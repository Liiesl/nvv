<script lang="ts">
	import { ide } from "#lib/ide/ide.svelte.js";
	import { languageOf } from "#lib/vfs.js";
</script>

{#if ide.langPick}
	<div
		class="palette-veil"
		role="button"
		tabindex="0"
		aria-label="Close language picker"
		onclick={() => (ide.langPick = false)}
		onkeydown={(e) => {
			if (e.key === "Escape") ide.langPick = false;
		}}
	>
		<div
			class="dlg"
			role="dialog"
			aria-label="Language mode"
			tabindex="0"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="dlg-title">Select Language Mode</div>
			<div class="dlg-body">
				{#each ["html", "css", "javascript", "typescript", "json", "markdown", "xml", "plaintext"] as l}
					<button
						type="button"
						class="opt langrow"
						class:on={languageOf(ide.active) === l}
						onclick={() => {
							ide.toast(`Language: ${l} (detected from extension)`);
							ide.langPick = false;
						}}>{l}{languageOf(ide.active) === l ? " · current" : ""}</button
					>
				{/each}
				<div class="dlg-actions">
					<button type="button" class="btn ghost" onclick={() => (ide.langPick = false)}
						>Close</button
					>
				</div>
			</div>
		</div>
	</div>
{/if}
