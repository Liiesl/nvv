<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { buildPreview, type BuiltPreview } from "#lib/preview.js";
    import type { VNode } from "#lib/vfs.js";
    import type { InspectPayload } from "#lib/inspect.js";
    import { isInspectKind } from "#lib/inspect.js";

    const BLOB_PREFIX = "neverview:project:";
    const INDEX_KEY = "neverview:projects:v1";
    const ACTIVE_KEY = "neverview:activeProject:v1";
    const CH_NAME = "neverview:preview";

    interface ProjectMeta {
        id: string;
        name: string;
        entry: string;
    }

    interface ProjectBlob {
        files: Record<string, VNode>;
        openTabs: string[];
        activePath: string;
    }

    let projectId = $state<string | null>(null);
    let projectName = $state("…");
    let entry = $state("/index.html");
    let userOverrodeEntry = $state(false);
    let live = $state(true);
    let error = $state("");
    let warnings = $state<string[]>([]);
    let snapshot = $state<Record<string, VNode> | null>(null);
    let built = $state<BuiltPreview | null>(null);
    let status = $state("loading…");

    let timer: ReturnType<typeof setTimeout> | null = null;
    let channel: BroadcastChannel | null = null;
    let frame: HTMLIFrameElement | null = $state(null);
    let inspectOn = $state(false);
    let hover = $state<InspectPayload | null>(null);
    let selected = $state<InspectPayload | null>(null);

    const htmlFiles = $derived(
        snapshot
            ? Object.keys(snapshot)
                  .filter(
                      (p) => p.endsWith(".html") && snapshot?.[p]?.type === "file",
                  )
                  .sort()
            : [],
    );

    function readMeta(id: string): ProjectMeta | null {
        try {
            const raw = localStorage.getItem(INDEX_KEY);
            if (!raw) return null;
            const arr = JSON.parse(raw) as ProjectMeta[];
            return arr.find((m) => m.id === id) ?? null;
        } catch {
            return null;
        }
    }

    function readBlob(id: string): ProjectBlob | null {
        try {
            const raw = localStorage.getItem(BLOB_PREFIX + id);
            if (!raw) return null;
            return JSON.parse(raw) as ProjectBlob;
        } catch {
            return null;
        }
    }

    function rebuild() {
        if (!snapshot) return;
        try {
            built = buildPreview(snapshot, entry, built ?? undefined);
            warnings = built.warnings;
            status = `updated ${new Date().toLocaleTimeString()}`;
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        }
    }

    function schedule() {
        if (!live) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(rebuild, 300);
    }

    function reloadFromStorage() {
        if (!projectId) {
            error =
                "No project specified. Open via the editor's “Open preview” button.";
            return;
        }
        const blob = readBlob(projectId);
        if (!blob || !blob.files) {
            error =
                "This project is gone (deleted or cleared). This tab stays pinned and will not follow other projects.";
            return;
        }
        error = "";
        snapshot = blob.files;
        const meta = readMeta(projectId);
        if (meta) {
            projectName = meta.name || "…";
            if (!userOverrodeEntry && meta.entry) entry = meta.entry;
        }
        schedule();
    }

    function onStorage(e: StorageEvent) {
        if (!projectId) return;
        if (e.key === BLOB_PREFIX + projectId || e.key === INDEX_KEY) {
            reloadFromStorage();
        }
    }

    function sendInspect() {
        try {
            frame?.contentWindow?.postMessage(
                { __nv: 2, type: inspectOn ? "inspect-on" : "inspect-off" },
                "*",
            );
        } catch {
            /* noop */
        }
        if (!inspectOn) {
            try {
                const doc = frame?.contentDocument;
                const ov = doc?.querySelector?.(
                    '[data-nv-inspect="overlay"]',
                ) as HTMLElement | null;
                const lb = doc?.querySelector?.(
                    '[data-nv-inspect="label"]',
                ) as HTMLElement | null;
                if (ov) ov.style.display = "none";
                if (lb) lb.style.display = "none";
            } catch {
                /* noop */
            }
        }
    }

    function toggleInspect() {
        inspectOn = !inspectOn;
        hover = null;
        if (!inspectOn) selected = null;
        sendInspect();
    }

    async function copyText(text: string) {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            /* noop */
        }
    }

    onMount(() => {
        const q = new URLSearchParams(location.search);
        const qp = q.get("project");
        const qe = q.get("entry");
        live = q.get("live") !== "0";
        if (qe) entry = qe;
        try {
            projectId = qp || localStorage.getItem(ACTIVE_KEY);
        } catch {
            projectId = qp;
        }
        reloadFromStorage();
        window.addEventListener("storage", onStorage);
        const onMsg = (e: MessageEvent) => {
            const d = e.data as {
                __nv?: number;
                kind?: string;
                tag?: string;
                id?: string;
                classes?: string[];
                selector?: string;
                width?: number;
                height?: number;
                outerHtml?: string;
            } | null;
            if (!d || d.__nv !== 1 || !isInspectKind(d.kind)) return;
            if (d.kind === "inspect-hover") {
                hover = {
                    tag: d.tag ?? "?",
                    id: d.id ?? "",
                    classes: d.classes ?? [],
                    selector: d.selector ?? "",
                    width: d.width ?? 0,
                    height: d.height ?? 0,
                    outerHtml: d.outerHtml ?? "",
                };
            } else if (d.kind === "inspect-select") {
                const info: InspectPayload = {
                    tag: d.tag ?? "?",
                    id: d.id ?? "",
                    classes: d.classes ?? [],
                    selector: d.selector ?? "",
                    width: d.width ?? 0,
                    height: d.height ?? 0,
                    outerHtml: d.outerHtml ?? "",
                };
                selected = info;
                hover = info;
            } else if (d.kind === "inspect-escape") {
                inspectOn = false;
                hover = null;
                selected = null;
                sendInspect();
            } else if (d.kind === "inspect-leave") {
                hover = null;
            }
        };
        const onKey = (e: KeyboardEvent) => {
            const mod = e.ctrlKey || e.metaKey;
            if (mod && e.shiftKey && e.key.toLowerCase() === "c") {
                e.preventDefault();
                toggleInspect();
            } else if (e.key === "Escape" && inspectOn) {
                inspectOn = false;
                hover = null;
                selected = null;
                sendInspect();
            }
        };
        window.addEventListener("message", onMsg);
        window.addEventListener("keydown", onKey);
        try {
            channel = new BroadcastChannel(CH_NAME);
            channel.onmessage = (ev) => {
                const d = ev.data as { projectId?: string } | null;
                if (!d || (d.projectId && d.projectId !== projectId)) return;
                reloadFromStorage();
            };
        } catch {
            channel = null;
        }
        return () => {
            window.removeEventListener("message", onMsg);
            window.removeEventListener("keydown", onKey);
        };
    });

    onDestroy(() => {
        window.removeEventListener("storage", onStorage);
        if (timer) clearTimeout(timer);
        try {
            channel?.close();
        } catch {
            /* noop */
        }
        if (built)
            for (const u of built.urls)
                try {
                    URL.revokeObjectURL(u);
                } catch {
                    /* noop */
                }
    });
