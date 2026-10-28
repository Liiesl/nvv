<script lang="ts">
	import Monaco from "#lib/components/Monaco.svelte";
	import Preview from "#lib/components/Preview.svelte";
	import { ide, type PreviewApi } from "#lib/ide/ide.svelte.js";
	import Welcome from "./Welcome.svelte";

	let splitEl: HTMLElement | null = $state(null);
	let sashEl: HTMLElement | null = $state(null);
	let previewEl = $state<PreviewApi | null>(null);

	$effect(() => {
		ide.previewRef = previewEl;
	});

	function applySashMove(clientX: number) {
		const el = splitEl;
		if (!el) return;
		const r = el.getBoundingClientRect();
		if (!r.width) return;
		ide.applyEditorPct(clientX, r.left, r.width);
	}

	function sashPointerDown(e: PointerEvent) {
		if (e.pointerType === "mouse" && e.button !== 0) return;
		ide.dragging = true;
		e.preventDefault();
		try {
			sashEl?.setPointerCapture?.(e.pointerId);
		} catch {
			/* noop */
		}
		ide.setBodyDragCursor("col");
		applySashMove(e.clientX);
	}

	function sashPointerMove(e: PointerEvent) {
		if (!ide.dragging) return;
		e.preventDefault();
		applySashMove(e.clientX);
	}

	function endSashDrag(e?: PointerEvent) {
		if (!ide.dragging) return;
		ide.dragging = false;
		ide.setBodyDragCursor("");
		try {
			if (e && sashEl?.hasPointerCapture?.(e.pointerId))
				sashEl?.releasePointerCapture?.(e.pointerId);
		} catch {
			/* noop */
		}
	}
</script>

<div class="split" bind:this={splitEl}>
	<div
		class="editorpane"
		role="group"
		aria-label="Editor"
		style={ide.showPreview ? `flex: 0 0 ${ide.editorPct}%` : "flex: 1 1 0%"}
		oncontextmenu={(e) => {
			const el = e.target as HTMLElement;
			if (el.closest(".monaco-host")) {
				e.preventDefault();
				ide.openEditorCtx({ x: e.clientX, y: e.clientY });
			}
		}}
	>
		{#if ide.active && ide.filesSnap[ide.active]}
			<Monaco
				path={ide.active}
				content={ide.content}
				fontSize={ide.fontSize}
				minimapOn={ide.minimapOn}
				revealLine={ide.revealLine}
				inspectTarget={ide.inspectTarget}
				onInspectClear={() => ide.handleInspectClearFromEditor()}
				onChange={(v) => ide.onEdit(v)}
				onCursor={(l: number, c: number) => {
					ide.line = l;
					ide.col = c;
				}}
			/>
		{:else}
			<Welcome />
		{/if}
	</div>
	{#if ide.showPreview}
		<div
			class="sash"
			class:drag={ide.dragging}
			role="slider"
			tabindex="0"
			aria-orientation="vertical"
			aria-label="Resize editor and preview"
			aria-valuenow={Math.round(ide.editorPct)}
			aria-valuemin={15}
			aria-valuemax={85}
			bind:this={sashEl}
			onpointerdown={sashPointerDown}
			onpointermove={sashPointerMove}
			onpointerup={(e) => endSashDrag(e)}
			onpointercancel={(e) => endSashDrag(e)}
			ondblclick={() => (ide.editorPct = 55)}
			onkeydown={(e) => {
				if (e.key === "ArrowLeft") ide.editorPct = Math.max(15, ide.editorPct - 2);
				if (e.key === "ArrowRight") ide.editorPct = Math.min(85, ide.editorPct + 2);
			}}
		></div>
		<div
			class="previewpane"
			style={`flex: 0 0 ${100 - ide.editorPct}%`}
			class:dragging={ide.dragging}
		>
			<Preview
				files={ide.filesSnap}
				entry={ide.entry}
				projectId={ide.activeProjectIdSnap}
				auto={ide.autoReload}
				onLog={(k, t) => ide.onLog(k, t)}
				zoomed={ide.previewZoomed}
				onToggleZoom={() => ide.togglePreviewZoom()}
				onInspectSelect={(i) => ide.handleInspectSelect(i)}
				bind:this={previewEl}
			/>
		</div>
	{/if}
</div>
{#if ide.dragging}
	<div class="dragveil" aria-hidden="true"></div>
{/if}
