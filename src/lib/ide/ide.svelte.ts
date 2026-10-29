// Central IDE state — extracted from src/routes/+page.svelte (was ~2862 lines).
// Single shared instance `ide` imported by all ide/* components.
// Keeps vfs/projects stores as source of truth; mirrors them into reactive fields.

import {
	files,
	activePath,
	openTabs,
	dirtyPaths,
	openFile,
	closeTab,
	reorderTabs,
	createFile,
	createFolder,
	renamePath,
	removePath,
	writeFile,
	resetWorkspace,
	join,
	basename,
	languageOf,
} from "#lib/vfs.js";
import type { VNode } from "#lib/vfs.js";
import {
	projects,
	activeProjectId,
	activeEntry,
	initProjects,
	createProject,
	renameProject,
	duplicateProject,
	deleteProject,
	switchProject,
	setProjectEntry,
	clearAllProjects,
	defaultProjectName,
} from "#lib/projects.js";
import type { ProjectMeta } from "#lib/projects.js";
import type { TemplateKind } from "#lib/projects.js";
import type { InspectPayload } from "#lib/inspect.js";
import {
	loadGlobalUI,
	saveGlobalUI,
	loadProjectsUIMap,
	saveProjectsUIMap,
	type ProjectUI,
} from "#lib/ide/ui-persist.js";
import {
	countLeaves,
	defaultLayoutFromFiles,
	fileItem,
	itemKey,
	itemsEqual,
	leaf,
	listGroupIds,
	nextGroupId,
	nextSplitId,
	previewItem,
	pruneLayout,
	sanitizePersistedLayout,
	MAX_GROUPS,
	type EditorGroup,
	type EditorItem,
	type PersistedLayout,
	type SplitNode,
} from "#lib/ide/layout.js";

export type SideView = "explorer" | "search" | "scm" | "debug" | "ext" | "settings";
export type PanelTab = "console" | "output" | "problems" | "terminal";

export interface PreviewApi {
	refresh: () => void;
	openNewTab: () => void;
	clearInspectSelection: () => void;
}

export class IdeState {
	// --- mirrored store snapshots ---
	filesSnap = $state<Record<string, VNode>>({});
	active = $state("/index.html");
	tabs = $state<string[]>([]);
	dirty = $state<Set<string>>(new Set());
	projectsSnap = $state<ProjectMeta[]>([]);
	activeProjectIdSnap = $state<string | null>(null);
	entry = $state("/index.html");

	// --- menus / dialogs ---
	projMenu = $state(false);
	showNewProj = $state(false);
	newProjName = $state("");
	newProjTemplate = $state<TemplateKind>("seed");
	renameTarget = $state<string | null>(null);
	renameDraft = $state("");

	// --- layout ---
	sideView = $state<SideView>("explorer");
	sidebar = $state(true);
	sidebarW = $state(268);
	sideDragging = $state(false);
	autoReload = $state(true);
	minimapOn = $state(true);
	fontSize = $state(13);
	showPanel = $state(true);
	panelTab = $state<PanelTab>("console");
	panelH = $state(168);
	panelMax = $state(false);
	panelDragging = $state(false);
	panelFilter = $state("");
	logs = $state<{ kind: string; text: string }[]>([]);
	query = $state("");
	replaceQ = $state("");
	palette = $state(false);
	paletteQ = $state("");
	paletteSel = $state(0);
	line = $state(1);
	col = $state(1);
	groupCursor = $state<Record<string, { line: number; col: number }>>({});
	// --- editor tiling (replaces showPreview/editorPct/previewZoomed/dragging) ---
	layoutRoot = $state<SplitNode>({ type: "leaf", groupId: "g1" });
	groups = $state<Record<string, EditorGroup>>({
		g1: { id: "g1", tabs: [fileItem("/index.html")], active: 0 },
	});
	activeGroupId = $state<string>("g1");
	maximizedGroupId = $state<string | null>(null);
	splitDrag = $state(false);
	splitDragDir = $state<"row" | "col" | null>(null);
	dropHover = $state<{ groupId: string; area: "tabs" | "body"; index: number | null } | null>(null);
	titleMenu = $state<string | null>(null);
	titleMenuPos = $state<{ x: number; y: number } | null>(null);
	tabCtx = $state<{
		x: number;
		y: number;
		path: string;
		groupId: string;
		isPreview: boolean;
	} | null>(null);
	editorCtx = $state<{ x: number; y: number } | null>(null);
	sideMenu = $state(false);
	collapseNonce = $state(0);
	outlineOpen = $state(true);
	timelineOpen = $state(false);
	langPick = $state(false);
	gotoOpen = $state(false);
	gotoDraft = $state("");
	revealLine = $state(0);
	commitMsg = $state("");
	termLines = $state<{ text: string; kind: string }[]>([
		{ text: "neverview terminal — type `help`", kind: "info" },
	]);
	termInput = $state("");
	toasts = $state<{ id: number; text: string; kind: string }[]>([]);
	dragTab = $state<string | null>(null);
	dragFromGroup = $state<string | null>(null);
	dragIsPreview = $state(false);
	currentBranch = $state("main");
	branches = $state(["main", "dev", "feature/preview"]);
	branchMenu = $state(false);
	useSpaces = $state(true);
	indentSize = $state(2);
	indentMenu = $state(false);
	encoding = $state("UTF-8");
	encodingMenu = $state(false);
	eol = $state("LF");
	eolMenu = $state(false);
	settingsMenu = $state(false);
	accountsMenu = $state(false);
	notifCenter = $state(false);
	outputChannel = $state("Preview");
	termTabs = $state<string[]>(["powershell"]);
	activeTerm = $state(0);
	openEditorsOpen = $state(true);
	expandedDirs = $state<string[]>(["/"]);
	uiReady = $state(false);
	searchCase = $state(false);
	searchWord = $state(false);
	searchRegex = $state(false);
	crumbSymMenu = $state(false);
	layoutMenu = $state(false);
	winMax = $state(false);
	previewRef = $state<PreviewApi | null>(null);
	inspectTarget = $state<InspectPayload | null>(null);

	toastSeq = 0;
	private unsubs: (() => void)[] = [];
	private didInit = false;
	private projectsUIMap: Record<string, ProjectUI> = {};
	private uiSaveT: ReturnType<typeof setTimeout> | null = null;
	private projSaveT: ReturnType<typeof setTimeout> | null = null;

	constructor() {
		// Subscribe immediately — safe on server (seed data) and client (live data).
		this.unsubs = [
			files.subscribe((v) => (this.filesSnap = v)),
			activePath.subscribe((v) => (this.active = v)),
			openTabs.subscribe((v) => (this.tabs = v)),
			dirtyPaths.subscribe((v) => (this.dirty = v)),
			projects.subscribe((v) => (this.projectsSnap = v)),
			activeProjectId.subscribe((v) => (this.activeProjectIdSnap = v)),
			activeEntry.subscribe((v) => (this.entry = v)),
		];
	}

	init() {
		if (this.didInit) return;
		this.didInit = true;
		initProjects();
		this.loadPersistedUI();
	}

	dispose() {
		for (const u of this.unsubs) u();
		this.unsubs = [];
	}

