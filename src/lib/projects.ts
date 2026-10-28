import { get, writable } from "svelte/store";
import {
	LS_KEY as LEGACY_LS_KEY,
	activePath,
	blankFileMap,
	cloneFileMap,
	dirtyPaths,
	files,
	openTabs,
	seedFileMap,
	type VNode,
} from "#lib/vfs.js";

export interface ProjectMeta {
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
	entry: string;
}

export type TemplateKind = "blank" | "seed" | "clone";

interface ProjectBlob {
	files: Record<string, VNode>;
	openTabs: string[];
	activePath: string;
}

const INDEX_KEY = "neverview:projects:v1";
const ACTIVE_KEY = "neverview:activeProject:v1";
const BLOB_PREFIX = "neverview:project:";

export const projects = writable<ProjectMeta[]>([]);
export const activeProjectId = writable<string | null>(null);
export const activeEntry = writable<string>("/index.html");
export const projectsReady = writable<boolean>(false);

let didInit = false;
let isLoading = false;
let saveT: ReturnType<typeof setTimeout> | null = null;

function uid(): string {
	try {
		if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
	} catch {
		/* noop */
	}
	return "p-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e9).toString(36);
}

function blobKey(id: string): string {
	return BLOB_PREFIX + id;
}

function readIndex(): ProjectMeta[] {
	try {
		if (typeof localStorage === "undefined") return [];
		const raw = localStorage.getItem(INDEX_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as ProjectMeta[];
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((p) => p && typeof p.id === "string" && typeof p.name === "string");
	} catch {
		return [];
	}
}

function writeIndex(metas: ProjectMeta[]) {
	try {
		if (typeof localStorage === "undefined") return;
		localStorage.setItem(INDEX_KEY, JSON.stringify(metas));
	} catch {
		/* quota exceeded: keep in-memory */
	}
}

function readBlob(id: string): ProjectBlob | null {
	try {
		if (typeof localStorage === "undefined") return null;
		const raw = localStorage.getItem(blobKey(id));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as ProjectBlob;
		if (!parsed || typeof parsed !== "object" || !parsed.files) return null;
		if (!parsed.files["/"]) {
			parsed.files["/"] = { path: "/", type: "dir", content: "", mtime: Date.now() };
		}
		if (!Array.isArray(parsed.openTabs)) parsed.openTabs = [];
		if (typeof parsed.activePath !== "string") parsed.activePath = "";
		return parsed;
	} catch {
		return null;
	}
}

function writeBlobSync(id: string, blob: ProjectBlob) {
	try {
		if (typeof localStorage === "undefined") return;
		localStorage.setItem(blobKey(id), JSON.stringify(blob));
	} catch {
		/* quota exceeded: keep in-memory */
	}
}

function readLegacyBlob(): Record<string, VNode> | null {
	try {
		if (typeof localStorage === "undefined") return null;
		const raw = localStorage.getItem(LEGACY_LS_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Record<string, VNode>;
		if (!parsed || typeof parsed !== "object" || !parsed["/index.html"]) return null;
		if (!parsed["/"]) parsed["/"] = { path: "/", type: "dir", content: "", mtime: Date.now() };
		return parsed;
	} catch {
		return null;
	}
}

function firstHtml(filesMap: Record<string, VNode>): string {
	if (filesMap["/index.html"]?.type === "file") return "/index.html";
	const html = Object.keys(filesMap)
		.filter((p) => filesMap[p]?.type === "file" && p.endsWith(".html"))
		.sort();
	return html[0] ?? "/index.html";
}

function schedulePersist() {
	if (!didInit || isLoading) return;
	if (typeof localStorage === "undefined") return;
	if (saveT) clearTimeout(saveT);
	saveT = setTimeout(() => {
		persistCurrentSync();
	}, 400);
}

function notifyPreview(id: string) {
	try {
		if (typeof BroadcastChannel === "undefined") return;
		const ch = new BroadcastChannel("neverview:preview");
		ch.postMessage({ projectId: id, rev: Date.now() });
		ch.close();
	} catch {
		/* noop */
	}
}

function persistCurrentSync() {
	const id = get(activeProjectId);
	if (!id) return;
	const snapFiles = get(files);
	const snapTabs = get(openTabs);
	const snapActive = get(activePath);
	const entry = get(activeEntry);
	writeBlobSync(id, { files: snapFiles, openTabs: snapTabs, activePath: snapActive });
	notifyPreview(id);
	dirtyPaths.set(new Set());
	const metas = get(projects);
	const i = metas.findIndex((m) => m.id === id);
	if (i >= 0 && (metas[i].entry !== entry || metas[i].updatedAt + 400 < Date.now())) {
		const next = [...metas];
		next[i] = { ...next[i], entry, updatedAt: Date.now() };
		projects.set(next);
		writeIndex(next);
		try {
			if (typeof localStorage !== "undefined") localStorage.setItem(ACTIVE_KEY, id);
		} catch {
			/* noop */
		}
	}
}

function applySnapshot(id: string, meta: ProjectMeta, blob: ProjectBlob) {
	isLoading = true;
	try {
		files.set(blob.files);
		openTabs.set(blob.openTabs);
		activePath.set(blob.activePath);
		activeEntry.set(meta.entry);
		activeProjectId.set(id);
		dirtyPaths.set(new Set());
		try {
			if (typeof localStorage !== "undefined") localStorage.setItem(ACTIVE_KEY, id);
		} catch {
			/* noop */
		}
	} finally {
		isLoading = false;
	}
}

export function initProjects() {
	if (didInit) return;
	if (typeof window === "undefined") return;
	didInit = true;

	let metas = readIndex();

	if (metas.length === 0) {
		const legacy = readLegacyBlob();
		if (legacy) {
			const id = uid();
			const now = Date.now();
			const entry = legacy["/index.html"] ? "/index.html" : firstHtml(legacy);
			const tabs = legacy[entry]
				? [entry]
				: [Object.keys(legacy).find((p) => legacy[p].type === "file") ?? entry];
			const active = tabs[0] ?? entry;
			metas = [{ id, name: "My first project", createdAt: now, updatedAt: now, entry }];
			writeIndex(metas);
			writeBlobSync(id, { files: legacy, openTabs: tabs, activePath: active });
			try {
				localStorage.removeItem(LEGACY_LS_KEY);
			} catch {
				/* noop */
			}
		} else {
			const id = uid();
			const now = Date.now();
			metas = [{ id, name: "Demo", createdAt: now, updatedAt: now, entry: "/index.html" }];
			writeIndex(metas);
			writeBlobSync(id, {
				files: seedFileMap(),
				openTabs: ["/index.html"],
				activePath: "/index.html",
			});
		}
	}

	let activeId: string | null = null;
	try {
		activeId = localStorage.getItem(ACTIVE_KEY);
	} catch {
		activeId = null;
	}
	if (!activeId || !metas.some((m) => m.id === activeId)) activeId = metas[0]?.id ?? null;

	projects.set(metas);

	if (activeId) {
		const meta = metas.find((m) => m.id === activeId)!;
		const blob = readBlob(activeId) ?? {
			files: seedFileMap(),
			openTabs: ["/index.html"],
			activePath: "/index.html",
		};
		// Ensure entry file exists; fall back to first html.
		if (!blob.files[meta.entry]) {
			meta.entry = firstHtml(blob.files);
		}
		if (!blob.files[blob.activePath]?.type) {
			blob.activePath = meta.entry;
		}
		if (!blob.openTabs.includes(blob.activePath) && blob.files[blob.activePath]?.type === "file") {
			blob.openTabs = [...blob.openTabs, blob.activePath];
		}
		if (blob.openTabs.length === 0) blob.openTabs = [meta.entry];
		applySnapshot(activeId, meta, blob);
	}

	// Subscribe after initial load so the load itself doesn't trigger a save.
	files.subscribe(() => schedulePersist());
	openTabs.subscribe(() => schedulePersist());
	activePath.subscribe(() => schedulePersist());
	activeEntry.subscribe(() => schedulePersist());

	projectsReady.set(true);
}

export function getActiveMeta(): ProjectMeta | null {
	const id = get(activeProjectId);
	if (!id) return null;
	return get(projects).find((m) => m.id === id) ?? null;
}

export function setProjectEntry(entry: string) {
	const id = get(activeProjectId);
	if (!id) {
		activeEntry.set(entry);
		return;
	}
	activeEntry.set(entry);
	const metas = get(projects);
	const i = metas.findIndex((m) => m.id === id);
	if (i >= 0) {
		const next = [...metas];
		next[i] = { ...next[i], entry, updatedAt: Date.now() };
		projects.set(next);
		writeIndex(next);
	}
	schedulePersist();
	notifyPreview(id);
}

export function createProject(name: string, template: TemplateKind = "seed"): string {
	const clean = name.trim() || defaultProjectName();
	const id = uid();
	const now = Date.now();

	let blob: ProjectBlob;
	if (template === "blank") {
		const fm = blankFileMap();
		blob = { files: fm, openTabs: ["/index.html"], activePath: "/index.html" };
	} else if (template === "clone") {
		const fm = cloneFileMap(get(files));
		const tabs = [...get(openTabs)];
		let active = get(activePath);
		if (!fm[active]?.type) active = firstHtml(fm);
		if (!tabs.includes(active) && fm[active]?.type === "file") tabs.push(active);
		blob = { files: fm, openTabs: tabs.length ? tabs : [active], activePath: active };
	} else {
		const fm = seedFileMap();
		blob = { files: fm, openTabs: ["/index.html"], activePath: "/index.html" };
	}

	const entry = firstHtml(blob.files);
	const meta: ProjectMeta = { id, name: clean, createdAt: now, updatedAt: now, entry };
	persistCurrentSync();
	writeBlobSync(id, blob);
	const metas = [meta, ...get(projects)];
	projects.set(metas);
	writeIndex(metas);
	applySnapshot(id, meta, blob);
	return id;
}

export function renameProject(id: string, name: string) {
	const clean = name.trim();
	if (!clean) return;
	const metas = get(projects);
	const i = metas.findIndex((m) => m.id === id);
	if (i < 0) return;
	const next = [...metas];
	next[i] = { ...next[i], name: clean, updatedAt: Date.now() };
	projects.set(next);
	writeIndex(next);
	notifyPreview(id);
}

export function duplicateProject(id: string): string | null {
	const metas = get(projects);
	const src = metas.find((m) => m.id === id);
	if (!src) return null;
	const srcBlob =
		id === get(activeProjectId)
			? { files: get(files), openTabs: get(openTabs), activePath: get(activePath) }
			: readBlob(id);
	if (!srcBlob) return null;
	const nid = uid();
	const now = Date.now();
	const meta: ProjectMeta = {
		id: nid,
		name: src.name + " copy",
		createdAt: now,
		updatedAt: now,
		entry: src.entry,
	};
	writeBlobSync(nid, {
		files: cloneFileMap(srcBlob.files),
		openTabs: [...srcBlob.openTabs],
		activePath: srcBlob.activePath,
	});
	persistCurrentSync();
	const next = [meta, ...get(projects)];
	projects.set(next);
	writeIndex(next);
	applySnapshot(nid, meta, {
		files: cloneFileMap(srcBlob.files),
		openTabs: [...srcBlob.openTabs],
		activePath: srcBlob.activePath,
	});
	return nid;
}

export function deleteProject(id: string) {
	const metas = get(projects);
	if (!metas.some((m) => m.id === id)) return;
	const wasActive = get(activeProjectId) === id;
	if (wasActive) persistCurrentSync();
	try {
		if (typeof localStorage !== "undefined") localStorage.removeItem(blobKey(id));
	} catch {
		/* noop */
	}
	let next = metas.filter((m) => m.id !== id);
	if (next.length === 0) {
		const nid = uid();
		const now = Date.now();
		const meta: ProjectMeta = {
			id: nid,
			name: "Demo",
			createdAt: now,
			updatedAt: now,
			entry: "/index.html",
		};
		const blob: ProjectBlob = {
			files: seedFileMap(),
			openTabs: ["/index.html"],
			activePath: "/index.html",
		};
		writeBlobSync(nid, blob);
		next = [meta];
		writeIndex(next);
		projects.set(next);
		applySnapshot(nid, meta, blob);
		return;
	}
	writeIndex(next);
	projects.set(next);
	if (wasActive) {
		const meta = next[0];
		const blob = readBlob(meta.id) ?? {
			files: seedFileMap(),
			openTabs: ["/index.html"],
			activePath: "/index.html",
		};
		applySnapshot(meta.id, meta, blob);
	}
}

export function switchProject(id: string) {
	if (get(activeProjectId) === id) return;
	const metas = get(projects);
	const meta = metas.find((m) => m.id === id);
	if (!meta) return;
	persistCurrentSync();
	const blob = readBlob(id);
	if (!blob) return;
	applySnapshot(id, meta, blob);
}

export function clearAllProjects() {
	try {
		if (typeof localStorage === "undefined") return;
		const metas = readIndex();
		for (const m of metas) localStorage.removeItem(blobKey(m.id));
		localStorage.removeItem(INDEX_KEY);
		localStorage.removeItem(ACTIVE_KEY);
		localStorage.removeItem(LEGACY_LS_KEY);
	} catch {
		/* noop */
	}
}

export function defaultProjectName(): string {
	const metas = get(projects);
	let n = metas.length + 1;
	let name = `Project ${n}`;
	while (metas.some((m) => m.name === name)) {
		n += 1;
		name = `Project ${n}`;
	}
	return name;
}
