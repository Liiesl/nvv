<script lang="ts">
	import Icon from "#lib/components/Icon.svelte";
	import { ide } from "#lib/ide/ide.svelte.js";
	import { basename } from "#lib/vfs.js";
	import { menuKeys, focusFirstMenuItem, watchOutside } from "#lib/ide/menus/menu.js";

	let titleMenuEl: HTMLElement | null = $state(null);
	let menubarEl: HTMLElement | null = $state(null);
	let projWrapEl: HTMLElement | null = $state(null);
	let projMenuEl: HTMLElement | null = $state(null);
	let layoutWrapEl: HTMLElement | null = $state(null);
	let layoutMenuEl: HTMLElement | null = $state(null);

	function titleAnchor(el: HTMLElement | null) {
		if (!el || typeof window === "undefined") return null;
		const r = el.getBoundingClientRect();
		return { x: Math.max(8, Math.min(r.left, window.innerWidth - 300)), y: r.bottom + 4 };
	}

	function toggleTitle(m: string, el: HTMLElement | null) {
		ide.openTitleMenu(m, titleAnchor(el));
	}

	function hoverTitle(m: string, el: HTMLElement | null) {
		if (ide.titleMenu && ide.titleMenu !== m) {
			ide.titleMenu = m;
			ide.titleMenuPos = titleAnchor(el);
		}
	}

	$effect(() => {
		void ide.titleMenu;
		if (ide.titleMenu && titleMenuEl) focusFirstMenuItem(titleMenuEl);
	});

	// Outside-click dismissal without a veil overlay (a veil would cover
	// the other menubuttons and force close-first-then-open on switch).
	$effect(() => {
		if (!ide.titleMenu) return;
		return watchOutside(
			() => [titleMenuEl, menubarEl],
			() => ide.closeAllMenus(),
		);
	});
	$effect(() => {
		if (!ide.projMenu) return;
		return watchOutside(
			() => [projMenuEl, projWrapEl],
			() => ide.closeAllMenus(),
		);
	});
	$effect(() => {
		if (!ide.layoutMenu) return;
		return watchOutside(
			() => [layoutMenuEl, layoutWrapEl],
			() => ide.closeAllMenus(),
		);
	});
</script>

