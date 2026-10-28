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
		{#key ide.layoutRoot}
			<SplitView node={ide.layoutRoot} />
		{/key}
	{/if}
</div>
{#if ide.splitDrag}
	<div class="dragveil" aria-hidden="true"></div>
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
</style>
