// UI persistence — global layout prefs + per-project view prefs.
// Global: single localStorage entry. Per-project: single map entry keyed by project id.
// Text inputs (search query, filters, commit msg, terminal history) intentionally reset.

import type { PanelTab, SideView } from "#lib/ide/ide.svelte.js";

export interface GlobalUI {
	sidebar: boolean;
	sidebarW: number;
	showPreview: boolean;
	autoReload: boolean;
	minimapOn: boolean;
	fontSize: number;
	showPanel: boolean;
	panelH: number;
	panelMax: boolean;
	editorPct: number;
	previewZoomed: boolean;
	winMax: boolean;
	openEditorsOpen: boolean;
	outlineOpen: boolean;
	timelineOpen: boolean;
	useSpaces: boolean;
	indentSize: number;
	encoding: string;
	eol: string;
	outputChannel: string;
	termTabs: string[];
	activeTerm: number;
	currentBranch: string;
	branches: string[];
	searchCase: boolean;
	searchWord: boolean;
	searchRegex: boolean;
}

export interface ProjectUI {
	sideView: SideView;
	panelTab: PanelTab;
	expandedDirs: string[];
}

export const GLOBAL_DEFAULTS: GlobalUI = {
	sidebar: true,
	sidebarW: 268,
	showPreview: true,
	autoReload: true,
	minimapOn: true,
	fontSize: 13,
	showPanel: true,
	panelH: 168,
	panelMax: false,
	editorPct: 55,
	previewZoomed: false,
	winMax: false,
	openEditorsOpen: true,
	outlineOpen: true,
	timelineOpen: false,
	useSpaces: true,
	indentSize: 2,
	encoding: "UTF-8",
	eol: "LF",
	outputChannel: "Preview",
	termTabs: ["powershell"],
	activeTerm: 0,
	currentBranch: "main",
	branches: ["main", "dev", "feature/preview"],
	searchCase: false,
	searchWord: false,
	searchRegex: false,
};

export const PROJECT_DEFAULTS: ProjectUI = {
	sideView: "explorer",
	panelTab: "console",
	expandedDirs: ["/"],
};

const GLOBAL_KEY = "neverview:ui:v1";
const PROJECTS_KEY = "neverview:ui:projects:v1";

const SIDE_VIEWS: SideView[] = ["explorer", "search", "scm", "debug", "ext", "settings"];
const PANEL_TABS: PanelTab[] = ["console", "output", "problems", "terminal"];
const OUTPUT_CHANNELS = ["Preview", "Tasks", "Extensions"];

function asBool(v: unknown, fb: boolean): boolean {
	return typeof v === "boolean" ? v : fb;
}

function asNum(v: unknown, min: number, max: number, fb: number): number {
	const n = typeof v === "number" && Number.isFinite(v) ? v : fb;
	return Math.min(max, Math.max(min, n));
}

function asEnum<T extends string>(v: unknown, allowed: T[], fb: T): T {
	return typeof v === "string" && (allowed as string[]).includes(v) ? (v as T) : fb;
}

function asStrArr(v: unknown, maxItems: number, maxLen: number): string[] | null {
	if (!Array.isArray(v)) return null;
	const out: string[] = [];
	for (const item of v) {
		if (typeof item !== "string") continue;
		const s = item.slice(0, maxLen);
		if (s) out.push(s);
		if (out.length >= maxItems) break;
	}
	return out;
}

