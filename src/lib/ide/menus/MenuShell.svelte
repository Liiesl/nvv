<script lang="ts">
	import { tick } from "svelte";
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

	$effect.pre(() => {
		pos = clampCtx(x, y, estW, estH);
	});

	async function refine(current: { x: number; y: number }) {
		await tick();
		if (!el) return;
		pos = fitMenuInViewport(el, current.x, current.y);
		if (autofocus) {
			// Container is the initial key-event target (Escape/arrows work
			// even before an item is focused), then move focus to first item
			// so screen readers announce the menu position.
			el.focus?.();
			focusFirstMenuItem(el);
		}
	}

	$effect(() => {
		refine(pos);
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
