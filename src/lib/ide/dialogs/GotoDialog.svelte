<script lang="ts">
	import { ide } from "#lib/ide/ide.svelte.js";

	function autofocus(el: HTMLInputElement) {
		el.focus();
	}
</script>

{#if ide.gotoOpen}
	<div
		class="palette-veil"
		role="button"
		tabindex="0"
		aria-label="Close go to line"
		onclick={() => (ide.gotoOpen = false)}
		onkeydown={(e) => {
			if (e.key === "Escape") ide.gotoOpen = false;
		}}
	>
		<div
			class="dlg"
			role="dialog"
			aria-label="Go to line"
			tabindex="0"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="dlg-title">Go to Line/Column</div>
			<div class="dlg-body">
				<input
					class="dlg-input"
					use:autofocus
					placeholder="12"
					bind:value={ide.gotoDraft}
					onkeydown={(e) => {
						if (e.key === "Enter") ide.confirmGoto();
					}}
				/>
				<div class="dlg-actions">
					<button type="button" class="btn ghost" onclick={() => (ide.gotoOpen = false)}
						>Cancel</button
					>
					<button type="button" class="btn" onclick={() => ide.confirmGoto()}>Go</button>
				</div>
			</div>
		</div>
	</div>
{/if}
