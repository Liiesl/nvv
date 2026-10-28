// Tiling model for the editor area — max 4 groups (2x2).
// Preview is a singleton tab item, not a side pane.

export type EditorItem = { kind: "file"; path: string } | { kind: "preview" };

export interface EditorGroup {
	id: string;
	tabs: EditorItem[];
	active: number; // index into tabs, -1 when empty
}

export type SplitNode =
	| { type: "leaf"; groupId: string }
	| { type: "split"; id: string; dir: "row" | "col"; sizes: number[]; children: SplitNode[] };

export interface PersistedLayout {
	root: SplitNode;
	groups: Record<string, EditorGroup>;
	activeGroupId: string;
	maximizedGroupId: string | null;
}

export const MAX_GROUPS = 4;
export const PREVIEW_KEY = "__preview__";

export function itemKey(item: EditorItem): string {
	return item.kind === "preview" ? PREVIEW_KEY : `file:${item.path}`;
}

export function itemsEqual(a: EditorItem, b: EditorItem): boolean {
	if (a.kind !== b.kind) return false;
	if (a.kind === "preview" && b.kind === "preview") return true;
	if (a.kind === "file" && b.kind === "file") return a.path === b.path;
	return false;
}

export function fileItem(path: string): EditorItem {
	return { kind: "file", path };
}

export function previewItem(): EditorItem {
	return { kind: "preview" };
}

let groupSeq = 2;
let splitSeq = 1;

export function nextGroupId(): string {
	groupSeq += 1;
	return `g${groupSeq}`;
}

export function nextSplitId(): string {
	splitSeq += 1;
	return `s${splitSeq}`;
}

export function resetSeqForTests() {
	groupSeq = 2;
	splitSeq = 1;
}

export function createGroup(tabs: EditorItem[] = [], active = -1): EditorGroup {
	const id = nextGroupId();
	return {
		id,
		tabs: [...tabs],
		active: tabs.length === 0 ? -1 : Math.min(Math.max(0, active), tabs.length - 1),
	};
}

export function leaf(groupId: string): SplitNode {
	return { type: "leaf", groupId };
}

export function split(dir: "row" | "col", children: SplitNode[], sizes?: number[]): SplitNode {
	const n = children.length;
	const s =
		sizes && sizes.length === n
			? [...sizes]
			: Array.from({ length: n }, () => 100 / Math.max(1, n));
	return { type: "split", id: nextSplitId(), dir, sizes: s, children: [...children] };
}

export function countLeaves(node: SplitNode): number {
	if (node.type === "leaf") return 1;
	return node.children.reduce((a, c) => a + countLeaves(c), 0);
}

export function listGroupIds(node: SplitNode): string[] {
	if (node.type === "leaf") return [node.groupId];
	return node.children.flatMap(listGroupIds);
}

export function findParent(
	node: SplitNode,
	targetGroupId: string,
	parent: Extract<SplitNode, { type: "split" }> | null = null,
): { parent: Extract<SplitNode, { type: "split" }>; index: number } | null {
	if (node.type === "leaf") return null;
	for (let i = 0; i < node.children.length; i++) {
		const c = node.children[i];
		if (c.type === "leaf" && c.groupId === targetGroupId) return { parent: node, index: i };
		const deeper = findParent(c, targetGroupId, node);
		if (deeper) return deeper;
	}
	return parent ? null : null;
}

export function findSplit(
	node: SplitNode,
	splitId: string,
): Extract<SplitNode, { type: "split" }> | null {
	if (node.type === "leaf") return null;
	if (node.id === splitId) return node;
	for (const c of node.children) {
		const f = findSplit(c, splitId);
		if (f) return f;
	}
	return null;
}

export function cloneNode(node: SplitNode): SplitNode {
	if (node.type === "leaf") return { type: "leaf", groupId: node.groupId };
	return {
		type: "split",
		id: node.id,
		dir: node.dir,
		sizes: [...node.sizes],
		children: node.children.map(cloneNode),
	};
}

function isValidItem(raw: unknown): raw is EditorItem {
	if (!raw || typeof raw !== "object") return false;
	const r = raw as Record<string, unknown>;
	if (r.kind === "preview") return true;
	if (r.kind === "file" && typeof r.path === "string" && r.path.startsWith("/")) return true;
	return false;
}

function sanitizeGroup(raw: unknown, fallbackId: string): EditorGroup | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const id = typeof r.id === "string" && r.id ? r.id.slice(0, 32) : fallbackId;
	const arr = Array.isArray(r.tabs) ? r.tabs : [];
	const tabs: EditorItem[] = [];
	const seen = new Set<string>();
	for (const t of arr.slice(0, 30)) {
		if (!isValidItem(t)) continue;
		const k = itemKey(t);
		if (seen.has(k)) continue;
		seen.add(k);
		tabs.push(t.kind === "preview" ? previewItem() : fileItem(t.path));
	}
	let active = typeof r.active === "number" ? Math.floor(r.active) : tabs.length - 1;
	if (tabs.length === 0) active = -1;
	else active = Math.min(Math.max(0, active), tabs.length - 1);
	return { id, tabs, active };
}

