<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type * as monacoNs from 'monaco-editor';
	import { loadMonaco, type MonacoApi } from '#lib/monaco.js';
	import { languageOf } from '#lib/vfs.js';

	let { path = '', content = '', onChange, onCursor }: {
		path: string;
		content: string;
		onChange: (v: string) => void;
		onCursor?: (line: number, col: number) => void;
	} = $props();

	let host: HTMLDivElement | null = null;
	let editor: monacoNs.editor.IStandaloneCodeEditor | null = null;
	let monacoInstance: MonacoApi | null = null;
	let model: monacoNs.editor.ITextModel | null = null;
	let contentSub: monacoNs.IDisposable | null = null;
	let failed = $state('');
	let ready = $state(false);
	let currentPath = '';
	const viewStates = new Map<string, monacoNs.editor.ICodeEditorViewState | null>();
	let ro: ResizeObserver | null = null;

	function setModel(p: string, value: string) {
		const m = monacoInstance;
		if (!m || !editor) return;
		if (currentPath) {
			try {
				const vs = editor.saveViewState();
				if (vs) viewStates.set(currentPath, vs);
			} catch { /* noop */ }
		}
		try { contentSub?.dispose(); } catch { /* noop */ }
		contentSub = null;
		if (model) {
			try { model.dispose(); } catch { /* noop */ }
			model = null;
		}
		const uri = m.Uri.parse('inmemory://' + p);
		try {
			const existing = m.editor.getModel(uri);
			if (existing) existing.dispose();
		} catch { /* noop */ }
		const next = m.editor.createModel(value ?? '', languageOf(p), uri);
		contentSub = next.onDidChangeContent(() => {
			try { onChange(next.getValue()); } catch { /* noop */ }
		});
		model = next;
		editor.setModel(next);
		currentPath = p;
		try {
			const vs = viewStates.get(p);
			if (vs) editor.restoreViewState(vs);
		} catch { /* noop */ }
	}

	onMount(() => {
		let dead = false;
		(async () => {
			try {
				const monaco = await loadMonaco();
				if (dead || !host) return;
				monacoInstance = monaco;
				editor = monaco.editor.create(host, {
					theme: 'vs-dark',
					fontSize: 13,
					minimap: { enabled: false },
					automaticLayout: false,
					scrollBeyondLastLine: false,
					padding: { top: 10 },
					renderLineHighlight: 'all'
				});
				editor.onDidChangeCursorPosition((e) =>
					onCursor?.(e.position.lineNumber, e.position.column)
				);
				setModel(path, content);
				const ed = editor;
				ro = new ResizeObserver(() => { try { ed.layout(); } catch { /* noop */ } });
				if (host) ro.observe(host);
				ready = true;
			} catch {
				failed = 'Monaco failed to load. Check console.';
			}
		})();
		return () => {
			dead = true;
			try { ro?.disconnect(); } catch { /* noop */ }
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
		} else {
			const cur = model;
			if (cur && cur.getValue() !== v) {
				try {
					cur.pushEditOperations([], [{ range: cur.getFullModelRange(), text: v ?? '' }], () => null);
				} catch { /* noop */ }
			}
		}
	});

	onDestroy(() => {
		try { contentSub?.dispose(); } catch { /* noop */ }
		try { model?.dispose(); } catch { /* noop */ }
		try { editor?.dispose(); } catch { /* noop */ }
		try { ro?.disconnect(); } catch { /* noop */ }
	});
</script>

<div class="monaco-host" bind:this={host}>
	{#if failed}<div class="loading">{failed}</div>{/if}
</div>

<style>
	.monaco-host { flex: 1; min-height: 0; }
	.loading { padding: 20px; color: var(--vs-fg-dim); }
</style>
