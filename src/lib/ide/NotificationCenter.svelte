<script lang="ts">
	import { ide } from "#lib/ide/ide.svelte.js";
	import Icon from "#lib/components/Icon.svelte";
</script>

{#if ide.notifCenter}
	<button class="veil" aria-label="Close notifications" onclick={() => (ide.notifCenter = false)}
	></button>
	<div class="notifcenter" role="dialog" aria-label="Notifications">
		<div class="notif-head">
			<span>Notifications</span><button
				class="iconbtn"
				title="Clear all"
				onclick={() => {
					ide.toasts = [];
					ide.logs = [];
				}}><Icon name="trash" size={13} /> Clear</button
			><button class="iconbtn" aria-label="Close" onclick={() => (ide.notifCenter = false)}
				><Icon name="close" size={13} /></button
			>
		</div>
		<div class="notif-body">
			{#each [...ide.toasts].reverse() as t}
				<div class="notifrow {t.kind}"><span class="tdot"></span><span>{t.text}</span></div>
			{/each}
			{#each ide.logs.slice(-8).reverse() as l}
				<div class="notifrow {l.kind}"><span class="tdot"></span><span>{l.text}</span></div>
			{/each}
			{#if ide.toasts.length === 0 && ide.logs.length === 0}<div class="oempty">
					No new notifications.
				</div>{/if}
		</div>
	</div>
{/if}
