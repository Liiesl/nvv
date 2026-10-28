<script lang="ts">
	import { ide } from "#lib/ide/ide.svelte.js";
</script>

<div class="searchbox">
	<label><input type="checkbox" bind:checked={ide.autoReload} /> Auto-reload preview</label>
	<label><input type="checkbox" bind:checked={ide.showPreview} /> Show preview</label>
	<label><input type="checkbox" bind:checked={ide.showPanel} /> Show panel</label>
	<label><input type="checkbox" bind:checked={ide.minimapOn} /> Minimap</label>
	<label
		>Font size
		<input type="range" min="11" max="18" step="1" bind:value={ide.fontSize} />
		<small>{ide.fontSize}px</small>
	</label>
	<label
		>Entry HTML
		<select class="textin" bind:value={ide.entry} onchange={() => ide.onEntryChange(ide.entry)}>
			{#each ide.htmlFiles as h}<option value={h}>{h}</option>{/each}
		</select>
	</label>
	<button
		class="btn ghost"
		onclick={() => {
			if (confirm(`Clear ALL projects (${ide.projectsSnap.length}) and reload?`)) {
				ide.clearAllProjects();
				location.reload();
			}
		}}>Clear all projects</button
	>
</div>
