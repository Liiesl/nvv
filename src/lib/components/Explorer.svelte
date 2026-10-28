<script lang="ts">
    import { buildTree, basename, type VNode } from "#lib/vfs.js";
    import Icon from "./Icon.svelte";
    import FileIcon from "./FileIcon.svelte";

    let {
        files,
        active,
        onOpen,
        onCreateFile,
        onCreateFolder,
        onRename,
        onDelete,
    }: {
        files: Record<string, VNode>;
        active: string;
        onOpen: (p: string) => void;
        onCreateFile: (dir: string, name: string) => void;
        onCreateFolder: (dir: string, name: string) => void;
        onRename: (oldP: string, newP: string) => void;
        onDelete: (p: string) => void;
    } = $props();

    let expanded = $state<Set<string>>(new Set(["/"]));
    let creating = $state<{ dir: string; kind: "file" | "dir" } | null>(null);
    let renaming = $state<string | null>(null);
    let draft = $state("");
    let ctx = $state<{
        x: number;
        y: number;
        path: string;
        type: "file" | "dir";
    } | null>(null);

    const tree = $derived(buildTree(files));

    function toggle(p: string) {
        const n = new Set(expanded);
        if (n.has(p)) n.delete(p);
        else n.add(p);
        expanded = n;
    }
    function startCreate(dir: string, kind: "file" | "dir") {
        const n = new Set(expanded);
        n.add(dir);
        expanded = n;
        creating = { dir, kind };
        draft = "";
    }
    function commitCreate() {
        if (!creating || !draft.trim()) {
            creating = null;
            return;
        }
        try {
            if (creating.kind === "file")
                onCreateFile(creating.dir, draft.trim());
            else onCreateFolder(creating.dir, draft.trim());
        } catch {
            /* exists */
        }
        creating = null;
    }
    function commitRename(oldP: string) {
        if (!renaming) return;
        const d = oldP.slice(0, oldP.lastIndexOf("/")) || "/";
        const np = (d === "/" ? "/" : d + "/") + draft.trim();
        if (draft.trim() && np !== oldP) {
            try {
                onRename(oldP, np);
            } catch {
                /* exists */
            }
        }
        renaming = null;
    }
    function autofocus(el: HTMLInputElement) {
        el.focus();
    }
    function onRowKey(e: KeyboardEvent, fn: () => void) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fn();
        }
    }
</script>

<div class="tree">
    {#snippet node(
        n: {
            path: string;
            name: string;
            type: "file" | "dir";
            children: typeof tree;
        },
        depth: number,
    )}
        <div class="tnode">
            {#if n.type === "dir"}
                <div
                    class="trow"
                    class:on={false}
                    style={`padding-left:${8 + depth * 8}px`}
                    role="treeitem"
                    tabindex="0"
                    aria-expanded={expanded.has(n.path)}
                    aria-selected="false"
                    onclick={() => toggle(n.path)}
                    onkeydown={(e) => onRowKey(e, () => toggle(n.path))}
                    oncontextmenu={(e) => {
                        e.preventDefault();
                        ctx = {
                            x: e.clientX,
                            y: e.clientY,
                            path: n.path,
                            type: "dir",
                        };
                    }}
                >
                    <span class="car"
                        ><Icon
                            name={expanded.has(n.path)
                                ? "chevron-down"
                                : "chevron-right"}
                            size={14}
                        /></span
                    >
                    <span class="ic"
                        ><FileIcon
                            name={n.name}
                            type="dir"
                            expanded={expanded.has(n.path)}
                        /></span
                    >
                    <span class="nm"
                        >{n.path === "/" ? "EXPLORER" : basename(n.path)}</span
                    >
                    <span class="rowact">
                        <button
                            class="iconbtn"
                            title="New file"
                            onclick={(e) => {
                                e.stopPropagation();
                                startCreate(n.path, "file");
                            }}><Icon name="new-file" /></button
                        >
                        <button
                            class="iconbtn"
                            title="New folder"
                            onclick={(e) => {
                                e.stopPropagation();
                                startCreate(n.path, "dir");
                            }}><Icon name="new-folder" /></button
                        >
                    </span>
                </div>
                {#if creating?.dir === n.path}
                    <div
                        style={`padding-left:${26 + depth * 8}px`}
                        class="trow"
                    >
                        <input
                            use:autofocus
                            value={draft}
                            oninput={(e) =>
                                (draft = (e.target as HTMLInputElement).value)}
                            onkeydown={(e) => {
                                if (e.key === "Enter") commitCreate();
                                if (e.key === "Escape") creating = null;
                            }}
                            placeholder={creating.kind === "file"
                                ? "file.ts"
                                : "folder"}
                            onblur={commitCreate}
                        />
                    </div>
                {/if}
                {#if expanded.has(n.path)}
                    <div class="tkids">
                        {#each n.children as c}
                            {@render node(c, depth + 1)}
                        {/each}
                    </div>
                {/if}
            {:else}
                <div
                    class="trow"
                    class:on={active === n.path}
                    style={`padding-left:${26 + depth * 8}px`}
                    role="treeitem"
                    tabindex="0"
                    aria-selected={active === n.path}
                    onclick={() => onOpen(n.path)}
                    onkeydown={(e) => onRowKey(e, () => onOpen(n.path))}
                    ondblclick={() => {
                        renaming = n.path;
                        draft = basename(n.path);
                    }}
                    oncontextmenu={(e) => {
                        e.preventDefault();
                        ctx = {
                            x: e.clientX,
                            y: e.clientY,
                            path: n.path,
                            type: "file",
                        };
                    }}
                >
                    <span class="ic"
                        ><FileIcon name={n.name} type="file" /></span
                    >
                    {#if renaming === n.path}
                        <input
                            use:autofocus
                            value={draft}
                            oninput={(e) =>
                                (draft = (e.target as HTMLInputElement).value)}
                            onclick={(e) => e.stopPropagation()}
                            onkeydown={(e) => {
                                if (e.key === "Enter") commitRename(n.path);
                                if (e.key === "Escape") renaming = null;
                            }}
                            onblur={() => commitRename(n.path)}
                        />
                    {:else}
                        <span class="nm">{n.name}</span>
                    {/if}
                </div>
            {/if}
        </div>
    {/snippet}
    {#each tree as n}
        {@render node(n, 0)}
    {/each}
</div>

{#if ctx}
    <button
        class="veil"
        aria-label="Close menu"
        style="position:fixed;inset:0;z-index:59;background:transparent;border:none;cursor:default"
        onclick={() => (ctx = null)}
        oncontextmenu={(e) => {
            e.preventDefault();
            ctx = null;
        }}
        onkeydown={(e) => {
            if (e.key === "Escape") ctx = null;
        }}
    ></button>
    <div class="ctx" role="menu" style={`left:${ctx.x}px;top:${ctx.y}px`}>
        {#if ctx.type === "dir"}
            <button
                onclick={() => {
                    startCreate(ctx!.path, "file");
                    ctx = null;
                }}><Icon name="new-file" /> New File</button
            >
            <button
                onclick={() => {
                    startCreate(ctx!.path, "dir");
                    ctx = null;
                }}><Icon name="new-folder" /> New Folder</button
            >
        {/if}
        <button
            onclick={() => {
                renaming = ctx!.path;
                draft = basename(ctx!.path);
                ctx = null;
            }}><Icon name="edit" /> Rename</button
        >
        <button
            class="danger"
            onclick={() => {
                onDelete(ctx!.path);
                ctx = null;
            }}><Icon name="trash" /> Delete</button
        >
    </div>
{/if}
