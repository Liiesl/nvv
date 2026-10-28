<script lang="ts">
	import { browser } from "$app/env";
	import { onMount } from "svelte";
	import { ide } from "#lib/ide/ide.svelte.js";
	import TitleBar from "#lib/ide/TitleBar.svelte";
	import ActivityBar from "#lib/ide/ActivityBar.svelte";
	import Sidebar from "#lib/ide/sidebar/Sidebar.svelte";
	import TabsBar from "#lib/ide/editor/TabsBar.svelte";
	import Breadcrumbs from "#lib/ide/editor/Breadcrumbs.svelte";
	import EditorSplit from "#lib/ide/editor/EditorSplit.svelte";
	import BottomPanel from "#lib/ide/panel/BottomPanel.svelte";
	import StatusBar from "#lib/ide/StatusBar.svelte";
	import TabContextMenu from "#lib/ide/menus/TabContextMenu.svelte";
	import EditorContextMenu from "#lib/ide/menus/EditorContextMenu.svelte";
	import CommandPalette from "#lib/ide/dialogs/CommandPalette.svelte";
	import LanguagePicker from "#lib/ide/dialogs/LanguagePicker.svelte";
	import GotoDialog from "#lib/ide/dialogs/GotoDialog.svelte";
	import NewProjectDialog from "#lib/ide/dialogs/NewProjectDialog.svelte";
	import RenameProjectDialog from "#lib/ide/dialogs/RenameProjectDialog.svelte";
	import Toasts from "#lib/ide/Toasts.svelte";
	import NotificationCenter from "#lib/ide/NotificationCenter.svelte";

	onMount(() => {
		ide.init();
		const flush = () => ide.flushUI();
		window.addEventListener("beforeunload", flush);
		return () => window.removeEventListener("beforeunload", flush);
	});

	// Autosave global layout prefs (debounced inside ide).
	$effect(() => {
		void ide.snapshotGlobal();
		ide.queueSaveGlobal();
	});

	// Autosave per-project view prefs (sideView / panelTab / expanded folders).
	$effect(() => {
		const pid = ide.activeProjectIdSnap;
		void ide.sideView;
		void ide.panelTab;
		void ide.expandedDirs;
		if (pid) ide.queueSaveProjects();
	});

	if (browser) {
		window.addEventListener("keydown", (e) => ide.handleGlobalKeydown(e));
		window.addEventListener("pointermove", (e) => {
			if (ide.sideDragging) ide.moveSidebar(e.clientX);
			if (ide.panelDragging) ide.movePanel(e.clientY);
		});
		window.addEventListener("pointerup", () => {
			if (ide.sideDragging) {
				ide.sideDragging = false;
				ide.setBodyDragCursor("");
			}
			if (ide.panelDragging) {
				ide.panelDragging = false;
				ide.setBodyDragCursor("");
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
	<div class="ide" class:preview-zoomed={ide.previewZoomed} class:has-error={ide.errCount > 0}>
		<TitleBar />
		<div class="workbench">
			<ActivityBar />
			<Sidebar />
			<div class="main">
				<TabsBar />
				<Breadcrumbs />
				<EditorSplit />
				<BottomPanel />
			</div>
		</div>
		<StatusBar />
	</div>
{/if}

<TabContextMenu />
<EditorContextMenu />
<CommandPalette />
<LanguagePicker />
<GotoDialog />
<NewProjectDialog />
<RenameProjectDialog />
<Toasts />
<NotificationCenter />
