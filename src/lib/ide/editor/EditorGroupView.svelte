<script lang="ts">
	import Monaco from "#lib/components/Monaco.svelte";
	import Preview from "#lib/components/Preview.svelte";
	import FileIcon from "#lib/components/FileIcon.svelte";
	import Icon from "#lib/components/Icon.svelte";
	import Welcome from "./Welcome.svelte";
	import { ide, type PreviewApi } from "#lib/ide/ide.svelte.js";
	import { basename, languageOf } from "#lib/vfs.js";
	import { PREVIEW_KEY, itemKey, fileItem, previewItem, type EditorItem } from "#lib/ide/layout.js";
	import { menuKeys, watchOutside } from "#lib/ide/menus/menu.js";

	let { groupId }: { groupId: string } = $props();

	let group = $derived(ide.groups[groupId]);
	let isFocused = $derived(ide.activeGroupId === groupId);
	let isMaxed = $derived(ide.maximizedGroupId === groupId);
	let activeItem = $derived<EditorItem | null>(
		group && group.active >= 0 && group.active < group.tabs.length
			? group.tabs[group.active]
			: null,
	);
	let activeFile = $derived<string | null>(activeItem?.kind === "file" ? activeItem.path : null);
	let hasPreview = $derived<boolean>(group?.tabs.some((t) => t.kind === "preview") ?? false);
	let previewIdx = $derived<number>(group?.tabs.findIndex((t) => t.kind === "preview") ?? -1);

	let previewEl = $state<PreviewApi | null>(null);
	let hoveredZone = $state<string | null>(null);
	let isBodyHover = $derived(ide.dropHover?.groupId === groupId && ide.dropHover?.area === "body");
	let isTabHover = $derived(ide.dropHover?.groupId === groupId && ide.dropHover?.area === "tabs");
	let cursor = $derived(ide.cursorFor(groupId));

	$effect(() => {
		// Singleton preview ref: only the group that owns + shows preview exposes it.
		if (hasPreview && previewEl) {
			ide.previewRef = previewEl;
		}
	});

	function crumbs() {
		if (activeItem?.kind === "preview") return [];
		if (!activeFile) return [];
		return ide.crumbsFor(activeFile);
	}
	function outline() {
		if (!activeFile) return [];
		return ide.outlineFor(activeFile);
	}

	let symBtnEl: HTMLElement | null = $state(null);
	let symMenuEl: HTMLElement | null = $state(null);
	$effect(() => {
		if (!ide.crumbSymMenu) return;
		return watchOutside(
			() => [symMenuEl, symBtnEl],
			() => ide.closeAllMenus(),
		);
	});

	function tabKey(t: EditorItem): string {
		return itemKey(t);
	}
	function tabLabel(t: EditorItem): string {
		if (t.kind === "preview") return `Preview: ${ide.entry}`;
		return basename(t.path);
	}
	function tabTitle(t: EditorItem): string {
		if (t.kind === "preview") return `Preview: ${ide.entry}`;
		return t.path;
	}

	function onTabClick(idx: number) {
		ide.activateTab(groupId, idx);
	}
	function onTabClose(e: MouseEvent, idx: number) {
		e.stopPropagation();
		ide.closeTabInGroup(groupId, idx);
	}
	function onTabCtx(e: MouseEvent, idx: number) {
		e.preventDefault();
		const t = group.tabs[idx];
		ide.activeGroupId = groupId;
		if (t.kind === "preview") {
			ide.openTabCtx({ x: e.clientX, y: e.clientY, path: PREVIEW_KEY, groupId, isPreview: true });
		} else {
			ide.openTabCtx({ x: e.clientX, y: e.clientY, path: t.path, groupId, isPreview: false });
		}
	}

	function onDragStart(e: DragEvent, idx: number) {
		const t = group.tabs[idx];
		ide.activeGroupId = groupId;
		if (t.kind === "preview") {
			ide.dragTab = PREVIEW_KEY;
			ide.dragIsPreview = true;
		} else {
			ide.dragTab = t.path;
			ide.dragIsPreview = false;
		}
		ide.dragFromGroup = groupId;
		try {
			e.dataTransfer?.setData("text/plain", tabKey(t));
			if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
		} catch {
			/* noop */
		}
	}
	function onDragEnd() {
		ide.dragTab = null;
		ide.dragFromGroup = null;
		ide.dragIsPreview = false;
		ide.dropHover = null;
		hoveredZone = null;
	}
	function onTabBarDrop(e: DragEvent, targetIdx: number) {
		e.preventDefault();
		e.stopPropagation();
		const from = ide.dragFromGroup;
		const key = ide.dragTab ? (ide.dragIsPreview ? PREVIEW_KEY : `file:${ide.dragTab}`) : null;
		const dtKey = (() => {
			try {
				return e.dataTransfer?.getData("text/plain") || null;
			} catch {
				return null;
			}
		})();
		const k = key ?? dtKey;
		if (!from || !k) {
			ide.dragTab = null;
			ide.dragFromGroup = null;
			return;
		}
		if (from === groupId) {
			const target = group.tabs[targetIdx];
			if (target) ide.reorderTabsInGroup(groupId, k, itemKey(target));
		} else {
			ide.moveTabToGroup(from, groupId, k);
		}
		ide.dragTab = null;
		ide.dragFromGroup = null;
		ide.dragIsPreview = false;
		ide.dropHover = null;
		hoveredZone = null;
	}

	function dragLeftContainer(e: DragEvent) {
		// Only clear when truly leaving the container (not moving between children).
		const cur = e.currentTarget as HTMLElement | null;
		const rel = e.relatedTarget as Node | null;
		if (cur && rel && cur.contains(rel)) return;
		if (ide.dropHover?.groupId === groupId) ide.dropHover = null;
		if (hoveredZone) hoveredZone = null;
	}

	function dragItemFromState(): EditorItem | null {
		if (!ide.dragTab) return null;
		if (ide.dragIsPreview) return previewItem();
		return fileItem(ide.dragTab);
	}

	function onZoneDrop(e: DragEvent, where: "center" | "left" | "right" | "top" | "bottom") {
		e.preventDefault();
		e.stopPropagation();
		const from = ide.dragFromGroup;
		const item = dragItemFromState();
		if (!from || !item) {
			onDragEnd();
			return;
		}
		if (where === "center") {
			if (from !== groupId) {
				ide.moveTabToGroup(from, groupId, itemKey(item));
			} else {
				ide.activateTab(
					groupId,
					group.tabs.findIndex((t) => itemKey(t) === itemKey(item)),
				);
			}
		} else if (where === "left") {
			ide.splitGroupWithItem(groupId, "row", item, false);
		} else if (where === "right") {
			ide.splitGroupWithItem(groupId, "row", item, true);
		} else if (where === "top") {
			ide.splitGroupWithItem(groupId, "col", item, false);
		} else if (where === "bottom") {
			ide.splitGroupWithItem(groupId, "col", item, true);
		}
		onDragEnd();
	}

	function onBodyDragOver(e: DragEvent) {
		if (!ide.dragTab) return;
		// Keep overlay mounted for the whole drag (no show/hide flicker).
		// Just allow the drop and hint the operation.
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
	}

	function onCatchDragOver(e: DragEvent) {
		if (!ide.dragTab) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
		const cur = ide.dropHover;
		if (!cur || cur.groupId !== groupId || cur.area !== "body") {
			ide.dropHover = { groupId, area: "body", index: null };
		}
	}

	function onTabHover(e: DragEvent, index: number | null) {
		if (!ide.dragTab) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
		ide.dropHover = { groupId, area: "tabs", index };
	}
