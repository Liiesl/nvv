<script lang="ts">
	import { browser } from '$app/env';
	import { files, activePath, openTabs, dirtyPaths, openFile, closeTab, createFile, createFolder, renamePath, removePath, writeFile, resetWorkspace, join, basename, languageOf } from '#lib/vfs.js';
	import type { VNode } from '#lib/vfs.js';
	import Monaco from '#lib/components/Monaco.svelte';
	import Preview from '#lib/components/Preview.svelte';
	import Explorer from '#lib/components/Explorer.svelte';

	let filesSnap = $state<Record<string, VNode>>({});
	let active = $state('/index.html');
	let tabs = $state<string[]>([]);
	let dirty = $state<Set<string>>(new Set());

	let sideView = $state<'explorer' | 'search' | 'settings'>('explorer');
	let sidebar = $state(true);
	let showPreview = $state(true);
	let autoReload = $state(true);
	let showPanel = $state(true);
	let panelTab = $state<'console' | 'problems'>('console');
	let logs = $state<{ kind: string; text: string }[]>([]);
	let entry = $state('/index.html');
	let query = $state('');
	let palette = $state(false);
	let paletteQ = $state('');
	let line = $state(1);
	let col = $state(1);
	let editorPct = $state(55);
	let dragging = $state(false);
	let previewRef = $state<{ refresh: () => void; openNewTab: () => void } | null>(null);

	$effect(() => {
		const u1 = files.subscribe((v: Record<string, VNode>) => (filesSnap = v));
		const u2 = activePath.subscribe((v: string) => (active = v));
		const u3 = openTabs.subscribe((v: string[]) => (tabs = v));
		const u4 = dirtyPaths.subscribe((v: Set<string>) => (dirty = v));
		return () => { u1(); u2(); u3(); u4(); };
	});

	const content = $derived(filesSnap[active]?.content ?? '');
	const htmlFiles = $derived(Object.keys(filesSnap).filter((p) => p.endsWith('.html')).sort());
	const problems = $derived(
		Object.entries(filesSnap)
			.filter(([, n]) => n.type === 'file' && !n.content.trim())
			.map(([p]) => `Empty file: ${p}`)
	);
	const searchHits = $derived(
		!query.trim()
			? []
			: Object.entries(filesSnap)
					.filter(([, n]) => n.type === 'file' && n.content.toLowerCase().includes(query.toLowerCase()))
					.slice(0, 50)
	);
	const paletteFiles = $derived(
		Object.keys(filesSnap)
			.filter((p) => filesSnap[p].type === 'file' && p.toLowerCase().includes(paletteQ.toLowerCase()))
			.slice(0, 20)
	);

	function onEdit(v: string) {
		if (v !== filesSnap[active]?.content) writeFile(active, v);
	}
	function autofocus(el: HTMLInputElement) {
		el.focus();
	}
	function activateOnKey(e: KeyboardEvent, fn: () => void) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			fn();
		}
	}
	function onLog(kind: string, text: string) {
		logs = [...logs.slice(-199), { kind, text }];
		if (kind === 'error') panelTab = 'console';
	}
	function doCreateFile(dir: string, name: string) {
		createFile(join(dir, name), name.endsWith('.html') ? '<!-- new -->\n' : '');
	}
	function doCreateFolder(dir: string, name: string) {
		createFolder(join(dir, name));
	}
	function sashDown(e: MouseEvent) {
		dragging = true;
		e.preventDefault();
		const move = (ev: MouseEvent) => {
			if (!dragging) return;
			const el = document.querySelector('.split') as HTMLElement | null;
			if (!el) return;
			const r = el.getBoundingClientRect();
			editorPct = Math.min(85, Math.max(15, ((ev.clientX - r.left) / r.width) * 100));
		};
		const up = () => { dragging = false; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
		window.addEventListener('mousemove', move);
		window.addEventListener('mouseup', up);
	}

	if (browser) {
		window.addEventListener('keydown', (e) => {
			const mod = e.ctrlKey || e.metaKey;
			if (mod && e.key.toLowerCase() === 'p' && !e.shiftKey) { e.preventDefault(); paletteQ = ''; palette = true; }
			if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); sidebar = !sidebar; }
			if (mod && e.key.toLowerCase() === 'j') { e.preventDefault(); showPanel = !showPanel; }
			if (e.key === 'Escape') palette = false;
		});
	}
