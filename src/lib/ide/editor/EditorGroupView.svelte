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

	type DropZone = "center" | "left" | "right" | "top" | "bottom";

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
	let hoveredZone = $state<DropZone | null>(null);
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

	function zoneFromPointer(e: DragEvent): DropZone {
		const el = e.currentTarget as HTMLElement | null;
		if (!el) return "center";
		const r = el.getBoundingClientRect();
		if (!r.width || !r.height) return "center";
		const x = (e.clientX - r.left) / r.width;
		const y = (e.clientY - r.top) / r.height;
		const EDGE = 0.22;
		if (x < EDGE) return "left";
		if (x > 1 - EDGE) return "right";
		if (y < EDGE) return "top";
		if (y > 1 - EDGE) return "bottom";
		return "center";
	}

	function dragLabel(): string {
		if (!ide.dragTab) return "";
		if (ide.dragIsPreview) return `Preview: ${ide.entry}`;
		return ide.dragTab.split("/").pop() || ide.dragTab;
	}

	function zoneHint(z: DropZone | null): string {
		switch (z) {
			case "left":
				return "Split left";
			case "right":
				return "Split right";
			case "top":
				return "Split up";
			case "bottom":
				return "Split down";
			default:
				return "Move into group";
		}
	}

	function dragItemFromState(): EditorItem | null {
		if (!ide.dragTab) return null;
		if (ide.dragIsPreview) return previewItem();
		return fileItem(ide.dragTab);
	}

	function onZoneDrop(e: DragEvent, where: DropZone) {
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

	function onCatchDragOver(e: DragEvent) {
		if (!ide.dragTab) return;
		// Position-based zones (VSCode/Zed style): edges split, middle moves in.
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
		const cur = ide.dropHover;
		if (!cur || cur.groupId !== groupId || cur.area !== "body") {
			ide.dropHover = { groupId, area: "body", index: null };
		}
		hoveredZone = zoneFromPointer(e);
	}

	function onBodyDrop(e: DragEvent) {
		// Compass buttons handle their own drop; anything else uses the
		// position-derived zone so dropping on an edge highlight just works.
		if ((e.target as HTMLElement)?.closest?.(".compass-btn")) return;
		e.preventDefault();
		e.stopPropagation();
		onZoneDrop(e, hoveredZone ?? "center");
	}

	function onCompassOver(e: DragEvent, zone: DropZone) {
		if (!ide.dragTab) return;
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
		hoveredZone = zone;
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
				<!-- IDE-style overlay: edge highlight + centered compass (VSCode/Zed). -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="dragcatch"
					role="region"
					aria-label="Editor drop target"
					tabindex="-1"
					ondragover={onCatchDragOver}
					ondragleave={dragLeftContainer}
					ondrop={onBodyDrop}
				>
					{#if isBodyHover}
						<div class="dropveil">
							<div class="drop-preview zone-{hoveredZone ?? 'center'}" aria-hidden="true"></div>
							<div class="drop-widget">
								<div class="compass" role="toolbar" aria-label="Editor drop options">
									<button
										type="button"
										class="compass-btn top"
										class:active={hoveredZone === "top"}
										title="Split up"
										aria-label="Split up"
										ondragover={(e) => onCompassOver(e, "top")}
										ondrop={(e) => onZoneDrop(e, "top")}><Icon name="arrow-up" size={14} /></button
									>
									<button
										type="button"
										class="compass-btn left"
										class:active={hoveredZone === "left"}
										title="Split left"
										aria-label="Split left"
										ondragover={(e) => onCompassOver(e, "left")}
										ondrop={(e) => onZoneDrop(e, "left")}
										><span class="flip-x"><Icon name="arrow-right" size={14} /></span></button
									>
									<button
										type="button"
										class="compass-btn center"
										class:active={hoveredZone === "center"}
										title="Move into group"
										aria-label="Move into group"
										ondragover={(e) => onCompassOver(e, "center")}
										ondrop={(e) => onZoneDrop(e, "center")}
										><span class="center-box" aria-hidden="true"></span></button
									>
									<button
										type="button"
										class="compass-btn right"
										class:active={hoveredZone === "right"}
										title="Split right"
										aria-label="Split right"
										ondragover={(e) => onCompassOver(e, "right")}
										ondrop={(e) => onZoneDrop(e, "right")}
										><Icon name="arrow-right" size={14} /></button
									>
									<button
										type="button"
										class="compass-btn bottom"
										class:active={hoveredZone === "bottom"}
										title="Split down"
										aria-label="Split down"
										ondragover={(e) => onCompassOver(e, "bottom")}
										ondrop={(e) => onZoneDrop(e, "bottom")}
										><Icon name="arrow-down" size={14} /></button
									>
								</div>
								<div class="drop-hint" aria-hidden="true">
									<span class="hint-file">{dragLabel()}</span>
									<span class="hint-sep">·</span>
									<span>{zoneHint(hoveredZone)}</span>
								</div>
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
		cursor: copy;
	}
	.dropveil {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.08);
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
	.drop-preview {
		position: absolute;
		background: rgba(55, 148, 255, 0.16);
		border: 1px solid var(--vs-accent2);
		border-radius: 6px;
		box-shadow: inset 0 0 0 1px rgba(55, 148, 255, 0.25);
		pointer-events: none;
		transition: all 90ms ease;
	}
	.drop-preview.zone-center {
		top: 6px;
		right: 6px;
		bottom: 6px;
		left: 6px;
	}
	.drop-preview.zone-left {
		top: 6px;
		bottom: 6px;
		left: 6px;
		width: calc(50% - 9px);
	}
	.drop-preview.zone-right {
		top: 6px;
		right: 6px;
		bottom: 6px;
		width: calc(50% - 9px);
	}
	.drop-preview.zone-top {
		top: 6px;
		right: 6px;
		left: 6px;
		height: calc(50% - 9px);
	}
	.drop-preview.zone-bottom {
		right: 6px;
		bottom: 6px;
		left: 6px;
		height: calc(50% - 9px);
	}
	.drop-widget {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		pointer-events: none;
	}
	.compass {
		display: grid;
		grid-template-columns: repeat(3, 32px);
		grid-template-rows: repeat(3, 32px);
		gap: 4px;
		padding: 8px;
		background: var(--vs-bg2);
		border: 1px solid var(--vs-border);
		border-radius: 10px;
		box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
		pointer-events: auto;
	}
	.compass-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		background: var(--vs-bg3);
		color: var(--vs-fg-dim);
		border: 1px solid var(--vs-border);
		border-radius: 6px;
		cursor: copy;
		transition:
			background 80ms ease,
			color 80ms ease,
			border-color 80ms ease,
			transform 80ms ease;
	}
	.compass-btn:hover,
	.compass-btn.active {
		background: var(--vs-accent2);
		border-color: var(--vs-accent2);
		color: #fff;
	}
	.compass-btn:active {
		transform: scale(0.94);
	}
	.compass-btn:focus-visible {
		outline: 1px solid var(--vs-accent2);
		outline-offset: 1px;
	}
	.compass-btn.top {
		grid-column: 2;
		grid-row: 1;
	}
	.compass-btn.left {
		grid-column: 1;
		grid-row: 2;
	}
	.compass-btn.center {
		grid-column: 2;
		grid-row: 2;
	}
	.compass-btn.right {
		grid-column: 3;
		grid-row: 2;
	}
	.compass-btn.bottom {
		grid-column: 2;
		grid-row: 3;
	}
	.flip-x {
		display: inline-flex;
		transform: rotate(180deg);
	}
	.center-box {
		width: 12px;
		height: 12px;
		border: 1.5px solid currentColor;
		border-radius: 2px;
	}
	.compass-btn.center.active .center-box {
		background: currentColor;
	}
	.drop-hint {
		display: flex;
		align-items: center;
		gap: 6px;
		max-width: 260px;
		overflow: hidden;
		white-space: nowrap;
		font-size: 11px;
		line-height: 1;
		color: var(--vs-fg-dim);
		background: var(--vs-bg2);
		border: 1px solid var(--vs-border);
		border-radius: 999px;
		padding: 6px 10px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
		pointer-events: none;
	}
	.hint-file {
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 150px;
		color: var(--vs-fg);
	}
	.hint-sep {
		opacity: 0.5;
	}
	@media (prefers-reduced-motion: reduce) {
		.drop-preview,
		.compass-btn {
			transition: none;
		}
	}
	.tab.previewtab {
		font-style: normal;
	}
	.tabsbar.droptarget {
		outline: 1px solid var(--vs-accent2);
		outline-offset: -1px;
		background: rgba(55, 148, 255, 0.08);
	}
	.tab.drophover {
		background: rgba(55, 148, 255, 0.15);
		box-shadow: inset 2px 0 0 var(--vs-accent2);
	}
</style>
