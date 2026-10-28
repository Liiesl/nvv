<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { loadMonaco } from '#lib/monaco.js';
	import { languageOf } from '#lib/vfs.js';

	let { path = '', content = '', onChange, onCursor }: {
		path: string;
		content: string;
		onChange: (v: string) => void;
		onCursor?: (line: number, col: number) => void;
	} = $props();

	let host: HTMLDivElement | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let editor: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let monacoInstance: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let model: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let contentSub: any = null;
	let failed = $state('');
	let ready = $state(false);
	let currentPath = '';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const viewStates = new Map<string, any>();
	let ro: ResizeObserver | null = null;

	function setModel(p: string, value: string) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const m = monacoInstance as any;
		if (!m || !editor) return;
		if (currentPath) {
			try {
				const vs = editor.saveViewState?.();
				if (vs) viewStates.set(currentPath, vs);
			} catch { /* noop */ }
		}
		try { contentSub?.dispose?.(); } catch { /* noop */ }
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
		model = m.editor.createModel(value ?? '', languageOf(p), uri);
		contentSub = model.onDidChangeContent(() => {
			try { onChange(model.getValue()); } catch { /* noop */ }
		});
		editor.setModel(model);
		currentPath = p;
		try {
			const vs = viewStates.get(p);
			if (vs) editor.restoreViewState?.(vs);
		} catch { /* noop */ }
	}

	onMount(() => {
		let dead = false;
		(async () => {
			try {
				const monaco = (await loadMonaco()) as any;
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
				editor.onDidChangeCursorPosition((e: { position: { lineNumber: number; column: number } }) =>
					onCursor?.(e.position.lineNumber, e.position.column)
				);
				setModel(path, content);
				ro = new ResizeObserver(() => { try { editor?.layout?.(); } catch { /* noop */ } });
				if (host) ro.observe(host);
				ready = true;
			} catch {
				failed = 'Monaco CDN failed to load. Check network.';
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
		if (!editor || !monacoInstance) return;
		if (p !== currentPath) {
			setModel(p, v);
		} else if (model && model.getValue() !== v) {
			try {
				model.pushEditOperations([], [{ range: model.getFullModelRange(), text: v ?? '' }], () => null);
			} catch { /* noop */ }
		}
	});

	onDestroy(() => {
		try { contentSub?.dispose?.(); } catch { /* noop */ }
		try { model?.dispose?.(); } catch { /* noop */ }
		try { editor?.dispose?.(); } catch { /* noop */ }
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