</script>

<svelte:head>
	<title>Neverview v2 — VSCode-like HTML preview</title>
	<meta name="description" content="Client-side VSCode-like HTML preview with CDN Monaco and virtual file system." />
</svelte:head>

{#if browser}
<div class="ide">
	<div class="titlebar">
		<div class="dots"><span style="background:#ff5f57"></span><span style="background:#febc2e"></span><span style="background:#28c840"></span></div>
		<div class="menu"><span>File</span><span>Edit</span><span>View</span><span>Run</span><span>Help</span></div>
		<div class="ttl">Neverview v2 — {active || 'no file'} — CDN Monaco + virtual FS</div>
		<div class="actions">
			<button class="btn small ghost" onclick={() => { previewRef?.refresh(); }}>Run ▶</button>
			<button class="btn small" onclick={() => previewRef?.openNewTab()}>Open preview ↗</button>
		</div>
	</div>

	<div class="workbench">
		<div class="activity">
			<button class:on={sideView === 'explorer'} title="Explorer (Ctrl+Shift+E)" onclick={() => { sideView = 'explorer'; sidebar = true; }}>📁</button>
			<button class:on={sideView === 'search'} title="Search (Ctrl+Shift+F)" onclick={() => { sideView = 'search'; sidebar = true; }}>🔍</button>
			<button title="Toggle preview" onclick={() => (showPreview = !showPreview)}>🌐</button>
			<button class:on={sideView === 'settings'} title="Settings" onclick={() => { sideView = 'settings'; sidebar = true; }}>⚙️</button>
			<div class="sp"></div>
			<button title="Command palette (Ctrl+P)" onclick={() => (palette = true)}>⌘</button>
		</div>

		{#if sidebar}
		<div class="sidebar">
			<div class="side-head"><span>{sideView.toUpperCase()}</span>
				<span class="icons">
					{#if sideView === 'explorer'}
						<button class="iconbtn" title="New file" onclick={() => doCreateFile('/', 'untitled.html')}>＋</button>
						<button class="iconbtn" title="Reset workspace" onclick={() => { if (confirm('Reset workspace to seed files?')) resetWorkspace(); }}>⟲</button>
					{/if}
				</span>
			</div>
			<div class="side-body">
				{#if sideView === 'explorer'}
					<div class="sec-title">▾ Workspace (localStorage)</div>
					<Explorer files={filesSnap} active={active}
						onOpen={openFile}
						onCreateFile={doCreateFile} onCreateFolder={doCreateFolder}
						onRename={renamePath} onDelete={removePath} />
				{:else if sideView === 'search'}
					<div class="searchbox"><input placeholder="Search files…" bind:value={query} /></div>
					{#each searchHits as [p, n]}
						<button type="button" class="sres" onclick={() => openFile(p)}><span>{p}</span><small>{n.content.slice(0, 80)}</small></button>
					{/each}
					{#if query && searchHits.length === 0}<div class="sres"><small>No results</small></div>{/if}
				{:else}
					<div class="searchbox">
						<label><input type="checkbox" bind:checked={autoReload} /> Auto-reload preview</label>
						<label><input type="checkbox" bind:checked={showPreview} /> Show preview</label>
						<label><input type="checkbox" bind:checked={showPanel} /> Show panel</label>
						<label>Entry HTML
							<select class="textin" bind:value={entry}>
								{#each htmlFiles as h}<option value={h}>{h}</option>{/each}
							</select>
						</label>
						<button class="btn ghost" onclick={() => { localStorage.removeItem('neverview:vfs:v1'); location.reload(); }}>Clear saved files</button>
					</div>
				{/if}
			</div>
		</div>
		{/if}

		<div class="main">
			<div class="tabs" role="tablist">
				{#each tabs as t}
					<div class="tab" class:on={t === active} role="tab" tabindex="0" aria-selected={t === active}
						onclick={() => openFile(t)} onkeydown={(e) => activateOnKey(e, () => openFile(t))}>
						<span>{dirty.has(t) ? '●' : ''} {basename(t)}</span>
						<button class="x" onclick={(e) => { e.stopPropagation(); closeTab(t); }}>✕</button>
					</div>
				{/each}
			</div>
			{#if active}
				<div class="crumbs"><span>{active.split('/').slice(0, -1).join(' › ') || '/'}</span><b>{basename(active)}</b><span style="margin-left:auto">{languageOf(active)} · Ln {line}, Col {col}</span></div>
			{/if}
			<div class="split">
				<div class="editorpane" style={`flex-basis:${editorPct}%`}>
					{#if active && filesSnap[active]}
						<Monaco path={active} content={content} onChange={onEdit} onCursor={(l: number, c: number) => { line = l; col = c; }} />
					{:else}
						<div class="empty"><h2>No file open</h2><p><kbd>Ctrl+P</kbd> to open a file, or create one in Explorer.</p></div>
					{/if}
				</div>
				<div class="sash" class:drag={dragging} role="slider" tabindex="0" aria-orientation="vertical"
					aria-label="Resize editor and preview" aria-valuenow={Math.round(editorPct)} aria-valuemin={15} aria-valuemax={85}
					onmousedown={sashDown}
					onkeydown={(e) => { if (e.key === 'ArrowLeft') editorPct = Math.max(15, editorPct - 2); if (e.key === 'ArrowRight') editorPct = Math.min(85, editorPct + 2); }}></div>
				{#if showPreview}
				<div class="previewpane" style={`flex-basis:${100 - editorPct}%`}>
					<Preview files={filesSnap} entry={entry} auto={autoReload} onLog={onLog} bind:this={previewRef} />
				</div>
				{/if}
			</div>
			{#if showPanel}
			<div class="panel">
				<div class="paneltabs">
					<button class:on={panelTab === 'console'} onclick={() => (panelTab = 'console')}>Console ({logs.length})</button>
					<button class:on={panelTab === 'problems'} onclick={() => (panelTab = 'problems')}>Problems ({problems.length})</button>
					<span style="flex:1"></span>
					<button onclick={() => (logs = [])}>Clear</button>
					<button onclick={() => (showPanel = false)}>✕</button>
				</div>
				<div class="panelbody">
					{#if panelTab === 'console'}
						{#each logs as l}<div class="logline {l.kind}">[{l.kind}] {l.text}</div>{/each}
						{#if logs.length === 0}<div class="logline info">console output from the preview iframe appears here.</div>{/if}
					{:else}
						{#each problems as p}<div class="logline warn">{p}</div>{/each}
						{#if problems.length === 0}<div class="logline info">No problems.</div>{/if}
					{/if}
				</div>
			</div>
			{/if}
		</div>
	</div>

	<div class="statusbar">
		<span class="it">🌿 main*</span>
		<button type="button" class="it" onclick={() => { if (confirm('Reset workspace?')) resetWorkspace(); }}>⟲ {Object.keys(filesSnap).length} files</button>
		<span class="right">
			<span class="it">{active ? languageOf(active) : '--'}</span>
			<span class="it">Ln {line}, Col {col}</span>
			<span class="it">CDN monaco {`0.52.2`}</span>
			<span class="it">CF worker ✓</span>
		</span>
	</div>
</div>
{/if}

{#if palette}
<div class="palette-veil" role="button" tabindex="0" aria-label="Close command palette"
	onclick={() => (palette = false)} onkeydown={(e) => { if (e.key === 'Escape') palette = false; }}>
	<div class="palette" role="dialog" aria-label="Command palette" tabindex="0"
		onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
		<input use:autofocus placeholder="> Type file name or command" bind:value={paletteQ}
			onkeydown={(e) => { if (e.key === 'Enter' && paletteFiles[0]) { openFile(paletteFiles[0]); palette = false; } }} />
		<div class="opts">
			{#each paletteFiles as p}<button type="button" class="opt" onclick={() => { openFile(p); palette = false; }}>📄 {p}<small>file</small></button>{/each}
			<button type="button" class="opt" onclick={() => { showPreview = !showPreview; palette = false; }}>🌐 Toggle preview<small>cmd</small></button>
			<button type="button" class="opt" onclick={() => { previewRef?.openNewTab(); palette = false; }}>↗ Open preview in new tab<small>cmd</small></button>
			<button type="button" class="opt" onclick={() => { if (confirm('Reset?')) resetWorkspace(); palette = false; }}>⟲ Reset workspace<small>cmd</small></button>
		</div>
	</div>
</div>
{/if}