function sanitizeGlobal(raw: unknown): GlobalUI | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const termTabs = asStrArr(r.termTabs, 10, 40) ?? [...GLOBAL_DEFAULTS.termTabs];
	if (termTabs.length === 0) termTabs.push("powershell");
	const branches = asStrArr(r.branches, 20, 64) ?? [...GLOBAL_DEFAULTS.branches];
	const activeTermRaw = typeof r.activeTerm === "number" ? r.activeTerm : 0;
	return {
		sidebar: asBool(r.sidebar, GLOBAL_DEFAULTS.sidebar),
		sidebarW: asNum(r.sidebarW, 180, 480, GLOBAL_DEFAULTS.sidebarW),
		showPreview: asBool(r.showPreview, GLOBAL_DEFAULTS.showPreview),
		autoReload: asBool(r.autoReload, GLOBAL_DEFAULTS.autoReload),
		minimapOn: asBool(r.minimapOn, GLOBAL_DEFAULTS.minimapOn),
		fontSize: asNum(r.fontSize, 11, 18, GLOBAL_DEFAULTS.fontSize),
		showPanel: asBool(r.showPanel, GLOBAL_DEFAULTS.showPanel),
		panelH: asNum(r.panelH, 100, 520, GLOBAL_DEFAULTS.panelH),
		panelMax: asBool(r.panelMax, GLOBAL_DEFAULTS.panelMax),
		editorPct: asNum(r.editorPct, 15, 85, GLOBAL_DEFAULTS.editorPct),
		previewZoomed: asBool(r.previewZoomed, GLOBAL_DEFAULTS.previewZoomed),
		winMax: asBool(r.winMax, GLOBAL_DEFAULTS.winMax),
		openEditorsOpen: asBool(r.openEditorsOpen, GLOBAL_DEFAULTS.openEditorsOpen),
		outlineOpen: asBool(r.outlineOpen, GLOBAL_DEFAULTS.outlineOpen),
		timelineOpen: asBool(r.timelineOpen, GLOBAL_DEFAULTS.timelineOpen),
		useSpaces: asBool(r.useSpaces, GLOBAL_DEFAULTS.useSpaces),
		indentSize: [2, 4, 8].includes(r.indentSize as number)
			? (r.indentSize as number)
			: GLOBAL_DEFAULTS.indentSize,
		encoding: "UTF-8",
		eol: asEnum(r.eol, ["LF"] as string[], GLOBAL_DEFAULTS.eol),
		outputChannel: asEnum(r.outputChannel, OUTPUT_CHANNELS, GLOBAL_DEFAULTS.outputChannel),
		termTabs,
		activeTerm: Math.min(
			Math.max(0, Number.isFinite(activeTermRaw) ? Math.floor(activeTermRaw) : 0),
			termTabs.length - 1,
		),
		currentBranch:
			typeof r.currentBranch === "string" && r.currentBranch
				? r.currentBranch.slice(0, 64)
				: GLOBAL_DEFAULTS.currentBranch,
		branches: branches.length ? branches : [...GLOBAL_DEFAULTS.branches],
		searchCase: asBool(r.searchCase, false),
		searchWord: asBool(r.searchWord, false),
		searchRegex: asBool(r.searchRegex, false),
	};
}

function sanitizeProject(raw: unknown): ProjectUI | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const dirs = (asStrArr(r.expandedDirs, 200, 256) ?? ["/"]).filter((p) => p.startsWith("/"));
	if (!dirs.includes("/")) dirs.unshift("/");
	return {
		sideView: asEnum(r.sideView, SIDE_VIEWS, PROJECT_DEFAULTS.sideView),
		panelTab: asEnum(r.panelTab, PANEL_TABS, PROJECT_DEFAULTS.panelTab),
		expandedDirs: dirs.slice(0, 200),
	};
}

function readJson(key: string): unknown | null {
	try {
		if (typeof localStorage === "undefined") return null;
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function writeJson(key: string, value: unknown): void {
	try {
		if (typeof localStorage === "undefined") return;
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		/* quota exceeded: keep in-memory */
	}
}

export function loadGlobalUI(): GlobalUI | null {
	return sanitizeGlobal(readJson(GLOBAL_KEY));
}

export function saveGlobalUI(state: GlobalUI): void {
	writeJson(GLOBAL_KEY, state);
}

export function loadProjectsUIMap(): Record<string, ProjectUI> {
	const raw = readJson(PROJECTS_KEY);
	if (!raw || typeof raw !== "object") return {};
	const out: Record<string, ProjectUI> = {};
	for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
		const clean = sanitizeProject(v);
		if (clean) out[k] = clean;
	}
	return out;
}

export function saveProjectsUIMap(map: Record<string, ProjectUI>): void {
	writeJson(PROJECTS_KEY, map);
}
