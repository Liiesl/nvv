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
	let model: any = null;
	let failed = $state('');
	let currentPath = '';
	let ro: ResizeObserver | null = null;

	function setModel(monaco: unknown, p: string, value: string) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const m = monaco as any;
		if (model) model.dispose();
		const uri = m.Uri.parse('inmemory://' + p);
		model = m.editor.createModel(value, languageOf(p), uri);
		model.onDidChangeContent(() => onChange(model.getValue()));
		editor.setModel(model);
		currentPath = p;
	}

	onMount(() => {
		let dead = false;
		(async () => {
			try {
				const monaco = (await loadMonaco()) as any;
				if (dead || !host) return;
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
				setModel(monaco, path, content);
				ro = new ResizeObserver(() => editor?.layout());
				if (host) ro.observe(host);
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
		// switch file
		if (editor && path !== currentPath) {
			const monaco = (window as unknown as { monaco: unknown }).monaco;
			if (monaco) setModel(monaco, path, content);
		}
	});

	$effect(() => {
		// external content update (e.g. reset) without clobbering cursor when equal
		if (model && model.getValue() !== content && document.activeElement?.tagName !== 'TEXTAREA') {
			// only push when change came from outside and editor not focused typing;
			// cheap guard: if diff is large (file switch already handled), update.
			if (Math.abs(model.getValue().length - content.length) > 2 || !editor?.hasTextFocus?.()) {
				model.pushEditOperations([], [{ range: model.getFullModelRange(), text: content }], () => null);
			}
		}
	});

	onDestroy(() => {
		try { model?.dispose(); } catch { /* noop */ }
		try { editor?.dispose(); } catch { /* noop */ }
	});
</script>

<div class="monaco-host" bind:this={host}>
	{#if failed}<div class="loading">{failed}</div>{/if}
</div>

<style>
	.monaco-host { flex: 1; min-height: 0; }
	.loading { padding: 20px; color: var(--vs-fg-dim); }
</style>
