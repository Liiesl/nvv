<script lang="ts">
	import FileIcon from "#lib/components/FileIcon.svelte";
	import Icon from "#lib/components/Icon.svelte";
	import { ide } from "#lib/ide/ide.svelte.js";
	import { basename } from "#lib/vfs.js";
</script>

<div class="tabsbar">
	<div class="tabs" role="tablist">
		{#each ide.tabs as t}
			<div
				class="tab"
				class:on={t === ide.active}
				class:dirty={ide.dirty.has(t)}
				class:dragging={ide.dragTab === t}
				role="tab"
				tabindex="0"
				title={t}
				draggable="true"
				aria-selected={t === ide.active}
				onclick={() => ide.openFile(t)}
				onkeydown={(e) => ide.activateOnKey(e, () => ide.openFile(t))}
				onauxclick={(e) => {
					if (e.button === 1) {
						e.preventDefault();
						ide.closeTab(t);
					}
				}}
				oncontextmenu={(e) => {
					e.preventDefault();
					ide.tabCtx = {
						x: e.clientX,
						y: e.clientY,
						path: t,
					};
				}}
				ondragstart={(e) => {
					ide.dragTab = t;
					try {
						e.dataTransfer?.setData("text/plain", t);
					} catch {
						/* noop */
					}
				}}
				ondragend={() => (ide.dragTab = null)}
				ondragover={(e) => e.preventDefault()}
				ondrop={(e) => {
					e.preventDefault();
					try {
						const from = e.dataTransfer?.getData("text/plain") || ide.dragTab;
						if (from) ide.reorderTabs(from, t);
					} catch {
						/* noop */
					}
					ide.dragTab = null;
				}}
			>
				<span class="tabname">
					<FileIcon name={basename(t)} />
					<span>{basename(t)}</span>
					<span class="dirtydot" aria-hidden="true">●</span>
				</span>
				<button
					class="x"
					title="Close (Ctrl+W)"
					aria-label="Close {basename(t)}"
					onclick={(e) => {
						e.stopPropagation();
						ide.closeTab(t);
					}}><Icon name="close" size={13} /></button
				>
			</div>
		{/each}
		<button
			class="newtab"
			title="New File"
			aria-label="New File"
			onclick={() => ide.doCreateFile("/", "untitled.html")}><span>+</span></button
		>
	</div>
	<div class="editor-actions">
		<button
			class="iconbtn"
			title="Split preview right"
			onclick={() => (ide.showPreview = !ide.showPreview)}
			><Icon name="split-horizontal" size={15} /></button
		>
		<button
			class="iconbtn"
			title="More editor actions"
			onclick={(e) => {
				const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
				ide.tabCtx = {
					x: r.left - 120,
					y: r.bottom + 4,
					path: ide.active,
				};
			}}><Icon name="ellipsis" size={15} /></button
		>
	</div>
</div>
