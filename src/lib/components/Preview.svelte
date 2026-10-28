<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { buildPreview, type BuiltPreview } from '#lib/preview.js';
	import type { VNode } from '#lib/vfs.js';
	import Icon from './Icon.svelte';

	let { files, entry = '/index.html', auto = true, onLog }: {
		files: Record<string, VNode>;
		entry: string;
		auto: boolean;
		onLog: (kind: string, text: string) => void;
	} = $props();

	let built: BuiltPreview | null = $state(null);
	let frame: HTMLIFrameElement | null = $state(null);
	let t: ReturnType<typeof setTimeout> | null = null;

	function rebuild() {
		built = buildPreview(files, entry, built ?? undefined);
		for (const w of built.warnings) onLog('warn', w);
	}

	function schedule() {
		if (!auto) return;
		if (t) clearTimeout(t);
		t = setTimeout(rebuild, 450);
	}

	$effect(() => {
		void files;
		void entry;
		schedule();
	});

	onMount(() => {
		rebuild();
		const h = (e: MessageEvent) => {
			const d = e.data as { __nv?: number; kind?: string; args?: string[] } | null;
			if (!d || d.__nv !== 1) return;
			onLog(d.kind ?? 'log', (d.args ?? []).join(' '));
		};
		window.addEventListener('message', h);
		return () => window.removeEventListener('message', h);
	});

	onDestroy(() => {
		if (t) clearTimeout(t);
		if (built) for (const u of built.urls) try { URL.revokeObjectURL(u); } catch { /* noop */ }
	});

	export function refresh() { rebuild(); }
	export function openNewTab() { if (built) window.open(built.entryUrl, '_blank', 'noopener'); }
</script>

<div class="pvbar">
	<span>Preview: {entry}</span>
	<span class="url">{built?.entryUrl ?? ''}</span>
	<button class="iconbtn" onclick={refresh} title="Refresh"><Icon name="refresh" /></button>
	<button class="iconbtn" onclick={openNewTab} title="Open in new tab"><Icon name="link-external" /></button>
</div>
{#if built}
	<iframe class="pvframe" bind:this={frame} title="preview" src={built.entryUrl} sandbox="allow-scripts allow-same-origin allow-modals allow-forms allow-popups"></iframe>
{/if}
