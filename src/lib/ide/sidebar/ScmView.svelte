<script lang="ts">
	import FileIcon from "#lib/components/FileIcon.svelte";
	import Icon from "#lib/components/Icon.svelte";
	import { ide } from "#lib/ide/ide.svelte.js";
	import { basename } from "#lib/vfs.js";
</script>

<div class="searchbox">
	<div class="smeta">
		SOURCE CONTROL · {ide.dirty.size} changes
	</div>
	<input placeholder="Message (Ctrl+Enter to commit)" bind:value={ide.commitMsg} />
	<button
		class="btn small"
		onclick={() => {
			ide.commitMsg = "";
			ide.toast(ide.dirty.size ? `Committed ${ide.dirty.size} file(s)` : "Nothing to commit");
		}}><Icon name="check" size={14} /> Commit</button
	>
</div>
<div class="smeta" style="padding:0 12px">Changes</div>
{#each [...ide.dirty] as d}
	<button type="button" class="sres" onclick={() => ide.openFile(d)}>
		<span class="sfile"
			><FileIcon name={basename(d)} />
			{d}</span
		>
		<small>M · unsaved</small>
	</button>
{/each}
{#if ide.dirty.size === 0}<div class="sres">
		<small>No changes — working tree clean.</small>
	</div>{/if}
