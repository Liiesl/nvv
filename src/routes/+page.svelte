<script lang="ts">
	import { browser } from "$app/env";
	import { onMount } from "svelte";
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
	import Monaco from "#lib/components/Monaco.svelte";
	import Preview from "#lib/components/Preview.svelte";
	import Explorer from "#lib/components/Explorer.svelte";
	import Icon from "#lib/components/Icon.svelte";
	import FileIcon from "#lib/components/FileIcon.svelte";

	let filesSnap = $state<Record<string, VNode>>({});
	let active = $state("/index.html");
	let tabs = $state<string[]>([]);
	let dirty = $state<Set<string>>(new Set());
	let projectsSnap = $state<ProjectMeta[]>([]);
	let activeProjectIdSnap = $state<string | null>(null);

	let projMenu = $state(false);
	let showNewProj = $state(false);
	let newProjName = $state("");
	let newProjTemplate = $state<"blank" | "seed" | "clone">("seed");
	let renameTarget = $state<string | null>(null);
	let renameDraft = $state("");

	type SideView = "explorer" | "search" | "scm" | "debug" | "ext" | "settings";
	let sideView = $state<SideView>("explorer");
	let sidebar = $state(true);
	let sidebarW = $state(268);
	let sideDragging = $state(false);
	let sideSashEl: HTMLElement | null = $state(null);
	let showPreview = $state(true);
	let autoReload = $state(true);
	let minimapOn = $state(true);
	let fontSize = $state(13);
	let showPanel = $state(true);
	let panelTab = $state<"console" | "output" | "problems" | "terminal">("console");
	let panelH = $state(168);
	let panelMax = $state(false);
	let panelDragging = $state(false);
	let panelFilter = $state("");
	let logs = $state<{ kind: string; text: string }[]>([]);
	let entry = $state("/index.html");
	let query = $state("");
	let replaceQ = $state("");
	let palette = $state(false);
	let paletteQ = $state("");
	let paletteSel = $state(0);
	let line = $state(1);
	let col = $state(1);
	let editorPct = $state(55);
	let previewZoomed = $state(false);
	let dragging = $state(false);
	let splitEl: HTMLElement | null = $state(null);
	let sashEl: HTMLElement | null = $state(null);
	let titleMenu = $state<string | null>(null);
	let tabCtx = $state<{ x: number; y: number; path: string } | null>(null);
	let editorCtx = $state<{ x: number; y: number } | null>(null);
	let sideMenu = $state(false);
	let collapseNonce = $state(0);
	let outlineOpen = $state(true);
	let timelineOpen = $state(false);
	let langPick = $state(false);
	let gotoOpen = $state(false);
	let gotoDraft = $state("");
	let revealLine = $state(0);
	let commitMsg = $state("");
	let termLines = $state<{ text: string; kind: string }[]>([
		{ text: "neverview terminal — type `help`", kind: "info" },
	]);
	let termInput = $state("");
	let toasts = $state<{ id: number; text: string; kind: string }[]>([]);
	let dragTab = $state<string | null>(null);
	let toastSeq = 0;
	let currentBranch = $state("main");
	let branches = $state(["main", "dev", "feature/preview"]);
	let branchMenu = $state(false);
	let useSpaces = $state(true);
	let indentSize = $state(2);
	let indentMenu = $state(false);
	let encoding = $state("UTF-8");
	let encodingMenu = $state(false);
	let eol = $state("LF");
	let eolMenu = $state(false);
	let settingsMenu = $state(false);
	let accountsMenu = $state(false);
	let notifCenter = $state(false);
	let outputChannel = $state("Preview");
	let termTabs = $state<string[]>(["powershell"]);
	let activeTerm = $state(0);
	let openEditorsOpen = $state(true);
	let searchCase = $state(false);
	let searchWord = $state(false);
	let searchRegex = $state(false);
	let crumbSymMenu = $state(false);
	let layoutMenu = $state(false);
	let winMax = $state(false);
	let previewRef = $state<{
		refresh: () => void;
		openNewTab: () => void;
		clearInspectSelection: () => void;
	} | null>(null);
	let inspectTarget = $state<import("#lib/inspect.js").InspectPayload | null>(null);

	function toast(text: string, kind = "info") {
		toastSeq += 1;
		const id = toastSeq;
		toasts = [...toasts.slice(-3), { id, text, kind }];
		setTimeout(() => {
			toasts = toasts.filter((t) => t.id !== id);
		}, 3400);
	}

	function hiMatch(label: string, q: string): { pre: string; mid: string; post: string } {
		if (!q) return { pre: label, mid: "", post: "" };
		const i = label.toLowerCase().indexOf(q.toLowerCase().slice(0, 32));
		if (i < 0) return { pre: label, mid: "", post: "" };
		const len = Math.min(q.length, 32);
		return { pre: label.slice(0, i), mid: label.slice(i, i + len), post: label.slice(i + len) };
	}

	function closeAllMenus() {
		titleMenu = null;
		projMenu = false;
		sideMenu = false;
		tabCtx = null;
		editorCtx = null;
		settingsMenu = false;
		accountsMenu = false;
		notifCenter = false;
		branchMenu = false;
		indentMenu = false;
		encodingMenu = false;
		eolMenu = false;
		crumbSymMenu = false;
		layoutMenu = false;
	}

	function handleInspectSelect(info: import("#lib/inspect.js").InspectPayload | null) {
		inspectTarget = info;
		if (!info) return;
		if (active !== entry) {
			const cur = filesSnap[active]?.content ?? "";
			const needle = info.id ? info.id : `<${info.tag}`;
			if (!cur.includes(needle)) openFile(entry);
		}
	}

	function handleInspectClearFromEditor() {
		inspectTarget = null;
		try {
			previewRef?.clearInspectSelection();
		} catch {
			/* noop */
		}
	}

	$effect(() => {
		const u1 = files.subscribe((v: Record<string, VNode>) => (filesSnap = v));
		const u2 = activePath.subscribe((v: string) => (active = v));
		const u3 = openTabs.subscribe((v: string[]) => (tabs = v));
		const u4 = dirtyPaths.subscribe((v: Set<string>) => (dirty = v));
		const u5 = projects.subscribe((v: ProjectMeta[]) => (projectsSnap = v));
		const u6 = activeProjectId.subscribe((v: string | null) => (activeProjectIdSnap = v));
		const u7 = activeEntry.subscribe((v: string) => (entry = v));
		return () => {
			u1();
			u2();
			u3();
			u4();
			u5();
			u6();
			u7();
		};
	});

	onMount(() => {
		initProjects();
	});

	const content = $derived(filesSnap[active]?.content ?? "");
	const htmlFiles = $derived(
		Object.keys(filesSnap)
			.filter((p) => p.endsWith(".html"))
			.sort(),
	);
	const fileCount = $derived(Object.values(filesSnap).filter((n) => n.type === "file").length);
	const activeProject = $derived(projectsSnap.find((p) => p.id === activeProjectIdSnap) ?? null);
	const activeProjectName = $derived(activeProject?.name ?? "…");
	const problems = $derived(
		Object.entries(filesSnap)
			.filter(([, n]) => n.type === "file" && !n.content.trim())
			.map(([p]) => `Empty file: ${p}`),
	);
	const errCount = $derived(logs.filter((l) => l.kind === "error").length);
	const warnCount = $derived(logs.filter((l) => l.kind === "warn").length + problems.length);
	const isDirty = $derived(dirty.has(active));
	const outline = $derived.by(() => {
		const src = content ?? "";
		const out: { line: number; label: string; kind: string }[] = [];
		const lines = src.split("\n");
		const lang = languageOf(active);
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
	});
	const crumbs = $derived.by(() => {
		if (!active) return [] as { label: string; path: string; isFile: boolean }[];
		const parts = active.split("/").filter(Boolean);
		const acc: { label: string; path: string; isFile: boolean }[] = [
			{ label: activeProjectName, path: "/", isFile: false },
		];
		let cur = "";
		parts.forEach((seg, i) => {
			cur += "/" + seg;
			acc.push({ label: seg, path: cur, isFile: i === parts.length - 1 });
		});
		return acc;
	});
	const searchDetailed = $derived.by(() => {
		const raw = query.trim();
		if (!raw) return [] as { path: string; line: number; text: string }[];
		const hits: { path: string; line: number; text: string }[] = [];
		let re: RegExp | null = null;
		if (searchRegex) {
			try {
				re = new RegExp(raw, searchCase ? "g" : "gi");
			} catch {
				re = null;
			}
		}
		const q = searchCase ? raw : raw.toLowerCase();
		for (const [p, n] of Object.entries(filesSnap)) {
			if (n.type !== "file") continue;
			const lines = n.content.split("\n");
			for (let i = 0; i < lines.length && hits.length < 60; i++) {
				const ln = lines[i];
				let ok = false;
				if (re) {
					re.lastIndex = 0;
					ok = re.test(ln);
				} else {
					const hay = searchCase ? ln : ln.toLowerCase();
					if (searchWord) {
						ok = new RegExp(
							`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
							searchCase ? "" : "i",
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
	});
	const paletteIsCmd = $derived(paletteQ.startsWith(">"));
	const paletteCmdQ = $derived(
		paletteIsCmd ? paletteQ.slice(1).trim().toLowerCase() : paletteQ.trim().toLowerCase(),
	);
	const paletteFiles = $derived(
		Object.keys(filesSnap)
			.filter(
				(p) =>
					filesSnap[p].type === "file" &&
					p.toLowerCase().includes(paletteIsCmd ? "" : paletteQ.toLowerCase()),
			)
			.sort((a, b) => {
				// MRU: open tabs first, then alphabetical — like VS Code quick open
				const ai = tabs.indexOf(a);
				const bi = tabs.indexOf(b);
				if (ai >= 0 && bi >= 0) return ai - bi;
				if (ai >= 0) return -1;
				if (bi >= 0) return 1;
				return a.localeCompare(b);
			})
			.slice(0, paletteIsCmd ? 5 : 12),
	);
	const allCommands = $derived.by(() => {
		const cmds = [
			{
				id: "new-file",
				label: "File: New File",
				run: () => doCreateFile("/", "untitled.html"),
			},
			{
				id: "toggle-sidebar",
				label: "View: Toggle Primary Side Bar",
				run: () => (sidebar = !sidebar),
			},
			{
				id: "toggle-panel",
				label: "View: Toggle Panel",
				run: () => (showPanel = !showPanel),
			},
			{
				id: "toggle-preview",
				label: "View: Toggle Preview",
				run: () => (showPreview = !showPreview),
			},
			{
				id: "zoom-preview",
				label: previewZoomed ? "View: Exit Preview Zoom" : "View: Zoom Preview",
				run: () => togglePreviewZoom(),
			},
			{
				id: "refresh",
				label: "Run: Refresh Preview",
				run: () => previewRef?.refresh(),
			},
			{
				id: "open-tab",
				label: "Run: Open Preview in New Tab",
				run: () => previewRef?.openNewTab(),
			},
			{
				id: "new-project",
				label: "Project: New Project…",
				run: () => openNewProjectDialog(),
			},
			{
				id: "close-others",
				label: "Tab: Close Others",
				run: () => {
					if (active) closeOthers(active);
				},
			},
			{
				id: "close-right",
				label: "Tab: Close to the Right",
				run: () => {
					if (active) closeToRight(active);
				},
			},
			{ id: "close-all", label: "Tab: Close All", run: () => closeAll() },
			{
				id: "goto-line",
				label: "Go: Go to Line…",
				run: () => {
					gotoDraft = String(line);
					gotoOpen = true;
				},
			},
			{
				id: "lang",
				label: "Language: Change Language Mode…",
				run: () => (langPick = true),
			},
			{
				id: "terminal",
				label: "Terminal: Focus Terminal",
				run: () => {
					panelTab = "terminal";
					showPanel = true;
				},
			},
			{
				id: "problems",
				label: "Problems: Focus Problems",
				run: () => {
					panelTab = "problems";
					showPanel = true;
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
		if (!paletteCmdQ) return cmds;
		return cmds.filter((c) => c.label.toLowerCase().includes(paletteCmdQ));
	});
	const paletteTotal = $derived(
		paletteFiles.length +
			allCommands.length +
			projectsSnap.filter((m) => m.name.toLowerCase().includes(paletteCmdQ)).length,
	);
	const filteredLogs = $derived.by(() => {
		const f = panelFilter.trim().toLowerCase();
		let list = logs;
		if (panelTab === "output") list = logs.filter((l) => l.kind !== "log");
		if (panelTab === "console") list = logs;
		if (!f) return list.slice(-120);
		return list.filter((l) => (l.kind + " " + l.text).toLowerCase().includes(f)).slice(-120);
	});

	$effect(() => {
		void paletteQ;
		paletteSel = 0;
	});

	function onEdit(v: string) {
		if (v !== filesSnap[active]?.content) writeFile(active, v);
	}
	function autofocus(el: HTMLInputElement) {
		el.focus();
	}
	function activateOnKey(e: KeyboardEvent, fn: () => void) {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			fn();
		}
	}
	function onLog(kind: string, text: string) {
		logs = [...logs.slice(-199), { kind, text }];
		if (kind === "error") {
			panelTab = "console";
			showPanel = true;
		}
	}
	function onEntryChange(v: string) {
		setProjectEntry(v);
		toast(`Entry → ${v}`);
	}
	function openNewProjectDialog() {
		newProjName = defaultProjectName();
		newProjTemplate = "seed";
		showNewProj = true;
		projMenu = false;
		palette = false;
	}
	function confirmNewProject() {
		createProject(newProjName.trim() || defaultProjectName(), newProjTemplate);
		showNewProj = false;
		toast(`Project “${newProjName.trim() || "untitled"}” created`);
	}
	function startRenameProject(id: string, cur: string) {
		renameTarget = id;
		renameDraft = cur;
		projMenu = false;
	}
	function confirmRenameProject() {
		if (renameTarget && renameDraft.trim()) renameProject(renameTarget, renameDraft.trim());
		renameTarget = null;
	}
	function doSwitchProject(id: string) {
		switchProject(id);
		projMenu = false;
		palette = false;
		toast("Project switched");
	}
	function doDeleteProject(id: string, name: string) {
		if (!confirm(`Delete project "${name}"? This cannot be undone.`)) return;
		deleteProject(id);
		projMenu = false;
		toast(`Deleted “${name}”`, "warn");
	}
	function doCreateFile(dir: string, name: string) {
		try {
			createFile(join(dir, name), name.endsWith(".html") ? "<!-- new -->\n" : "");
			toast(`Created ${join(dir, name)}`);
		} catch {
			toast("File already exists", "warn");
		}
	}
	function doCreateFolder(dir: string, name: string) {
		try {
			createFolder(join(dir, name));
			toast(`Created folder ${name}`);
		} catch {
			toast("Folder already exists", "warn");
		}
	}
	function togglePreviewZoom() {
		previewZoomed = !previewZoomed;
		if (previewZoomed) showPreview = true;
	}
	function runPaletteCommand(id: string) {
		const c = allCommands.find((x) => x.id === id);
		c?.run();
		palette = false;
	}
	function confirmGoto() {
		const n = parseInt(gotoDraft, 10);
		if (Number.isFinite(n) && n >= 1) {
			revealLine = 0;
			requestAnimationFrame(() => (revealLine = n));
			line = n;
			toast(`Go to line ${n}`);
		}
		gotoOpen = false;
	}
	function runTerm(cmdRaw: string) {
		const cmd = cmdRaw.trim();
		if (!cmd) return;
		termLines = [...termLines.slice(-99), { text: `$ ${cmd}`, kind: "cmd" }];
		const [c, ...rest] = cmd.split(/\s+/);
		const arg = rest.join(" ");
		if (c === "help") {
			termLines = [
				...termLines,
				{
					text: "help · clear · ls · open <file> · entry · echo <text>",
					kind: "info",
				},
			];
		} else if (c === "clear") {
			termLines = [];
		} else if (c === "ls") {
			const names = Object.keys(filesSnap)
				.filter((p) => filesSnap[p].type === "file")
				.sort()
				.join("  ");
			termLines = [...termLines, { text: names || "(empty)", kind: "log" }];
		} else if (c === "open") {
			const target = arg.startsWith("/") ? arg : "/" + arg;
			if (filesSnap[target]?.type === "file") {
				openFile(target);
				termLines = [...termLines, { text: `opened ${target}`, kind: "ok" }];
			} else {
				termLines = [...termLines, { text: `no such file: ${arg}`, kind: "error" }];
			}
		} else if (c === "entry") {
			termLines = [...termLines, { text: `entry = ${entry}`, kind: "log" }];
		} else if (c === "echo") {
			termLines = [...termLines, { text: arg, kind: "log" }];
		} else {
			termLines = [...termLines, { text: `command not found: ${c}`, kind: "error" }];
		}
		termInput = "";
	}
	function sashPointerDown(e: PointerEvent) {
		if (e.pointerType === "mouse" && e.button !== 0) return;
		dragging = true;
		e.preventDefault();
		try {
			sashEl?.setPointerCapture?.(e.pointerId);
		} catch {
			/* noop */
		}
		try {
			document.body.style.userSelect = "none";
			document.body.style.cursor = "col-resize";
		} catch {
			/* noop */
		}
		applySashMove(e.clientX);
	}
	function applySashMove(clientX: number) {
		const el = splitEl;
		if (!el) return;
		const r = el.getBoundingClientRect();
		if (!r.width) return;
		editorPct = Math.min(85, Math.max(15, ((clientX - r.left) / r.width) * 100));
	}
	function sashPointerMove(e: PointerEvent) {
		if (!dragging) return;
		e.preventDefault();
		applySashMove(e.clientX);
	}
	function endSashDrag(e?: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		try {
			document.body.style.userSelect = "";
			document.body.style.cursor = "";
		} catch {
			/* noop */
		}
		try {
			if (e && sashEl?.hasPointerCapture?.(e.pointerId))
				sashEl?.releasePointerCapture?.(e.pointerId);
		} catch {
			/* noop */
		}
	}
	function sideSashDown(e: PointerEvent) {
		if (e.pointerType === "mouse" && e.button !== 0) return;
		sideDragging = true;
		e.preventDefault();
		try {
			sideSashEl?.setPointerCapture?.(e.pointerId);
		} catch {
			/* noop */
		}
		document.body.style.userSelect = "none";
		document.body.style.cursor = "col-resize";
	}
	function sideSashMove(e: PointerEvent) {
		if (!sideDragging) return;
		sidebarW = Math.min(480, Math.max(180, e.clientX - 48));
	}
	function sideSashUp() {
		sideDragging = false;
		document.body.style.userSelect = "";
		document.body.style.cursor = "";
	}
	function panelSashDown(e: PointerEvent) {
		panelDragging = true;
		panelMax = false;
		e.preventDefault();
		document.body.style.userSelect = "none";
		document.body.style.cursor = "row-resize";
	}
	function panelSashMove(e: PointerEvent) {
		if (!panelDragging) return;
		const h = window.innerHeight - e.clientY - 24;
		panelH = Math.min(520, Math.max(100, h));
	}
	function panelSashUp() {
		panelDragging = false;
		document.body.style.userSelect = "";
		document.body.style.cursor = "";
	}

	if (browser) {
		window.addEventListener("keydown", (e) => {
			const mod = e.ctrlKey || e.metaKey;
			if (mod && e.key.toLowerCase() === "p" && !e.shiftKey) {
				e.preventDefault();
				paletteQ = "";
				palette = true;
			}
			if (mod && e.shiftKey && e.key.toLowerCase() === "p") {
				e.preventDefault();
				paletteQ = "> ";
				palette = true;
			}
			if (mod && e.key.toLowerCase() === "b") {
				e.preventDefault();
				sidebar = !sidebar;
			}
			if (mod && e.key.toLowerCase() === "j") {
				e.preventDefault();
				showPanel = !showPanel;
			}
			if (mod && e.key === "`") {
				e.preventDefault();
				panelTab = "terminal";
				showPanel = !showPanel;
			}
			if (mod && e.shiftKey && ["e", "f", "g"].includes(e.key.toLowerCase())) {
				e.preventDefault();
				const k = e.key.toLowerCase();
				sideView = k === "e" ? "explorer" : k === "f" ? "search" : "scm";
				sidebar = true;
			}
			if (mod && e.key.toLowerCase() === "w") {
				e.preventDefault();
				if (active) closeTab(active);
			}
			if (mod && e.key === "Tab") {
				e.preventDefault();
				if (tabs.length > 1) {
					const i = tabs.indexOf(active);
					const n = e.shiftKey ? (i - 1 + tabs.length) % tabs.length : (i + 1) % tabs.length;
					openFile(tabs[n]);
				}
			}
			if (e.key === "F1") {
				e.preventDefault();
				paletteQ = "> ";
				palette = true;
			}
			if (mod && e.key.toLowerCase() === "g" && !e.shiftKey) {
				e.preventDefault();
				gotoDraft = String(line);
				gotoOpen = true;
			}
			if (e.key === "F5" && !e.shiftKey) {
				// keep native reload out of the way inside editor context
			}
			if (e.key === "Escape") {
				if (gotoOpen) gotoOpen = false;
				else if (langPick) langPick = false;
				else if (tabCtx) tabCtx = null;
				else if (editorCtx) editorCtx = null;
				else if (titleMenu) titleMenu = null;
				else closeAllMenus();
				if (previewZoomed && e.key === "Escape") previewZoomed = false;
				if (!gotoOpen && !langPick && !tabCtx && !editorCtx && !titleMenu) palette = false;
			}
		});
		window.addEventListener("pointermove", (e) => {
			if (sideDragging) sideSashMove(e as unknown as PointerEvent);
			if (panelDragging) panelSashMove(e as unknown as PointerEvent);
		});
		window.addEventListener("pointerup", () => {
			if (sideDragging) sideSashUp();
			if (panelDragging) panelSashUp();
		});
	}
</script>

<svelte:head>
	<title>Neverview v2 — VSCode-like HTML preview</title>
	<meta
		name="description"
		content="Client-side VSCode-like HTML preview with local Monaco and virtual file system."
	/>
</svelte:head>

{#if browser}
	<div class="ide" class:preview-zoomed={previewZoomed} class:has-error={errCount > 0}>
		<div class="titlebar" data-tauri-drag-region>
			<div class="appicon" title="Neverview v2 — VS Code-like" aria-hidden="true">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
					><path
						fill="#23A9F2"
						d="M17.5 3 3.8 10.2c-.4.3-.4.9 0 1.2l3.4 2.1 2.2-2.2 2.1 2.1 2.1-2.1 2.1 2.1 5.8-3.6c.6-.4.6-1.2 0-1.6L17.5 3Z"
					/><path
						fill="#007ACC"
						d="m9.4 12.4-2.2 2.2 10.3 6.4c.6.4 1.4 0 1.4-.8V4.6L9.4 12.4Z"
					/></svg
				>
			</div>
			<div class="menu">
				{#each ["File", "Edit", "Selection", "View", "Go", "Run", "Terminal", "Help"] as m}
					<button
						type="button"
						class="menubtn"
						class:on={titleMenu === m}
						onmouseenter={() => {
							if (titleMenu && titleMenu !== m) titleMenu = m;
						}}
						onclick={() => (titleMenu = titleMenu === m ? null : m)}>{m}</button
					>
				{/each}
				{#if titleMenu}
					<button
						class="veil"
						aria-label="Close menu"
						onclick={() => (titleMenu = null)}
						onkeydown={(e) => {
							if (e.key === "Escape") titleMenu = null;
						}}
					></button>
					<div class="titlemenu" role="menu">
						{#if titleMenu === "File"}
							<button
								onclick={() => {
									doCreateFile("/", "untitled.html");
									titleMenu = null;
								}}><span>New File…</span> <small>Ctrl+N</small></button
							>
							<button
								onclick={() => {
									openNewProjectDialog();
									titleMenu = null;
								}}><span>New Project…</span></button
							>
							<div class="sep"></div>
							<button
								onclick={() => {
									if (active) closeTab(active);
									titleMenu = null;
								}}><span>Close Tab</span> <small>Ctrl+W</small></button
							>
							<button
								onclick={() => {
									if (active) closeOthers(active);
									titleMenu = null;
								}}><span>Close Others</span></button
							>
							<button
								onclick={() => {
									closeAll();
									titleMenu = null;
								}}><span>Close All</span></button
							>
							<div class="sep"></div>
							<button
								onclick={() => {
									toast("Workspace autosaves to localStorage");
									titleMenu = null;
								}}><span>✓ Auto Save</span></button
							>
						{:else if titleMenu === "Edit"}
							<button
								onclick={() => {
									paletteQ = "> ";
									palette = true;
									titleMenu = null;
								}}><span>Command Palette…</span> <small>Ctrl+Shift+P</small></button
							>
							<button
								onclick={() => {
									gotoDraft = String(line);
									gotoOpen = true;
									titleMenu = null;
								}}><span>Go to Line…</span> <small>Ctrl+G</small></button
							>
							<button
								onclick={() => {
									langPick = true;
									titleMenu = null;
								}}><span>Change Language Mode</span></button
							>
						{:else if titleMenu === "Selection"}
							<button
								onclick={() => {
									toast("Select All — use editor (Ctrl+A)");
									titleMenu = null;
								}}><span>Select All</span> <small>Ctrl+A</small></button
							>
							<button
								onclick={() => {
									query = basename(active ?? "");
									sideView = "search";
									sidebar = true;
									titleMenu = null;
								}}><span>Find in Files</span> <small>Ctrl+Shift+F</small></button
							>
							<button
								onclick={() => {
									replaceQ = "";
									sideView = "search";
									sidebar = true;
									titleMenu = null;
								}}><span>Replace in Files</span> <small>Ctrl+Shift+H</small></button
							>
						{:else if titleMenu === "View"}
							<button
								onclick={() => {
									sidebar = !sidebar;
									titleMenu = null;
								}}><span>{sidebar ? "✓" : "○"} Primary Side Bar</span> <small>Ctrl+B</small></button
							>
							<button
								onclick={() => {
									showPanel = !showPanel;
									titleMenu = null;
								}}><span>{showPanel ? "✓" : "○"} Panel</span> <small>Ctrl+J</small></button
							>
							<button
								onclick={() => {
									showPreview = !showPreview;
									titleMenu = null;
								}}><span>{showPreview ? "✓" : "○"} Preview</span></button
							>
							<button
								onclick={() => {
									togglePreviewZoom();
									titleMenu = null;
								}}><span>Zoom Preview</span></button
							>
							<div class="sep"></div>
							<button
								onclick={() => {
									minimapOn = !minimapOn;
									titleMenu = null;
								}}><span>{minimapOn ? "✓" : "○"} Minimap</span></button
							>
							<button
								onclick={() => {
									paletteQ = "> ";
									palette = true;
									titleMenu = null;
								}}><span>Command Palette…</span> <small>F1</small></button
							>
						{:else if titleMenu === "Go"}
							<button
								onclick={() => {
									paletteQ = "";
									palette = true;
									titleMenu = null;
								}}><span>Go to File…</span> <small>Ctrl+P</small></button
							>
							<button
								onclick={() => {
									gotoDraft = String(line);
									gotoOpen = true;
									titleMenu = null;
								}}><span>Go to Line…</span> <small>Ctrl+G</small></button
							>
							<button
								onclick={() => {
									sideView = "explorer";
									sidebar = true;
									outlineOpen = true;
									titleMenu = null;
								}}><span>Go to Symbol…</span> <small>Ctrl+Shift+O</small></button
							>
						{:else if titleMenu === "Run"}
							<button
								onclick={() => {
									previewRef?.refresh();
									titleMenu = null;
									toast("Preview refreshed");
								}}><span>Run Preview</span> <small>F5</small></button
							>
							<button
								onclick={() => {
									previewRef?.openNewTab();
									titleMenu = null;
								}}><span>Open Preview in New Tab</span></button
							>
							<button
								onclick={() => {
									panelTab = "terminal";
									showPanel = true;
									titleMenu = null;
								}}><span>Focus Terminal</span> <small>Ctrl+`</small></button
							>
						{:else if titleMenu === "Terminal"}
							<button
								onclick={() => {
									panelTab = "terminal";
									showPanel = true;
									termTabs = [...termTabs, `powershell (${termTabs.length + 1})`];
									activeTerm = termTabs.length - 1;
									titleMenu = null;
								}}><span>New Terminal</span> <small>Ctrl+Shift+`</small></button
							>
							<button
								onclick={() => {
									termLines = [];
									panelTab = "terminal";
									showPanel = true;
									titleMenu = null;
								}}><span>Clear Terminal</span></button
							>
						{:else}
							<button
								onclick={() => {
									paletteQ = "> ";
									palette = true;
									titleMenu = null;
								}}><span>Keyboard Shortcuts</span></button
							>
							<button
								onclick={() => {
									toast("Neverview v2 — Monaco + virtual FS");
									titleMenu = null;
								}}><span>About Neverview</span></button
							>
						{/if}
					</div>
				{/if}
			</div>
			<div class="projwrap">
				<button
					class="btn small ghost projbtn"
					title="Switch project"
					aria-label="Switch project"
					onclick={() => (projMenu = !projMenu)}
					><Icon name="files" size={14} />
					{activeProjectName}
					<Icon name="chevron-down" size={14} /></button
				>
				{#if projMenu}
					<button
						class="veil"
						aria-label="Close projects menu"
						onclick={() => (projMenu = false)}
						onkeydown={(e) => {
							if (e.key === "Escape") projMenu = false;
						}}
					></button>
					<div class="projmenu" role="menu">
						<div class="projmenu-head">
							Projects ({projectsSnap.length})
						</div>
						{#each projectsSnap as p}
							<div class="projrow" class:on={p.id === activeProjectIdSnap}>
								<button
									type="button"
									class="projname"
									title="Switch to {p.name}"
									onclick={() => doSwitchProject(p.id)}
								>
									<span class="dot" class:on={p.id === activeProjectIdSnap}></span>
									<span class="nm">{p.name}</span>
									<small>{new Date(p.updatedAt).toLocaleDateString()}</small>
								</button>
								<span class="projacts">
									<button
										class="iconbtn"
										title="Rename {p.name}"
										aria-label="Rename {p.name}"
										onclick={() => startRenameProject(p.id, p.name)}
										><Icon name="edit" size={14} /></button
									>
									<button
										class="iconbtn"
										title="Duplicate {p.name}"
										aria-label="Duplicate {p.name}"
										onclick={() => {
											duplicateProject(p.id);
											projMenu = false;
										}}><Icon name="new-file" size={14} /></button
									>
									<button
										class="iconbtn danger"
										title="Delete {p.name}"
										aria-label="Delete {p.name}"
										onclick={() => doDeleteProject(p.id, p.name)}
										><Icon name="trash" size={14} /></button
									>
								</span>
							</div>
						{/each}
						<button type="button" class="opt newproj" onclick={openNewProjectDialog}
							>+ New project...</button
						>
					</div>
				{/if}
			</div>
			<button
				type="button"
				class="cmdcenter"
				title="{active ? active : 'No file open'} — {activeProjectName} (Ctrl+P)"
				onclick={() => {
					paletteQ = "";
					palette = true;
				}}
			>
				<Icon name="search" size={13} />
				<span class="cc-main"
					>{#if isDirty}<span class="cc-dot">●</span>{/if}{active ? basename(active) : "no file"} — {activeProjectName}</span
				>
			</button>
			<div class="actions">
				<button
					class="iconbtn"
					title="Toggle Primary Side Bar (Ctrl+B)"
					aria-label="Toggle Primary Side Bar"
					onclick={() => (sidebar = !sidebar)}><Icon name="split-horizontal" size={16} /></button
				>
				<button
					class="iconbtn"
					title="Toggle Panel (Ctrl+J)"
					aria-label="Toggle Panel"
					onclick={() => (showPanel = !showPanel)}><Icon name="terminal" size={16} /></button
				>
				<div class="layoutwrap">
					<button
						class="iconbtn"
						title="Customize Layout"
						aria-label="Customize Layout"
						onclick={() => (layoutMenu = !layoutMenu)}><Icon name="extensions" size={15} /></button
					>
					{#if layoutMenu}
						<button class="veil" aria-label="Close layout" onclick={() => (layoutMenu = false)}
						></button>
						<div class="layoutmenu" role="menu">
							<div class="projmenu-head">Layout</div>
							<button
								onclick={() => {
									sidebar = !sidebar;
									layoutMenu = false;
								}}><span>{sidebar ? "✓" : "○"} Primary Side Bar</span><small>Ctrl+B</small></button
							>
							<button
								onclick={() => {
									showPanel = !showPanel;
									layoutMenu = false;
								}}><span>{showPanel ? "✓" : "○"} Panel</span><small>Ctrl+J</small></button
							>
							<button
								onclick={() => {
									showPreview = !showPreview;
									layoutMenu = false;
								}}><span>{showPreview ? "✓" : "○"} Preview (side)</span></button
							>
							<button
								onclick={() => {
									togglePreviewZoom();
									layoutMenu = false;
								}}><span>Zoom Preview</span></button
							>
							<div class="sep"></div>
							<button
								onclick={() => {
									previewRef?.refresh();
									layoutMenu = false;
									toast("Preview refreshed");
								}}><span>Run Preview</span><small>F5</small></button
							>
							<button
								onclick={() => {
									previewRef?.openNewTab();
									layoutMenu = false;
								}}><span>Open Preview in New Tab</span></button
							>
						</div>
					{/if}
				</div>
				<div class="winbtns" role="group" aria-label="Window controls">
					<button
						class="winbtn"
						title="Minimize"
						aria-label="Minimize"
						onclick={() => toast("Minimize is a mock in the browser")}
						><span class="wl">─</span></button
					>
					<button
						class="winbtn"
						title={winMax ? "Restore" : "Maximize"}
						aria-label={winMax ? "Restore" : "Maximize"}
						onclick={() => {
							winMax = !winMax;
							toast(winMax ? "Maximized (mock)" : "Restored (mock)");
						}}><span class="wl">{winMax ? "❐" : "▢"}</span></button
					>
					<button
						class="winbtn close"
						title="Close"
						aria-label="Close"
						onclick={() => toast("Close is disabled in the browser demo")}
						><span class="wl">✕</span></button
					>
				</div>
			</div>
		</div>

		<div class="workbench">
			<div class="activity">
				<button
					class:on={sideView === "explorer"}
					title="Explorer (Ctrl+Shift+E)"
					aria-label="Explorer"
					onclick={() => {
						sideView = "explorer";
						sidebar = true;
					}}><Icon name="files" size={22} /></button
				>
				<button
					class:on={sideView === "search"}
					title="Search (Ctrl+Shift+F)"
					aria-label="Search"
					onclick={() => {
						sideView = "search";
						sidebar = true;
					}}
					><Icon name="search" size={22} />
					{#if query.trim()}<span class="badge">!</span>{/if}
				</button>
				<button
					class:on={sideView === "scm"}
					title="Source Control (Ctrl+Shift+G)"
					aria-label="Source Control"
					onclick={() => {
						sideView = "scm";
						sidebar = true;
					}}
					><Icon name="git-branch" size={22} />
					{#if dirty.size > 0}<span class="badge">{dirty.size}</span>{/if}
				</button>
				<button
					class:on={sideView === "debug"}
					title="Run and Debug"
					aria-label="Run and Debug"
					onclick={() => {
						sideView = "debug";
						sidebar = true;
					}}
					><Icon name="debug" size={22} />
					{#if errCount > 0}<span class="badge err">{errCount}</span>{/if}
				</button>
				<button
					class:on={sideView === "ext"}
					title="Extensions"
					aria-label="Extensions"
					onclick={() => {
						sideView = "ext";
						sidebar = true;
					}}><Icon name="extensions" size={22} /></button
				>
				<button
					class:on={showPreview}
					title="Toggle preview"
					aria-label="Toggle preview"
					onclick={() => (showPreview = !showPreview)}><Icon name="browser" size={22} /></button
				>
				<div class="sp"></div>
				<div class="actwrap">
					<button
						title="Accounts"
						aria-label="Accounts"
						onclick={() => {
							accountsMenu = !accountsMenu;
							settingsMenu = false;
						}}><Icon name="account" size={22} /></button
					>
					{#if accountsMenu}
						<button class="veil" aria-label="Close accounts" onclick={() => (accountsMenu = false)}
						></button>
						<div class="actmenu" role="menu">
							<div class="projmenu-head">Accounts</div>
							<div class="actuser">
								<Icon name="account" size={28} /><span
									>local-user<br /><small>Signed in locally — no account needed</small></span
								>
							</div>
							<div class="sep"></div>
							<button
								onclick={() => {
									toast("No other accounts");
									accountsMenu = false;
								}}><span>Manage trusted extensions</span></button
							>
						</div>
					{/if}
				</div>
				<div class="actwrap">
					<button
						class:on={sideView === "settings"}
						title="Manage"
						aria-label="Manage"
						onclick={() => {
							settingsMenu = !settingsMenu;
							accountsMenu = false;
						}}
						><Icon name="settings-gear" size={22} />
						{#if warnCount > 0}<span class="badge">{warnCount}</span>{/if}</button
					>
					{#if settingsMenu}
						<button class="veil" aria-label="Close manage" onclick={() => (settingsMenu = false)}
						></button>
						<div class="actmenu" role="menu">
							<div class="projmenu-head">Manage</div>
							<button
								onclick={() => {
									sideView = "settings";
									sidebar = true;
									settingsMenu = false;
								}}><span>Settings</span><small>Ctrl+,</small></button
							>
							<button
								onclick={() => {
									paletteQ = "> ";
									palette = true;
									settingsMenu = false;
								}}><span>Command Palette…</span><small>F1</small></button
							>
							<button
								onclick={() => {
									toast("Color Theme: Dark Modern (default)");
									settingsMenu = false;
								}}><span>Color Theme</span><small>Ctrl+K T</small></button
							>
							<button
								onclick={() => {
									toast("Keyboard Shortcuts — F1 then type");
									settingsMenu = false;
								}}><span>Keyboard Shortcuts</span><small>Ctrl+K S</small></button
							>
							<div class="sep"></div>
							<button
								onclick={() => {
									toast("Neverview v2 — Monaco + virtual FS");
									settingsMenu = false;
								}}><span>About</span></button
							>
						</div>
					{/if}
				</div>
				<button
					title="Notifications"
					aria-label="Notifications"
					onclick={() => (notifCenter = !notifCenter)}
					><Icon name="bell" size={22} />
					{#if warnCount > 0}<span class="badge">{warnCount}</span>{/if}
				</button>
			</div>

			{#if sidebar}
				<div class="sidebar" style={`flex-basis:${sidebarW}px;width:${sidebarW}px`}>
					<div class="side-head">
						<span>{sideView.toUpperCase()} · {activeProjectName}</span>
						<span class="icons">
							{#if sideView === "explorer"}
								<button
									class="iconbtn"
									title="New file"
									onclick={() => doCreateFile("/", "untitled.html")}
									><Icon name="new-file" size={15} /></button
								>
								<button
									class="iconbtn"
									title="New folder"
									onclick={() => {
										doCreateFolder("/", "new-folder");
									}}><Icon name="new-folder" size={15} /></button
								>
								<button
									class="iconbtn"
									title="Refresh explorer"
									onclick={() => toast("Explorer refreshed")}
									><Icon name="refresh" size={15} /></button
								>
								<button class="iconbtn" title="Collapse all" onclick={() => (collapseNonce += 1)}
									><Icon name="collapse-all" size={15} /></button
								>
								<button class="iconbtn" title="More actions" onclick={() => (sideMenu = !sideMenu)}
									><Icon name="ellipsis" size={15} /></button
								>
							{/if}
						</span>
					</div>
					{#if sideMenu && sideView === "explorer"}
						<div class="sidemenu" role="menu">
							<button
								onclick={() => {
									doCreateFile("/", "untitled.html");
									sideMenu = false;
								}}>New File</button
							>
							<button
								onclick={() => {
									doCreateFolder("/", "new-folder");
									sideMenu = false;
								}}>New Folder</button
							>
							<button
								onclick={() => {
									collapseNonce += 1;
									sideMenu = false;
								}}>Collapse All</button
							>
							<button
								onclick={() => {
									openNewProjectDialog();
									sideMenu = false;
								}}>New Project…</button
							>
						</div>
					{/if}
					<div class="side-body">
						{#if sideView === "explorer"}
							<button
								type="button"
								class="sec-title collapsible"
								onclick={() => (openEditorsOpen = !openEditorsOpen)}
							>
								<Icon name={openEditorsOpen ? "chevron-down" : "chevron-right"} size={14} />
								OPEN EDITORS
								<small>{tabs.length}</small>
							</button>
							{#if openEditorsOpen}
								<div class="openeditors">
									{#each tabs as t}
										{@const hm = hiMatch(basename(t), "")}
										<div
											class="trow openrow"
											class:on={t === active}
											role="treeitem"
											tabindex="0"
											aria-selected={t === active}
											title={t}
											onclick={() => openFile(t)}
											onkeydown={(e) => activateOnKey(e, () => openFile(t))}
										>
											<span class="ic"><FileIcon name={basename(t)} /></span>
											<span class="nm">{basename(t)}</span>
											<span class="opath">{t.slice(0, t.lastIndexOf("/") + 1) || "/"}</span>
											{#if dirty.has(t)}<span class="dirtymini">●</span>{:else}
												<button
													class="x"
													title="Close"
													aria-label="Close {basename(t)}"
													onclick={(e) => {
														e.stopPropagation();
														closeTab(t);
													}}><Icon name="close" size={12} /></button
												>
											{/if}
										</div>
									{/each}
									{#if tabs.length === 0}<div class="oempty">No open editors.</div>{/if}
								</div>
							{/if}
							<div class="sec-title">
								<Icon name="chevron-down" size={14} />
								{activeProjectName} · {fileCount} files
							</div>
							<Explorer
								files={filesSnap}
								{active}
								{collapseNonce}
								onOpen={(p) => {
									openFile(p);
								}}
								onCreateFile={doCreateFile}
								onCreateFolder={doCreateFolder}
								onRename={renamePath}
								onDelete={(p) => {
									removePath(p);
									toast(`Deleted ${p}`, "warn");
								}}
							/>
							<button
								type="button"
								class="sec-title collapsible"
								onclick={() => (outlineOpen = !outlineOpen)}
							>
								<Icon name={outlineOpen ? "chevron-down" : "chevron-right"} size={14} />
								OUTLINE
								<small>{outline.length}</small>
							</button>
							{#if outlineOpen}
								<div class="outline">
									{#each outline as o}
										<button
											type="button"
											class="orow"
											title="Go to line {o.line}"
											onclick={() => {
												revealLine = 0;
												requestAnimationFrame(() => (revealLine = o.line));
											}}
										>
											<span class="okind">{o.kind}</span>
											<span class="olabel">{o.label}</span>
											<span class="oline">{o.line}</span>
										</button>
									{/each}
									{#if outline.length === 0}
										<div class="oempty">No symbols in active file.</div>
									{/if}
								</div>
							{/if}
							<button
								type="button"
								class="sec-title collapsible"
								onclick={() => (timelineOpen = !timelineOpen)}
							>
								<Icon name={timelineOpen ? "chevron-down" : "chevron-right"} size={14} />
								TIMELINE
							</button>
							{#if timelineOpen}
								<div class="timeline">
									<div class="tline">
										<span>Project updated</span><small
											>{activeProject
												? new Date(activeProject.updatedAt).toLocaleString()
												: "—"}</small
										>
									</div>
									<div class="tline">
										<span>Entry</span><small>{entry}</small>
									</div>
									<div class="tline">
										<span>Unsaved changes</span><small>{dirty.size}</small>
									</div>
								</div>
							{/if}
						{:else if sideView === "search"}
							<div class="searchbox">
								<div class="searchrow">
									<input placeholder="Search files…" bind:value={query} aria-label="Search files" />
									<span class="sopts">
										<button
											type="button"
											class="sopt"
											class:on={searchCase}
											title="Match Case"
											aria-pressed={searchCase}
											onclick={() => (searchCase = !searchCase)}>Aa</button
										>
										<button
											type="button"
											class="sopt"
											class:on={searchWord}
											title="Match Whole Word"
											aria-pressed={searchWord}
											onclick={() => (searchWord = !searchWord)}>ab</button
										>
										<button
											type="button"
											class="sopt"
											class:on={searchRegex}
											title="Use Regular Expression"
											aria-pressed={searchRegex}
											onclick={() => (searchRegex = !searchRegex)}>.*</button
										>
									</span>
								</div>
								<input
									placeholder="Replace (Enter applies to open file)"
									bind:value={replaceQ}
									aria-label="Replace"
									onkeydown={(e) => {
										if (e.key === "Enter" && replaceQ && active && filesSnap[active]) {
											const cur = filesSnap[active].content;
											writeFile(active, cur.split(query).join(replaceQ));
											toast(`Replaced in ${basename(active)}`);
										}
									}}
								/>
								<div class="smeta">
									{searchDetailed.length} results {query ? `for “${query}”` : ""}
									<button
										type="button"
										class="replaceall"
										title="Replace All in open file"
										onclick={() => {
											if (replaceQ && active && filesSnap[active] && query) {
												const cur = filesSnap[active].content;
												writeFile(active, cur.split(query).join(replaceQ));
												toast(`Replaced all in ${basename(active)}`);
											}
										}}>⇄ Replace All</button
									>
								</div>
							</div>
							{#each searchDetailed as h}
								<button
									type="button"
									class="sres"
									onclick={() => {
										openFile(h.path);
										revealLine = 0;
										requestAnimationFrame(() => (revealLine = h.line));
									}}
									><span class="sfile"
										><FileIcon name={basename(h.path)} />
										{h.path} <em>:{h.line}</em></span
									><small>{h.text || "(empty line)"}</small></button
								>
							{/each}
							{#if query && searchDetailed.length === 0}<div class="sres">
									<small>No results</small>
								</div>{/if}
						{:else if sideView === "scm"}
							<div class="searchbox">
								<div class="smeta">
									SOURCE CONTROL · {dirty.size} changes
								</div>
								<input placeholder="Message (Ctrl+Enter to commit)" bind:value={commitMsg} />
								<button
									class="btn small"
									onclick={() => {
										commitMsg = "";
										toast(dirty.size ? `Committed ${dirty.size} file(s)` : "Nothing to commit");
									}}><Icon name="check" size={14} /> Commit</button
								>
							</div>
							<div class="smeta" style="padding:0 12px">Changes</div>
							{#each [...dirty] as d}
								<button type="button" class="sres" onclick={() => openFile(d)}>
									<span class="sfile"
										><FileIcon name={basename(d)} />
										{d}</span
									>
									<small>M · unsaved</small>
								</button>
							{/each}
							{#if dirty.size === 0}<div class="sres">
									<small>No changes — working tree clean.</small>
								</div>{/if}
						{:else if sideView === "debug"}
							<div class="searchbox">
								<div class="smeta">RUN AND DEBUG</div>
								<button
									class="btn small"
									onclick={() => {
										previewRef?.refresh();
										toast("Preview refreshed");
									}}><Icon name="play" size={14} /> Start Debugging (F5)</button
								>
								<label
									>Entry HTML
									<select class="textin" bind:value={entry} onchange={() => onEntryChange(entry)}>
										{#each htmlFiles as h}<option value={h}>{h}</option>{/each}
									</select>
								</label>
								<label
									><input type="checkbox" bind:checked={autoReload} /> Auto-reload preview</label
								>
								<div class="smeta">
									Breakpoints: none · Console: {logs.length}
								</div>
							</div>
						{:else if sideView === "ext"}
							<div class="searchbox">
								<div class="smeta">EXTENSIONS · Marketplace (local mock)</div>
							</div>
							{#each [["Prettier", "Code formatter"], ["ESLint", "Problem matcher"], ["Live Preview", "Preview helper"]] as [n, d]}
								<div class="sres ext">
									<span class="sfile"
										><Icon name="extensions" size={16} />
										{n}</span
									>
									<small>{d}</small>
									<button class="btn small ghost" onclick={() => toast(`${n} installed (mock)`)}
										>Install</button
									>
								</div>
							{/each}
						{:else}
							<div class="searchbox">
								<label
									><input type="checkbox" bind:checked={autoReload} /> Auto-reload preview</label
								>
								<label><input type="checkbox" bind:checked={showPreview} /> Show preview</label>
								<label><input type="checkbox" bind:checked={showPanel} /> Show panel</label>
								<label><input type="checkbox" bind:checked={minimapOn} /> Minimap</label>
								<label
									>Font size
									<input type="range" min="11" max="18" step="1" bind:value={fontSize} />
									<small>{fontSize}px</small>
								</label>
								<label
									>Entry HTML
									<select class="textin" bind:value={entry} onchange={() => onEntryChange(entry)}>
										{#each htmlFiles as h}<option value={h}>{h}</option>{/each}
									</select>
								</label>
								<button
									class="btn ghost"
									onclick={() => {
										if (confirm(`Clear ALL projects (${projectsSnap.length}) and reload?`)) {
											clearAllProjects();
											location.reload();
										}
									}}>Clear all projects</button
								>
							</div>
						{/if}
					</div>
				</div>
				<div
					class="sash side"
					role="slider"
					tabindex="0"
					aria-label="Resize sidebar"
					aria-orientation="vertical"
					aria-valuenow={Math.round(sidebarW)}
					aria-valuemin={180}
					aria-valuemax={480}
					bind:this={sideSashEl}
					onpointerdown={sideSashDown}
					ondblclick={() => (sidebarW = 268)}
					onkeydown={(e) => {
						if (e.key === "ArrowLeft") sidebarW = Math.max(180, sidebarW - 12);
						if (e.key === "ArrowRight") sidebarW = Math.min(480, sidebarW + 12);
					}}
				></div>
			{/if}

			<div class="main">
				<div class="tabsbar">
					<div class="tabs" role="tablist">
						{#each tabs as t}
							<div
								class="tab"
								class:on={t === active}
								class:dirty={dirty.has(t)}
								class:dragging={dragTab === t}
								role="tab"
								tabindex="0"
								title={t}
								draggable="true"
								aria-selected={t === active}
								onclick={() => openFile(t)}
								onkeydown={(e) => activateOnKey(e, () => openFile(t))}
								onauxclick={(e) => {
									if (e.button === 1) {
										e.preventDefault();
										closeTab(t);
									}
								}}
								oncontextmenu={(e) => {
									e.preventDefault();
									tabCtx = {
										x: e.clientX,
										y: e.clientY,
										path: t,
									};
								}}
								ondragstart={(e) => {
									dragTab = t;
									try {
										e.dataTransfer?.setData("text/plain", t);
									} catch {
										/* noop */
									}
								}}
								ondragend={() => (dragTab = null)}
								ondragover={(e) => e.preventDefault()}
								ondrop={(e) => {
									e.preventDefault();
									try {
										const from = e.dataTransfer?.getData("text/plain") || dragTab;
										if (from) reorderTabs(from, t);
									} catch {
										/* noop */
									}
									dragTab = null;
								}}
							>
								<span class="tabname">
									<FileIcon name={basename(t)} />
									<span>{basename(t)}</span>
									<span class="dirtydot" aria-hidden="true">●</span>
								</span>
								<button
									class="x"
									title="Close (Ctrl+W)"
									aria-label="Close {basename(t)}"
									onclick={(e) => {
										e.stopPropagation();
										closeTab(t);
									}}><Icon name="close" size={13} /></button
								>
							</div>
						{/each}
						<button
							class="newtab"
							title="New File"
							aria-label="New File"
							onclick={() => doCreateFile("/", "untitled.html")}><span>+</span></button
						>
					</div>
					<div class="editor-actions">
						<button
							class="iconbtn"
							title="Split preview right"
							onclick={() => (showPreview = !showPreview)}
							><Icon name="split-horizontal" size={15} /></button
						>
						<button
							class="iconbtn"
							title="More editor actions"
							onclick={(e) => {
								const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
								tabCtx = {
									x: r.left - 120,
									y: r.bottom + 4,
									path: active,
								};
							}}><Icon name="ellipsis" size={15} /></button
						>
					</div>
				</div>
				{#if active}
					<div class="crumbs">
						{#each crumbs as c, i}
							<button
								type="button"
								class="crumb"
								class:file={c.isFile}
								title={c.path}
								onclick={() => {
									if (c.path === "/") {
										sideView = "explorer";
										sidebar = true;
									} else if (filesSnap[c.path]?.type === "file") openFile(c.path);
									else {
										sideView = "explorer";
										sidebar = true;
									}
								}}
								>{#if c.isFile}<FileIcon name={c.label} />{/if}{c.label}</button
							>
							{#if i < crumbs.length - 1}<span class="csep">›</span>{/if}
						{/each}
						{#if outline.length > 0}
							<span class="symwrap">
								<span class="csep">›</span>
								<button
									type="button"
									class="crumb sym"
									title="Go to symbol in file"
									onclick={() => (crumbSymMenu = !crumbSymMenu)}
									>⌖ {outline[0]?.label ?? ""} <small>▾</small></button
								>
								{#if crumbSymMenu}
									<button
										class="veil"
										aria-label="Close symbols"
										onclick={() => (crumbSymMenu = false)}
									></button>
									<div class="symmenu" role="menu">
										{#each outline.slice(0, 20) as o}
											<button
												onclick={() => {
													revealLine = 0;
													requestAnimationFrame(() => (revealLine = o.line));
													crumbSymMenu = false;
												}}
												><span class="okind">{o.kind}</span>
												{o.label} <small>:{o.line}</small></button
											>
										{/each}
									</div>
								{/if}
							</span>
						{/if}
						<span class="crumb-right">
							<button
								type="button"
								class="mini-crumb"
								title="Select Language Mode"
								onclick={() => (langPick = true)}>{languageOf(active)}</button
							>
							<span>·</span>
							<button
								type="button"
								class="mini-crumb"
								title="Go to Line/Column"
								onclick={() => {
									gotoDraft = String(line);
									gotoOpen = true;
								}}>Ln {line}, Col {col}</button
							>
						</span>
					</div>
				{/if}
				<div class="split" bind:this={splitEl}>
					<div
						class="editorpane"
						role="group"
						aria-label="Editor"
						style={showPreview ? `flex: 0 0 ${editorPct}%` : "flex: 1 1 0%"}
						oncontextmenu={(e) => {
							const el = e.target as HTMLElement;
							if (el.closest(".monaco-host")) {
								e.preventDefault();
								editorCtx = { x: e.clientX, y: e.clientY };
							}
						}}
					>
						{#if active && filesSnap[active]}
							<Monaco
								path={active}
								{content}
								{fontSize}
								{minimapOn}
								{revealLine}
								{inspectTarget}
								onInspectClear={handleInspectClearFromEditor}
								onChange={onEdit}
								onCursor={(l: number, c: number) => {
									line = l;
									col = c;
								}}
							/>
						{:else}
							<div class="welcome">
								<div class="wlogo" aria-hidden="true">
									<svg width="52" height="52" viewBox="0 0 24 24" fill="none"
										><path
											fill="#23A9F2"
											opacity="0.9"
											d="M17.5 3 3.8 10.2c-.4.3-.4.9 0 1.2l3.4 2.1 2.2-2.2 2.1 2.1 2.1-2.1 2.1 2.1 5.8-3.6c.6-.4.6-1.2 0-1.6L17.5 3Z"
										/><path
											fill="#007ACC"
											opacity="0.9"
											d="m9.4 12.4-2.2 2.2 10.3 6.4c.6.4 1.4 0 1.4-.8V4.6L9.4 12.4Z"
										/></svg
									>
									<div>
										<h1>Neverview</h1>
										<p>Editing evolved — {activeProjectName}</p>
									</div>
								</div>
								<div class="wcols">
									<div class="wcol">
										<h2>Start</h2>
										<button onclick={() => doCreateFile("/", "untitled.html")}
											><span class="wic">＋</span> New File…</button
										>
										<button onclick={openNewProjectDialog}
											><span class="wic">＋</span> New Project…</button
										>
										<button
											onclick={() => {
												paletteQ = "";
												palette = true;
											}}>Open File… <small>Ctrl+P</small></button
										>
										<button
											onclick={() => {
												panelTab = "terminal";
												showPanel = true;
											}}>Open Terminal <small>Ctrl+`</small></button
										>
									</div>
									<div class="wcol">
										<h2>Recent</h2>
										{#each tabs.slice(-5).reverse() as t}
											<button onclick={() => openFile(t)}
												><FileIcon name={basename(t)} />
												{t}</button
											>
										{/each}
										{#if tabs.length === 0}<p>No recent files. Files you open appear here.</p>{/if}
									</div>
									<div class="wcol">
										<h2>Shortcuts</h2>
										<p><kbd>Ctrl P</kbd> quick open</p>
										<p><kbd>Ctrl Shift P</kbd> commands</p>
										<p><kbd>Ctrl B</kbd> sidebar</p>
										<p><kbd>Ctrl J</kbd> panel</p>
										<p><kbd>Ctrl `</kbd> terminal</p>
										<p><kbd>F1</kbd> help</p>
									</div>
								</div>
							</div>
						{/if}
					</div>
					{#if showPreview}
						<div
							class="sash"
							class:drag={dragging}
							role="slider"
							tabindex="0"
							aria-orientation="vertical"
							aria-label="Resize editor and preview"
							aria-valuenow={Math.round(editorPct)}
							aria-valuemin={15}
							aria-valuemax={85}
							bind:this={sashEl}
							onpointerdown={sashPointerDown}
							onpointermove={sashPointerMove}
							onpointerup={(e) => endSashDrag(e)}
							onpointercancel={(e) => endSashDrag(e)}
							ondblclick={() => (editorPct = 55)}
							onkeydown={(e) => {
								if (e.key === "ArrowLeft") editorPct = Math.max(15, editorPct - 2);
								if (e.key === "ArrowRight") editorPct = Math.min(85, editorPct + 2);
							}}
						></div>
						<div class="previewpane" style={`flex: 0 0 ${100 - editorPct}%`} class:dragging>
							<Preview
								files={filesSnap}
								{entry}
								projectId={activeProjectIdSnap}
								auto={autoReload}
								{onLog}
								zoomed={previewZoomed}
								onToggleZoom={togglePreviewZoom}
								onInspectSelect={handleInspectSelect}
								bind:this={previewRef}
							/>
						</div>
					{/if}
				</div>
				{#if dragging}
					<div class="dragveil" aria-hidden="true"></div>
				{/if}
				{#if showPanel}
					<div
						class="psash"
						role="slider"
						tabindex="0"
						aria-label="Resize panel"
						aria-orientation="horizontal"
						aria-valuenow={Math.round(panelH)}
						aria-valuemin={100}
						aria-valuemax={520}
						onpointerdown={panelSashDown}
						ondblclick={() => (panelH = 168)}
					></div>
					<div class="panel" style={panelMax ? "flex-basis:45vh" : `flex-basis:${panelH}px`}>
						<div class="paneltabs">
							<button class:on={panelTab === "console"} onclick={() => (panelTab = "console")}
								><Icon name="debug" size={13} /> Debug Console</button
							>
							<button class:on={panelTab === "output"} onclick={() => (panelTab = "output")}
								>Output</button
							>
							{#if panelTab === "output"}
								<button
									type="button"
									class="chanpick"
									title="Output channel"
									onclick={() => {
										const order = ["Preview", "Tasks", "Extensions"];
										outputChannel = order[(order.indexOf(outputChannel) + 1) % order.length];
									}}>{outputChannel} ▾</button
								>
							{/if}
							<button class:on={panelTab === "problems"} onclick={() => (panelTab = "problems")}
								><Icon name={problems.length || errCount ? "error" : "check"} size={13} /> Problems
								<span class="pcount">{problems.length + errCount}</span></button
							>
							{#if termTabs.length > 1}
								{#each termTabs as tt, i}
									<button
										class:on={panelTab === "terminal" && activeTerm === i}
										onclick={() => {
											panelTab = "terminal";
											activeTerm = i;
										}}><Icon name="terminal" size={12} /> {tt}</button
									>
								{/each}
							{:else}
								<button class:on={panelTab === "terminal"} onclick={() => (panelTab = "terminal")}
									><Icon name="terminal" size={13} /> Terminal</button
								>
							{/if}
							<span style="flex:1"></span>
							{#if panelTab === "terminal"}
								<button
									title="New terminal (Ctrl+Shift+`)"
									onclick={() => {
										termTabs = [...termTabs, `powershell (${termTabs.length + 1})`];
										activeTerm = termTabs.length - 1;
									}}><span class="plussign">+</span></button
								>
								<button title="Clear terminal" onclick={() => (termLines = [])}
									><Icon name="trash" size={13} /></button
								>
							{:else}
								<input
									class="panelfilter"
									placeholder="Filter (e.g. error)…"
									bind:value={panelFilter}
								/>
								<button onclick={() => (logs = [])} title="Clear Output"
									><Icon name="trash" size={13} /></button
								>
							{/if}
							<button
								title="Views and More Actions…"
								onclick={() => toast("Panel actions: clear · maximize · hide")}
								><Icon name="ellipsis" size={13} /></button
							>
							<button
								title={panelMax ? "Restore" : "Maximize panel"}
								onclick={() => (panelMax = !panelMax)}
								><Icon name={panelMax ? "fullscreen-exit" : "fullscreen"} size={13} /></button
							>
							<button
								onclick={() => (showPanel = false)}
								title="Close panel (Ctrl+J)"
								aria-label="Close panel"><Icon name="close" size={14} /></button
							>
						</div>
						<div class="panelbody">
							{#if panelTab === "terminal"}
								<div class="term" role="log" aria-label="Terminal">
									{#each termLines.slice(-80) as tl}
										<div class="logline {tl.kind}">
											{tl.text}
										</div>
									{/each}
									<form
										class="termin"
										onsubmit={(e) => {
											e.preventDefault();
											runTerm(termInput);
										}}
									>
										<span class="prompt"
											>➜ {activeProjectName} [{termTabs[activeTerm] ?? "powershell"}]$</span
										>
										<input
											bind:value={termInput}
											placeholder="help · ls · open /index.html · entry · echo"
											aria-label="Terminal input"
										/>
									</form>
								</div>
							{:else if panelTab === "problems"}
								<div class="probs">
									<div class="prow phead">
										<span></span><span>File</span><span>Message</span><span>Go</span>
									</div>
									{#each problems as p}
										<button
											type="button"
											class="prow clickable"
											onclick={() => openFile(p.replace("Empty file: ", ""))}
										>
											<Icon name="warning" size={13} />
											<span class="pfile">{p.replace("Empty file: ", "")}</span>
											<span class="pmsg">Empty file</span>
											<small>open →</small>
										</button>
									{/each}
									{#each logs.filter((l) => l.kind === "error") as l}
										<div class="prow error">
											<Icon name="error" size={13} />
											<span class="pfile">preview</span>
											<span class="pmsg">{l.text}</span>
											<small>log</small>
										</div>
									{/each}
									{#if problems.length === 0 && errCount === 0}<div class="logline info">
											<Icon name="check" size={13} /> No problems — working tree clean.
										</div>{/if}
								</div>
							{:else if panelTab === "output" && outputChannel !== "Preview"}
								<div class="logline info">
									[ {outputChannel} ] — No output in this mock channel yet. Run the preview to generate
									logs.
								</div>
							{:else}
								{#each filteredLogs as l}<div class="logline {l.kind}">
										<span class="ltime">{l.kind}</span>
										{l.text}
									</div>{/each}
								{#if filteredLogs.length === 0}<div class="logline info">
										{panelTab === "output"
											? "Output from build + warnings appears here."
											: "console output from the preview iframe appears here. Run the preview to see logs."}
									</div>{/if}
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</div>

		<div class="statusbar">
			<button
				type="button"
				class="it remote"
				title="Remote — local workspace (mock)"
				onclick={() => toast("Remote: local workspace")}
				><span class="remote-glyph">{"<>"}</span></button
			>
			<div class="sbwrap">
				<button
					type="button"
					class="it"
					title="Branch — switch branch"
					onclick={() => (branchMenu = !branchMenu)}
					><Icon name="git-branch" size={13} />
					{currentBranch}{isDirty ? "*" : ""}</button
				>
				{#if branchMenu}
					<button class="veil up" aria-label="Close branches" onclick={() => (branchMenu = false)}
					></button>
					<div class="sbmenu" role="menu">
						<div class="projmenu-head">Branch</div>
						{#each branches as b}
							<button
								onclick={() => {
									currentBranch = b;
									branchMenu = false;
									toast(`Switched to ${b} (mock)`);
								}}
								><span>{b}</span>{#if b === currentBranch}<small>✓ current</small>{/if}</button
							>
						{/each}
						<div class="sep"></div>
						<button
							onclick={() => {
								branchMenu = false;
								toast("New branch is a mock");
							}}><span>+ New Branch…</span></button
						>
					</div>
				{/if}
			</div>
			<button
				type="button"
				class="it"
				title="Sync (mock)"
				onclick={() => toast("Synced (mock) — files persist to localStorage")}
				><Icon name="sync" size={13} /> 0↓ 1↑</button
			>
			<button
				type="button"
				class="it"
				title="Errors and warnings — open Problems"
				onclick={() => {
					panelTab = "problems";
					showPanel = true;
				}}
				><Icon name="error" size={13} />
				{errCount}
				<Icon name="warning" size={13} />
				{warnCount}</button
			>
			<button
				type="button"
				class="it hide-sm"
				title="{fileCount} files in workspace"
				onclick={() => {
					sideView = "explorer";
					sidebar = true;
				}}
				><Icon name="files" size={13} />
				{fileCount} files</button
			>
			<span class="right">
				<button
					type="button"
					class="it"
					title="Go to line"
					onclick={() => {
						gotoDraft = String(line);
						gotoOpen = true;
					}}>Ln {line}, Col {col}</button
				>
				<div class="sbwrap">
					<button
						type="button"
						class="it"
						title="Select Indentation"
						onclick={() => (indentMenu = !indentMenu)}
						>{useSpaces ? "Spaces" : "Tabs"}: {indentSize}</button
					>
					{#if indentMenu}
						<button class="veil up" aria-label="Close indent" onclick={() => (indentMenu = false)}
						></button>
						<div class="sbmenu" role="menu">
							<div class="projmenu-head">Indentation</div>
							<button
								onclick={() => {
									useSpaces = true;
									indentMenu = false;
								}}
								><span>Spaces</span>{#if useSpaces}<small>✓</small>{/if}</button
							>
							<button
								onclick={() => {
									useSpaces = false;
									indentMenu = false;
								}}
								><span>Tabs</span>{#if !useSpaces}<small>✓</small>{/if}</button
							>
							<div class="sep"></div>
							{#each [2, 4, 8] as n}
								<button
									onclick={() => {
										indentSize = n;
										indentMenu = false;
									}}
									><span>{n}</span>{#if indentSize === n}<small>✓</small>{/if}</button
								>
							{/each}
						</div>
					{/if}
				</div>
				<div class="sbwrap">
					<button
						type="button"
						class="it"
						title="Select Encoding"
						onclick={() => (encodingMenu = !encodingMenu)}>{encoding}</button
					>
					{#if encodingMenu}
						<button
							class="veil up"
							aria-label="Close encoding"
							onclick={() => (encodingMenu = false)}
						></button>
						<div class="sbmenu" role="menu">
							{#each ["UTF-8", "UTF-16 LE", "Western (Windows 1252)"] as e}
								<button
									onclick={() => {
										encoding = e === "UTF-8" ? "UTF-8" : "UTF-8";
										encodingMenu = false;
										toast(e === "UTF-8" ? "Encoding: UTF-8" : `${e} is a mock — kept UTF-8`);
									}}
									><span>{e}</span>{#if e === "UTF-8"}<small>✓</small>{/if}</button
								>
							{/each}
						</div>
					{/if}
				</div>
				<div class="sbwrap">
					<button
						type="button"
						class="it"
						title="Select End of Line Sequence"
						onclick={() => (eolMenu = !eolMenu)}>{eol}</button
					>
					{#if eolMenu}
						<button class="veil up" aria-label="Close eol" onclick={() => (eolMenu = false)}
						></button>
						<div class="sbmenu" role="menu">
							<button
								onclick={() => {
									eol = "LF";
									eolMenu = false;
								}}
								><span>LF</span>{#if eol === "LF"}<small>✓</small>{/if}</button
							>
							<button
								onclick={() => {
									eol = "CRLF";
									eolMenu = false;
									toast("CRLF is a mock — kept LF");
									eol = "LF";
								}}><span>CRLF</span></button
							>
						</div>
					{/if}
				</div>
				<button
					type="button"
					class="it"
					title="Change language mode"
					onclick={() => (langPick = true)}>{active ? languageOf(active) : "--"}</button
				>
				<button
					type="button"
					class="it"
					title="Toggle preview"
					onclick={() => (showPreview = !showPreview)}
					><Icon name="browser" size={13} /> Go Live</button
				>
				<button
					type="button"
					class="it"
					title="Notifications — show notification center"
					onclick={() => (notifCenter = !notifCenter)}><Icon name="bell" size={13} /></button
				>
			</span>
		</div>
	</div>
{/if}

{#if tabCtx}
	<button
		class="veil"
		aria-label="Close tab menu"
		onclick={() => (tabCtx = null)}
		onkeydown={(e) => {
			if (e.key === "Escape") tabCtx = null;
		}}
	></button>
	<div
		class="ctx"
		role="menu"
		style={`left:${Math.min(tabCtx.x, window.innerWidth - 230)}px;top:${tabCtx.y}px`}
	>
		<button
			onclick={() => {
				openFile(tabCtx!.path);
				tabCtx = null;
			}}><span>Open</span></button
		>
		<div class="sep"></div>
		<button
			onclick={() => {
				closeTab(tabCtx!.path);
				tabCtx = null;
			}}><span>Close</span><small>Ctrl+W</small></button
		>
		<button
			onclick={() => {
				closeOthers(tabCtx!.path);
				tabCtx = null;
				toast("Closed others");
			}}><span>Close Others</span></button
		>
		<button
			onclick={() => {
				closeToRight(tabCtx!.path);
				tabCtx = null;
			}}><span>Close to the Right</span></button
		>
		<button
			onclick={() => {
				closeAll();
				tabCtx = null;
			}}><span>Close All</span></button
		>
		<div class="sep"></div>
		<button
			onclick={() => {
				try {
					navigator.clipboard.writeText(tabCtx!.path);
					toast("Path copied");
				} catch {
					/* noop */
				}
				tabCtx = null;
			}}><span>Copy Path</span><small>Ctrl+C</small></button
		>
		<button
			onclick={() => {
				sideView = "explorer";
				sidebar = true;
				tabCtx = null;
				toast("Revealed in Explorer (mock)");
			}}><span>Reveal in Explorer</span></button
		>
	</div>
{/if}

{#if editorCtx}
	<button
		class="veil"
		aria-label="Close editor menu"
		onclick={() => (editorCtx = null)}
		onkeydown={(e) => {
			if (e.key === "Escape") editorCtx = null;
		}}
	></button>
	<div class="ctx" role="menu" style={`left:${editorCtx.x}px;top:${editorCtx.y}px`}>
		<button
			onclick={() => {
				document.execCommand?.("cut");
				editorCtx = null;
			}}><span>Cut</span><small>Ctrl+X</small></button
		>
		<button
			onclick={() => {
				document.execCommand?.("copy");
				editorCtx = null;
			}}><span>Copy</span><small>Ctrl+C</small></button
		>
		<button
			onclick={() => {
				document.execCommand?.("paste");
				editorCtx = null;
			}}><span>Paste</span><small>Ctrl+V</small></button
		>
		<div class="sep"></div>
		<button
			onclick={() => {
				paletteQ = "> ";
				palette = true;
				editorCtx = null;
			}}><span>Command Palette…</span><small>F1</small></button
		>
		<button
			onclick={() => {
				gotoDraft = String(line);
				gotoOpen = true;
				editorCtx = null;
			}}><span>Go to Line…</span><small>Ctrl+G</small></button
		>
		<button
			onclick={() => {
				langPick = true;
				editorCtx = null;
			}}><span>Change Language Mode</span></button
		>
		<div class="sep"></div>
		<button
			onclick={() => {
				previewRef?.refresh();
				editorCtx = null;
				toast("Preview refreshed");
			}}><Icon name="play" size={14} /><span>Run Preview</span><small>F5</small></button
		>
	</div>
{/if}

{#if palette}
	<div
		class="palette-veil"
		role="button"
		tabindex="0"
		aria-label="Close command palette"
		onclick={() => (palette = false)}
		onkeydown={(e) => {
			if (e.key === "Escape") palette = false;
		}}
	>
		<div
			class="palette"
			role="dialog"
			aria-label="Command palette"
			tabindex="0"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<input
				use:autofocus
				placeholder={paletteIsCmd ? "> Type a command" : "Type file name, or > for commands"}
				bind:value={paletteQ}
				onkeydown={(e) => {
					if (e.key === "ArrowDown") {
						e.preventDefault();
						paletteSel = Math.min(paletteTotal - 1, paletteSel + 1);
					} else if (e.key === "ArrowUp") {
						e.preventDefault();
						paletteSel = Math.max(0, paletteSel - 1);
					} else if (e.key === "Enter") {
						let idx = paletteSel;
						if (idx < paletteFiles.length && paletteFiles[idx]) {
							openFile(paletteFiles[idx]);
							palette = false;
						} else {
							idx -= paletteFiles.length;
							const projHits = projectsSnap.filter((m) =>
								m.name.toLowerCase().includes(paletteCmdQ),
							);
							if (idx < projHits.length) {
								doSwitchProject(projHits[idx].id);
								palette = false;
							} else {
								idx -= projHits.length;
								const cmd = allCommands[idx];
								if (cmd) {
									cmd.run();
									palette = false;
								}
							}
						}
					}
				}}
			/>
			<div class="opts">
				{#if !paletteIsCmd}
					<div class="pgroup">files · {paletteFiles.length} · MRU first</div>
				{/if}
				{#each paletteFiles as p, i}
					{@const hm = hiMatch(p, paletteQ)}
					<button
						type="button"
						class="opt"
						class:on={paletteSel === i}
						onmouseenter={() => (paletteSel = i)}
						onclick={() => {
							openFile(p);
							palette = false;
						}}
						><FileIcon name={basename(p)} />
						<span class="pfile"
							><span>{hm.pre}</span>{#if hm.mid}<mark>{hm.mid}</mark>{/if}<span>{hm.post}</span
							></span
						><small>{tabs.includes(p) ? "open ·" : ""} file · ↵</small></button
					>{/each}
				<div class="pgroup">projects</div>
				{#each projectsSnap.filter((m) => m.name
						.toLowerCase()
						.includes(paletteCmdQ)) as m, j}<button
						type="button"
						class="opt"
						class:on={paletteSel === paletteFiles.length + j}
						onmouseenter={() => (paletteSel = paletteFiles.length + j)}
						onclick={() => {
							doSwitchProject(m.id);
							palette = false;
						}}
						><Icon name="files" size={15} />
						{m.name}<small>project{m.id === activeProjectIdSnap ? " · active" : ""}</small></button
					>{/each}
				<div class="pgroup">commands · prefix with &gt;</div>
				{#each allCommands as c, k}<button
						type="button"
						class="opt"
						class:on={paletteSel ===
							paletteFiles.length +
								projectsSnap.filter((m) => m.name.toLowerCase().includes(paletteCmdQ)).length +
								k}
						onmouseenter={() =>
							(paletteSel =
								paletteFiles.length +
								projectsSnap.filter((m) => m.name.toLowerCase().includes(paletteCmdQ)).length +
								k)}
						onclick={() => runPaletteCommand(c.id)}
						><Icon name="record-keys" size={15} />
						{c.label}<small>cmd</small></button
					>{/each}
			</div>
			<div class="pfoot">
				<span><kbd>↑↓</kbd> navigate</span><span><kbd>↵</kbd> select</span><span
					><kbd>esc</kbd> close</span
				><span class="pfhint">{paletteIsCmd ? "command mode" : "type > for commands"}</span>
			</div>
		</div>
	</div>
{/if}

{#if langPick}
	<div
		class="palette-veil"
		role="button"
		tabindex="0"
		aria-label="Close language picker"
		onclick={() => (langPick = false)}
		onkeydown={(e) => {
			if (e.key === "Escape") langPick = false;
		}}
	>
		<div
			class="dlg"
			role="dialog"
			aria-label="Language mode"
			tabindex="0"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="dlg-title">Select Language Mode</div>
			<div class="dlg-body">
				{#each ["html", "css", "javascript", "typescript", "json", "markdown", "xml", "plaintext"] as l}
					<button
						type="button"
						class="opt langrow"
						class:on={languageOf(active) === l}
						onclick={() => {
							toast(`Language: ${l} (detected from extension)`);
							langPick = false;
						}}>{l}{languageOf(active) === l ? " · current" : ""}</button
					>
				{/each}
				<div class="dlg-actions">
					<button type="button" class="btn ghost" onclick={() => (langPick = false)}>Close</button>
				</div>
			</div>
		</div>
	</div>
{/if}

{#if gotoOpen}
	<div
		class="palette-veil"
		role="button"
		tabindex="0"
		aria-label="Close go to line"
		onclick={() => (gotoOpen = false)}
		onkeydown={(e) => {
			if (e.key === "Escape") gotoOpen = false;
		}}
	>
		<div
			class="dlg"
			role="dialog"
			aria-label="Go to line"
			tabindex="0"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="dlg-title">Go to Line/Column</div>
			<div class="dlg-body">
				<input
					class="dlg-input"
					use:autofocus
					placeholder="12"
					bind:value={gotoDraft}
					onkeydown={(e) => {
						if (e.key === "Enter") confirmGoto();
					}}
				/>
				<div class="dlg-actions">
					<button type="button" class="btn ghost" onclick={() => (gotoOpen = false)}>Cancel</button>
					<button type="button" class="btn" onclick={confirmGoto}>Go</button>
				</div>
			</div>
		</div>
	</div>
{/if}

{#if showNewProj}
	<div
		class="palette-veil"
		role="button"
		tabindex="0"
		aria-label="Close new project dialog"
		onclick={() => (showNewProj = false)}
		onkeydown={(e) => {
			if (e.key === "Escape") showNewProj = false;
		}}
	>
		<div
			class="dlg"
			role="dialog"
			aria-label="New project"
			tabindex="0"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="dlg-title">New project</div>
			<div class="dlg-body">
				<input
					class="dlg-input"
					use:autofocus
					placeholder="Project name"
					bind:value={newProjName}
					onkeydown={(e) => {
						if (e.key === "Enter") confirmNewProject();
					}}
				/>
				<div class="radio-list">
					<label class="radio-row"
						><input type="radio" name="tpl" value="seed" bind:group={newProjTemplate} /><span
							><span class="rtitle">Seed</span><br /><span class="rdesc"
								>Starter files (index.html / style.css / app.js)</span
							></span
						></label
					>
					<label class="radio-row"
						><input type="radio" name="tpl" value="blank" bind:group={newProjTemplate} /><span
							><span class="rtitle">Blank</span><br /><span class="rdesc">Minimal index.html</span
							></span
						></label
					>
					<label class="radio-row"
						><input type="radio" name="tpl" value="clone" bind:group={newProjTemplate} /><span
							><span class="rtitle">Clone current</span><br /><span class="rdesc"
								>Copy files from active project</span
							></span
						></label
					>
				</div>
				<div class="dlg-actions">
					<button type="button" class="btn ghost" onclick={() => (showNewProj = false)}
						>Cancel</button
					>
					<button type="button" class="btn" onclick={confirmNewProject}>Create</button>
				</div>
			</div>
		</div>
	</div>
{/if}

{#if renameTarget}
	<div
		class="palette-veil"
		role="button"
		tabindex="0"
		aria-label="Close rename dialog"
		onclick={() => (renameTarget = null)}
		onkeydown={(e) => {
			if (e.key === "Escape") renameTarget = null;
		}}
	>
		<div
			class="dlg"
			role="dialog"
			aria-label="Rename project"
			tabindex="0"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="dlg-title">Rename project</div>
			<div class="dlg-body">
				<input
					class="dlg-input"
					use:autofocus
					placeholder="Project name"
					bind:value={renameDraft}
					onkeydown={(e) => {
						if (e.key === "Enter") confirmRenameProject();
					}}
				/>
				<div class="dlg-actions">
					<button type="button" class="btn ghost" onclick={() => (renameTarget = null)}
						>Cancel</button
					>
					<button type="button" class="btn" onclick={confirmRenameProject}>Rename</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<div class="toasts" aria-live="polite">
	{#each toasts as t}
		<div class="toast {t.kind}">
			<span class="tdot"></span>
			<span class="ttext">{t.text}</span>
			<button
				class="tact"
				onclick={() => {
					toasts = toasts.filter((x) => x.id !== t.id);
					notifCenter = true;
				}}>Details</button
			>
			<button
				class="iconbtn"
				aria-label="Dismiss"
				onclick={() => (toasts = toasts.filter((x) => x.id !== t.id))}
				><Icon name="close" size={13} /></button
			>
		</div>
	{/each}
</div>

{#if notifCenter}
	<button class="veil" aria-label="Close notifications" onclick={() => (notifCenter = false)}
	></button>
	<div class="notifcenter" role="dialog" aria-label="Notifications">
		<div class="notif-head">
			<span>Notifications</span><button
				class="iconbtn"
				title="Clear all"
				onclick={() => {
					toasts = [];
					logs = [];
				}}><Icon name="trash" size={13} /> Clear</button
			><button class="iconbtn" aria-label="Close" onclick={() => (notifCenter = false)}
				><Icon name="close" size={13} /></button
			>
		</div>
		<div class="notif-body">
			{#each [...toasts].reverse() as t}
				<div class="notifrow {t.kind}"><span class="tdot"></span><span>{t.text}</span></div>
			{/each}
			{#each logs.slice(-8).reverse() as l}
				<div class="notifrow {l.kind}"><span class="tdot"></span><span>{l.text}</span></div>
			{/each}
			{#if toasts.length === 0 && logs.length === 0}<div class="oempty">
					No new notifications.
				</div>{/if}
		</div>
	</div>
{/if}
