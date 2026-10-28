<script lang="ts">
	import FileIcon from "#lib/components/FileIcon.svelte";
	import Icon from "#lib/components/Icon.svelte";
	import { ide } from "#lib/ide/ide.svelte.js";
	import { basename, writeFile } from "#lib/vfs.js";
</script>

<div class="searchbox">
	<div class="searchrow">
		<input placeholder="Search files…" bind:value={ide.query} aria-label="Search files" />
		<span class="sopts">
			<button
				type="button"
				class="sopt"
				class:on={ide.searchCase}
				title="Match Case"
				aria-pressed={ide.searchCase}
				onclick={() => (ide.searchCase = !ide.searchCase)}>Aa</button
			>
			<button
				type="button"
				class="sopt"
				class:on={ide.searchWord}
				title="Match Whole Word"
				aria-pressed={ide.searchWord}
				onclick={() => (ide.searchWord = !ide.searchWord)}>ab</button
			>
			<button
				type="button"
				class="sopt"
				class:on={ide.searchRegex}
				title="Use Regular Expression"
				aria-pressed={ide.searchRegex}
				onclick={() => (ide.searchRegex = !ide.searchRegex)}>.*</button
			>
		</span>
	</div>
	<input
		placeholder="Replace (Enter applies to open file)"
		bind:value={ide.replaceQ}
		aria-label="Replace"
		onkeydown={(e) => {
			if (e.key === "Enter" && ide.replaceQ && ide.active && ide.filesSnap[ide.active]) {
				const cur = ide.filesSnap[ide.active].content;
				writeFile(ide.active, cur.split(ide.query).join(ide.replaceQ));
				ide.toast(`Replaced in ${basename(ide.active)}`);
			}
		}}
	/>
	<div class="smeta">
		{ide.searchDetailed.length} results {ide.query ? `for “${ide.query}”` : ""}
		<button
			type="button"
			class="replaceall"
			title="Replace All in open file"
			onclick={() => {
				if (ide.replaceQ && ide.active && ide.filesSnap[ide.active] && ide.query) {
					const cur = ide.filesSnap[ide.active].content;
					writeFile(ide.active, cur.split(ide.query).join(ide.replaceQ));
					ide.toast(`Replaced all in ${basename(ide.active)}`);
				}
			}}><Icon name="replace-all" size={13} /> Replace All</button
		>
	</div>
</div>
{#each ide.searchDetailed as h}
	<button
		type="button"
		class="sres"
		onclick={() => {
			ide.openFile(h.path);
			ide.revealLine = 0;
			requestAnimationFrame(() => (ide.revealLine = h.line));
		}}
		><span class="sfile"
			><FileIcon name={basename(h.path)} />
			{h.path} <em>:{h.line}</em></span
		><small>{h.text || "(empty line)"}</small></button
	>
{/each}
{#if ide.query && ide.searchDetailed.length === 0}<div class="sres">
		<small>No results</small>
	</div>{/if}
