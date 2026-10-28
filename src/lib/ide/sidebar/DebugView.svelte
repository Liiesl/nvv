<script lang="ts">
	import Icon from "#lib/components/Icon.svelte";
	import { ide } from "#lib/ide/ide.svelte.js";
</script>

<div class="searchbox">
	<div class="smeta">RUN AND DEBUG</div>
	<button
		class="btn small"
		onclick={() => {
			ide.previewRef?.refresh();
			ide.toast("Preview refreshed");
		}}><Icon name="play" size={14} /> Start Debugging (F5)</button
	>
	<label
		>Entry HTML
		<select class="textin" bind:value={ide.entry} onchange={() => ide.onEntryChange(ide.entry)}>
			{#each ide.htmlFiles as h}<option value={h}>{h}</option>{/each}
		</select>
	</label>
	<label><input type="checkbox" bind:checked={ide.autoReload} /> Auto-reload preview</label>
	<div class="smeta">
		Breakpoints: none · Console: {ide.logs.length}
	</div>
</div>
