<script lang="ts">
	import Explorer from "#lib/components/Explorer.svelte";
	import FileIcon from "#lib/components/FileIcon.svelte";
	import Icon from "#lib/components/Icon.svelte";
	import { ide } from "#lib/ide/ide.svelte.js";
	import { basename } from "#lib/vfs.js";
</script>

<button
	type="button"
	class="sec-title collapsible"
	onclick={() => (ide.openEditorsOpen = !ide.openEditorsOpen)}
>
	<Icon name={ide.openEditorsOpen ? "chevron-down" : "chevron-right"} size={14} />
	OPEN EDITORS
	<small>{ide.tabs.length}</small>
</button>
{#if ide.openEditorsOpen}
	<div class="openeditors">
		{#each ide.tabs as t}
			<div
				class="trow openrow"
				class:on={t === ide.active}
				role="treeitem"
				tabindex="0"
				aria-selected={t === ide.active}
				title={t}
				onclick={() => ide.openFile(t)}
				onkeydown={(e) => ide.activateOnKey(e, () => ide.openFile(t))}
			>
				<span class="ic"><FileIcon name={basename(t)} /></span>
				<span class="nm">{basename(t)}</span>
				<span class="opath">{t.slice(0, t.lastIndexOf("/") + 1) || "/"}</span>
				{#if ide.dirty.has(t)}<span class="dirtymini"><Icon name="circle-filled" size={8} /></span
					>{:else}
					<button
						class="x"
						title="Close"
						aria-label="Close {basename(t)}"
						onclick={(e) => {
							e.stopPropagation();
							ide.closeTab(t);
						}}><Icon name="close" size={12} /></button
					>
				{/if}
			</div>
		{/each}
		{#if ide.tabs.length === 0}<div class="oempty">No open editors.</div>{/if}
	</div>
{/if}
<div class="sec-title">
	<Icon name="chevron-down" size={14} />
	{ide.activeProjectName} · {ide.fileCount} files
</div>
<Explorer
	files={ide.filesSnap}
	active={ide.active}
	collapseNonce={ide.collapseNonce}
	onOpen={(p) => {
		ide.openFile(p);
	}}
	onCreateFile={(d, n) => ide.doCreateFile(d, n)}
	onCreateFolder={(d, n) => ide.doCreateFolder(d, n)}
	onRename={(a, b) => ide.renamePath(a, b)}
	onDelete={(p) => {
		ide.removePath(p);
	}}
/>
<button
	type="button"
	class="sec-title collapsible"
	onclick={() => (ide.outlineOpen = !ide.outlineOpen)}
>
	<Icon name={ide.outlineOpen ? "chevron-down" : "chevron-right"} size={14} />
	OUTLINE
	<small>{ide.outline.length}</small>
</button>
{#if ide.outlineOpen}
	<div class="outline">
		{#each ide.outline as o}
			<button
				type="button"
				class="orow"
				title="Go to line {o.line}"
				onclick={() => {
					ide.revealLine = 0;
					requestAnimationFrame(() => (ide.revealLine = o.line));
				}}
			>
				<span class="okind">{o.kind}</span>
				<span class="olabel">{o.label}</span>
				<span class="oline">{o.line}</span>
			</button>
		{/each}
		{#if ide.outline.length === 0}
			<div class="oempty">No symbols in active file.</div>
		{/if}
	</div>
{/if}
<button
	type="button"
	class="sec-title collapsible"
	onclick={() => (ide.timelineOpen = !ide.timelineOpen)}
>
	<Icon name={ide.timelineOpen ? "chevron-down" : "chevron-right"} size={14} />
	TIMELINE
</button>
{#if ide.timelineOpen}
	<div class="timeline">
		<div class="tline">
			<span>Project updated</span><small
				>{ide.activeProject ? new Date(ide.activeProject.updatedAt).toLocaleString() : "—"}</small
			>
		</div>
		<div class="tline">
			<span>Entry</span><small>{ide.entry}</small>
		</div>
		<div class="tline">
			<span>Unsaved changes</span><small>{ide.dirty.size}</small>
		</div>
	</div>
{/if}
