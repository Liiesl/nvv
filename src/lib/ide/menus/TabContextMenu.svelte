<script lang="ts">
	import { ide } from "#lib/ide/ide.svelte.js";
	import { openFile } from "#lib/vfs.js";
	import MenuShell from "./MenuShell.svelte";
</script>

{#if ide.tabCtx}
	<MenuShell x={ide.tabCtx.x} y={ide.tabCtx.y} label="Tab menu" onClose={() => (ide.tabCtx = null)}>
		{#if !ide.tabCtx.isPreview && ide.tabCtx.path}
			<button
				onclick={() => {
					ide.openFile(ide.tabCtx!.path, ide.tabCtx!.groupId);
					ide.tabCtx = null;
				}}><span>Open</span></button
			>
			<div class="sep"></div>
		{/if}
		<button
			onclick={() => {
				const ctx = ide.tabCtx!;
				const g = ide.groups[ctx.groupId];
				if (g) {
					const idx = ctx.isPreview
						? g.tabs.findIndex((t) => t.kind === "preview")
						: g.tabs.findIndex((t) => t.kind === "file" && t.path === ctx.path);
					if (idx >= 0) ide.closeTabInGroup(ctx.groupId, idx);
				}
				ide.tabCtx = null;
			}}><span>Close</span><small>Ctrl+W</small></button
		>
		{#if !ide.tabCtx.isPreview && ide.tabCtx.path}
			<button
				onclick={() => {
					const ctx = ide.tabCtx!;
					const g = ide.groups[ctx.groupId];
					if (g) {
						// Close others in this group, keep the target file.
						for (let i = g.tabs.length - 1; i >= 0; i--) {
							const t = g.tabs[i];
							if (t.kind === "file" && t.path !== ctx.path) ide.closeTabInGroup(ctx.groupId, i);
							if (t.kind === "preview") ide.closeTabInGroup(ctx.groupId, i);
						}
					}
					ide.tabCtx = null;
					ide.toast("Closed others in group");
				}}><span>Close Others in Group</span></button
			>
			<button
				onclick={() => {
					const ctx = ide.tabCtx!;
					const g = ide.groups[ctx.groupId];
					if (g) {
						const idx = g.tabs.findIndex((t) => t.kind === "file" && t.path === ctx.path);
						if (idx >= 0) {
							for (let i = g.tabs.length - 1; i > idx; i--) ide.closeTabInGroup(ctx.groupId, i);
						}
					}
					ide.tabCtx = null;
				}}><span>Close to the Right</span></button
			>
		{/if}
		<button
			onclick={() => {
				const ctx = ide.tabCtx!;
				// Close all tabs in this group.
				const g = ide.groups[ctx.groupId];
				if (g) {
					for (let i = g.tabs.length - 1; i >= 0; i--) ide.closeTabInGroup(ctx.groupId, i);
				}
				ide.tabCtx = null;
			}}><span>Close All in Group</span></button
		>
		<div class="sep"></div>
		<button
			onclick={() => {
				ide.splitGroup(ide.tabCtx!.groupId, "row");
				ide.tabCtx = null;
			}}><span>Split Right</span><small>Ctrl+\</small></button
		>
		<button
			onclick={() => {
				ide.splitGroup(ide.tabCtx!.groupId, "col");
				ide.tabCtx = null;
			}}><span>Split Down</span></button
		>
		<button
			onclick={() => {
				ide.toggleMaximize(ide.tabCtx!.groupId);
				ide.tabCtx = null;
			}}><span>{ide.maximizedGroupId ? "Exit Maximized Group" : "Maximize Group"}</span></button
		>
		<div class="sep"></div>
		{#if !ide.tabCtx.isPreview && ide.tabCtx.path}
			<button
				onclick={() => {
					try {
						navigator.clipboard.writeText(ide.tabCtx!.path);
						ide.toast("Path copied");
					} catch {
						/* noop */
					}
					ide.tabCtx = null;
				}}><span>Copy Path</span><small>Ctrl+C</small></button
			>
			<button
				onclick={() => {
					const p = ide.tabCtx!.path;
					ide.openFile(p, ide.tabCtx!.groupId);
					ide.sideView = "explorer";
					ide.sidebar = true;
					ide.tabCtx = null;
					ide.toast("Revealed in Explorer (mock)");
				}}><span>Reveal in Explorer</span></button
			>
		{:else}
			<button
				onclick={() => {
					ide.previewRef?.refresh();
					ide.tabCtx = null;
					ide.toast("Preview refreshed");
				}}><span>Refresh Preview</span><small>F5</small></button
			>
			<button
				onclick={() => {
					ide.previewRef?.openNewTab();
					ide.tabCtx = null;
				}}><span>Open Preview in New Tab</span></button
			>
		{/if}
	</MenuShell>
{/if}
