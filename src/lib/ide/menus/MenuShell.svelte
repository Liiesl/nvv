<script lang="ts">
	import { tick, untrack } from "svelte";
	import type { Snippet } from "svelte";
	import {
		clampCtx,
		fitMenuInViewport,
		focusFirstMenuItem,
		menuKeys,
		watchOutside,
	} from "./menu.js";

	let {
		x,
		y,
		label,
		onClose,
		estW = 230,
		estH = 320,
		autofocus = true,
		children,
	}: {
		x: number;
		y: number;
		label: string;
		onClose: () => void;
		estW?: number;
		estH?: number;
		autofocus?: boolean;
		children?: Snippet;
	} = $props();

	// Position is derived from the anchor on every change, then refined
	// after mount by measuring the rendered menu (viewport flip).
	let pos = $state({ x: 0, y: 0 });
	let el: HTMLElement | null = $state(null);
	let refineSeq = 0;

	function setPos(nx: number, ny: number) {
		const same = untrack(() => pos.x === nx && pos.y === ny);
		if (!same) pos = { x: nx, y: ny };
	}

	$effect.pre(() => {
		const c = clampCtx(x, y, estW, estH);
		setPos(c.x, c.y);
	});

	async function refine(sx: number, sy: number, seq: number) {
		await tick();
		if (seq !== refineSeq) return;
		const node = untrack(() => el);
		if (!node) return;
		const n = fitMenuInViewport(node, sx, sy);
		untrack(() => {
			if (n.x !== pos.x || n.y !== pos.y) pos = n;
		});
		if (seq !== refineSeq) return;
		if (untrack(() => autofocus)) {
			// Container is the initial key-event target (Escape/arrows work
			// even before an item is focused), then move focus to first item
			// so screen readers announce the menu position.
			node.focus?.();
			focusFirstMenuItem(node);
		}
	}

	// Track only the anchor + mount node. `pos` itself is deliberately
	// NOT tracked here (read via untrack) so the write inside refine()
	// cannot re-trigger this effect into an infinite tick() loop.
	$effect(() => {
		const cx = x;
		const cy = y;
		const ew = estW;
		const eh = estH;
		const node = el;
		if (!node) return;
		const start = clampCtx(cx, cy, ew, eh);
		refineSeq += 1;
		const seq = refineSeq;
		refine(start.x, start.y, seq);
	});

	// No veil overlay: it would sit above other triggers and swallow the
	// second click. Dismiss via capture-phase outside detection instead,
	// so clicking another trigger switches menus in a single click.
	$effect(() => {
		if (!el) return;
		return watchOutside(() => [el], onClose);
	});
</script>

<div
	class="ctx menu-shell"
	bind:this={el}
	role="menu"
	tabindex="-1"
	aria-label={label}
	style={`left:${pos.x}px;top:${pos.y}px`}
	onkeydown={(e) => menuKeys(e, el, onClose)}
	oncontextmenu={(e) => e.preventDefault()}
>
	{@render children?.()}
</div>

<style>
	.menu-shell {
		z-index: 80;
		max-height: min(60vh, 420px);
		overflow: auto;
	}
</style>
