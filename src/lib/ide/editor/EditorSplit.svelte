<script lang="ts">
	import SplitView from "./SplitView.svelte";
	import EditorGroupView from "./EditorGroupView.svelte";
	import { ide } from "#lib/ide/ide.svelte.js";
</script>

<div class="tile-root" class:maximized={ide.maximizedGroupId !== null}>
	{#if ide.maximizedGroupId && ide.groups[ide.maximizedGroupId]}
		<div class="tile-leaf maxed">
			<EditorGroupView groupId={ide.maximizedGroupId} />
		</div>
	{:else}
		<SplitView node={ide.layoutRoot} />
	{/if}
</div>
{#if ide.splitDrag || ide.sideDragging || ide.panelDragging}
	<div
		class="dragveil"
		class:row={ide.splitDragDir === "row"}
		class:col={ide.splitDragDir === "col"}
		aria-hidden="true"
	></div>
{/if}

<style>
	.tile-root {
		flex: 1;
		display: flex;
		min-height: 0;
		min-width: 0;
	}
	.tile-root.maximized .tile-leaf.maxed {
		flex: 1;
		display: flex;
		min-width: 0;
		min-height: 0;
	}
	.dragveil {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: transparent;
		cursor: grabbing;
	}
	.dragveil.row {
		cursor: col-resize;
	}
	.dragveil.col {
		cursor: row-resize;
	}
</style>
