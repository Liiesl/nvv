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
	closeOthers,
	closeToRight,
	closeAll,
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
	showPreview = $state(true);
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
	editorPct = $state(55);
	previewZoomed = $state(false);
	dragging = $state(false);
	titleMenu = $state<string | null>(null);
	tabCtx = $state<{ x: number; y: number; path: string } | null>(null);
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
				label: "View: Toggle Preview",
				run: () => (this.showPreview = !this.showPreview),
			},
			{
				id: "zoom-preview",
				label: this.previewZoomed ? "View: Exit Preview Zoom" : "View: Zoom Preview",
				run: () => this.togglePreviewZoom(),
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
				label: "Tab: Close Others",
				run: () => {
					if (this.active) closeOthers(this.active);
				},
			},
			{
				id: "close-right",
				label: "Tab: Close to the Right",
				run: () => {
					if (this.active) closeToRight(this.active);
				},
			},
			{ id: "close-all", label: "Tab: Close All", run: () => closeAll() },
			{
				id: "goto-line",
				label: "Go: Go to Line…",
				run: () => {
					this.gotoDraft = String(this.line);
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

	onEdit(v: string) {
		if (v !== this.filesSnap[this.active]?.content) writeFile(this.active, v);
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
		createProject(this.newProjName.trim() || defaultProjectName(), this.newProjTemplate);
		this.showNewProj = false;
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
		switchProject(id);
		this.projMenu = false;
		this.palette = false;
		this.toast("Project switched");
	}

	doDeleteProject(id: string, name: string) {
		if (!confirm(`Delete project "${name}"? This cannot be undone.`)) return;
		deleteProject(id);
		this.projMenu = false;
		this.toast(`Deleted “${name}”`, "warn");
	}

	doCreateFile(dir: string, name: string) {
		try {
			createFile(join(dir, name), name.endsWith(".html") ? "<!-- new -->\n" : "");
			this.toast(`Created ${join(dir, name)}`);
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
		this.previewZoomed = !this.previewZoomed;
		if (this.previewZoomed) this.showPreview = true;
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
			this.line = n;
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
	applyEditorPct(clientX: number, rectLeft: number, rectWidth: number) {
		if (!rectWidth) return;
		this.editorPct = Math.min(85, Math.max(15, ((clientX - rectLeft) / rectWidth) * 100));
	}
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
			if (this.active) closeTab(this.active);
		}
		if (mod && e.key === "Tab") {
			e.preventDefault();
			if (this.tabs.length > 1) {
				const i = this.tabs.indexOf(this.active);
				const n = e.shiftKey
					? (i - 1 + this.tabs.length) % this.tabs.length
					: (i + 1) % this.tabs.length;
				openFile(this.tabs[n]);
			}
		}
		if (e.key === "F1") {
			e.preventDefault();
			this.paletteQ = "> ";
			this.palette = true;
		}
		if (mod && e.key.toLowerCase() === "g" && !e.shiftKey) {
			e.preventDefault();
			this.gotoDraft = String(this.line);
			this.gotoOpen = true;
		}
		if (e.key === "Escape") {
			if (this.gotoOpen) this.gotoOpen = false;
			else if (this.langPick) this.langPick = false;
			else if (this.tabCtx) this.tabCtx = null;
			else if (this.editorCtx) this.editorCtx = null;
			else if (this.titleMenu) this.titleMenu = null;
			else this.closeAllMenus();
			if (this.previewZoomed) this.previewZoomed = false;
			if (!this.gotoOpen && !this.langPick && !this.tabCtx && !this.editorCtx && !this.titleMenu)
				this.palette = false;
		}
	}

	// Re-export store actions needed directly by components
	openFile(p: string) {
		openFile(p);
	}
	closeTab(p: string) {
		closeTab(p);
	}
	reorderTabs(from: string, to: string) {
		reorderTabs(from, to);
	}
	removePath(p: string) {
		removePath(p);
		this.toast(`Deleted ${p}`, "warn");
	}
	renamePath(a: string, b: string) {
		renamePath(a, b);
	}
	clearAllProjects() {
		clearAllProjects();
	}
	duplicateProject(id: string) {
		duplicateProject(id);
		this.projMenu = false;
	}
}

export const ide = new IdeState();