<div class="titlebar" data-tauri-drag-region>
	<div class="appicon" title="Neverview v2 — VS Code-like" aria-hidden="true">
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
			><path
				fill="#23A9F2"
				d="M17.5 3 3.8 10.2c-.4.3-.4.9 0 1.2l3.4 2.1 2.2-2.2 2.1 2.1 2.1-2.1 2.1 2.1 5.8-3.6c.6-.4.6-1.2 0-1.6L17.5 3Z"
			/><path fill="#007ACC" d="m9.4 12.4-2.2 2.2 10.3 6.4c.6.4 1.4 0 1.4-.8V4.6L9.4 12.4Z" /></svg
		>
	</div>
	<div class="menu" role="menubar" aria-label="Application menu" bind:this={menubarEl}>
		{#each ["File", "Edit", "Selection", "View", "Go", "Run", "Terminal", "Help"] as m}
			<button
				type="button"
				class="menubtn"
				class:on={ide.titleMenu === m}
				aria-haspopup="menu"
				aria-expanded={ide.titleMenu === m}
				onmouseenter={(e) => hoverTitle(m, e.currentTarget as HTMLElement)}
				onclick={(e) => toggleTitle(m, e.currentTarget as HTMLElement)}>{m}</button
			>
		{/each}
		{#if ide.titleMenu}
			<div
				class="titlemenu"
				role="menu"
				tabindex="-1"
				aria-label={ide.titleMenu}
				bind:this={titleMenuEl}
				style={ide.titleMenuPos
					? `left:${ide.titleMenuPos.x}px;top:${ide.titleMenuPos.y}px`
					: undefined}
				onkeydown={(e) => menuKeys(e, titleMenuEl, () => ide.closeAllMenus())}
			>
				{#if ide.titleMenu === "File"}
					<button
						onclick={() => {
							ide.doCreateFile("/", "untitled.html");
							ide.titleMenu = null;
						}}><span>New File…</span> <small>Ctrl+N</small></button
					>
					<button
						onclick={() => {
							ide.openNewProjectDialog();
							ide.titleMenu = null;
						}}><span>New Project…</span></button
					>
					<div class="sep"></div>
					<button
						onclick={() => {
							const g = ide.groups[ide.activeGroupId];
							if (g && g.active >= 0) ide.closeTabInGroup(ide.activeGroupId, g.active);
							ide.titleMenu = null;
						}}><span>Close Tab</span> <small>Ctrl+W</small></button
					>
					<button
						onclick={() => {
							ide.runPaletteCommand("close-others");
							ide.titleMenu = null;
						}}><span>Close Others in Group</span></button
					>
					<button
						onclick={() => {
							ide.runPaletteCommand("close-all");
							ide.titleMenu = null;
						}}><span>Close All in Group</span></button
					>
					<div class="sep"></div>
					<button
						onclick={() => {
							ide.toast("Workspace autosaves to localStorage");
							ide.titleMenu = null;
						}}
						><span style="display:flex;align-items:center;gap:6px"
							><Icon name="check" size={13} />Auto Save</span
						></button
					>
				{:else if ide.titleMenu === "Edit"}
					<button
						onclick={() => {
							ide.paletteQ = "> ";
							ide.palette = true;
							ide.titleMenu = null;
						}}><span>Command Palette…</span> <small>Ctrl+Shift+P</small></button
					>
					<button
						onclick={() => {
							ide.gotoDraft = String(ide.cursorFor(ide.activeGroupId).line);
							ide.gotoOpen = true;
							ide.titleMenu = null;
						}}><span>Go to Line…</span> <small>Ctrl+G</small></button
					>
					<button
						onclick={() => {
							ide.langPick = true;
							ide.titleMenu = null;
						}}><span>Change Language Mode</span></button
					>
				{:else if ide.titleMenu === "Selection"}
					<button
						onclick={() => {
							ide.toast("Select All — use editor (Ctrl+A)");
							ide.titleMenu = null;
						}}><span>Select All</span> <small>Ctrl+A</small></button
					>
					<button
						onclick={() => {
							ide.query = basename(ide.active ?? "");
							ide.sideView = "search";
							ide.sidebar = true;
							ide.titleMenu = null;
						}}><span>Find in Files</span> <small>Ctrl+Shift+F</small></button
					>
					<button
						onclick={() => {
							ide.replaceQ = "";
							ide.sideView = "search";
							ide.sidebar = true;
							ide.titleMenu = null;
						}}><span>Replace in Files</span> <small>Ctrl+Shift+H</small></button
					>
				{:else if ide.titleMenu === "View"}
					<button
						onclick={() => {
							ide.sidebar = !ide.sidebar;
							ide.titleMenu = null;
						}}
						><span style="display:flex;align-items:center;gap:6px"
							>{#if ide.sidebar}<Icon name="check" size={13} />{:else}<span
									style="width:13px;height:13px;display:inline-block"
								></span>{/if}Primary Side Bar</span
						> <small>Ctrl+B</small></button
					>
					<button
						onclick={() => {
							ide.showPanel = !ide.showPanel;
							ide.titleMenu = null;
						}}
						><span style="display:flex;align-items:center;gap:6px"
							>{#if ide.showPanel}<Icon name="check" size={13} />{:else}<span
									style="width:13px;height:13px;display:inline-block"
								></span>{/if}Panel</span
						> <small>Ctrl+J</small></button
					>
					<button
						onclick={() => {
							ide.togglePreviewTab();
							ide.titleMenu = null;
						}}
						><span style="display:flex;align-items:center;gap:6px"
							>{#if ide.hasPreviewOpen}<Icon name="check" size={13} />{:else}<span
									style="width:13px;height:13px;display:inline-block"
								></span>{/if}Preview Tab</span
						></button
					>
					<button
						onclick={() => {
							ide.toggleMaximize();
							ide.titleMenu = null;
						}}
						><span>{ide.maximizedGroupId ? "Exit Maximized Group" : "Maximize Active Group"}</span
						></button
					>
					<button
						onclick={() => {
							ide.splitActiveGroup("row");
							ide.titleMenu = null;
						}}><span>Split Right</span><small>Ctrl+\</small></button
					>
					<button
						onclick={() => {
							ide.splitActiveGroup("col");
							ide.titleMenu = null;
						}}><span>Split Down</span></button
					>
					<div class="sep"></div>
					<button
						onclick={() => {
							ide.minimapOn = !ide.minimapOn;
							ide.titleMenu = null;
						}}
						><span style="display:flex;align-items:center;gap:6px"
							>{#if ide.minimapOn}<Icon name="check" size={13} />{:else}<span
									style="width:13px;height:13px;display:inline-block"
								></span>{/if}Minimap</span
						></button
					>
					<button
						onclick={() => {
							ide.paletteQ = "> ";
							ide.palette = true;
							ide.titleMenu = null;
						}}><span>Command Palette…</span> <small>F1</small></button
					>
				{:else if ide.titleMenu === "Go"}
					<button
						onclick={() => {
							ide.paletteQ = "";
							ide.palette = true;
							ide.titleMenu = null;
						}}><span>Go to File…</span> <small>Ctrl+P</small></button
					>
					<button
						onclick={() => {
							ide.gotoDraft = String(ide.cursorFor(ide.activeGroupId).line);
							ide.gotoOpen = true;
							ide.titleMenu = null;
						}}><span>Go to Line…</span> <small>Ctrl+G</small></button
					>
					<button
						onclick={() => {
							ide.sideView = "explorer";
							ide.sidebar = true;
							ide.outlineOpen = true;
							ide.titleMenu = null;
						}}><span>Go to Symbol…</span> <small>Ctrl+Shift+O</small></button
					>
				{:else if ide.titleMenu === "Run"}
					<button
						onclick={() => {
							ide.previewRef?.refresh();
							ide.titleMenu = null;
							ide.toast("Preview refreshed");
						}}><span>Run Preview</span> <small>F5</small></button
					>
					<button
						onclick={() => {
							ide.previewRef?.openNewTab();
							ide.titleMenu = null;
						}}><span>Open Preview in New Tab</span></button
					>
					<button
						onclick={() => {
							ide.panelTab = "terminal";
							ide.showPanel = true;
							ide.titleMenu = null;
						}}><span>Focus Terminal</span> <small>Ctrl+`</small></button
					>
				{:else if ide.titleMenu === "Terminal"}
					<button
						onclick={() => {
							ide.panelTab = "terminal";
							ide.showPanel = true;
							ide.termTabs = [...ide.termTabs, `powershell (${ide.termTabs.length + 1})`];
							ide.activeTerm = ide.termTabs.length - 1;
							ide.titleMenu = null;
						}}><span>New Terminal</span> <small>Ctrl+Shift+`</small></button
					>
					<button
						onclick={() => {
							ide.termLines = [];
							ide.panelTab = "terminal";
							ide.showPanel = true;
							ide.titleMenu = null;
						}}><span>Clear Terminal</span></button
					>
				{:else}
					<button
						onclick={() => {
							ide.paletteQ = "> ";
							ide.palette = true;
							ide.titleMenu = null;
						}}><span>Keyboard Shortcuts</span></button
					>
					<button
						onclick={() => {
							ide.toast("Neverview v2 — Monaco + virtual FS");
							ide.titleMenu = null;
						}}><span>About Neverview</span></button
					>
				{/if}
			</div>
		{/if}
	</div>
	<div class="projwrap" bind:this={projWrapEl}>
		<button
			class="btn small ghost projbtn"
			title="Switch project"
			aria-label="Switch project"
			aria-haspopup="menu"
			aria-expanded={ide.projMenu}
			onclick={() => ide.openOnly(() => (ide.projMenu = true))}
			><Icon name="files" size={14} />
			{ide.activeProjectName}
			<Icon name="chevron-down" size={14} /></button
		>
		{#if ide.projMenu}
			<div
				class="projmenu"
				role="menu"
				tabindex="-1"
				bind:this={projMenuEl}
				onkeydown={(e) => menuKeys(e, e.currentTarget as HTMLElement, () => ide.closeAllMenus())}
			>
				<div class="projmenu-head">
					Projects ({ide.projectsSnap.length})
				</div>
				{#each ide.projectsSnap as p}
					<div class="projrow" class:on={p.id === ide.activeProjectIdSnap}>
						<button
							type="button"
							class="projname"
							title="Switch to {p.name}"
							onclick={() => ide.doSwitchProject(p.id)}
						>
							<span class="dot" class:on={p.id === ide.activeProjectIdSnap}></span>
							<span class="nm">{p.name}</span>
							<small>{new Date(p.updatedAt).toLocaleDateString()}</small>
						</button>
						<span class="projacts">
							<button
								class="iconbtn"
								title="Rename {p.name}"
								aria-label="Rename {p.name}"
								onclick={() => ide.startRenameProject(p.id, p.name)}
								><Icon name="edit" size={14} /></button
							>
							<button
								class="iconbtn"
								title="Duplicate {p.name}"
								aria-label="Duplicate {p.name}"
								onclick={() => {
									ide.duplicateProject(p.id);
								}}><Icon name="new-file" size={14} /></button
							>
							<button
								class="iconbtn danger"
								title="Delete {p.name}"
								aria-label="Delete {p.name}"
								onclick={() => ide.doDeleteProject(p.id, p.name)}
								><Icon name="trash" size={14} /></button
							>
						</span>
					</div>
				{/each}
				<button type="button" class="opt newproj" onclick={() => ide.openNewProjectDialog()}
					><Icon name="add" size={13} /> New project...</button
				>
			</div>
		{/if}
	</div>
	<button
		type="button"
		class="cmdcenter"
		title="{ide.active ? ide.active : 'No file open'} — {ide.activeProjectName} (Ctrl+P)"
		onclick={() => {
			ide.paletteQ = "";
			ide.palette = true;
		}}
	>
		<Icon name="search" size={13} />
		<span class="cc-main"
			>{#if ide.isDirty}<span class="cc-dot"><Icon name="circle-filled" size={8} /></span
				>{/if}{ide.active ? basename(ide.active) : "no file"} — {ide.activeProjectName}</span
		>
	</button>
	<div class="actions">
		<button
			class="iconbtn"
			title="Toggle Primary Side Bar (Ctrl+B)"
			aria-label="Toggle Primary Side Bar"
			onclick={() => (ide.sidebar = !ide.sidebar)}
			><Icon name="split-horizontal" size={16} /></button
		>
		<button
			class="iconbtn"
			title="Toggle Panel (Ctrl+J)"
			aria-label="Toggle Panel"
			onclick={() => (ide.showPanel = !ide.showPanel)}><Icon name="terminal" size={16} /></button
		>
		<div class="layoutwrap" bind:this={layoutWrapEl}>
			<button
				class="iconbtn"
				title="Customize Layout"
				aria-label="Customize Layout"
				aria-haspopup="menu"
				aria-expanded={ide.layoutMenu}
				onclick={() => ide.openOnly(() => (ide.layoutMenu = true))}
				><Icon name="extensions" size={15} /></button
			>
			{#if ide.layoutMenu}
				<div
					class="layoutmenu"
					role="menu"
					tabindex="-1"
					bind:this={layoutMenuEl}
					onkeydown={(e) => menuKeys(e, e.currentTarget as HTMLElement, () => ide.closeAllMenus())}
				>
					<div class="projmenu-head">Layout</div>
					<button
						onclick={() => {
							ide.sidebar = !ide.sidebar;
							ide.layoutMenu = false;
						}}
						><span style="display:flex;align-items:center;gap:6px"
							>{#if ide.sidebar}<Icon name="check" size={13} />{:else}<span
									style="width:13px;height:13px;display:inline-block"
								></span>{/if}Primary Side Bar</span
						><small>Ctrl+B</small></button
					>
					<button
						onclick={() => {
							ide.showPanel = !ide.showPanel;
							ide.layoutMenu = false;
						}}
						><span style="display:flex;align-items:center;gap:6px"
							>{#if ide.showPanel}<Icon name="check" size={13} />{:else}<span
									style="width:13px;height:13px;display:inline-block"
								></span>{/if}Panel</span
						><small>Ctrl+J</small></button
					>
					<button
						onclick={() => {
							ide.togglePreviewTab();
							ide.layoutMenu = false;
						}}
						><span style="display:flex;align-items:center;gap:6px"
							>{#if ide.hasPreviewOpen}<Icon name="check" size={13} />{:else}<span
									style="width:13px;height:13px;display:inline-block"
								></span>{/if}Preview Tab</span
						></button
					>
					<button
						onclick={() => {
							ide.toggleMaximize();
							ide.layoutMenu = false;
						}}
						><span>{ide.maximizedGroupId ? "Exit Maximized Group" : "Maximize Active Group"}</span
						></button
					>
					<button
						onclick={() => {
							ide.splitActiveGroup("row");
							ide.layoutMenu = false;
						}}><span>Split Right</span><small>Ctrl+\</small></button
					>
					<button
						onclick={() => {
							ide.splitActiveGroup("col");
							ide.layoutMenu = false;
						}}><span>Split Down</span></button
					>
					<button
						onclick={() => {
							ide.closeGroup(ide.activeGroupId);
							ide.layoutMenu = false;
						}}><span>Close Active Group</span></button
					>
					<div class="sep"></div>
					<button
						onclick={() => {
							ide.previewRef?.refresh();
							ide.layoutMenu = false;
							ide.toast("Preview refreshed");
						}}><span>Run Preview</span><small>F5</small></button
					>
					<button
						onclick={() => {
							ide.previewRef?.openNewTab();
							ide.layoutMenu = false;
						}}><span>Open Preview in New Tab</span></button
					>
				</div>
			{/if}
		</div>
		<div class="winbtns" role="group" aria-label="Window controls">
			<button
				class="winbtn"
				title="Minimize"
				aria-label="Minimize"
				onclick={() => ide.toast("Minimize is a mock in the browser")}
				><Icon name="chrome-minimize" size={12} /></button
			>
			<button
				class="winbtn"
				title={ide.winMax ? "Restore" : "Maximize"}
				aria-label={ide.winMax ? "Restore" : "Maximize"}
				onclick={() => {
					ide.winMax = !ide.winMax;
					ide.toast(ide.winMax ? "Maximized (mock)" : "Restored (mock)");
				}}
				>{#if ide.winMax}<Icon name="chrome-restore" size={12} />{:else}<Icon
						name="chrome-maximize"
						size={12}
					/>{/if}</button
			>
			<button
				class="winbtn close"
				title="Close"
				aria-label="Close"
				onclick={() => ide.toast("Close is disabled in the browser demo")}
				><Icon name="chrome-close" size={12} /></button
			>
		</div>
	</div>
</div>
