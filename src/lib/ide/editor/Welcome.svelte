<script lang="ts">
	import FileIcon from "#lib/components/FileIcon.svelte";
	import { ide } from "#lib/ide/ide.svelte.js";
	import { basename } from "#lib/vfs.js";
</script>

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
			<p>Editing evolved — {ide.activeProjectName}</p>
		</div>
	</div>
	<div class="wcols">
		<div class="wcol">
			<h2>Start</h2>
			<button onclick={() => ide.doCreateFile("/", "untitled.html")}
				><span class="wic">＋</span> New File…</button
			>
			<button onclick={() => ide.openNewProjectDialog()}
				><span class="wic">＋</span> New Project…</button
			>
			<button
				onclick={() => {
					ide.paletteQ = "";
					ide.palette = true;
				}}>Open File… <small>Ctrl+P</small></button
			>
			<button
				onclick={() => {
					ide.panelTab = "terminal";
					ide.showPanel = true;
				}}>Open Terminal <small>Ctrl+`</small></button
			>
		</div>
		<div class="wcol">
			<h2>Recent</h2>
			{#each ide.tabs.slice(-5).reverse() as t}
				<button onclick={() => ide.openFile(t)}
					><FileIcon name={basename(t)} />
					{t}</button
				>
			{/each}
			{#if ide.tabs.length === 0}<p>No recent files. Files you open appear here.</p>{/if}
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
