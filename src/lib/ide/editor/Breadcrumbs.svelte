<script lang="ts">
	import FileIcon from "#lib/components/FileIcon.svelte";
	import Icon from "#lib/components/Icon.svelte";
	import { ide } from "#lib/ide/ide.svelte.js";
	import { languageOf } from "#lib/vfs.js";
	import { menuKeys, watchOutside } from "#lib/ide/menus/menu.js";

	let symBtnEl: HTMLElement | null = $state(null);
	let symMenuEl: HTMLElement | null = $state(null);

	$effect(() => {
		if (!ide.crumbSymMenu) return;
		return watchOutside(
			() => [symMenuEl, symBtnEl],
			() => ide.closeAllMenus(),
		);
	});
</script>

{#if ide.active}
	<div class="crumbs">
		{#each ide.crumbs as c, i}
			<button
				type="button"
				class="crumb"
				class:file={c.isFile}
				title={c.path}
				onclick={() => {
					if (c.path === "/") {
						ide.sideView = "explorer";
						ide.sidebar = true;
					} else if (ide.filesSnap[c.path]?.type === "file") ide.openFile(c.path);
					else {
						ide.sideView = "explorer";
						ide.sidebar = true;
					}
				}}
				>{#if c.isFile}<FileIcon name={c.label} />{/if}{c.label}</button
			>
			{#if i < ide.crumbs.length - 1}<Icon name="chevron-right" size={12} />{/if}
		{/each}
		{#if ide.outline.length > 0}
			<span class="symwrap">
				<Icon name="chevron-right" size={12} />
				<button
					type="button"
					class="crumb sym"
					title="Go to symbol in file"
					aria-haspopup="menu"
					aria-expanded={ide.crumbSymMenu}
					bind:this={symBtnEl}
					onclick={() => ide.openOnly(() => (ide.crumbSymMenu = true))}
					><Icon name="target" size={13} />
					{ide.outline[0]?.label ?? ""}
					<Icon name="chevron-down" size={12} /></button
				>
				{#if ide.crumbSymMenu}
					<div
						class="symmenu"
						role="menu"
						tabindex="-1"
						bind:this={symMenuEl}
						onkeydown={(e) =>
							menuKeys(e, e.currentTarget as HTMLElement, () => ide.closeAllMenus())}
						oncontextmenu={(e) => e.preventDefault()}
					>
						{#each ide.outline.slice(0, 20) as o}
							<button
								onclick={() => {
									ide.revealLine = 0;
									requestAnimationFrame(() => (ide.revealLine = o.line));
									ide.closeAllMenus();
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
				onclick={() => (ide.langPick = true)}>{languageOf(ide.active)}</button
			>
			<span>·</span>
			<button
				type="button"
				class="mini-crumb"
				title="Go to Line/Column"
				onclick={() => {
					ide.gotoDraft = String(ide.cursorFor(ide.activeGroupId).line);
					ide.gotoOpen = true;
				}}>Ln {ide.line}, Col {ide.col}</button
			>
		</span>
	</div>
{/if}
