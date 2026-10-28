<script lang="ts">
	import { ide } from "#lib/ide/ide.svelte.js";
	import FileIcon from "#lib/components/FileIcon.svelte";
	import Icon from "#lib/components/Icon.svelte";
	import { basename } from "#lib/vfs.js";

	function autofocus(el: HTMLInputElement) {
		el.focus();
	}

	let projHits = $derived(
		ide.projectsSnap.filter((m) => m.name.toLowerCase().includes(ide.paletteCmdQ)),
	);

	$effect(() => {
		void ide.paletteQ;
		ide.paletteSel = 0;
	});
</script>

{#if ide.palette}
	<div
		class="palette-veil"
		role="button"
		tabindex="0"
		aria-label="Close command palette"
		onclick={() => (ide.palette = false)}
		onkeydown={(e) => {
			if (e.key === "Escape") ide.palette = false;
		}}
	>
		<div
			class="palette"
			role="dialog"
			aria-label="Command palette"
			tabindex="0"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<input
				use:autofocus
				placeholder={ide.paletteIsCmd ? "> Type a command" : "Type file name, or > for commands"}
				bind:value={ide.paletteQ}
				onkeydown={(e) => {
					if (e.key === "ArrowDown") {
						e.preventDefault();
						ide.paletteSel = Math.min(ide.paletteTotal - 1, ide.paletteSel + 1);
					} else if (e.key === "ArrowUp") {
						e.preventDefault();
						ide.paletteSel = Math.max(0, ide.paletteSel - 1);
					} else if (e.key === "Enter") {
						let idx = ide.paletteSel;
						if (idx < ide.paletteFiles.length && ide.paletteFiles[idx]) {
							ide.openFile(ide.paletteFiles[idx]);
							ide.palette = false;
						} else {
							idx -= ide.paletteFiles.length;
							if (idx < projHits.length) {
								ide.doSwitchProject(projHits[idx].id);
								ide.palette = false;
							} else {
								idx -= projHits.length;
								const cmd = ide.allCommands[idx];
								if (cmd) {
									ide.runPaletteCommand(cmd.id);
								}
							}
						}
					}
				}}
			/>
			<div class="opts">
				{#if !ide.paletteIsCmd}
					<div class="pgroup">files · {ide.paletteFiles.length} · MRU first</div>
				{/if}
				{#each ide.paletteFiles as p, i}
					{@const hm = ide.hiMatch(p, ide.paletteQ)}
					<button
						type="button"
						class="opt"
						class:on={ide.paletteSel === i}
						onmouseenter={() => (ide.paletteSel = i)}
						onclick={() => {
							ide.openFile(p);
							ide.palette = false;
						}}
						><FileIcon name={basename(p)} />
						<span class="pfile"
							><span>{hm.pre}</span>{#if hm.mid}<mark>{hm.mid}</mark>{/if}<span>{hm.post}</span
							></span
						><small>{ide.tabs.includes(p) ? "open ·" : ""} file · ↵</small></button
					>{/each}
				<div class="pgroup">projects</div>
				{#each projHits as m, j}<button
						type="button"
						class="opt"
						class:on={ide.paletteSel === ide.paletteFiles.length + j}
						onmouseenter={() => (ide.paletteSel = ide.paletteFiles.length + j)}
						onclick={() => {
							ide.doSwitchProject(m.id);
							ide.palette = false;
						}}
						><Icon name="files" size={15} />
						{m.name}<small>project{m.id === ide.activeProjectIdSnap ? " · active" : ""}</small
						></button
					>{/each}
				<div class="pgroup">commands · prefix with &gt;</div>
				{#each ide.allCommands as c, k}<button
						type="button"
						class="opt"
						class:on={ide.paletteSel === ide.paletteFiles.length + projHits.length + k}
						onmouseenter={() => (ide.paletteSel = ide.paletteFiles.length + projHits.length + k)}
						onclick={() => ide.runPaletteCommand(c.id)}
						><Icon name="record-keys" size={15} />
						{c.label}<small>cmd</small></button
					>{/each}
			</div>
			<div class="pfoot">
				<span><kbd>↑↓</kbd> navigate</span><span><kbd>↵</kbd> select</span><span
					><kbd>esc</kbd> close</span
				><span class="pfhint">{ide.paletteIsCmd ? "command mode" : "type > for commands"}</span>
			</div>
		</div>
	</div>
{/if}