</script>

{#if group}
	<div
		class="egroup"
		class:focused={isFocused}
		onpointerdown={() => {
			if (ide.activeGroupId !== groupId) ide.focusGroup(groupId);
		}}
		role="group"
		aria-label="Editor group"
	>
		<div class="tabsbar" class:droptarget={isTabHover}>
			<div
				class="tabs"
				role="tablist"
				tabindex="0"
				ondragover={(e) => onTabHover(e, null)}
				ondragleave={dragLeftContainer}
				ondrop={(e) => {
					// Drop on empty tab-bar space: move here.
					if ((e.target as HTMLElement)?.closest?.(".tab")) return;
					e.preventDefault();
					const from = ide.dragFromGroup;
					const item = dragItemFromState();
					if (from && item && from !== groupId) {
						ide.moveTabToGroup(from, groupId, itemKey(item));
					}
					onDragEnd();
				}}
			>
				{#each group.tabs as t, i (tabKey(t))}
					<div
						class="tab"
						class:on={i === group.active}
						class:dirty={t.kind === "file" && ide.dirty.has(t.path)}
						class:dragging={ide.dragTab !== null &&
							((ide.dragIsPreview && t.kind === "preview") ||
								(!ide.dragIsPreview && t.kind === "file" && t.path === ide.dragTab)) &&
							ide.dragFromGroup === groupId}
						class:drophover={ide.dropHover?.groupId === groupId &&
							ide.dropHover?.area === "tabs" &&
							ide.dropHover?.index === i}
						class:previewtab={t.kind === "preview"}
						role="tab"
						tabindex="0"
						title={tabTitle(t)}
						draggable="true"
						aria-selected={i === group.active}
						onclick={() => onTabClick(i)}
						onkeydown={(e) => ide.activateOnKey(e, () => onTabClick(i))}
						onauxclick={(e) => {
							if (e.button === 1) {
								e.preventDefault();
								ide.closeTabInGroup(groupId, i);
							}
						}}
						oncontextmenu={(e) => onTabCtx(e, i)}
						ondragstart={(e) => onDragStart(e, i)}
						ondragend={onDragEnd}
						ondragover={(e) => onTabHover(e, i)}
						ondrop={(e) => onTabBarDrop(e, i)}
					>
						<span class="tabname">
							{#if t.kind === "preview"}
								<Icon name="browser" size={13} />
							{:else}
								<FileIcon name={basename(t.path)} />
							{/if}
							<span>{tabLabel(t)}</span>
							{#if t.kind === "file"}
								<span class="dirtydot" aria-hidden="true"
									><Icon name="circle-filled" size={8} /></span
								>
							{/if}
						</span>
						<button
							class="x"
							title="Close"
							aria-label={t.kind === "preview" ? "Close preview tab" : `Close ${basename(t.path)}`}
							onclick={(e) => onTabClose(e, i)}><Icon name="close" size={13} /></button
						>
					</div>
				{/each}
				<button
					class="newtab"
					title="New File"
					aria-label="New File"
					onclick={() => ide.doCreateFile("/", "untitled.html")}
					><Icon name="add" size={14} /></button
				>
			</div>
			<div class="editor-actions">
				<button
					class="iconbtn"
					title="Split right (duplicate file / move preview)"
					aria-label="Split right"
					onclick={() => {
						ide.activeGroupId = groupId;
						ide.splitGroup(groupId, "row");
					}}><Icon name="split-horizontal" size={15} /></button
				>
				<button
					class="iconbtn"
					title="Split down"
					aria-label="Split down"
					onclick={() => {
						ide.activeGroupId = groupId;
						ide.splitGroup(groupId, "col");
					}}
					><span style="display:inline-flex;transform:rotate(90deg)"
						><Icon name="split-horizontal" size={15} /></span
					></button
				>
				<button
					class="iconbtn"
					class:on={isMaxed}
					title={isMaxed ? "Exit maximized group (Esc)" : "Maximize group"}
					aria-label={isMaxed ? "Exit maximized group" : "Maximize group"}
					aria-pressed={isMaxed}
					onclick={() => ide.toggleMaximize(groupId)}
					><Icon name={isMaxed ? "fullscreen-exit" : "fullscreen"} size={14} /></button
				>
				{#if ide.groupCount > 1}
					<button
						class="iconbtn"
						title="Close group"
						aria-label="Close group"
						onclick={() => ide.closeGroup(groupId)}><Icon name="close" size={14} /></button
					>
				{/if}
				<button
					class="iconbtn"
					title="More editor actions"
					onclick={(e) => {
						const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
						const cur = group.active >= 0 ? group.tabs[group.active] : null;
						ide.activeGroupId = groupId;
						ide.openTabCtx({
							x: r.left - 120,
							y: r.bottom + 4,
							path: cur?.kind === "file" ? cur.path : cur?.kind === "preview" ? PREVIEW_KEY : "",
							groupId,
							isPreview: cur?.kind === "preview",
						});
					}}><Icon name="ellipsis" size={15} /></button
				>
			</div>
		</div>

		{#if activeItem?.kind === "file" && activeFile}
			{@const cr = crumbs()}
			{#if cr.length}
				<div class="crumbs">
					{#each cr as c, ci}
						<button
							type="button"
							class="crumb"
							class:file={c.isFile}
							title={c.path}
							onclick={() => {
								if (c.path === "/") {
									ide.sideView = "explorer";
									ide.sidebar = true;
								} else if (ide.filesSnap[c.path]?.type === "file") ide.openFile(c.path, groupId);
								else {
									ide.sideView = "explorer";
									ide.sidebar = true;
								}
							}}
							>{#if c.isFile}<FileIcon name={c.label} />{/if}{c.label}</button
						>
						{#if ci < cr.length - 1}<Icon name="chevron-right" size={12} />{/if}
					{/each}
					{#if outline().length > 0}
						<span class="symwrap">
							<Icon name="chevron-right" size={12} />
							<button
								type="button"
								class="crumb sym"
								title="Go to symbol in file"
								aria-haspopup="menu"
								aria-expanded={ide.crumbSymMenu}
								bind:this={symBtnEl}
								onclick={() => {
									ide.activeGroupId = groupId;
									ide.openOnly(() => (ide.crumbSymMenu = true));
								}}
								><Icon name="target" size={13} />
								{outline()[0]?.label ?? ""}
								<Icon name="chevron-down" size={12} /></button
							>
							{#if ide.crumbSymMenu && isFocused}
								<div
									class="symmenu"
									role="menu"
									tabindex="-1"
									bind:this={symMenuEl}
									onkeydown={(e) =>
										menuKeys(e, e.currentTarget as HTMLElement, () => ide.closeAllMenus())}
									oncontextmenu={(e) => e.preventDefault()}
								>
									{#each outline().slice(0, 20) as o}
										<button
											onclick={() => {
												ide.revealLine = 0;
												requestAnimationFrame(() => (ide.revealLine = o.line));
												ide.closeAllMenus();
											}}
											><span class="okind">{o.kind}</span>
											{o.label} <small>:{o.line}</small></button
										>
									{/each}
								</div>
							{/if}
						</span>
					{/if}
					<span class="crumb-right">
						<button
							type="button"
							class="mini-crumb"
							title="Select Language Mode"
							onclick={() => (ide.langPick = true)}>{languageOf(activeFile)}</button
						>
						<span>·</span>
						<button
							type="button"
							class="mini-crumb"
							title="Go to Line/Column"
							onclick={() => {
								ide.activeGroupId = groupId;
								ide.gotoDraft = String(cursor.line);
								ide.gotoOpen = true;
							}}>Ln {cursor.line}, Col {cursor.col}</button
						>
					</span>
				</div>
			{/if}
		{/if}

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="egroup-body"
			role="tabpanel"
			tabindex="0"
			aria-label="Editor panel"
			oncontextmenu={(e) => {
				const el = e.target as HTMLElement;
				if (el.closest(".monaco-host")) {
					e.preventDefault();
					ide.openEditorCtx({ x: e.clientX, y: e.clientY });
				}
			}}
		>
			{#if hasPreview}
				<div
					class="epreview"
					style={activeItem?.kind === "preview" ? "" : "display:none"}
					aria-hidden={activeItem?.kind === "preview" ? undefined : true}
				>
					<Preview
						files={ide.filesSnap}
						entry={ide.entry}
						projectId={ide.activeProjectIdSnap}
						auto={ide.autoReload}
						onLog={(k, t) => ide.onLog(k, t)}
						zoomed={isMaxed}
						onToggleZoom={() => ide.toggleMaximize(groupId)}
						onInspectSelect={(i) => ide.handleInspectSelect(i)}
						bind:this={previewEl}
					/>
				</div>
			{/if}
			{#if activeItem?.kind === "file" && activeFile && ide.filesSnap[activeFile]}
				<div class="efile">
					<Monaco
						path={activeFile}
						content={ide.filesSnap[activeFile]?.content ?? ""}
						fontSize={ide.fontSize}
						minimapOn={ide.minimapOn}
						revealLine={isFocused ? ide.revealLine : 0}
						inspectTarget={ide.inspectTarget}
						onInspectClear={() => ide.handleInspectClearFromEditor()}
						onChange={(v) => ide.onEdit(v, activeFile)}
						onCursor={(l, c) => {
							ide.setGroupCursor(groupId, l, c);
						}}
					/>
				</div>
			{:else if activeItem?.kind !== "preview"}
				<Welcome />
			{/if}

			{#if ide.dragTab}
				<!-- Transparent catch layer: keeps dragover alive over Monaco/iframe. -->
				<!-- Drop grid only renders in the hovered group (no all-groups flash). -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="dragcatch"
					role="region"
					aria-label="Editor drop target"
					tabindex="-1"
					ondragover={onCatchDragOver}
					ondragleave={dragLeftContainer}
					ondrop={(e) => {
						if ((e.target as HTMLElement)?.closest?.(".dropzone")) return;
						e.preventDefault();
						const from = ide.dragFromGroup;
						const item = dragItemFromState();
						if (from && item && from !== groupId) ide.moveTabToGroup(from, groupId, itemKey(item));
						onDragEnd();
					}}
				>
					{#if isBodyHover}
						<div class="dropveil">
							<div class="dropgrid">
								<button
									class="dropzone top"
									class:hover={hoveredZone === "top"}
									ondrop={(e) => onZoneDrop(e, "top")}
									ondragover={(e) => {
										e.preventDefault();
										hoveredZone = "top";
									}}>Top</button
								>
								<button
									class="dropzone left"
									class:hover={hoveredZone === "left"}
									ondrop={(e) => onZoneDrop(e, "left")}
									ondragover={(e) => {
										e.preventDefault();
										hoveredZone = "left";
									}}>Left</button
								>
								<button
									class="dropzone center"
									class:hover={hoveredZone === "center"}
									ondrop={(e) => onZoneDrop(e, "center")}
									ondragover={(e) => {
										e.preventDefault();
										hoveredZone = "center";
									}}>Center</button
								>
								<button
									class="dropzone right"
									class:hover={hoveredZone === "right"}
									ondrop={(e) => onZoneDrop(e, "right")}
									ondragover={(e) => {
										e.preventDefault();
										hoveredZone = "right";
									}}>Right</button
								>
								<button
									class="dropzone bottom"
									class:hover={hoveredZone === "bottom"}
									ondrop={(e) => onZoneDrop(e, "bottom")}
									ondragover={(e) => {
										e.preventDefault();
										hoveredZone = "bottom";
									}}>Bottom</button
								>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{:else}
	<div class="egroup"><Welcome /></div>
{/if}

<style>
	.egroup {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		flex: 1;
		background: var(--vs-bg);
	}
	.egroup-body {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		min-width: 0;
		overflow: hidden;
	}
	.efile,
	.epreview {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		min-width: 0;
	}
	.epreview {
		background: #fff;
	}
	.dragcatch {
		position: absolute;
		inset: 0;
		z-index: 20;
		/* Transparent: only catches drag over Monaco/iframe. No flash. */
		background: transparent;
		pointer-events: auto;
	}
	.dropveil {
		position: absolute;
		inset: 0;
		background: rgba(0, 122, 204, 0.12);
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: auto;
	}
	.dropgrid {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		grid-template-rows: 1fr 1fr 1fr;
		gap: 4px;
		width: 70%;
		height: 70%;
		pointer-events: auto;
	}
	.dropzone {
		background: rgba(55, 148, 255, 0.25);
		border: 1px dashed var(--vs-accent2);
		color: #fff;
		border-radius: 4px;
		font-size: 11px;
		cursor: copy;
	}
	.dropzone:hover,
	.dropzone.hover {
		background: rgba(55, 148, 255, 0.5);
	}
	.dropzone.top {
		grid-column: 2;
		grid-row: 1;
	}
	.dropzone.left {
		grid-column: 1;
		grid-row: 2;
	}
	.dropzone.center {
		grid-column: 2;
		grid-row: 2;
	}
	.dropzone.right {
		grid-column: 3;
		grid-row: 2;
	}
	.dropzone.bottom {
		grid-column: 2;
		grid-row: 3;
	}
	.tab.previewtab {
		font-style: normal;
	}
	.tabsbar.droptarget {
		outline: 1px solid var(--vs-accent2);
		outline-offset: -1px;
		background: rgba(55, 148, 255, 0.12);
	}
	.tab.drophover {
		outline: 1px solid var(--vs-accent2);
		outline-offset: -1px;
		background: rgba(55, 148, 255, 0.2);
	}
</style>
