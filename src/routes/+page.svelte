<script lang="ts">
    import { browser } from "$app/env";
    import { onMount } from "svelte";
    import {
        files,
        activePath,
        openTabs,
        dirtyPaths,
        openFile,
        closeTab,
        createFile,
        createFolder,
        renamePath,
        removePath,
        writeFile,
        resetWorkspace,
        join,
        basename,
        languageOf,
    } from "#lib/vfs.js";
    import type { VNode } from "#lib/vfs.js";
    import {
        projects,
        activeProjectId,
        activeEntry,
        initProjects,
        createProject,
        renameProject,
        duplicateProject,
        deleteProject,
        switchProject,
        setProjectEntry,
        clearAllProjects,
        defaultProjectName,
    } from "#lib/projects.js";
    import type { ProjectMeta } from "#lib/projects.js";
    import Monaco from "#lib/components/Monaco.svelte";
    import Preview from "#lib/components/Preview.svelte";
    import Explorer from "#lib/components/Explorer.svelte";
    import Icon from "#lib/components/Icon.svelte";
    import FileIcon from "#lib/components/FileIcon.svelte";

    let filesSnap = $state<Record<string, VNode>>({});
    let active = $state("/index.html");
    let tabs = $state<string[]>([]);
    let dirty = $state<Set<string>>(new Set());
    let projectsSnap = $state<ProjectMeta[]>([]);
    let activeProjectIdSnap = $state<string | null>(null);

    let projMenu = $state(false);
    let showNewProj = $state(false);
    let newProjName = $state("");
    let newProjTemplate = $state<"blank" | "seed" | "clone">("seed");
    let renameTarget = $state<string | null>(null);
    let renameDraft = $state("");

    let sideView = $state<"explorer" | "search" | "settings">("explorer");
    let sidebar = $state(true);
    let showPreview = $state(true);
    let autoReload = $state(true);
    let showPanel = $state(true);
    let panelTab = $state<"console" | "problems">("console");
    let logs = $state<{ kind: string; text: string }[]>([]);
    let entry = $state("/index.html");
    let query = $state("");
    let palette = $state(false);
    let paletteQ = $state("");
    let line = $state(1);
    let col = $state(1);
    let editorPct = $state(55);
    let previewZoomed = $state(false);
    let dragging = $state(false);
    let splitEl: HTMLElement | null = $state(null);
    let sashEl: HTMLElement | null = $state(null);
    let previewRef = $state<{
        refresh: () => void;
        openNewTab: () => void;
    } | null>(null);

    $effect(() => {
        const u1 = files.subscribe(
            (v: Record<string, VNode>) => (filesSnap = v),
        );
        const u2 = activePath.subscribe((v: string) => (active = v));
        const u3 = openTabs.subscribe((v: string[]) => (tabs = v));
        const u4 = dirtyPaths.subscribe((v: Set<string>) => (dirty = v));
        const u5 = projects.subscribe((v: ProjectMeta[]) => (projectsSnap = v));
        const u6 = activeProjectId.subscribe(
            (v: string | null) => (activeProjectIdSnap = v),
        );
        const u7 = activeEntry.subscribe((v: string) => (entry = v));
        return () => {
            u1();
            u2();
            u3();
            u4();
            u5();
            u6();
            u7();
        };
    });

    onMount(() => {
        initProjects();
    });

    const content = $derived(filesSnap[active]?.content ?? "");
    const htmlFiles = $derived(
        Object.keys(filesSnap)
            .filter((p) => p.endsWith(".html"))
            .sort(),
    );
    const activeProject = $derived(
        projectsSnap.find((p) => p.id === activeProjectIdSnap) ?? null,
    );
    const activeProjectName = $derived(activeProject?.name ?? "…");
    const problems = $derived(
        Object.entries(filesSnap)
            .filter(([, n]) => n.type === "file" && !n.content.trim())
            .map(([p]) => `Empty file: ${p}`),
    );
    const searchHits = $derived(
        !query.trim()
            ? []
            : Object.entries(filesSnap)
                  .filter(
                      ([, n]) =>
                          n.type === "file" &&
                          n.content.toLowerCase().includes(query.toLowerCase()),
                  )
                  .slice(0, 50),
    );
    const paletteFiles = $derived(
        Object.keys(filesSnap)
            .filter(
                (p) =>
                    filesSnap[p].type === "file" &&
                    p.toLowerCase().includes(paletteQ.toLowerCase()),
            )
            .slice(0, 20),
    );

    function onEdit(v: string) {
        if (v !== filesSnap[active]?.content) writeFile(active, v);
    }
    function autofocus(el: HTMLInputElement) {
        el.focus();
    }
    function activateOnKey(e: KeyboardEvent, fn: () => void) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fn();
        }
    }
    function onLog(kind: string, text: string) {
        logs = [...logs.slice(-199), { kind, text }];
        if (kind === "error") panelTab = "console";
    }
    function onEntryChange(v: string) {
        setProjectEntry(v);
    }
    function openNewProjectDialog() {
        newProjName = defaultProjectName();
        newProjTemplate = "seed";
        showNewProj = true;
        projMenu = false;
    }
    function confirmNewProject() {
        createProject(
            newProjName.trim() || defaultProjectName(),
            newProjTemplate,
        );
        showNewProj = false;
    }
    function startRenameProject(id: string, cur: string) {
        renameTarget = id;
        renameDraft = cur;
        projMenu = false;
    }
    function confirmRenameProject() {
        if (renameTarget && renameDraft.trim())
            renameProject(renameTarget, renameDraft.trim());
        renameTarget = null;
    }
    function doSwitchProject(id: string) {
        switchProject(id);
        projMenu = false;
    }
    function doDeleteProject(id: string, name: string) {
        if (!confirm(`Delete project "${name}"? This cannot be undone.`))
            return;
        deleteProject(id);
        projMenu = false;
    }
    function doCreateFile(dir: string, name: string) {
        createFile(
            join(dir, name),
            name.endsWith(".html") ? "<!-- new -->\n" : "",
        );
    }
    function doCreateFolder(dir: string, name: string) {
        createFolder(join(dir, name));
    }
    function togglePreviewZoom() {
        previewZoomed = !previewZoomed;
        if (previewZoomed) showPreview = true;
    }
    function sashPointerDown(e: PointerEvent) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        dragging = true;
        e.preventDefault();
        try {
            sashEl?.setPointerCapture?.(e.pointerId);
        } catch {
            /* noop */
        }
        try {
            document.body.style.userSelect = "none";
            document.body.style.cursor = "col-resize";
        } catch {
            /* noop */
        }
        applySashMove(e.clientX);
    }
    function applySashMove(clientX: number) {
        const el = splitEl;
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (!r.width) return;
        editorPct = Math.min(
            85,
            Math.max(15, ((clientX - r.left) / r.width) * 100),
        );
    }
    function sashPointerMove(e: PointerEvent) {
        if (!dragging) return;
        e.preventDefault();
        applySashMove(e.clientX);
    }
    function endSashDrag(e?: PointerEvent) {
        if (!dragging) return;
        dragging = false;
        try {
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        } catch {
            /* noop */
        }
        try {
            if (e && sashEl?.hasPointerCapture?.(e.pointerId))
                sashEl?.releasePointerCapture?.(e.pointerId);
        } catch {
            /* noop */
        }
    }

    if (browser) {
        window.addEventListener("keydown", (e) => {
            const mod = e.ctrlKey || e.metaKey;
            if (mod && e.key.toLowerCase() === "p" && !e.shiftKey) {
                e.preventDefault();
                paletteQ = "";
                palette = true;
            }
            if (mod && e.key.toLowerCase() === "b") {
                e.preventDefault();
                sidebar = !sidebar;
            }
            if (mod && e.key.toLowerCase() === "j") {
                e.preventDefault();
                showPanel = !showPanel;
            }
            if (e.key === "Escape") {
                if (previewZoomed) previewZoomed = false;
                else palette = false;
            }
        });
    }