function sanitizeNode(raw: unknown, knownGroups: Set<string>): SplitNode | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	if (r.type === "leaf" && typeof r.groupId === "string" && knownGroups.has(r.groupId)) {
		return { type: "leaf", groupId: r.groupId };
	}
	if (r.type === "split" && (r.dir === "row" || r.dir === "col") && Array.isArray(r.children)) {
		const kids: SplitNode[] = [];
		for (const c of (r.children as unknown[]).slice(0, 4)) {
			const s = sanitizeNode(c, knownGroups);
			if (s) kids.push(s);
			if (kids.length >= 4) break;
		}
		if (kids.length === 0) return null;
		if (kids.length === 1) return kids[0];
		const sizesRaw = Array.isArray(r.sizes) ? (r.sizes as unknown[]) : [];
		const sizes = kids.map((_, i) => {
			const v = sizesRaw[i];
			return typeof v === "number" && Number.isFinite(v)
				? Math.min(85, Math.max(15, v))
				: 100 / kids.length;
		});
		const sum = sizes.reduce((a, b) => a + b, 0) || 1;
		const norm = sizes.map((s) => (s / sum) * 100);
		const id = typeof r.id === "string" && r.id ? String(r.id).slice(0, 32) : nextSplitId();
		return { type: "split", id, dir: r.dir, sizes: norm, children: kids };
	}
	return null;
}

export function sanitizePersistedLayout(raw: unknown): PersistedLayout | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const groupsRaw = r.groups as Record<string, unknown> | undefined;
	if (!groupsRaw || typeof groupsRaw !== "object") return null;
	const groups: Record<string, EditorGroup> = {};
	for (const [k, v] of Object.entries(groupsRaw).slice(0, MAX_GROUPS + 2)) {
		const g = sanitizeGroup(v, k);
		if (g) groups[g.id] = g;
	}
	const ids = Object.keys(groups);
	if (ids.length === 0 || ids.length > MAX_GROUPS) return null;
	const known = new Set(ids);
	const root = sanitizeNode(r.root, known);
	if (!root) return null;
	// Every group must be reachable; drop unreachable groups (unless single).
	const reachable = new Set(listGroupIds(root));
	for (const id of ids) {
		if (!reachable.has(id)) delete groups[id];
	}
	if (Object.keys(groups).length === 0) return null;
	let activeGroupId =
		typeof r.activeGroupId === "string" && groups[r.activeGroupId] ? r.activeGroupId : ids[0];
	const maximizedRaw = r.maximizedGroupId;
	const maximizedGroupId =
		typeof maximizedRaw === "string" && groups[maximizedRaw] ? maximizedRaw : null;
	// Cap leaves.
	if (countLeaves(root) > MAX_GROUPS) return null;
	// Ensure preview singleton.
	let previewCount = 0;
	for (const g of Object.values(groups)) {
		for (const t of g.tabs) if (t.kind === "preview") previewCount++;
	}
	if (previewCount > 1) return null;
	return { root, groups, activeGroupId, maximizedGroupId };
}

export function defaultLayoutFromFiles(
	fileTabs: string[],
	activeFile: string,
	showPreview: boolean,
	editorPct: number,
): PersistedLayout {
	const files = [
		...new Set(fileTabs.filter((p) => typeof p === "string" && p.startsWith("/"))),
	].slice(0, 30);
	if (files.length === 0 && activeFile) files.push(activeFile);
	const leftTabs = files.map(fileItem);
	let leftActive = Math.max(
		0,
		leftTabs.findIndex((t) => t.kind === "file" && t.path === activeFile),
	);
	if (leftTabs.length === 0) leftActive = -1;
	if (!showPreview) {
		const g: EditorGroup = { id: "g1", tabs: leftTabs, active: leftActive };
		return { root: leaf("g1"), groups: { g1: g }, activeGroupId: "g1", maximizedGroupId: null };
	}
	const pct = Math.min(85, Math.max(15, editorPct || 55));
	const g1: EditorGroup = { id: "g1", tabs: leftTabs, active: leftActive };
	const g2: EditorGroup = { id: "g2", tabs: [previewItem()], active: 0 };
	groupSeq = Math.max(groupSeq, 2);
	return {
		root: {
			type: "split",
			id: "s1",
			dir: "row",
			sizes: [pct, 100 - pct],
			children: [leaf("g1"), leaf("g2")],
		},
		groups: { g1, g2 },
		activeGroupId: "g1",
		maximizedGroupId: null,
	};
}

/** Remove file items that no longer exist; clamp actives; ensure >=1 group. */
export function pruneLayout(
	root: SplitNode,
	groups: Record<string, EditorGroup>,
	existingFiles: Set<string>,
): { root: SplitNode; prunedGroups: string[] } {
	const pruned: string[] = [];
	for (const g of Object.values(groups)) {
		const before = g.tabs.length;
		g.tabs = g.tabs.filter((t) => (t.kind === "preview" ? true : existingFiles.has(t.path)));
		if (g.tabs.length === 0) g.active = -1;
		else if (g.active < 0 || g.active >= g.tabs.length) g.active = g.tabs.length - 1;
		if (g.tabs.length !== before) {
			// keep group even if empty (shows Welcome) — collapse handled by caller
		}
	}
	// Drop groups unreachable from root (stale ids).
	const reachable = new Set(listGroupIds(root));
	for (const id of Object.keys(groups)) {
		if (!reachable.has(id)) {
			delete groups[id];
			pruned.push(id);
		}
	}
	return { root, prunedGroups: pruned };
}
