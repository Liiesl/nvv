<script lang="ts">
	import Icon from "#lib/components/Icon.svelte";
	import { ide } from "#lib/ide/ide.svelte.js";
	import ExplorerView from "#lib/ide/sidebar/ExplorerView.svelte";
	import SearchView from "#lib/ide/sidebar/SearchView.svelte";
	import ScmView from "#lib/ide/sidebar/ScmView.svelte";
	import DebugView from "#lib/ide/sidebar/DebugView.svelte";
	import ExtView from "#lib/ide/sidebar/ExtView.svelte";
	import SettingsView from "#lib/ide/sidebar/SettingsView.svelte";
	import { menuKeys, watchOutside, focusFirstMenuItem } from "#lib/ide/menus/menu.js";

	let sideSashEl: HTMLElement | null = $state(null);
	let sideMenuEl: HTMLElement | null = $state(null);
	let moreBtnEl: HTMLElement | null = $state(null);

	function sideSashDown(e: PointerEvent) {
		if (e.pointerType === "mouse" && e.button !== 0) return;
		ide.sideDragging = true;
		e.preventDefault();
		try {
			sideSashEl?.setPointerCapture?.(e.pointerId);
		} catch {
			/* noop */
		}
		ide.setBodyDragCursor("col");
	}
	function sideSashMove(e: PointerEvent) {
		if (!ide.sideDragging) return;
		e.preventDefault();
		ide.moveSidebar(e.clientX);
	}
	function sideSashUp(e?: PointerEvent) {
		if (!ide.sideDragging) return;
		ide.sideDragging = false;
		ide.setBodyDragCursor("");
		try {
			if (e && sideSashEl?.hasPointerCapture?.(e.pointerId))
				sideSashEl?.releasePointerCapture?.(e.pointerId);
		} catch {
			/* noop */
		}
	}

	$effect(() => {
		if (ide.sideMenu && sideMenuEl) focusFirstMenuItem(sideMenuEl);
	});

	// No veil: it would push layout and swallow trigger clicks.
	$effect(() => {
		if (!ide.sideMenu) return;
		return watchOutside(
			() => [sideMenuEl, moreBtnEl],
			() => ide.closeAllMenus(),
		);
	});
</script>

{#if ide.sidebar}
	<div class="sidebar" style={`flex-basis:${ide.sidebarW}px;width:${ide.sidebarW}px`}>
		<div class="side-head">
			<span>{ide.sideView.toUpperCase()} · {ide.activeProjectName}</span>
			<span class="icons">
				{#if ide.sideView === "explorer"}
					<button
						class="iconbtn"
						title="New file"
						onclick={() => ide.doCreateFile("/", "untitled.html")}
						><Icon name="new-file" size={15} /></button
					>
					<button
						class="iconbtn"
						title="New folder"
						onclick={() => {
							ide.doCreateFolder("/", "new-folder");
						}}><Icon name="new-folder" size={15} /></button
					>
					<button
						class="iconbtn"
						title="Refresh explorer"
						onclick={() => ide.toast("Explorer refreshed")}
						><Icon name="refresh" size={15} /></button
					>
					<button class="iconbtn" title="Collapse all" onclick={() => (ide.collapseNonce += 1)}
						><Icon name="collapse-all" size={15} /></button
					>
					<button
						class="iconbtn"
						title="More actions"
						aria-label="More actions"
						aria-haspopup="menu"
						aria-expanded={ide.sideMenu}
						bind:this={moreBtnEl}
						onclick={() => ide.openOnly(() => (ide.sideMenu = true))}
						><Icon name="ellipsis" size={15} /></button
					>
				{/if}
			</span>
		</div>
		{#if ide.sideMenu && ide.sideView === "explorer"}
			<div
				class="sidemenu"
				role="menu"
				tabindex="-1"
				bind:this={sideMenuEl}
				onkeydown={(e) => menuKeys(e, sideMenuEl, () => ide.closeAllMenus())}
				oncontextmenu={(e) => e.preventDefault()}
			>
				<button
					onclick={() => {
						ide.doCreateFile("/", "untitled.html");
						ide.closeAllMenus();
					}}>New File</button
				>
				<button
					onclick={() => {
						ide.doCreateFolder("/", "new-folder");
						ide.closeAllMenus();
					}}>New Folder</button
				>
				<button
					onclick={() => {
						ide.collapseNonce += 1;
						ide.closeAllMenus();
					}}>Collapse All</button
				>
				<button
					onclick={() => {
						ide.openNewProjectDialog();
						ide.closeAllMenus();
					}}>New Project…</button
				>
			</div>
		{/if}
		<div class="side-body">
			{#if ide.sideView === "explorer"}
				<ExplorerView />
			{:else if ide.sideView === "search"}
				<SearchView />
			{:else if ide.sideView === "scm"}
				<ScmView />
			{:else if ide.sideView === "debug"}
				<DebugView />
			{:else if ide.sideView === "ext"}
				<ExtView />
			{:else}
				<SettingsView />
			{/if}
		</div>
	</div>
	<div
		class="sash side"
		role="slider"
		tabindex="0"
		aria-label="Resize sidebar"
		aria-orientation="vertical"
		aria-valuenow={Math.round(ide.sidebarW)}
		aria-valuemin={180}
		aria-valuemax={480}
		bind:this={sideSashEl}
		onpointerdown={sideSashDown}
		onpointermove={sideSashMove}
		onpointerup={sideSashUp}
		ondblclick={() => (ide.sidebarW = 268)}
		onkeydown={(e) => {
			if (e.key === "ArrowLeft") ide.sidebarW = Math.max(180, ide.sidebarW - 12);
			if (e.key === "ArrowRight") ide.sidebarW = Math.min(480, ide.sidebarW + 12);
		}}
	></div>
{/if}