</script>

<svelte:head>
    <title>Neverview v2 — VSCode-like HTML preview</title>
    <meta
        name="description"
        content="Client-side VSCode-like HTML preview with local Monaco and virtual file system."
    />
</svelte:head>

{#if browser}
    <div class="ide" class:preview-zoomed={previewZoomed}>
        <div class="titlebar">
            <div class="dots">
                <span style="background:#ff5f57"></span><span
                    style="background:#febc2e"
                ></span><span style="background:#28c840"></span>
            </div>
            <div class="menu">
                <span>File</span><span>Edit</span><span>View</span><span
                    >Run</span
                ><span>Help</span>
            </div>
            <div class="projwrap">
                <button
                    class="btn small ghost projbtn"
                    title="Switch project"
                    aria-label="Switch project"
                    onclick={() => (projMenu = !projMenu)}
                    ><Icon name="files" size={14} />
                    {activeProjectName}
                    <Icon name="chevron-down" size={14} /></button
                >
                {#if projMenu}
                    <button
                        class="veil"
                        aria-label="Close projects menu"
                        onclick={() => (projMenu = false)}
                        onkeydown={(e) => {
                            if (e.key === "Escape") projMenu = false;
                        }}
                    ></button>
                    <div class="projmenu" role="menu">
                        <div class="projmenu-head">
                            Projects ({projectsSnap.length})
                        </div>
                        {#each projectsSnap as p}
                            <div
                                class="projrow"
                                class:on={p.id === activeProjectIdSnap}
                            >
                                <button
                                    type="button"
                                    class="projname"
                                    title="Switch to {p.name}"
                                    onclick={() => doSwitchProject(p.id)}
                                >
                                    <span
                                        class="dot"
                                        class:on={p.id === activeProjectIdSnap}
                                    ></span>
                                    <span class="nm">{p.name}</span>
                                    <small
                                        >{new Date(
                                            p.updatedAt,
                                        ).toLocaleDateString()}</small
                                    >
                                </button>
                                <span class="projacts">
                                    <button
                                        class="iconbtn"
                                        title="Rename {p.name}"
                                        aria-label="Rename {p.name}"
                                        onclick={() =>
                                            startRenameProject(p.id, p.name)}
                                        ><Icon name="edit" size={14} /></button
                                    >
                                    <button
                                        class="iconbtn"
                                        title="Duplicate {p.name}"
                                        aria-label="Duplicate {p.name}"
                                        onclick={() => {
                                            duplicateProject(p.id);
                                            projMenu = false;
                                        }}
                                        ><Icon
                                            name="new-file"
                                            size={14}
                                        /></button
                                    >
                                    <button
                                        class="iconbtn danger"
                                        title="Delete {p.name}"
                                        aria-label="Delete {p.name}"
                                        onclick={() =>
                                            doDeleteProject(p.id, p.name)}
                                        ><Icon name="trash" size={14} /></button
                                    >
                                </span>
                            </div>
                        {/each}
                        <button
                            type="button"
                            class="opt newproj"
                            onclick={openNewProjectDialog}
                            >+ New project...</button
                        >
                    </div>
                {/if}
            </div>
            <div class="ttl">{active || "no file"} — Monaco + virtual FS</div>
            <div class="actions">
                <button
                    class="btn small ghost"
                    onclick={() => {
                        previewRef?.refresh();
                    }}><Icon name="play" size={14} /> Run</button
                >
                <button
                    class="btn small"
                    onclick={() => previewRef?.openNewTab()}
                    ><Icon name="link-external" size={14} /> Open preview</button
                >
            </div>
        </div>

        <div class="workbench">
            <div class="activity">
                <button
                    class:on={sideView === "explorer"}
                    title="Explorer (Ctrl+Shift+E)"
                    aria-label="Explorer"
                    onclick={() => {
                        sideView = "explorer";
                        sidebar = true;
                    }}><Icon name="files" size={22} /></button
                >
                <button
                    class:on={sideView === "search"}
                    title="Search (Ctrl+Shift+F)"
                    aria-label="Search"
                    onclick={() => {
                        sideView = "search";
                        sidebar = true;
                    }}><Icon name="search" size={22} /></button
                >
                <button
                    title="Toggle preview"
                    aria-label="Toggle preview"
                    onclick={() => (showPreview = !showPreview)}
                    ><Icon name="browser" size={22} /></button
                >
                <button
                    class:on={sideView === "settings"}
                    title="Settings"
                    aria-label="Settings"
                    onclick={() => {
                        sideView = "settings";
                        sidebar = true;
                    }}><Icon name="settings-gear" size={22} /></button
                >
                <div class="sp"></div>
                <button
                    title="Command palette (Ctrl+P)"
                    aria-label="Command palette"
                    onclick={() => (palette = true)}
                    ><Icon name="record-keys" size={22} /></button
                >
            </div>

            {#if sidebar}
                <div class="sidebar">
                    <div class="side-head">
                        <span
                            >{sideView.toUpperCase()} · {activeProjectName}</span
                        >
                        <span class="icons">
                            {#if sideView === "explorer"}
                                <button
                                    class="iconbtn"
                                    title="New file"
                                    onclick={() =>
                                        doCreateFile("/", "untitled.html")}
                                    ><Icon name="new-file" /></button
                                >
                                <button
                                    class="iconbtn"
                                    title="New project"
                                    aria-label="New project"
                                    onclick={openNewProjectDialog}
                                    ><Icon name="new-folder" /></button
                                >
                                <button
                                    class="iconbtn"
                                    title="Reset project files"
                                    onclick={() => {
                                        if (
                                            confirm(
                                                `Reset project "${activeProjectName}" to seed files?`,
                                            )
                                        )
                                            resetWorkspace();
                                    }}><Icon name="refresh" /></button
                                >
                            {/if}
                        </span>
                    </div>
                    <div class="side-body">
                        {#if sideView === "explorer"}
                            <div class="sec-title">
                                <Icon name="chevron-down" size={14} />
                                {activeProjectName} (localStorage)
                            </div>
                            <Explorer
                                files={filesSnap}
                                {active}
                                onOpen={openFile}
                                onCreateFile={doCreateFile}
                                onCreateFolder={doCreateFolder}
                                onRename={renamePath}
                                onDelete={removePath}
                            />
                        {:else if sideView === "search"}
                            <div class="searchbox">
                                <input
                                    placeholder="Search files…"
                                    bind:value={query}
                                />
                            </div>
                            {#each searchHits as [p, n]}
                                <button
                                    type="button"
                                    class="sres"
                                    onclick={() => openFile(p)}
                                    ><span>{p}</span><small
                                        >{n.content.slice(0, 80)}</small
                                    ></button
                                >
                            {/each}
                            {#if query && searchHits.length === 0}<div
                                    class="sres"
                                >
                                    <small>No results</small>
                                </div>{/if}
                        {:else}
                            <div class="searchbox">
                                <label
                                    ><input
                                        type="checkbox"
                                        bind:checked={autoReload}
                                    /> Auto-reload preview</label
                                >
                                <label
                                    ><input
                                        type="checkbox"
                                        bind:checked={showPreview}
                                    /> Show preview</label
                                >
                                <label
                                    ><input
                                        type="checkbox"
                                        bind:checked={showPanel}
                                    /> Show panel</label
                                >
                                <label
                                    >Entry HTML
                                    <select
                                        class="textin"
                                        bind:value={entry}
                                        onchange={() => onEntryChange(entry)}
                                    >
                                        {#each htmlFiles as h}<option value={h}
                                                >{h}</option
                                            >{/each}
                                    </select>
                                </label>
                                <button
                                    class="btn ghost"
                                    onclick={() => {
                                        if (
                                            confirm(
                                                `Clear ALL projects (${projectsSnap.length}) and reload?`,
                                            )
                                        ) {
                                            clearAllProjects();
                                            location.reload();
                                        }
                                    }}>Clear all projects</button
                                >
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}

            <div class="main">
                <div class="tabs" role="tablist">
                    {#each tabs as t}
                        <div
                            class="tab"
                            class:on={t === active}
                            role="tab"
                            tabindex="0"
                            aria-selected={t === active}
                            onclick={() => openFile(t)}
                            onkeydown={(e) =>
                                activateOnKey(e, () => openFile(t))}
                        >
                            <span class="tabname">
                                {#if dirty.has(t)}<Icon
                                        name="circle-filled"
                                        size={8}
                                        class="dirtydot"
                                    />{/if}
                                <span>{basename(t)}</span>
                            </span>
                            <button
                                class="x"
                                title="Close"
                                aria-label="Close {basename(t)}"
                                onclick={(e) => {
                                    e.stopPropagation();
                                    closeTab(t);
                                }}><Icon name="close" size={14} /></button
                            >
                        </div>
                    {/each}
                </div>
                {#if active}
                    <div class="crumbs">
                        <span
                            >{active.split("/").slice(0, -1).join(" › ") ||
                                "/"}</span
                        ><b>{basename(active)}</b><span style="margin-left:auto"
                            >{languageOf(active)} · Ln {line}, Col {col}</span
                        >
                    </div>
                {/if}
                <div class="split" bind:this={splitEl}>
                    <div class="editorpane" style={showPreview ? `flex: 0 0 ${editorPct}%` : "flex: 1 1 0%"}>
                        {#if active && filesSnap[active]}
                            <Monaco
                                path={active}
                                {content}
                                onChange={onEdit}
                                onCursor={(l: number, c: number) => {
                                    line = l;
                                    col = c;
                                }}
                            />
                        {:else}
                            <div class="empty">
                                <h2>No file open</h2>
                                <p>
                                    <kbd>Ctrl+P</kbd> to open a file, or create one
                                    in Explorer.
                                </p>
                            </div>
                        {/if}
                    </div>
                    {#if showPreview}
                        <div
                            class="sash"
                            class:drag={dragging}
                            role="slider"
                            tabindex="0"
                            aria-orientation="vertical"
                            aria-label="Resize editor and preview"
                            aria-valuenow={Math.round(editorPct)}
                            aria-valuemin={15}
                            aria-valuemax={85}
                            bind:this={sashEl}
                            onpointerdown={sashPointerDown}
                            onpointermove={sashPointerMove}
                            onpointerup={(e) => endSashDrag(e)}
                            onpointercancel={(e) => endSashDrag(e)}
                            ondblclick={() => (editorPct = 55)}
                            onkeydown={(e) => {
                                if (e.key === "ArrowLeft")
                                    editorPct = Math.max(15, editorPct - 2);
                                if (e.key === "ArrowRight")
                                    editorPct = Math.min(85, editorPct + 2);
                            }}
                        ></div>
                        <div
                            class="previewpane"
                            style={`flex: 0 0 ${100 - editorPct}%`}
                            class:dragging
                        >
                            <Preview
                                files={filesSnap}
                                {entry}
                                projectId={activeProjectIdSnap}
                                auto={autoReload}
                                {onLog}
                                zoomed={previewZoomed}
                                onToggleZoom={togglePreviewZoom}
                                bind:this={previewRef}
                            />
                        </div>
                    {/if}
                </div>
                {#if dragging}
                    <div class="dragveil" aria-hidden="true"></div>
                {/if}
                {#if showPanel}
                    <div class="panel">
                        <div class="paneltabs">
                            <button
                                class:on={panelTab === "console"}
                                onclick={() => (panelTab = "console")}
                                >Console ({logs.length})</button
                            >
                            <button
                                class:on={panelTab === "problems"}
                                onclick={() => (panelTab = "problems")}
                                >Problems ({problems.length})</button
                            >
                            <span style="flex:1"></span>
                            <button onclick={() => (logs = [])}>Clear</button>
                            <button
                                onclick={() => (showPanel = false)}
                                title="Close panel"
                                aria-label="Close panel"
                                ><Icon name="close" size={14} /></button
                            >
                        </div>
                        <div class="panelbody">
                            {#if panelTab === "console"}
                                {#each logs as l}<div class="logline {l.kind}">
                                        [{l.kind}] {l.text}
                                    </div>{/each}
                                {#if logs.length === 0}<div
                                        class="logline info"
                                    >
                                        console output from the preview iframe
                                        appears here.
                                    </div>{/if}
                            {:else}
                                {#each problems as p}<div class="logline warn">
                                        {p}
                                    </div>{/each}
                                {#if problems.length === 0}<div
                                        class="logline info"
                                    >
                                        No problems.
                                    </div>{/if}
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>
        </div>

        <div class="statusbar">
            <span class="it"
                ><Icon name="git-branch" size={14} /> {activeProjectName}*</span
            >
            <button
                type="button"
                class="it"
                onclick={() => {
                    if (confirm(`Reset project "${activeProjectName}"?`))
                        resetWorkspace();
                }}
                ><Icon name="refresh" size={14} />
                {Object.keys(filesSnap).length} files · {projectsSnap.length} projects</button
            >
            <span class="right">
                <span class="it">{active ? languageOf(active) : "--"}</span>
                <span class="it">Ln {line}, Col {col}</span>
                <span class="it">monaco 0.57.0</span>
                <span class="it"><Icon name="check" size={14} /> CF worker</span
                >
            </span>
        </div>
    </div>
{/if}

{#if palette}
    <div
        class="palette-veil"
        role="button"
        tabindex="0"
        aria-label="Close command palette"
        onclick={() => (palette = false)}
        onkeydown={(e) => {
            if (e.key === "Escape") palette = false;
        }}
    >
        <div
            class="palette"
            role="dialog"
            aria-label="Command palette"
            tabindex="0"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
        >
            <input
                use:autofocus
                placeholder="> Type file name or command"
                bind:value={paletteQ}
                onkeydown={(e) => {
                    if (e.key === "Enter" && paletteFiles[0]) {
                        openFile(paletteFiles[0]);
                        palette = false;
                    }
                }}
            />
            <div class="opts">
                {#each paletteFiles as p}<button
                        type="button"
                        class="opt"
                        onclick={() => {
                            openFile(p);
                            palette = false;
                        }}
                        ><FileIcon name={basename(p)} />
                        {p}<small>file</small></button
                    >{/each}
                {#each projectsSnap.filter((m) => m.name
                        .toLowerCase()
                        .includes(paletteQ.toLowerCase())) as m}<button
                        type="button"
                        class="opt"
                        onclick={() => {
                            doSwitchProject(m.id);
                            palette = false;
                        }}
                        ><Icon name="files" />
                        {m.name}<small
                            >project{m.id === activeProjectIdSnap
                                ? " · active"
                                : ""}</small
                        ></button
                    >{/each}
                <button
                    type="button"
                    class="opt"
                    onclick={() => {
                        openNewProjectDialog();
                        palette = false;
                    }}
                    ><Icon name="new-folder" /> New project...<small>cmd</small
                    ></button
                >
                <button
                    type="button"
                    class="opt"
                    onclick={() => {
                        showPreview = !showPreview;
                        palette = false;
                    }}
                    ><Icon name="browser" /> Toggle preview<small>cmd</small
                    ></button
                >
                <button
                    type="button"
                    class="opt"
                    onclick={() => {
                        togglePreviewZoom();
                        palette = false;
                    }}
                    ><Icon
                        name={previewZoomed
                            ? "fullscreen-exit"
                            : "fullscreen"}
                    />
                    {previewZoomed ? "Exit preview zoom" : "Zoom preview"}<small
                        >cmd</small
                    ></button
                >
                <button
                    type="button"
                    class="opt"
                    onclick={() => {
                        previewRef?.openNewTab();
                        palette = false;
                    }}
                    ><Icon name="link-external" /> Open preview in new tab<small
                        >cmd</small
                    ></button
                >
                <button
                    type="button"
                    class="opt"
                    onclick={() => {
                        if (confirm("Reset?")) resetWorkspace();
                        palette = false;
                    }}
                    ><Icon name="refresh" /> Reset project files<small
                        >cmd</small
                    ></button
                >
            </div>
        </div>
    </div>
{/if}

{#if showNewProj}
    <div
        class="palette-veil"
        role="button"
        tabindex="0"
        aria-label="Close new project dialog"
        onclick={() => (showNewProj = false)}
        onkeydown={(e) => {
            if (e.key === "Escape") showNewProj = false;
        }}
    >
        <div
            class="dlg"
            role="dialog"
            aria-label="New project"
            tabindex="0"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
        >
            <div class="dlg-title">New project</div>
            <div class="dlg-body">
                <input
                    class="dlg-input"
                    use:autofocus
                    placeholder="Project name"
                    bind:value={newProjName}
                    onkeydown={(e) => {
                        if (e.key === "Enter") confirmNewProject();
                    }}
                />
                <div class="radio-list">
                    <label class="radio-row"
                        ><input
                            type="radio"
                            name="tpl"
                            value="seed"
                            bind:group={newProjTemplate}
                        /><span
                            ><span class="rtitle">Seed</span><br /><span
                                class="rdesc"
                                >Starter files (index.html / style.css / app.js)</span
                            ></span
                        ></label
                    >
                    <label class="radio-row"
                        ><input
                            type="radio"
                            name="tpl"
                            value="blank"
                            bind:group={newProjTemplate}
                        /><span
                            ><span class="rtitle">Blank</span><br /><span
                                class="rdesc">Minimal index.html</span
                            ></span
                        ></label
                    >
                    <label class="radio-row"
                        ><input
                            type="radio"
                            name="tpl"
                            value="clone"
                            bind:group={newProjTemplate}
                        /><span
                            ><span class="rtitle">Clone current</span><br
                            /><span class="rdesc"
                                >Copy files from active project</span
                            ></span
                        ></label
                    >
                </div>
                <div class="dlg-actions">
                    <button
                        type="button"
                        class="btn ghost"
                        onclick={() => (showNewProj = false)}>Cancel</button
                    >
                    <button
                        type="button"
                        class="btn"
                        onclick={confirmNewProject}>Create</button
                    >
                </div>
            </div>
        </div>
    </div>
{/if}

{#if renameTarget}
    <div
        class="palette-veil"
        role="button"
        tabindex="0"
        aria-label="Close rename dialog"
        onclick={() => (renameTarget = null)}
        onkeydown={(e) => {
            if (e.key === "Escape") renameTarget = null;
        }}
    >
        <div
            class="dlg"
            role="dialog"
            aria-label="Rename project"
            tabindex="0"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
        >
            <div class="dlg-title">Rename project</div>
            <div class="dlg-body">
                <input
                    class="dlg-input"
                    use:autofocus
                    placeholder="Project name"
                    bind:value={renameDraft}
                    onkeydown={(e) => {
                        if (e.key === "Enter") confirmRenameProject();
                    }}
                />
                <div class="dlg-actions">
                    <button
                        type="button"
                        class="btn ghost"
                        onclick={() => (renameTarget = null)}>Cancel</button
                    >
                    <button
                        type="button"
                        class="btn"
                        onclick={confirmRenameProject}>Rename</button
                    >
                </div>
            </div>
        </div>
    </div>
{/if}
