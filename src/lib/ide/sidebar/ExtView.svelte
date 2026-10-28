<script lang="ts">
	import Icon from "#lib/components/Icon.svelte";
	import { ide } from "#lib/ide/ide.svelte.js";
</script>

<div class="searchbox">
	<div class="smeta">EXTENSIONS · Marketplace (local mock)</div>
</div>
{#each [["Prettier", "Code formatter"], ["ESLint", "Problem matcher"], ["Live Preview", "Preview helper"]] as [n, d]}
	<div class="sres ext">
		<span class="sfile"
			><Icon name="extensions" size={16} />
			{n}</span
		>
		<small>{d}</small>
		<button class="btn small ghost" onclick={() => ide.toast(`${n} installed (mock)`)}
			>Install</button
		>
	</div>
{/each}
