<script lang="ts">
	import { ide } from "#lib/ide/ide.svelte.js";

	function autofocus(el: HTMLInputElement) {
		el.focus();
	}
</script>

{#if ide.showNewProj}
	<div
		class="palette-veil"
		role="button"
		tabindex="0"
		aria-label="Close new project dialog"
		onclick={() => (ide.showNewProj = false)}
		onkeydown={(e) => {
			if (e.key === "Escape") ide.showNewProj = false;
		}}
	>
		<div
			class="dlg"
			role="dialog"
			aria-label="New project"
			tabindex="0"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="dlg-title">New project</div>
			<div class="dlg-body">
				<input
					class="dlg-input"
					use:autofocus
					placeholder="Project name"
					bind:value={ide.newProjName}
					onkeydown={(e) => {
						if (e.key === "Enter") ide.confirmNewProject();
					}}
				/>
				<div class="radio-list">
					<label class="radio-row"
						><input type="radio" name="tpl" value="seed" bind:group={ide.newProjTemplate} /><span
							><span class="rtitle">Seed</span><br /><span class="rdesc"
								>Starter files (index.html / style.css / app.js)</span
							></span
						></label
					>
					<label class="radio-row"
						><input type="radio" name="tpl" value="blank" bind:group={ide.newProjTemplate} /><span
							><span class="rtitle">Blank</span><br /><span class="rdesc">Minimal index.html</span
							></span
						></label
					>
					<label class="radio-row"
						><input type="radio" name="tpl" value="clone" bind:group={ide.newProjTemplate} /><span
							><span class="rtitle">Clone current</span><br /><span class="rdesc"
								>Copy files from active project</span
							></span
						></label
					>
				</div>
				<div class="dlg-actions">
					<button type="button" class="btn ghost" onclick={() => (ide.showNewProj = false)}
						>Cancel</button
					>
					<button type="button" class="btn" onclick={() => ide.confirmNewProject()}>Create</button>
				</div>
			</div>
		</div>
	</div>
{/if}
