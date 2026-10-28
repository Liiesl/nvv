<script lang="ts">
	import type { SplitNode } from "#lib/ide/layout.js";
	import { ide } from "#lib/ide/ide.svelte.js";
	import EditorGroupView from "./EditorGroupView.svelte";
	import SplitView from "./SplitView.svelte";

	let { node }: { node: SplitNode } = $props();

	let dragIdx = $state<number | null>(null);
	let startPos = $state(0);
	let startSizes = $state<number[]>([]);
	let containerEl: HTMLElement | null = $state(null);

	function sashDown(e: PointerEvent, idx: number, splitId: string, dir: "row" | "col") {
		if (e.pointerType === "mouse" && e.button !== 0) return;
		const split = ide.findSplitById(splitId);
		if (!split) return;
		dragIdx = idx;
		startSizes = [...split.sizes];
		startPos = dir === "row" ? e.clientX : e.clientY;
		ide.splitDrag = true;
		ide.setBodyDragCursor(dir === "row" ? "col" : "row");
		(e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
		e.preventDefault();
	}

	function sashMove(e: PointerEvent, splitId: string, dir: "row" | "col") {
		if (dragIdx === null) return;
		const el = containerEl;
		if (!el) return;
		const r = el.getBoundingClientRect();
		const total = dir === "row" ? r.width : r.height;
		if (!total) return;
		const cur = dir === "row" ? e.clientX : e.clientY;
		const deltaPct = ((cur - startPos) / total) * 100;
		const next = [...startSizes];
		const a = next[dragIdx] + deltaPct;
		const b = next[dragIdx + 1] - deltaPct;
		if (a < 15 || b < 15 || a > 85 || b > 85) return;
		next[dragIdx] = a;
		next[dragIdx + 1] = b;
		ide.setSplitSizes(splitId, next);
	}

	function sashUp(e: PointerEvent) {
		if (dragIdx === null) return;
		dragIdx = null;
		ide.splitDrag = false;
		ide.setBodyDragCursor("");
		try {
			(e.currentTarget as HTMLElement)?.releasePointerCapture?.(e.pointerId);
		} catch {
			/* noop */
		}
	}
</script>

{#if node.type === "leaf"}
	<div
		class="tile-leaf"
		data-group={node.groupId}
		class:maxed={ide.maximizedGroupId === node.groupId}
	>
		<EditorGroupView groupId={node.groupId} />
	</div>
{:else}
	<div
		class="tile-split"
		class:row={node.dir === "row"}
		class:col={node.dir === "col"}
		bind:this={containerEl}
	>
		{#each node.children as child, i (child.type === "leaf" ? child.groupId : child.id)}
			<div
				class="tile-child"
				style={node.dir === "row"
					? `flex: 0 0 ${node.sizes[i]}%; max-width:${node.sizes[i]}%`
					: `flex: 0 0 ${node.sizes[i]}%; max-height:${node.sizes[i]}%`}
			>
				<SplitView node={child} />
			</div>
			{#if i < node.children.length - 1}
				<div
					class="tile-sash"
					class:row={node.dir === "row"}
					class:col={node.dir === "col"}
					class:drag={dragIdx === i}
					role="slider"
					tabindex="0"
					aria-orientation={node.dir === "row" ? "vertical" : "horizontal"}
					aria-label={node.dir === "row" ? "Resize columns" : "Resize rows"}
					aria-valuemin={15}
					aria-valuemax={85}
					aria-valuenow={Math.round(node.sizes[i])}
					onpointerdown={(e) => sashDown(e, i, node.id, node.dir)}
					onpointermove={(e) => sashMove(e, node.id, node.dir)}
					onpointerup={sashUp}
					onpointercancel={sashUp}
					ondblclick={() =>
						ide.setSplitSizes(
							node.id,
							node.children.map(() => 100 / node.children.length),
						)}
					onkeydown={(e) => {
						if (e.key === "ArrowLeft" && node.dir === "row") ide.resizeSplit(node.id, i, -2);
						if (e.key === "ArrowRight" && node.dir === "row") ide.resizeSplit(node.id, i, 2);
						if (e.key === "ArrowUp" && node.dir === "col") ide.resizeSplit(node.id, i, -2);
						if (e.key === "ArrowDown" && node.dir === "col") ide.resizeSplit(node.id, i, 2);
					}}
				></div>
			{/if}
		{/each}
	</div>
{/if}
