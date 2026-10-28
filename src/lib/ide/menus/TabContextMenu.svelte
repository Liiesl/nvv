<script lang="ts">
	import { ide } from "#lib/ide/ide.svelte.js";
	import { openFile, closeTab, closeOthers, closeToRight, closeAll } from "#lib/vfs.js";
</script>

{#if ide.tabCtx}
	<button
		class="veil"
		aria-label="Close tab menu"
		onclick={() => (ide.tabCtx = null)}
		onkeydown={(e) => {
			if (e.key === "Escape") ide.tabCtx = null;
		}}
	></button>
	<div
		class="ctx"
		role="menu"
		style={`left:${Math.min(ide.tabCtx.x, window.innerWidth - 230)}px;top:${ide.tabCtx.y}px`}
	>
		<button
			onclick={() => {
				openFile(ide.tabCtx!.path);
				ide.tabCtx = null;
			}}><span>Open</span></button
		>
		<div class="sep"></div>
		<button
			onclick={() => {
				closeTab(ide.tabCtx!.path);
				ide.tabCtx = null;
			}}><span>Close</span><small>Ctrl+W</small></button
		>
		<button
			onclick={() => {
				closeOthers(ide.tabCtx!.path);
				ide.tabCtx = null;
				ide.toast("Closed others");
			}}><span>Close Others</span></button
		>
		<button
			onclick={() => {
				closeToRight(ide.tabCtx!.path);
				ide.tabCtx = null;
			}}><span>Close to the Right</span></button
		>
		<button
			onclick={() => {
				closeAll();
				ide.tabCtx = null;
			}}><span>Close All</span></button
		>
		<div class="sep"></div>
		<button
			onclick={() => {
				try {
					navigator.clipboard.writeText(ide.tabCtx!.path);
					ide.toast("Path copied");
				} catch {
					/* noop */
				}
				ide.tabCtx = null;
			}}><span>Copy Path</span><small>Ctrl+C</small></button
		>
		<button
			onclick={() => {
				ide.sideView = "explorer";
				ide.sidebar = true;
				ide.tabCtx = null;
				ide.toast("Revealed in Explorer (mock)");
			}}><span>Reveal in Explorer</span></button
		>
	</div>
{/if}
