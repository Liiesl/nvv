<script lang="ts">
	import Icon from "#lib/components/Icon.svelte";
	import { ide } from "#lib/ide/ide.svelte.js";
	import { basename, closeOthers, closeAll } from "#lib/vfs.js";
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
	<div class="menu">
		{#each ["File", "Edit", "Selection", "View", "Go", "Run", "Terminal", "Help"] as m}
			<button
				type="button"
				class="menubtn"
				class:on={ide.titleMenu === m}
				onmouseenter={() => {
					if (ide.titleMenu && ide.titleMenu !== m) ide.titleMenu = m;
				}}
				onclick={() => (ide.titleMenu = ide.titleMenu === m ? null : m)}>{m}</button
			>
		{/each}
		{#if ide.titleMenu}
			<button
				class="veil"
				aria-label="Close menu"
				onclick={() => (ide.titleMenu = null)}
				onkeydown={(e) => {
					if (e.key === "Escape") ide.titleMenu = null;
				}}
			></button>
			<div class="titlemenu" role="menu">
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
							if (ide.active) ide.closeTab(ide.active);
							ide.titleMenu = null;
						}}><span>Close Tab</span> <small>Ctrl+W</small></button
					>
					<button
						onclick={() => {
							if (ide.active) closeOthers(ide.active);
							ide.titleMenu = null;
						}}><span>Close Others</span></button
					>
					<button
						onclick={() => {
							closeAll();
							ide.titleMenu = null;
						}}><span>Close All</span></button
					>
					<div class="sep"></div>
					<button
						onclick={() => {
							ide.toast("Workspace autosaves to localStorage");
							ide.titleMenu = null;
						}}><span>✓ Auto Save</span></button
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
							ide.gotoDraft = String(ide.line);
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
						}}><span>{ide.sidebar ? "✓" : "○"} Primary Side Bar</span> <small>Ctrl+B</small></button
					>
					<button
						onclick={() => {
							ide.showPanel = !ide.showPanel;
							ide.titleMenu = null;
						}}><span>{ide.showPanel ? "✓" : "○"} Panel</span> <small>Ctrl+J</small></button
					>
					<button
						onclick={() => {
							ide.showPreview = !ide.showPreview;
							ide.titleMenu = null;
						}}><span>{ide.showPreview ? "✓" : "○"} Preview</span></button
					>
					<button
						onclick={() => {
							ide.togglePreviewZoom();
							ide.titleMenu = null;
						}}><span>Zoom Preview</span></button
					>
					<div class="sep"></div>
					<button
						onclick={() => {
							ide.minimapOn = !ide.minimapOn;
							ide.titleMenu = null;
						}}><span>{ide.minimapOn ? "✓" : "○"} Minimap</span></button
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
							ide.gotoDraft = String(ide.line);
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
	<div class="projwrap">
		<button
			class="btn small ghost projbtn"
			title="Switch project"
			aria-label="Switch project"
			onclick={() => (ide.projMenu = !ide.projMenu)}
			><Icon name="files" size={14} />
			{ide.activeProjectName}
			<Icon name="chevron-down" size={14} /></button
		>
		{#if ide.projMenu}
			<button
				class="veil"
				aria-label="Close projects menu"
				onclick={() => (ide.projMenu = false)}
				onkeydown={(e) => {
					if (e.key === "Escape") ide.projMenu = false;
				}}
			></button>
			<div class="projmenu" role="menu">
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
					>+ New project...</button
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
			>{#if ide.isDirty}<span class="cc-dot">●</span>{/if}{ide.active
				? basename(ide.active)
				: "no file"} — {ide.activeProjectName}</span
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
		<div class="layoutwrap">
			<button
				class="iconbtn"
				title="Customize Layout"
				aria-label="Customize Layout"
				onclick={() => (ide.layoutMenu = !ide.layoutMenu)}
				><Icon name="extensions" size={15} /></button
			>
			{#if ide.layoutMenu}
				<button class="veil" aria-label="Close layout" onclick={() => (ide.layoutMenu = false)}
				></button>
				<div class="layoutmenu" role="menu">
					<div class="projmenu-head">Layout</div>
					<button
						onclick={() => {
							ide.sidebar = !ide.sidebar;
							ide.layoutMenu = false;
						}}><span>{ide.sidebar ? "✓" : "○"} Primary Side Bar</span><small>Ctrl+B</small></button
					>
					<button
						onclick={() => {
							ide.showPanel = !ide.showPanel;
							ide.layoutMenu = false;
						}}><span>{ide.showPanel ? "✓" : "○"} Panel</span><small>Ctrl+J</small></button
					>
					<button
						onclick={() => {
							ide.showPreview = !ide.showPreview;
							ide.layoutMenu = false;
						}}><span>{ide.showPreview ? "✓" : "○"} Preview (side)</span></button
					>
					<button
						onclick={() => {
							ide.togglePreviewZoom();
							ide.layoutMenu = false;
						}}><span>Zoom Preview</span></button
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
				><span class="wl">─</span></button
			>
			<button
				class="winbtn"
				title={ide.winMax ? "Restore" : "Maximize"}
				aria-label={ide.winMax ? "Restore" : "Maximize"}
				onclick={() => {
					ide.winMax = !ide.winMax;
					ide.toast(ide.winMax ? "Maximized (mock)" : "Restored (mock)");
				}}><span class="wl">{ide.winMax ? "❐" : "▢"}</span></button
			>
			<button
				class="winbtn close"
				title="Close"
				aria-label="Close"
				onclick={() => ide.toast("Close is disabled in the browser demo")}
				><span class="wl">✕</span></button
			>
		</div>
	</div>
</div>
