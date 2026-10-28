// Shared menu helpers — hover / interaction / position for ALL menus.
// No string-based element selection: items are found by walking the DOM
// and testing node types / disabled state.

export interface CtxPos {
	x: number;
	y: number;
}

/** Clamp a cursor-anchored menu into the viewport. */
export function clampCtx(x: number, y: number, estW = 230, estH = 320, margin = 8): CtxPos {
	if (typeof window === "undefined") return { x, y };
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	return {
		x: Math.max(margin, Math.min(x, vw - estW - margin)),
		y: Math.max(margin, Math.min(y, vh - estH - margin)),
	};
}

/** Measure a rendered menu el and re-clamp so it never overflows. */
export function fitMenuInViewport(el: HTMLElement, x: number, y: number, margin = 8): CtxPos {
	if (typeof window === "undefined") return { x, y };
	const r = el.getBoundingClientRect();
	const w = r.width || 230;
	const h = r.height || 200;
	let nx = x;
	let ny = y;
	if (nx + w > window.innerWidth - margin) nx = window.innerWidth - w - margin;
	if (ny + h > window.innerHeight - margin) ny = window.innerHeight - h - margin;
	return { x: Math.max(margin, nx), y: Math.max(margin, ny) };
}

function collectButtons(root: HTMLElement): HTMLButtonElement[] {
	const out: HTMLButtonElement[] = [];
	const walk = (node: Node) => {
		if (node instanceof HTMLButtonElement) {
			if (!node.disabled) out.push(node);
		}
		node.childNodes.forEach(walk);
	};
	walk(root);
	return out;
}

/**
 * Apply roving tabindex to menu buttons: active item gets 0, rest get -1.
 * Container keeps tabindex -1 so it can receive initial focus and key events.
 */
export function initMenuItems(container: HTMLElement | null, activeIndex = 0) {
	if (!container) return [];
	const items = collectButtons(container);
	items.forEach((btn, i) => {
		btn.tabIndex = i === activeIndex ? 0 : -1;
		if (!btn.hasAttribute("role")) btn.setAttribute("role", "menuitem");
	});
	return items;
}

/** Focus the first focusable item inside a menu container. */
export function focusFirstMenuItem(container: HTMLElement | null) {
	if (!container) return;
	const items = collectButtons(container);
	items.forEach((btn, i) => {
		btn.tabIndex = i === 0 ? 0 : -1;
		if (!btn.hasAttribute("role")) btn.setAttribute("role", "menuitem");
	});
	items[0]?.focus?.();
}

/**
 * Dismiss a menu on outside click / right-click.
 * Capture-phase so it runs before trigger handlers: same-component triggers
 * must be listed in getNodes (then their clicks are ignored and their own
 * toggle runs), while other-component triggers dismiss-then-act in one click.
 * No string selectors — nodes are passed as element references.
 * Returns a cleanup function for use in $effect.
 */
export function watchOutside(getNodes: () => (HTMLElement | null)[], onDismiss: () => void) {
	if (typeof window === "undefined") return () => {};
	const inside = (t: EventTarget | null) => {
		if (!(t instanceof Node)) return false;
		for (const n of getNodes()) {
			if (n && (n === t || n.contains(t))) return true;
		}
		return false;
	};
	const onClick = (e: MouseEvent) => {
		if (!inside(e.target)) onDismiss();
	};
	const onCtx = (e: MouseEvent) => {
		if (inside(e.target)) return;
		e.preventDefault();
		onDismiss();
	};
	window.addEventListener("click", onClick, true);
	window.addEventListener("contextmenu", onCtx, true);
	return () => {
		window.removeEventListener("click", onClick, true);
		window.removeEventListener("contextmenu", onCtx, true);
	};
}

/**
 * VS Code-style keyboard nav driven by registered item order.
 * ArrowDown/Up move, Home/End jump, Escape closes.
 * Returns true when the key was handled.
 */
export function menuKeys(e: KeyboardEvent, container: HTMLElement | null, onClose: () => void) {
	if (e.key === "Escape") {
		e.preventDefault();
		e.stopPropagation();
		onClose();
		return true;
	}
	if (!container) return false;
	if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End")
		return false;
	const items = collectButtons(container);
	if (items.length === 0) return false;
	e.preventDefault();
	e.stopPropagation();
	const current = e.target instanceof HTMLButtonElement ? e.target : document.activeElement;
	const idx = items.indexOf(current as HTMLButtonElement);
	let next = 0;
	if (e.key === "ArrowDown") next = idx < 0 ? 0 : (idx + 1) % items.length;
	else if (e.key === "ArrowUp")
		next = idx < 0 ? items.length - 1 : (idx - 1 + items.length) % items.length;
	else if (e.key === "Home") next = 0;
	else next = items.length - 1;
	items.forEach((btn, i) => {
		btn.tabIndex = i === next ? 0 : -1;
	});
	items[next]?.focus?.();
	return true;
}