</script>

<svelte:head>
    <title>Pinned preview — {projectName} {entry}</title>
</svelte:head>

<div class="wrap">
    <header class="bar">
        <strong class="proj">Pinned: {projectName}</strong>
        <select
            bind:value={entry}
            onchange={() => {
                userOverrodeEntry = true;
                schedule();
            }}
            aria-label="Entry HTML"
        >
            {#if entry && !htmlFiles.includes(entry)}<option value={entry}
                    >{entry} (missing)</option
                >{/if}
            {#each htmlFiles as h}<option value={h}>{h}</option>{/each}
        </select>
        <label class="live"
            ><input
                type="checkbox"
                bind:checked={live}
                onchange={() => {
                    if (live) reloadFromStorage();
                }}
            /> Live</label
        >
        <button
            class="btn"
            class:on={inspectOn}
            onclick={toggleInspect}
            title="Inspect: hover highlight (Ctrl+Shift+C)"
            aria-pressed={inspectOn}>Inspect</button
        >
        <button
            class="btn"
            onclick={() => {
                reloadFromStorage();
                rebuild();
            }}>Refresh</button
        >
        <span class="status">{error || status}</span>
    </header>
    {#if inspectOn}
        <div class="inspectbar" role="status">
            {#if selected ?? hover}
                {@const info = selected ?? hover}
                <span class="tag">{info?.tag}</span>
                {#if info?.id}<span class="iid">#{info.id}</span>{/if}
                {#if info?.classes?.length}<span class="cls"
                        >.{info.classes.slice(0, 3).join(".")}</span
                    >{/if}
                <span class="dims">{info?.width}x{info?.height}</span>
                <code class="sel">{info?.selector}</code>
                <span class="sp"></span>
                <button
                    class="mini"
                    onclick={() => info && copyText(info.selector)}
                    >Copy selector</button
                >
                <button
                    class="mini"
                    onclick={() => info && copyText(info.outerHtml)}
                    >Copy HTML</button
                >
            {:else}
                <span class="hint"
                    >Hover page to highlight — click to pin. Esc to exit.</span
                >
            {/if}
        </div>
    {/if}
    {#if error}<p class="err">{error}</p>{/if}
    {#if built}
        <iframe
            class="frame"
            bind:this={frame}
            title="pinned preview"
            src={built.entryUrl}
            onload={sendInspect}
            sandbox="allow-scripts allow-same-origin allow-modals allow-forms allow-popups"
        ></iframe>
    {/if}
    {#if warnings.length}
        <ul class="warns">
            {#each warnings as w}<li>{w}</li>{/each}
        </ul>
    {/if}
</div>

<style>
    .wrap {
        display: flex;
        flex-direction: column;
        height: 100vh;
        background: #14171f;
        color: #e8e6df;
        font-family: system-ui, sans-serif;
    }
    .bar {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border-bottom: 1px solid #2a3345;
        font-size: 0.85rem;
    }
    .proj {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 30vw;
    }
    select {
        background: #1a212f;
        color: inherit;
        border: 1px solid #2a3345;
        border-radius: 6px;
        padding: 4px 8px;
        max-width: 30vw;
    }
    .live {
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
    }
    .btn {
        background: #1a212f;
        color: inherit;
        border: 1px solid #2a3345;
        border-radius: 6px;
        padding: 4px 10px;
        cursor: pointer;
    }
    .status {
        margin-left: auto;
        color: #9aa3b2;
        white-space: nowrap;
    }
    .err {
        margin: 0;
        padding: 10px 14px;
        background: #3a1f1f;
        border-bottom: 1px solid #5a2b2b;
    }
    .frame {
        flex: 1;
        border: 0;
        background: #fff;
        min-height: 0;
    }
    .warns {
        margin: 0;
        padding: 6px 14px;
        font-size: 0.75rem;
        color: #9aa3b2;
        border-top: 1px solid #2a3345;
        max-height: 5em;
        overflow: auto;
    }
</style>
