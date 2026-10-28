<script lang="ts">
	import { ide } from "#lib/ide/ide.svelte.js";

	function autofocus(el: HTMLInputElement) {
		el.focus();
	}
</script>

{#if ide.renameTarget}
	<div
		class="palette-veil"
		role="button"
		tabindex="0"
		aria-label="Close rename dialog"
		onclick={() => (ide.renameTarget = null)}
		onkeydown={(e) => {
			if (e.key === "Escape") ide.renameTarget = null;
		}}
	>
		<div
			class="dlg"
			role="dialog"
			aria-label="Rename project"
			tabindex="0"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="dlg-title">Rename project</div>
			<div class="dlg-body">
				<input
					class="dlg-input"
					use:autofocus
					placeholder="Project name"
					bind:value={ide.renameDraft}
					onkeydown={(e) => {
						if (e.key === "Enter") ide.confirmRenameProject();
					}}
				/>
				<div class="dlg-actions">
					<button type="button" class="btn ghost" onclick={() => (ide.renameTarget = null)}
						>Cancel</button
					>
					<button type="button" class="btn" onclick={() => ide.confirmRenameProject()}
						>Rename</button
					>
				</div>
			</div>
		</div>
	</div>
{/if}
