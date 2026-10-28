<script lang="ts">
	import { ide } from "#lib/ide/ide.svelte.js";
	import Icon from "#lib/components/Icon.svelte";
</script>

<div class="toasts" aria-live="polite">
	{#each ide.toasts as t}
		<div class="toast {t.kind}">
			<span class="tdot"></span>
			<span class="ttext">{t.text}</span>
			<button
				class="tact"
				onclick={() => {
					ide.toasts = ide.toasts.filter((x) => x.id !== t.id);
					ide.notifCenter = true;
				}}>Details</button
			>
			<button
				class="iconbtn"
				aria-label="Dismiss"
				onclick={() => (ide.toasts = ide.toasts.filter((x) => x.id !== t.id))}
				><Icon name="close" size={13} /></button
			>
		</div>
	{/each}
</div>
