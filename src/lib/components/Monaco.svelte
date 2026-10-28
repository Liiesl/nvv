<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import type * as monacoNs from "monaco-editor";
	import { loadMonaco, type MonacoApi } from "#lib/monaco.js";
	import { languageOf } from "#lib/vfs.js";
	import type { InspectPayload } from "#lib/inspect.js";

	let {
		path = "",
		content = "",
		onChange,
		onCursor,
		inspectTarget = null,
		onInspectClear,
		fontSize = 13,
		minimapOn = true,
		revealLine = 0,
	}: {
		path: string;
		content: string;
		onChange: (v: string) => void;
		onCursor?: (line: number, col: number) => void;
		inspectTarget?: InspectPayload | null;
		onInspectClear?: () => void;
		fontSize?: number;
		minimapOn?: boolean;
		revealLine?: number;
	} = $props();

	let host: HTMLDivElement | null = null;
	let editor: monacoNs.editor.IStandaloneCodeEditor | null = null;
	let monacoInstance: MonacoApi | null = null;
	let model: monacoNs.editor.ITextModel | null = null;
	let contentSub: monacoNs.IDisposable | null = null;
	let failed = $state("");
	let ready = $state(false);
	let currentPath = "";
	const instanceUid = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
	const viewStates = new Map<string, monacoNs.editor.ICodeEditorViewState | null>();
	let decorIds: string[] = [];

	function clearInspectDecorations() {
		if (!editor) {
			decorIds = [];
			return;
		}
		try {
			decorIds = editor.deltaDecorations(decorIds, []);
		} catch {
			decorIds = [];
		}
	}

	function handleUserTakeover() {
		// User clicked/typed elsewhere in the editor: the pinned inspect
		// highlight is transient, so drop it instead of leaving it stuck.
		if (decorIds.length === 0) return;
		clearInspectDecorations();
		try {
			onInspectClear?.();
		} catch {
			/* noop */
		}
	}

	function findInspectIndex(text: string, target: InspectPayload): number {
		// Strict matching only. A weak fallback (e.g. first `<div>`) would
		// highlight the wrong line in unrelated files and look "stuck".
		// Return -1 to clear instead of guessing.
		if (target.id) {
			const needle1 = `id="${target.id}"`;
			const needle2 = `id='${target.id}'`;
			let i = text.indexOf(needle1);
			if (i < 0) i = text.indexOf(needle2);
			if (i >= 0) {
				// back up to the opening '<' of this tag
				const lt = text.lastIndexOf("<", i);
				return lt >= 0 ? lt : i;
			}
			return -1;
		}
		if (target.classes.length) {
			const cls = target.classes[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			try {
				const re = new RegExp(`<${target.tag}[^>]*class=["'][^"']*${cls}`, "i");
				const m = re.exec(text);
				if (m && m.index >= 0) return m.index;
			} catch {
				/* noop */
			}
			return -1;
		}
		// No id/class: try the raw opening tag verbatim, else clear.
		const outer = (target.outerHtml ?? "").slice(0, 120);
		const gt = outer.indexOf(">");
		if (outer.length > 3 && gt > 0) {
			const opening = outer.slice(0, gt + 1);
			const k = text.indexOf(opening);
			if (k >= 0) return k;
		}
		return -1;
	}

	function applyInspectTarget(target: InspectPayload | null) {
		if (!editor || !monacoInstance || !model) return;
		try {
			if (model.isDisposed()) {
				model = null;
				return;
			}
		} catch {
			return;
		}
		clearInspectDecorations();
		if (!target) return;
		try {
			const text = model.getValue();
			const idx = findInspectIndex(text, target);
			if (idx < 0) return;
			const before = text.slice(0, idx);
			const line = before.split("\n").length;
			const lastNl = before.lastIndexOf("\n");
			const col = idx - lastNl;
			// highlight the opening tag through its closing '>'
			const close = text.indexOf(">", idx);
			const endIdx = close >= 0 ? close + 1 : idx + target.tag.length + 2;
			const endBefore = text.slice(0, endIdx);
			const endLine = endBefore.split("\n").length;
			const endLastNl = endBefore.lastIndexOf("\n");
			const endCol = endIdx - endLastNl;
			const range = new monacoInstance.Range(line, col, endLine, endCol);
			decorIds = editor.deltaDecorations(decorIds, [
				{
					range,
					options: {
						inlineClassName: "nv-inspect-match",
						stickiness: monacoInstance.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
					},
				},
			]);
			// Reveal only — do NOT move the cursor/selection. Stealing the
			// selection is what made the highlight look permanently stuck.
			editor.revealLineInCenter(line);
		} catch {
			/* noop */
		}
	}

	function setModel(p: string, value: string) {
		const m = monacoInstance;
		if (!m || !editor) return;
		try {
			decorIds = editor.deltaDecorations(decorIds, []);
		} catch {
			decorIds = [];
		}
		if (currentPath) {
			try {
				const vs = editor.saveViewState();
				if (vs) viewStates.set(currentPath, vs);
			} catch {
				/* noop */
			}
		}
		try {
			contentSub?.dispose();
		} catch {
			/* noop */
		}
		contentSub = null;
		if (model) {
			try {
				if (!model.isDisposed()) model.dispose();
			} catch {
				/* noop */
			}
			model = null;
		}
		// Per-instance URI: split groups can open the same file.
		// A shared inmemory://<path> URI would let one editor dispose the
		// model still referenced by another group (Model is disposed!).
		const uri = m.Uri.parse("inmemory://m-" + instanceUid + p);
		const next = m.editor.createModel(value ?? "", languageOf(p), uri);
		contentSub = next.onDidChangeContent(() => {
			try {
				onChange(next.getValue());
			} catch {
				/* noop */
			}
		});
		model = next;
		editor.setModel(next);
		currentPath = p;
		try {
			const vs = viewStates.get(p);
			if (vs) editor.restoreViewState(vs);
		} catch {
			/* noop */
		}
	}

	onMount(() => {
		let dead = false;
		(async () => {
			try {
				const monaco = await loadMonaco();
				if (dead || !host) return;
				monacoInstance = monaco;
				editor = monaco.editor.create(host, {
					theme: "vs-dark",
					fontSize,
					minimap: {
						enabled: minimapOn,
						scale: 1,
						renderCharacters: false,
						maxColumn: 80,
					},
					automaticLayout: true,
					scrollBeyondLastLine: false,
					padding: { top: 10 },
					renderLineHighlight: "all",
					stickyScroll: { enabled: true },
					bracketPairColorization: { enabled: true },
					guides: { bracketPairs: true, indentation: true },
					smoothScrolling: true,
					cursorBlinking: "smooth",
					renderWhitespace: "selection",
					fontLigatures: true,
				});
				editor.onDidChangeCursorPosition((e) =>
					onCursor?.(e.position.lineNumber, e.position.column),
				);
				editor.onMouseDown(() => handleUserTakeover());
				editor.onDidChangeCursorPosition(() => {
					// Our own programmatic setSelection sets a flag;
					// any other cursor move is the user taking over.
					handleUserTakeover();
				});
				setModel(path, content);
				ready = true;
			} catch {
				failed = "Monaco failed to load. Check console.";
			}
		})();
		return () => {
			dead = true;
		};
	});

	$effect(() => {
		if (!ready) return;
		const p = path;
		const v = content;
		const ed = editor;
		if (!ed || !monacoInstance) return;
		if (p !== currentPath) {
			setModel(p, v);
			// re-apply pending inspect highlight after file switch
			if (inspectTarget) applyInspectTarget(inspectTarget);
		} else {
			const cur = model;
			if (cur) {
				let curText: string | null = null;
				try {
					if (cur.isDisposed()) {
						model = null;
						setModel(p, v);
						return;
					}
					curText = cur.getValue();
				} catch {
					curText = null;
				}
				if (curText !== null && curText !== v) {
					try {
						cur.pushEditOperations(
							[],
							[{ range: cur.getFullModelRange(), text: v ?? "" }],
							() => null,
						);
					} catch {
						/* noop */
					}
				}
				// File changed under a pinned highlight: re-resolve so the
				// decoration tracks the edit or clears if the node is gone.
				if (inspectTarget) applyInspectTarget(inspectTarget);
			}
		}
	});

	$effect(() => {
		if (!ready) return;
		applyInspectTarget(inspectTarget);
	});

	$effect(() => {
		if (!ready || !editor) return;
		void fontSize;
		void minimapOn;
		try {
			editor.updateOptions({
				fontSize,
				minimap: { enabled: minimapOn },
			});
		} catch {
			/* noop */
		}
	});

	$effect(() => {
		if (!ready || !editor || !monacoInstance) return;
		if (!revealLine || revealLine < 1) return;
		try {
			editor.revealLineInCenter(revealLine);
			editor.setPosition({ lineNumber: revealLine, column: 1 });
			editor.focus();
		} catch {
			/* noop */
		}
	});

	onDestroy(() => {
		try {
			contentSub?.dispose();
		} catch {
			/* noop */
		}
		try {
			model?.dispose();
		} catch {
			/* noop */
		}
		try {
			editor?.dispose();
		} catch {
			/* noop */
		}
	});
</script>

<div class="monaco-host" bind:this={host}>
	{#if failed}<div class="loading">{failed}</div>{/if}
</div>

<style>
	.monaco-host {
		flex: 1;
		min-height: 0;
	}
	.loading {
		padding: 20px;
		color: var(--vs-fg-dim);
	}
</style>