	// ---------- derived ----------
	get content() {
		return this.filesSnap[this.active]?.content ?? "";
	}
	get htmlFiles() {
		return Object.keys(this.filesSnap)
			.filter((p) => p.endsWith(".html"))
			.sort();
	}
	get fileCount() {
		return Object.values(this.filesSnap).filter((n) => n.type === "file").length;
	}
	get activeProject() {
		return this.projectsSnap.find((p) => p.id === this.activeProjectIdSnap) ?? null;
	}
	get activeProjectName() {
		return this.activeProject?.name ?? "…";
	}
	get problems() {
		return Object.entries(this.filesSnap)
			.filter(([, n]) => n.type === "file" && !n.content.trim())
			.map(([p]) => `Empty file: ${p}`);
	}
	get errCount() {
		return this.logs.filter((l) => l.kind === "error").length;
	}
	get warnCount() {
		return this.logs.filter((l) => l.kind === "warn").length + this.problems.length;
	}
	get isDirty() {
		return this.dirty.has(this.active);
	}
	get outline(): { line: number; label: string; kind: string }[] {
		const src = this.content ?? "";
		const out: { line: number; label: string; kind: string }[] = [];
		const lines = src.split("\n");
		const lang = languageOf(this.active);
		for (let i = 0; i < lines.length; i++) {
			const ln = lines[i];
			if (lang === "html" || lang === "xml") {
				const m = ln.match(
					/<(h[1-6]|section|header|footer|main|div|button|form)[^>]*>([^<]{1,60})/i,
				);
				if (m)
					out.push({
						line: i + 1,
						label: `${m[1]} — ${(m[2] ?? "").trim().slice(0, 42) || "(block)"}`,
						kind: "tag",
					});
				continue;
			}
			if (lang === "css") {
				const m = ln.match(/^\s*([.#]?[A-Za-z][\w\-.,\s:#>]*)\s*\{/);
				if (m)
					out.push({
						line: i + 1,
						label: m[1].trim().slice(0, 48),
						kind: "css",
					});
				continue;
			}
			const m =
				ln.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/) ??
				ln.match(/^\s*class\s+([A-Za-z_$][\w$]*)/) ??
				ln.match(/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/);
			if (m?.[1])
				out.push({
					line: i + 1,
					label: String(m[1]).slice(0, 48),
					kind: lang,
				});
		}
		return out.slice(0, 60);
	}
	get crumbs(): { label: string; path: string; isFile: boolean }[] {
		if (!this.active) return [];
		const parts = this.active.split("/").filter(Boolean);
		const acc: { label: string; path: string; isFile: boolean }[] = [
			{ label: this.activeProjectName, path: "/", isFile: false },
		];
		let cur = "";
		parts.forEach((seg, i) => {
			cur += "/" + seg;
			acc.push({ label: seg, path: cur, isFile: i === parts.length - 1 });
		});
		return acc;
	}
	get searchDetailed(): { path: string; line: number; text: string }[] {
		const raw = this.query.trim();
		if (!raw) return [];
		const hits: { path: string; line: number; text: string }[] = [];
		let re: RegExp | null = null;
		if (this.searchRegex) {
			try {
				re = new RegExp(raw, this.searchCase ? "g" : "gi");
			} catch {
				re = null;
			}
		}
		const q = this.searchCase ? raw : raw.toLowerCase();
		for (const [p, n] of Object.entries(this.filesSnap)) {
			if (n.type !== "file") continue;
			const lines = n.content.split("\n");
			for (let i = 0; i < lines.length && hits.length < 60; i++) {
				const ln = lines[i];
				let ok = false;
				if (re) {
					re.lastIndex = 0;
					ok = re.test(ln);
				} else {
					const hay = this.searchCase ? ln : ln.toLowerCase();
					if (this.searchWord) {
						ok = new RegExp(
							`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
							this.searchCase ? "" : "i",
						).test(ln);
					} else {
						ok = hay.includes(q);
					}
				}
				if (ok) {
					hits.push({
						path: p,
						line: i + 1,
						text: lines[i].trim().slice(0, 100),
					});
				}
			}
			if (hits.length >= 60) break;
		}
		return hits;
	}
	get paletteIsCmd() {
		return this.paletteQ.startsWith(">");
	}
	get paletteCmdQ() {
		return this.paletteIsCmd
			? this.paletteQ.slice(1).trim().toLowerCase()
			: this.paletteQ.trim().toLowerCase();
	}
	get paletteFiles() {
		return Object.keys(this.filesSnap)
			.filter(
				(p) =>
					this.filesSnap[p].type === "file" &&
					p.toLowerCase().includes(this.paletteIsCmd ? "" : this.paletteQ.toLowerCase()),
			)
			.sort((a, b) => {
				const ai = this.tabs.indexOf(a);
				const bi = this.tabs.indexOf(b);
				if (ai >= 0 && bi >= 0) return ai - bi;
				if (ai >= 0) return -1;
				if (bi >= 0) return 1;
				return a.localeCompare(b);
			})
			.slice(0, this.paletteIsCmd ? 5 : 12);
	}
	get allCommands(): { id: string; label: string; run: () => void }[] {
		const maxLabel = this.maximizedGroupId
			? "View: Exit Maximized Group"
			: "View: Maximize Active Group";
		const cmds = [
			{
				id: "new-file",
				label: "File: New File",
				run: () => this.doCreateFile("/", "untitled.html"),
			},
			{
				id: "toggle-sidebar",
				label: "View: Toggle Primary Side Bar",
				run: () => (this.sidebar = !this.sidebar),
			},
			{
				id: "toggle-panel",
				label: "View: Toggle Panel",
				run: () => (this.showPanel = !this.showPanel),
			},
			{
				id: "toggle-preview",
				label: "View: Toggle Preview Tab",
				run: () => this.togglePreviewTab(),
			},
			{
				id: "zoom-preview",
				label: maxLabel,
				run: () => this.toggleMaximize(),
			},
			{
				id: "split-right",
				label: "View: Split Editor Right",
				run: () => this.splitActiveGroup("row"),
			},
			{
				id: "split-down",
				label: "View: Split Editor Down",
				run: () => this.splitActiveGroup("col"),
			},
			{
				id: "close-group",
				label: "View: Close Active Editor Group",
				run: () => this.closeGroup(this.activeGroupId),
			},
			{ id: "refresh", label: "Run: Refresh Preview", run: () => this.previewRef?.refresh() },
			{
				id: "open-tab",
				label: "Run: Open Preview in New Tab",
				run: () => this.previewRef?.openNewTab(),
			},
			{ id: "new-project", label: "Project: New Project…", run: () => this.openNewProjectDialog() },
			{
				id: "close-others",
				label: "Tab: Close Others in Group",
				run: () => {
					const g = this.groups[this.activeGroupId];
					if (!g || g.active < 0) return;
					const keep = g.tabs[g.active];
					for (let i = g.tabs.length - 1; i >= 0; i--) {
						if (i !== g.active) this.closeTabInGroup(this.activeGroupId, i);
					}
					if (keep.kind === "file") openFile(keep.path);
				},
			},
			{
				id: "close-right",
				label: "Tab: Close to the Right",
				run: () => {
					const g = this.groups[this.activeGroupId];
					if (!g) return;
					for (let i = g.tabs.length - 1; i > g.active; i--)
						this.closeTabInGroup(this.activeGroupId, i);
				},
			},
			{
				id: "close-all",
				label: "Tab: Close All in Group",
				run: () => {
					const g = this.groups[this.activeGroupId];
					if (!g) return;
					for (let i = g.tabs.length - 1; i >= 0; i--) this.closeTabInGroup(this.activeGroupId, i);
				},
			},
			{
				id: "goto-line",
				label: "Go: Go to Line…",
				run: () => {
					this.gotoDraft = String(this.cursorFor(this.activeGroupId).line);
					this.gotoOpen = true;
				},
			},
			{ id: "lang", label: "Language: Change Language Mode…", run: () => (this.langPick = true) },
			{
				id: "terminal",
				label: "Terminal: Focus Terminal",
				run: () => {
					this.panelTab = "terminal";
					this.showPanel = true;
				},
			},
			{
				id: "problems",
				label: "Problems: Focus Problems",
				run: () => {
					this.panelTab = "problems";
					this.showPanel = true;
				},
			},
			{
				id: "reset",
				label: "Project: Reset Files to Seed",
				run: () => {
					if (confirm("Reset?")) resetWorkspace();
				},
			},
		];
		if (!this.paletteCmdQ) return cmds;
		return cmds.filter((c) => c.label.toLowerCase().includes(this.paletteCmdQ));
	}
	get paletteTotal() {
		return (
			this.paletteFiles.length +
			this.allCommands.length +
			this.projectsSnap.filter((m) => m.name.toLowerCase().includes(this.paletteCmdQ)).length
		);
	}
	get filteredLogs() {
		const f = this.panelFilter.trim().toLowerCase();
		let list = this.logs;
		if (this.panelTab === "output") list = this.logs.filter((l) => l.kind !== "log");
		if (this.panelTab === "console") list = this.logs;
		if (!f) return list.slice(-120);
		return list.filter((l) => (l.kind + " " + l.text).toLowerCase().includes(f)).slice(-120);
	}

	// ---------- ui persistence (hybrid: global layout + per-project view) ----------
	loadPersistedUI() {
		if (typeof window === "undefined") return;
		try {
			const g = loadGlobalUI();
			if (g) {
				this.sidebar = g.sidebar;
				this.sidebarW = g.sidebarW;
				this.autoReload = g.autoReload;
				this.minimapOn = g.minimapOn;
				this.fontSize = g.fontSize;
				this.showPanel = g.showPanel;
				this.panelH = g.panelH;
				this.panelMax = g.panelMax;
				this.winMax = g.winMax;
				this.openEditorsOpen = g.openEditorsOpen;
				this.outlineOpen = g.outlineOpen;
				this.timelineOpen = g.timelineOpen;
				this.useSpaces = g.useSpaces;
				this.indentSize = g.indentSize;
				this.encoding = g.encoding;
				this.eol = g.eol;
				this.outputChannel = g.outputChannel;
				this.termTabs = [...g.termTabs];
				this.activeTerm = g.activeTerm;
				this.currentBranch = g.currentBranch;
				this.branches = [...g.branches];
				this.searchCase = g.searchCase;
				this.searchWord = g.searchWord;
				this.searchRegex = g.searchRegex;
				if (g.layout) {
					const clean = sanitizePersistedLayout(g.layout);
					if (clean) {
						this.layoutRoot = clean.root;
						this.groups = clean.groups;
						this.activeGroupId = clean.activeGroupId;
						this.maximizedGroupId = clean.maximizedGroupId;
					} else {
						this.migrateLegacyLayout(g.showPreview, g.editorPct, g.previewZoomed);
					}
				} else {
					this.migrateLegacyLayout(g.showPreview, g.editorPct, g.previewZoomed);
				}
				this.pruneLayoutToFiles();
				this.ensureLayoutValid();
			} else {
				this.migrateLegacyLayout(true, 55, false);
			}
			this.projectsUIMap = loadProjectsUIMap();
			this.applyProjectUI(this.activeProjectIdSnap);
		} catch {
			/* corrupted UI prefs: keep defaults */
		} finally {
			this.uiReady = true;
		}
	}

	migrateLegacyLayout(showPreview?: boolean, editorPct?: number, previewZoomed?: boolean) {
		const tabs = this.tabs.length ? [...this.tabs] : [this.active || "/index.html"];
		const migrated = defaultLayoutFromFiles(
			tabs,
			this.active || "/index.html",
			showPreview ?? true,
			editorPct ?? 55,
		);
		this.layoutRoot = migrated.root;
		this.groups = migrated.groups;
		this.activeGroupId = migrated.activeGroupId;
		// Old "zoom preview" becomes maximized preview group.
		if (previewZoomed) {
			const loc = this.previewLocation;
			this.maximizedGroupId = loc ? loc.groupId : migrated.activeGroupId;
		} else {
			this.maximizedGroupId = null;
		}
	}

	ensureLayoutValid() {
		const ids = listGroupIds(this.layoutRoot);
		// Drop group records unreachable from root.
		for (const id of Object.keys(this.groups)) {
			if (!ids.includes(id)) {
				delete this.groups[id];
				delete this.groupCursor[id];
			}
		}
		// Ensure every leaf has a group record.
		for (const id of ids) {
			if (!this.groups[id]) this.groups[id] = { id, tabs: [], active: -1 };
		}
		if (ids.length === 0) {
			this.groups = { g1: { id: "g1", tabs: [], active: -1 } };
			this.layoutRoot = leaf("g1");
			this.activeGroupId = "g1";
		}
		if (!this.groups[this.activeGroupId]) this.activeGroupId = listGroupIds(this.layoutRoot)[0];
		if (this.maximizedGroupId && !this.groups[this.maximizedGroupId]) this.maximizedGroupId = null;
		// Clamp actives.
		for (const g of Object.values(this.groups)) {
			if (g.tabs.length === 0) g.active = -1;
			else if (g.active < 0 || g.active >= g.tabs.length) g.active = g.tabs.length - 1;
		}
		this.groups = { ...this.groups };
	}

	pruneLayoutToFiles() {
		try {
			const existing = new Set(
				Object.values(this.filesSnap)
					.filter((n) => n.type === "file")
					.map((n) => n.path),
			);
			pruneLayout(this.layoutRoot, this.groups, existing);
			this.ensureLayoutValid();
		} catch {
			/* noop */
		}
	}

	applyProjectUI(id: string | null) {
		if (!id) return;
		const saved = this.projectsUIMap[id];
		if (saved) {
			this.sideView = saved.sideView;
			this.panelTab = saved.panelTab;
			const known = new Set(
				Object.values(this.filesSnap)
					.filter((n) => n.type === "dir")
					.map((n) => n.path),
			);
			known.add("/");
			const pruned = saved.expandedDirs.filter((p) => known.has(p)).slice(0, 200);
			if (!pruned.includes("/")) pruned.unshift("/");
			this.expandedDirs = pruned.length ? pruned : ["/"];
		} else {
			this.sideView = "explorer";
			this.panelTab = "console";
			this.expandedDirs = ["/"];
		}
	}

	snapshotGlobal() {
		return {
			sidebar: this.sidebar,
			sidebarW: this.sidebarW,
			autoReload: this.autoReload,
			minimapOn: this.minimapOn,
			fontSize: this.fontSize,
			showPanel: this.showPanel,
			panelH: this.panelH,
			panelMax: this.panelMax,
			winMax: this.winMax,
			openEditorsOpen: this.openEditorsOpen,
			outlineOpen: this.outlineOpen,
			timelineOpen: this.timelineOpen,
			useSpaces: this.useSpaces,
			indentSize: this.indentSize,
			encoding: this.encoding,
			eol: this.eol,
			outputChannel: this.outputChannel,
			termTabs: [...this.termTabs],
			activeTerm: this.activeTerm,
			currentBranch: this.currentBranch,
			branches: [...this.branches],
			searchCase: this.searchCase,
			searchWord: this.searchWord,
			searchRegex: this.searchRegex,
			layout: {
				root: this.layoutRoot,
				groups: this.groups,
				activeGroupId: this.activeGroupId,
				maximizedGroupId: this.maximizedGroupId,
			} as PersistedLayout,
		};
	}

	snapshotProject(): ProjectUI {
		return {
			sideView: this.sideView,
			panelTab: this.panelTab,
			expandedDirs: [...this.expandedDirs].slice(0, 200),
		};
	}

	queueSaveGlobal() {
		if (!this.uiReady || typeof window === "undefined") return;
		if (this.uiSaveT) clearTimeout(this.uiSaveT);
		this.uiSaveT = setTimeout(() => {
			this.uiSaveT = null;
			try {
				saveGlobalUI(this.snapshotGlobal());
			} catch {
				/* noop */
			}
		}, 250);
	}

	queueSaveProjects() {
		if (!this.uiReady || typeof window === "undefined") return;
		const id = this.activeProjectIdSnap;
		if (!id) return;
		if (this.projSaveT) clearTimeout(this.projSaveT);
		this.projSaveT = setTimeout(() => {
			this.projSaveT = null;
			try {
				this.projectsUIMap[id] = this.snapshotProject();
				saveProjectsUIMap(this.projectsUIMap);
			} catch {
				/* noop */
			}
		}, 250);
	}

	flushUI() {
		if (!this.uiReady || typeof window === "undefined") return;
		try {
			if (this.uiSaveT) {
				clearTimeout(this.uiSaveT);
				this.uiSaveT = null;
			}
			if (this.projSaveT) {
				clearTimeout(this.projSaveT);
				this.projSaveT = null;
			}
			saveGlobalUI(this.snapshotGlobal());
			const id = this.activeProjectIdSnap;
			if (id) {
				this.projectsUIMap[id] = this.snapshotProject();
				saveProjectsUIMap(this.projectsUIMap);
			}
		} catch {
			/* noop */
		}
	}

	// ---------- actions ----------
	toast(text: string, kind = "info") {
		this.toastSeq += 1;
		const id = this.toastSeq;
		this.toasts = [...this.toasts.slice(-3), { id, text, kind }];
		setTimeout(() => {
			this.toasts = this.toasts.filter((t) => t.id !== id);
		}, 3400);
	}

	hiMatch(label: string, q: string): { pre: string; mid: string; post: string } {
		if (!q) return { pre: label, mid: "", post: "" };
		const i = label.toLowerCase().indexOf(q.toLowerCase().slice(0, 32));
		if (i < 0) return { pre: label, mid: "", post: "" };
		const len = Math.min(q.length, 32);
		return { pre: label.slice(0, i), mid: label.slice(i, i + len), post: label.slice(i + len) };
	}

	closeAllMenus() {
		this.titleMenu = null;
		this.titleMenuPos = null;
		this.projMenu = false;
		this.sideMenu = false;
		this.tabCtx = null;
		this.editorCtx = null;
		this.settingsMenu = false;
		this.accountsMenu = false;
		this.notifCenter = false;
		this.branchMenu = false;
		this.indentMenu = false;
		this.encodingMenu = false;
		this.eolMenu = false;
		this.crumbSymMenu = false;
		this.layoutMenu = false;
	}

	/** Open one top-level menu exclusively (single-open invariant). */
	openOnly(patch: () => void) {
		this.closeAllMenus();
		patch();
	}

	openTitleMenu(name: string, anchor?: { x: number; y: number } | null) {
		const cur = this.titleMenu;
		this.closeAllMenus();
		if (cur !== name) {
			this.titleMenu = name;
			this.titleMenuPos = anchor ?? this.titleMenuPos;
		}
	}

	openTabCtx(p: { x: number; y: number; path: string; groupId?: string; isPreview?: boolean }) {
		this.closeAllMenus();
		this.tabCtx = {
			x: p.x,
			y: p.y,
			path: p.path,
			groupId: p.groupId ?? this.activeGroupId,
			isPreview: p.isPreview ?? false,
		};
	}

	openEditorCtx(p: { x: number; y: number }) {
		this.closeAllMenus();
		this.editorCtx = p;
	}

	handleInspectSelect(info: InspectPayload | null) {
		this.inspectTarget = info;
		if (!info) return;
		if (this.active !== this.entry) {
			const cur = this.filesSnap[this.active]?.content ?? "";
			const needle = info.id ? info.id : `<${info.tag}`;
			if (!cur.includes(needle)) openFile(this.entry);
		}
	}

	handleInspectClearFromEditor() {
		this.inspectTarget = null;
		try {
			this.previewRef?.clearInspectSelection();
		} catch {
			/* noop */
		}
	}

	onEdit(v: string, path?: string) {
		const target = path ?? this.active;
		if (v !== this.filesSnap[target]?.content) writeFile(target, v);
	}

	autofocus(el: HTMLInputElement) {
		el.focus();
	}

	activateOnKey(e: KeyboardEvent, fn: () => void) {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			fn();
		}
	}

	onLog(kind: string, text: string) {
		this.logs = [...this.logs.slice(-199), { kind, text }];
		if (kind === "error") {
			this.panelTab = "console";
			this.showPanel = true;
		}
	}

	onEntryChange(v: string) {
		setProjectEntry(v);
		this.toast(`Entry → ${v}`);
	}

	openNewProjectDialog() {
		this.newProjName = defaultProjectName();
		this.newProjTemplate = "seed";
		this.showNewProj = true;
		this.projMenu = false;
		this.palette = false;
	}

	confirmNewProject() {
		this.flushUI();
		const id = createProject(this.newProjName.trim() || defaultProjectName(), this.newProjTemplate);
		this.applyProjectUI(id);
		this.queueSaveProjects();
		this.showNewProj = false;
		// New project has its own files/tabs — rebuild tiling from stores.
		try {
			this.resetLayoutFromStores(true);
		} catch {
			/* noop */
		}
		this.toast(`Project “${this.newProjName.trim() || "untitled"}” created`);
	}

	startRenameProject(id: string, cur: string) {
		this.renameTarget = id;
		this.renameDraft = cur;
		this.projMenu = false;
	}

	confirmRenameProject() {
		if (this.renameTarget && this.renameDraft.trim())
			renameProject(this.renameTarget, this.renameDraft.trim());
		this.renameTarget = null;
	}

	doSwitchProject(id: string) {
		this.flushUI();
		switchProject(id);
		this.applyProjectUI(id);
		this.projMenu = false;
		this.palette = false;
		try {
			this.resetLayoutFromStores(true);
		} catch {
			/* noop */
		}
		this.toast("Project switched");
	}

	doDeleteProject(id: string, name: string) {
		if (!confirm(`Delete project "${name}"? This cannot be undone.`)) return;
		this.flushUI();
		delete this.projectsUIMap[id];
		try {
			saveProjectsUIMap(this.projectsUIMap);
		} catch {
			/* noop */
		}
		deleteProject(id);
		this.applyProjectUI(this.activeProjectIdSnap);
		this.projMenu = false;
		try {
			this.resetLayoutFromStores(true);
		} catch {
			/* noop */
		}
		this.toast(`Deleted “${name}”`, "warn");
	}

	doCreateFile(dir: string, name: string) {
		try {
			const full = join(dir, name);
			createFile(full, name.endsWith(".html") ? "<!-- new -->\n" : "");
			try {
				this.ensureLayoutValid();
				this.ensureFileInGroup(full, this.activeGroupId);
			} catch {
				/* noop */
			}
			this.toast(`Created ${full}`);
		} catch {
			this.toast("File already exists", "warn");
		}
	}

	doCreateFolder(dir: string, name: string) {
		try {
			createFolder(join(dir, name));
			this.toast(`Created folder ${name}`);
		} catch {
			this.toast("Folder already exists", "warn");
		}
	}

	togglePreviewZoom() {
		this.toggleMaximize();
	}

	/** @deprecated use togglePreviewTab — kept for command-palette compat */
	togglePreview() {
		this.togglePreviewTab();
	}

	get groupCount(): number {
		try {
			return countLeaves(this.layoutRoot);
		} catch {
			return Object.keys(this.groups).length;
		}
	}

	get activeGroup(): EditorGroup | null {
		return this.groups[this.activeGroupId] ?? null;
	}

	get hasPreviewOpen(): boolean {
		return Object.values(this.groups).some((g) => g.tabs.some((t) => t.kind === "preview"));
	}

	get previewLocation(): { groupId: string; index: number } | null {
		for (const g of Object.values(this.groups)) {
			const i = g.tabs.findIndex((t) => t.kind === "preview");
			if (i >= 0) return { groupId: g.id, index: i };
		}
		return null;
	}

	getGroupActiveItem(groupId: string): EditorItem | null {
		const g = this.groups[groupId];
		if (!g || g.active < 0 || g.active >= g.tabs.length) return null;
		return g.tabs[g.active];
	}

	getGroupActiveFile(groupId: string): string | null {
		const it = this.getGroupActiveItem(groupId);
		return it && it.kind === "file" ? it.path : null;
	}

	outlineFor(path: string): { line: number; label: string; kind: string }[] {
		const src = this.filesSnap[path]?.content ?? "";
		const out: { line: number; label: string; kind: string }[] = [];
		const lines = src.split("\n");
		const lang = languageOf(path);
		for (let i = 0; i < lines.length; i++) {
			const ln = lines[i];
			if (lang === "html" || lang === "xml") {
				const m = ln.match(
					/<(h[1-6]|section|header|footer|main|div|button|form)[^>]*>([^<]{1,60})/i,
				);
				if (m)
					out.push({
						line: i + 1,
						label: `${m[1]} — ${(m[2] ?? "").trim().slice(0, 42) || "(block)"}`,
						kind: "tag",
					});
				continue;
			}
			if (lang === "css") {
				const m = ln.match(/^\s*([.#]?[A-Za-z][\w\-.,\s:#>]*)\s*\{/);
				if (m)
					out.push({
						line: i + 1,
						label: m[1].trim().slice(0, 48),
						kind: "css",
					});
				continue;
			}
			const m =
				ln.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/) ??
				ln.match(/^\s*class\s+([A-Za-z_$][\w$]*)/) ??
				ln.match(/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/);
			if (m?.[1])
				out.push({
					line: i + 1,
					label: String(m[1]).slice(0, 48),
					kind: lang,
				});
		}
		return out.slice(0, 60);
	}

	crumbsFor(path: string): { label: string; path: string; isFile: boolean }[] {
		if (!path) return [];
		const parts = path.split("/").filter(Boolean);
		const acc: { label: string; path: string; isFile: boolean }[] = [
			{ label: this.activeProjectName, path: "/", isFile: false },
		];
		let cur = "";
		parts.forEach((seg, i) => {
			cur += "/" + seg;
			acc.push({ label: seg, path: cur, isFile: i === parts.length - 1 });
		});
		return acc;
	}

	focusGroup(id: string) {
		if (!this.groups[id]) return;
		this.activeGroupId = id;
		const f = this.getGroupActiveFile(id);
		if (f) openFile(f);
		this.syncGlobalCursorFromActiveGroup();
		this.groups = { ...this.groups };
	}

	activateTab(groupId: string, index: number) {
		const g = this.groups[groupId];
		if (!g || index < 0 || index >= g.tabs.length) return;
		g.active = index;
		this.activeGroupId = groupId;
		const it = g.tabs[index];
		if (it.kind === "file") openFile(it.path);
		this.syncGlobalCursorFromActiveGroup();
		this.groups = { ...this.groups };
	}

	cursorFor(groupId: string): { line: number; col: number } {
		return this.groupCursor[groupId] ?? { line: 1, col: 1 };
	}

	setGroupCursor(groupId: string, line: number, col: number) {
		this.groupCursor[groupId] = { line, col };
		if (groupId === this.activeGroupId) {
			this.line = line;
			this.col = col;
		}
	}

	syncGlobalCursorFromActiveGroup() {
		const c = this.groupCursor[this.activeGroupId];
		if (c) {
			this.line = c.line;
			this.col = c.col;
		} else {
			this.line = 1;
			this.col = 1;
		}
	}

	touchGroups() {
		this.syncGlobalCursorFromActiveGroup();
		this.groups = { ...this.groups };
	}

	ensureFileInGroup(path: string, groupId: string) {
		const g = this.groups[groupId];
		if (!g) return;
		const i = g.tabs.findIndex((t) => t.kind === "file" && t.path === path);
		if (i >= 0) {
			g.active = i;
		} else {
			g.tabs.push(fileItem(path));
			g.active = g.tabs.length - 1;
		}
		this.activeGroupId = groupId;
		this.touchGroups();
	}

	openPreviewInGroup(groupId: string) {
		const existing = this.previewLocation;
		if (existing && existing.groupId === groupId) {
			this.activateTab(groupId, existing.index);
			return;
		}
		if (existing) {
			const src = this.groups[existing.groupId];
			if (src) {
				src.tabs.splice(existing.index, 1);
				if (src.active >= src.tabs.length) src.active = src.tabs.length - 1;
			}
		}
		const target = this.groups[groupId];
		if (!target) return;
		const dup = target.tabs.findIndex((t) => t.kind === "preview");
		if (dup >= 0) {
			target.active = dup;
		} else {
			target.tabs.push(previewItem());
			target.active = target.tabs.length - 1;
		}
		this.activeGroupId = groupId;
		this.touchGroups();
	}

	togglePreviewTab() {
		if (this.hasPreviewOpen) {
			const loc = this.previewLocation!;
			// If preview is already focused, close it; otherwise focus it.
			const g = this.groups[loc.groupId];
			if (this.activeGroupId === loc.groupId && g && g.active === loc.index) {
				this.closeTabInGroup(loc.groupId, loc.index);
			} else {
				this.activateTab(loc.groupId, loc.index);
			}
		} else {
			this.ensureLayoutValid();
			this.openPreviewInGroup(this.activeGroupId);
		}
	}

	closePreview() {
		const loc = this.previewLocation;
		if (loc) this.closeTabInGroup(loc.groupId, loc.index);
	}

	openPreview() {
		this.ensureLayoutValid();
		this.openPreviewInGroup(this.activeGroupId);
	}

	toggleMaximize(groupId?: string) {
		const target = groupId ?? this.activeGroupId;
		if (this.maximizedGroupId === target) this.maximizedGroupId = null;
		else this.maximizedGroupId = target;
	}

	splitActiveGroup(dir: "row" | "col") {
		this.splitGroup(this.activeGroupId, dir);
	}

	splitGroup(groupId: string, dir: "row" | "col") {
		if (this.groupCount >= MAX_GROUPS) {
			this.toast("Maximum of 4 editor groups", "warn");
			return;
		}
		const src = this.groups[groupId];
		if (!src) return;
		const activeItem = src.active >= 0 ? src.tabs[src.active] : null;
		const nid = nextGroupId();
		let newTabs: EditorItem[];
		if (!activeItem) {
			newTabs = [];
		} else if (activeItem.kind === "preview") {
			// Singleton: move preview to the new group.
			src.tabs.splice(src.active, 1);
			if (src.active >= src.tabs.length) src.active = src.tabs.length - 1;
			newTabs = [previewItem()];
		} else {
			// Duplicate file so both groups stay useful.
			newTabs = [fileItem(activeItem.path)];
		}
		const ng: EditorGroup = { id: nid, tabs: newTabs, active: newTabs.length - 1 };
		this.groups[nid] = ng;
		this.replaceLeafWithSplit(groupId, dir, leaf(nid), false);
		this.activeGroupId = nid;
		this.touchGroups();
	}

	splitGroupWithItem(
		sourceGroupId: string,
		dir: "row" | "col",
		item: EditorItem,
		placeAfter = true,
	) {
		if (this.groupCount >= MAX_GROUPS) {
			this.toast("Maximum of 4 editor groups", "warn");
			return;
		}
		const src = this.groups[sourceGroupId];
		if (!src) return;
		// Remove from source (keep empty source — it becomes Welcome).
		const si = src.tabs.findIndex((t) => itemsEqual(t, item));
		if (si >= 0) {
			src.tabs.splice(si, 1);
			if (src.active >= src.tabs.length) src.active = src.tabs.length - 1;
		} else if (item.kind === "preview") {
			// Preview singleton may live elsewhere.
			const loc = this.previewLocation;
			if (loc) {
				const og = this.groups[loc.groupId];
				if (og) {
					og.tabs.splice(loc.index, 1);
					if (og.active >= og.tabs.length) og.active = og.tabs.length - 1;
				}
			}
		}
		const nid = nextGroupId();
		this.groups[nid] = { id: nid, tabs: [item], active: 0 };
		this.replaceLeafWithSplit(sourceGroupId, dir, leaf(nid), !placeAfter);
		this.activeGroupId = nid;
		this.touchGroups();
	}

	replaceLeafWithSplit(
		leafGroupId: string,
		dir: "row" | "col",
		newLeaf: SplitNode,
		before: boolean,
	) {
		const replace = (node: SplitNode): SplitNode => {
			if (node.type === "leaf") {
				if (node.groupId !== leafGroupId) return node;
				const kids = before ? [newLeaf, node] : [node, newLeaf];
				return { type: "split", id: nextSplitId(), dir, sizes: [50, 50], children: kids };
			}
			return { ...node, children: node.children.map(replace) };
		};
		this.layoutRoot = replace(this.layoutRoot);
	}

	moveTabToGroup(fromGroupId: string, toGroupId: string, key: string) {
		if (fromGroupId === toGroupId) return;
		const src = this.groups[fromGroupId];
		const dst = this.groups[toGroupId];
		if (!src || !dst) return;
		const si = src.tabs.findIndex((t) => itemKey(t) === key);
		if (si < 0) return;
		const [item] = src.tabs.splice(si, 1);
		if (src.active >= src.tabs.length) src.active = src.tabs.length - 1;
		// If target already has it (same file in both groups is allowed, but
		// avoid exact duplicates), just focus existing.
		const di = dst.tabs.findIndex((t) => itemKey(t) === key);
		if (di >= 0) {
			dst.active = di;
		} else {
			dst.tabs.push(item);
			dst.active = dst.tabs.length - 1;
		}
		this.activeGroupId = toGroupId;
		if (item.kind === "file") openFile(item.path);
		// Auto-collapse source if it became empty and others remain.
		if (src.tabs.length === 0 && this.groupCount > 1) {
			this.removeLeaf(fromGroupId);
			delete this.groups[fromGroupId];
			delete this.groupCursor[fromGroupId];
			if (this.maximizedGroupId === fromGroupId) this.maximizedGroupId = null;
		}
		this.ensureLayoutValid();
		this.touchGroups();
	}

	reorderTabsInGroup(groupId: string, fromKey: string, toKey: string) {
		if (fromKey === toKey) return;
		const g = this.groups[groupId];
		if (!g) return;
		const fi = g.tabs.findIndex((t) => itemKey(t) === fromKey);
		const ti = g.tabs.findIndex((t) => itemKey(t) === toKey);
		if (fi < 0 || ti < 0) return;
		const [m] = g.tabs.splice(fi, 1);
		g.tabs.splice(ti, 0, m);
		g.active = g.tabs.findIndex((t) => itemsEqual(t, m));
		this.activeGroupId = groupId;
		this.touchGroups();
	}

	closeTabInGroup(groupId: string, index: number) {
		const g = this.groups[groupId];
		if (!g || index < 0 || index >= g.tabs.length) return;
		const [removed] = g.tabs.splice(index, 1);
		if (g.active >= g.tabs.length) g.active = g.tabs.length - 1;
		if (removed.kind === "file") {
			const stillOpen = Object.values(this.groups).some((gg) =>
				gg.tabs.some((t) => t.kind === "file" && t.path === removed.path),
			);
			if (!stillOpen) closeTab(removed.path);
		}
		if (g.tabs.length === 0 && this.groupCount > 1) {
			this.removeLeaf(groupId);
			delete this.groups[groupId];
			delete this.groupCursor[groupId];
			if (this.maximizedGroupId === groupId) this.maximizedGroupId = null;
		}
		this.ensureLayoutValid();
		// Keep global active on a file.
		const fallback =
			this.getGroupActiveFile(this.activeGroupId) ?? this.getGroupActiveFile(groupId);
		if (fallback) openFile(fallback);
		this.touchGroups();
	}

	closeFileEverywhere(path: string) {
		for (const g of Object.values(this.groups)) {
			const i = g.tabs.findIndex((t) => t.kind === "file" && t.path === path);
			if (i >= 0) {
				g.tabs.splice(i, 1);
				if (g.active >= g.tabs.length) g.active = g.tabs.length - 1;
			}
		}
		closeTab(path);
		// Collapse newly-empty groups except the last one.
		const empties = Object.values(this.groups).filter((g) => g.tabs.length === 0);
		if (this.groupCount > 1) {
			for (const e of empties) {
				if (this.groupCount <= 1) break;
				this.removeLeaf(e.id);
				delete this.groups[e.id];
				delete this.groupCursor[e.id];
				if (this.maximizedGroupId === e.id) this.maximizedGroupId = null;
			}
		}
		this.ensureLayoutValid();
		this.touchGroups();
	}

	closeGroup(groupId: string) {
		if (this.groupCount <= 1) {
			// Last group: clear tabs (Welcome) instead of removing.
			const g = this.groups[groupId];
			if (g) {
				const files = g.tabs
					.filter((t) => t.kind === "file")
					.map((t) => (t as { path: string }).path);
				g.tabs = [];
				g.active = -1;
				for (const f of files) {
					const elsewhere = Object.values(this.groups).some((gg) =>
						gg.tabs.some((t) => t.kind === "file" && t.path === f),
					);
					if (!elsewhere) closeTab(f);
				}
			}
			this.maximizedGroupId = null;
			this.touchGroups();
			return;
		}
		const g = this.groups[groupId];
		if (g) {
			for (const t of [...g.tabs]) {
				if (t.kind === "file") {
					const elsewhere = Object.entries(this.groups).some(
						([id, gg]) =>
							id !== groupId && gg.tabs.some((x) => x.kind === "file" && x.path === t.path),
					);
					if (!elsewhere) closeTab(t.path);
				}
			}
		}
		this.removeLeaf(groupId);
		delete this.groups[groupId];
		delete this.groupCursor[groupId];
		if (this.maximizedGroupId === groupId) this.maximizedGroupId = null;
		if (!this.groups[this.activeGroupId]) {
			const ids = listGroupIds(this.layoutRoot);
			this.activeGroupId = ids[0] ?? groupId;
		}
		this.ensureLayoutValid();
		this.touchGroups();
	}

	removeLeaf(groupId: string) {
		const remove = (node: SplitNode): SplitNode | null => {
			if (node.type === "leaf") return node.groupId === groupId ? null : node;
			const mapped: (SplitNode | null)[] = node.children.map(remove);
			const kids: SplitNode[] = [];
			const keptSizes: number[] = [];
			node.children.forEach((_, i) => {
				const r = mapped[i];
				if (r) {
					kids.push(r);
					keptSizes.push(node.sizes[i] ?? 100 / node.children.length);
				}
			});
			if (kids.length === 0) return null;
			if (kids.length === 1) return kids[0];
			const sum = keptSizes.reduce((a, b) => a + b, 0) || 1;
			return { ...node, sizes: keptSizes.map((s) => (s / sum) * 100), children: kids };
		};
		const next = remove(this.layoutRoot);
		if (next) this.layoutRoot = next;
		else {
			this.groups = { g1: { id: "g1", tabs: [], active: -1 } };
			this.layoutRoot = leaf("g1");
			this.activeGroupId = "g1";
		}
	}

	resizeSplit(splitId: string, index: number, deltaPct: number) {
		const target = this.findSplitById(splitId);
		if (!target || index < 0 || index >= target.sizes.length - 1) return;
		const a = target.sizes[index] + deltaPct;
		const b = target.sizes[index + 1] - deltaPct;
		if (a < 15 || b < 15 || a > 85 || b > 85) return;
		target.sizes[index] = a;
		target.sizes[index + 1] = b;
		// Mutating target.sizes in place is reactive ($state deep tracking).
		// Do NOT replace layoutRoot here — that remounts every editor/iframe.
	}

	setSplitSizes(splitId: string, sizes: number[]) {
		const target = this.findSplitById(splitId);
		if (!target || sizes.length !== target.children.length) return;
		target.sizes = [...sizes];
		// Same: in-place update only, no root clone (see above).
	}

	findSplitById(splitId: string): Extract<SplitNode, { type: "split" }> | null {
		const walk = (node: SplitNode): Extract<SplitNode, { type: "split" }> | null => {
			if (node.type === "leaf") return null;
			if (node.id === splitId) return node;
			for (const c of node.children) {
				const f = walk(c);
				if (f) return f;
			}
			return null;
		};
		return walk(this.layoutRoot);
	}

	resetLayoutFromStores(showPreview = true) {
		const tabs = this.tabs.length ? [...this.tabs] : [this.active || "/index.html"];
		const migrated = defaultLayoutFromFiles(tabs, this.active || "/index.html", showPreview, 55);
		this.layoutRoot = migrated.root;
		this.groups = migrated.groups;
		this.activeGroupId = migrated.activeGroupId;
		this.maximizedGroupId = null;
		this.touchGroups();
	}

	// --- compatibility layer for pre-tiling prefs/components ---
	get showPreview(): boolean {
		return this.hasPreviewOpen;
	}
	set showPreview(v: boolean) {
		if (v) this.openPreview();
		else this.closePreview();
	}
	get previewZoomed(): boolean {
		return this.maximizedGroupId !== null;
	}
	set previewZoomed(v: boolean) {
		if (!v) this.maximizedGroupId = null;
		else if (!this.maximizedGroupId) {
			const loc = this.previewLocation;
			this.maximizedGroupId = loc ? loc.groupId : this.activeGroupId;
		}
	}
	get dragging(): boolean {
		return this.splitDrag;
	}
	set dragging(v: boolean) {
		this.splitDrag = v;
	}
	get editorPct(): number {
		if (this.layoutRoot.type === "split" && this.layoutRoot.sizes.length === 2) {
			return Math.round(this.layoutRoot.sizes[0]);
		}
		return 55;
	}
	set editorPct(v: number) {
		if (this.layoutRoot.type === "split" && this.layoutRoot.sizes.length === 2) {
			const c = Math.min(85, Math.max(15, v));
			this.setSplitSizes(this.layoutRoot.id, [c, 100 - c]);
		}
	}
	applyEditorPct(clientX: number, rectLeft: number, rectWidth: number) {
		if (!rectWidth) return;
		this.editorPct = ((clientX - rectLeft) / rectWidth) * 100;
	}

	runPaletteCommand(id: string) {
		const c = this.allCommands.find((x) => x.id === id);
		c?.run();
		this.palette = false;
	}

	confirmGoto() {
		const n = parseInt(this.gotoDraft, 10);
		if (Number.isFinite(n) && n >= 1) {
			this.revealLine = 0;
			requestAnimationFrame(() => (this.revealLine = n));
			this.setGroupCursor(this.activeGroupId, n, 1);
			this.toast(`Go to line ${n}`);
		}
		this.gotoOpen = false;
	}

	runTerm(cmdRaw: string) {
		const cmd = cmdRaw.trim();
		if (!cmd) return;
		this.termLines = [...this.termLines.slice(-99), { text: `$ ${cmd}`, kind: "cmd" }];
		const [c, ...rest] = cmd.split(/\s+/);
		const arg = rest.join(" ");
		if (c === "help") {
			this.termLines = [
				...this.termLines,
				{ text: "help · clear · ls · open <file> · entry · echo <text>", kind: "info" },
			];
		} else if (c === "clear") {
			this.termLines = [];
		} else if (c === "ls") {
			const names = Object.keys(this.filesSnap)
				.filter((p) => this.filesSnap[p].type === "file")
				.sort()
				.join("  ");
			this.termLines = [...this.termLines, { text: names || "(empty)", kind: "log" }];
		} else if (c === "open") {
			const target = arg.startsWith("/") ? arg : "/" + arg;
			if (this.filesSnap[target]?.type === "file") {
				openFile(target);
				this.termLines = [...this.termLines, { text: `opened ${target}`, kind: "ok" }];
			} else {
				this.termLines = [...this.termLines, { text: `no such file: ${arg}`, kind: "error" }];
			}
		} else if (c === "entry") {
			this.termLines = [...this.termLines, { text: `entry = ${this.entry}`, kind: "log" }];
		} else if (c === "echo") {
			this.termLines = [...this.termLines, { text: arg, kind: "log" }];
		} else {
			this.termLines = [...this.termLines, { text: `command not found: ${c}`, kind: "error" }];
		}
		this.termInput = "";
	}

	// --- sash / resize (element refs live in components) ---
	moveSidebar(clientX: number) {
		this.sidebarW = Math.min(480, Math.max(180, clientX - 48));
	}
	movePanel(clientY: number) {
		const h = window.innerHeight - clientY - 24;
		this.panelH = Math.min(520, Math.max(100, h));
	}

	setBodyDragCursor(kind: "col" | "row" | "") {
		try {
			document.body.style.userSelect = kind ? "none" : "";
			document.body.style.cursor =
				kind === "col" ? "col-resize" : kind === "row" ? "row-resize" : "";
		} catch {
			/* noop */
		}
	}

	resetPaletteSel() {
		this.paletteSel = 0;
	}

	handleGlobalKeydown(e: KeyboardEvent) {
		const mod = e.ctrlKey || e.metaKey;
		if (mod && e.key.toLowerCase() === "p" && !e.shiftKey) {
			e.preventDefault();
			this.paletteQ = "";
			this.palette = true;
		}
		if (mod && e.shiftKey && e.key.toLowerCase() === "p") {
			e.preventDefault();
			this.paletteQ = "> ";
			this.palette = true;
		}
		if (mod && e.key.toLowerCase() === "b") {
			e.preventDefault();
			this.sidebar = !this.sidebar;
		}
		if (mod && e.key.toLowerCase() === "j") {
			e.preventDefault();
			this.showPanel = !this.showPanel;
		}
		if (mod && e.key === "`") {
			e.preventDefault();
			this.panelTab = "terminal";
			this.showPanel = !this.showPanel;
		}
		if (mod && e.shiftKey && ["e", "f", "g"].includes(e.key.toLowerCase())) {
			e.preventDefault();
			const k = e.key.toLowerCase();
			this.sideView = k === "e" ? "explorer" : k === "f" ? "search" : "scm";
			this.sidebar = true;
		}
		if (mod && e.key.toLowerCase() === "w") {
			e.preventDefault();
			const g = this.groups[this.activeGroupId];
			if (g && g.active >= 0) this.closeTabInGroup(this.activeGroupId, g.active);
			else if (this.active) this.closeFileEverywhere(this.active);
		}
		if (mod && e.key === "\\") {
			e.preventDefault();
			if (e.shiftKey) this.splitActiveGroup("col");
			else this.splitActiveGroup("row");
		}
		if (mod && e.key === "Tab") {
			e.preventDefault();
			if (this.tabs.length > 1) {
				const i = this.tabs.indexOf(this.active);
				const n = e.shiftKey
					? (i - 1 + this.tabs.length) % this.tabs.length
					: (i + 1) % this.tabs.length;
				this.openFile(this.tabs[n]);
			}
		}
		if (e.key === "F1") {
			e.preventDefault();
			this.paletteQ = "> ";
			this.palette = true;
		}
		if (mod && e.key.toLowerCase() === "g" && !e.shiftKey) {
			e.preventDefault();
			this.gotoDraft = String(this.cursorFor(this.activeGroupId).line);
			this.gotoOpen = true;
		}
		if (e.key === "Escape") {
			if (this.gotoOpen) this.gotoOpen = false;
			else if (this.langPick) this.langPick = false;
			else if (
				this.tabCtx ||
				this.editorCtx ||
				this.titleMenu ||
				this.sideMenu ||
				this.projMenu ||
				this.layoutMenu ||
				this.branchMenu ||
				this.indentMenu ||
				this.encodingMenu ||
				this.eolMenu ||
				this.settingsMenu ||
				this.accountsMenu ||
				this.notifCenter ||
				this.crumbSymMenu
			)
				this.closeAllMenus();
			if (this.maximizedGroupId) this.maximizedGroupId = null;
			if (
				!this.gotoOpen &&
				!this.langPick &&
				!this.tabCtx &&
				!this.editorCtx &&
				!this.titleMenu &&
				!this.sideMenu &&
				!this.notifCenter
			)
				this.palette = false;
		}
	}

	// Re-export store actions needed directly by components (group-aware)
	openFile(p: string, groupId?: string) {
		openFile(p);
		try {
			this.ensureLayoutValid();
			const target = groupId ?? this.activeGroupId;
			if (this.groups[target]) this.ensureFileInGroup(p, target);
			else {
				const ids = listGroupIds(this.layoutRoot);
				if (ids.length) this.ensureFileInGroup(p, ids[0]);
			}
		} catch {
			/* noop */
		}
	}
	closeTab(p: string) {
		this.closeFileEverywhere(p);
	}
	reorderTabs(from: string, to: string) {
		reorderTabs(from, to);
		// Mirror into active group when both present.
		try {
			const g = this.groups[this.activeGroupId];
			if (g) {
				const fk = `file:${from}`;
				const tk = `file:${to}`;
				if (g.tabs.some((t) => itemKey(t) === fk) && g.tabs.some((t) => itemKey(t) === tk)) {
					this.reorderTabsInGroup(this.activeGroupId, fk, tk);
				}
			}
		} catch {
			/* noop */
		}
	}
	removePath(p: string) {
		removePath(p);
		try {
			for (const g of Object.values(this.groups)) {
				const idx = g.tabs.findIndex((t) => t.kind === "file" && t.path === p);
				if (idx >= 0) {
					// Directory delete: also drop children.
					const isDir = p && !this.filesSnap[p];
					if (g.tabs[idx]?.kind === "file") {
						g.tabs.splice(idx, 1);
						if (g.active >= g.tabs.length) g.active = g.tabs.length - 1;
					}
				}
				// Drop any tab under a deleted folder.
				g.tabs = g.tabs.filter((t) =>
					t.kind === "preview" ? true : !(t.path === p || t.path.startsWith(p + "/")),
				);
				if (g.active >= g.tabs.length) g.active = g.tabs.length - 1;
			}
			this.pruneLayoutToFiles();
			this.ensureLayoutValid();
			this.touchGroups();
		} catch {
			/* noop */
		}
		this.toast(`Deleted ${p}`, "warn");
	}
	renamePath(a: string, b: string) {
		renamePath(a, b);
		try {
			for (const g of Object.values(this.groups)) {
				for (let i = 0; i < g.tabs.length; i++) {
					const t = g.tabs[i];
					if (t.kind === "file") {
						if (t.path === a) g.tabs[i] = fileItem(b);
						else if (t.path.startsWith(a + "/")) g.tabs[i] = fileItem(b + t.path.slice(a.length));
					}
				}
			}
			this.touchGroups();
		} catch {
			/* noop */
		}
	}
	clearAllProjects() {
		this.flushUI();
		this.projectsUIMap = {};
		try {
			saveProjectsUIMap(this.projectsUIMap);
		} catch {
			/* noop */
		}
		clearAllProjects();
	}
	duplicateProject(id: string) {
		this.flushUI();
		const nid = duplicateProject(id);
		if (nid) {
			const src = this.projectsUIMap[id] ?? this.snapshotProject();
			this.projectsUIMap[nid] = { ...src, expandedDirs: [...src.expandedDirs] };
			try {
				saveProjectsUIMap(this.projectsUIMap);
			} catch {
				/* noop */
			}
			this.applyProjectUI(nid);
			try {
				this.resetLayoutFromStores(true);
			} catch {
				/* noop */
			}
		}
		this.projMenu = false;
	}
}

export const ide = new IdeState();
