<script lang="ts">
	import { ide } from "#lib/ide/ide.svelte.js";
	import Icon from "#lib/components/Icon.svelte";
</script>

{#if ide.editorCtx}
	<button
		class="veil"
		aria-label="Close editor menu"
		onclick={() => (ide.editorCtx = null)}
		onkeydown={(e) => {
			if (e.key === "Escape") ide.editorCtx = null;
		}}
	></button>
	<div class="ctx" role="menu" style={`left:${ide.editorCtx.x}px;top:${ide.editorCtx.y}px`}>
		<button
			onclick={() => {
				document.execCommand?.("cut");
				ide.editorCtx = null;
			}}><span>Cut</span><small>Ctrl+X</small></button
		>
		<button
			onclick={() => {
				document.execCommand?.("copy");
				ide.editorCtx = null;
			}}><span>Copy</span><small>Ctrl+C</small></button
		>
		<button
			onclick={() => {
				document.execCommand?.("paste");
				ide.editorCtx = null;
			}}><span>Paste</span><small>Ctrl+V</small></button
		>
		<div class="sep"></div>
		<button
			onclick={() => {
				ide.paletteQ = "> ";
				ide.palette = true;
				ide.editorCtx = null;
			}}><span>Command Palette…</span><small>F1</small></button
		>
		<button
			onclick={() => {
				ide.gotoDraft = String(ide.line);
				ide.gotoOpen = true;
				ide.editorCtx = null;
			}}><span>Go to Line…</span><small>Ctrl+G</small></button
		>
		<button
			onclick={() => {
				ide.langPick = true;
				ide.editorCtx = null;
			}}><span>Change Language Mode</span></button
		>
		<div class="sep"></div>
		<button
			onclick={() => {
				ide.previewRef?.refresh();
				ide.editorCtx = null;
				ide.toast("Preview refreshed");
			}}><Icon name="play" size={14} /><span>Run Preview</span><small>F5</small></button
		>
	</div>
{/if}
