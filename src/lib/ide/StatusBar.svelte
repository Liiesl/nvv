<script lang="ts">
	import Icon from "#lib/components/Icon.svelte";
	import { ide } from "#lib/ide/ide.svelte.js";
	import { languageOf } from "#lib/vfs.js";
	import { menuKeys, watchOutside } from "#lib/ide/menus/menu.js";

	let branchBtnEl: HTMLElement | null = $state(null);
	let branchMenuEl: HTMLElement | null = $state(null);
	let indentBtnEl: HTMLElement | null = $state(null);
	let indentMenuEl: HTMLElement | null = $state(null);
	let encodingBtnEl: HTMLElement | null = $state(null);
	let encodingMenuEl: HTMLElement | null = $state(null);
	let eolBtnEl: HTMLElement | null = $state(null);
	let eolMenuEl: HTMLElement | null = $state(null);

	function toggleExclusive(which: "branch" | "indent" | "encoding" | "eol") {
		const cur =
			which === "branch"
				? ide.branchMenu
				: which === "indent"
					? ide.indentMenu
					: which === "encoding"
						? ide.encodingMenu
						: ide.eolMenu;
		ide.closeAllMenus();
		if (!cur) {
			if (which === "branch") ide.branchMenu = true;
			else if (which === "indent") ide.indentMenu = true;
			else if (which === "encoding") ide.encodingMenu = true;
			else ide.eolMenu = true;
		}
	}

	function closeMenus() {
		ide.closeAllMenus();
	}

	$effect(() => {
		if (!ide.branchMenu) return;
		return watchOutside(() => [branchMenuEl, branchBtnEl], closeMenus);
	});
	$effect(() => {
		if (!ide.indentMenu) return;
		return watchOutside(() => [indentMenuEl, indentBtnEl], closeMenus);
	});
	$effect(() => {
		if (!ide.encodingMenu) return;
		return watchOutside(() => [encodingMenuEl, encodingBtnEl], closeMenus);
	});
	$effect(() => {
		if (!ide.eolMenu) return;
		return watchOutside(() => [eolMenuEl, eolBtnEl], closeMenus);
	});
</script>

<div class="statusbar">
	<button
		type="button"
		class="it remote"
		title="Remote — local workspace (mock)"
		onclick={() => ide.toast("Remote: local workspace")}
		><span class="remote-glyph">{"<>"}</span></button
	>
	<div class="sbwrap">
		<button
			type="button"
			class="it"
			title="Branch — switch branch"
			aria-haspopup="menu"
			aria-expanded={ide.branchMenu}
			bind:this={branchBtnEl}
			onclick={() => toggleExclusive("branch")}
			><Icon name="git-branch" size={13} />
			{ide.currentBranch}{ide.isDirty ? "*" : ""}</button
		>
		{#if ide.branchMenu}
			<div
				class="sbmenu"
				role="menu"
				tabindex="-1"
				bind:this={branchMenuEl}
				onkeydown={(e) => menuKeys(e, e.currentTarget as HTMLElement, closeMenus)}
				oncontextmenu={(e) => e.preventDefault()}
			>
				<div class="projmenu-head">Branch</div>
				{#each ide.branches as b}
					<button
						onclick={() => {
							ide.currentBranch = b;
							closeMenus();
							ide.toast(`Switched to ${b} (mock)`);
						}}
						><span>{b}</span>{#if b === ide.currentBranch}<small>✓ current</small>{/if}</button
					>
				{/each}
				<div class="sep"></div>
				<button
					onclick={() => {
						closeMenus();
						ide.toast("New branch is a mock");
					}}><span>+ New Branch…</span></button
				>
			</div>
		{/if}
	</div>
	<button
		type="button"
		class="it"
		title="Sync (mock)"
		onclick={() => ide.toast("Synced (mock) — files persist to localStorage")}
		><Icon name="sync" size={13} /> 0↓ 1↑</button
	>
	<button
		type="button"
		class="it"
		title="Errors and warnings — open Problems"
		onclick={() => {
			ide.panelTab = "problems";
			ide.showPanel = true;
		}}
		><Icon name="error" size={13} />
		{ide.errCount}
		<Icon name="warning" size={13} />
		{ide.warnCount}</button
	>
	<button
		type="button"
		class="it hide-sm"
		title="{ide.fileCount} files in workspace"
		onclick={() => {
			ide.sideView = "explorer";
			ide.sidebar = true;
		}}
		><Icon name="files" size={13} />
		{ide.fileCount} files</button
	>
	<span class="right">
		<button
			type="button"
			class="it"
			title="Go to line"
			onclick={() => {
				ide.gotoDraft = String(ide.line);
				ide.gotoOpen = true;
			}}>Ln {ide.line}, Col {ide.col}</button
		>
		<div class="sbwrap">
			<button
				type="button"
				class="it"
				title="Select Indentation"
				aria-haspopup="menu"
				aria-expanded={ide.indentMenu}
				bind:this={indentBtnEl}
				onclick={() => toggleExclusive("indent")}
				>{ide.useSpaces ? "Spaces" : "Tabs"}: {ide.indentSize}</button
			>
			{#if ide.indentMenu}
				<div
					class="sbmenu align-right"
					role="menu"
					tabindex="-1"
					bind:this={indentMenuEl}
					onkeydown={(e) => menuKeys(e, e.currentTarget as HTMLElement, closeMenus)}
					oncontextmenu={(e) => e.preventDefault()}
				>
					<div class="projmenu-head">Indentation</div>
					<button
						onclick={() => {
							ide.useSpaces = true;
							closeMenus();
						}}
						><span>Spaces</span>{#if ide.useSpaces}<small>✓</small>{/if}</button
					>
					<button
						onclick={() => {
							ide.useSpaces = false;
							closeMenus();
						}}
						><span>Tabs</span>{#if !ide.useSpaces}<small>✓</small>{/if}</button
					>
					<div class="sep"></div>
					{#each [2, 4, 8] as n}
						<button
							onclick={() => {
								ide.indentSize = n;
								closeMenus();
							}}
							><span>{n}</span>{#if ide.indentSize === n}<small>✓</small>{/if}</button
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
				aria-haspopup="menu"
				aria-expanded={ide.encodingMenu}
				bind:this={encodingBtnEl}
				onclick={() => toggleExclusive("encoding")}>{ide.encoding}</button
			>
			{#if ide.encodingMenu}
				<div
					class="sbmenu align-right"
					role="menu"
					tabindex="-1"
					bind:this={encodingMenuEl}
					onkeydown={(e) => menuKeys(e, e.currentTarget as HTMLElement, closeMenus)}
					oncontextmenu={(e) => e.preventDefault()}
				>
					{#each ["UTF-8", "UTF-16 LE", "Western (Windows 1252)"] as e}
						<button
							onclick={() => {
								ide.encoding = e === "UTF-8" ? "UTF-8" : "UTF-8";
								closeMenus();
								ide.toast(e === "UTF-8" ? "Encoding: UTF-8" : `${e} is a mock — kept UTF-8`);
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
				aria-haspopup="menu"
				aria-expanded={ide.eolMenu}
				bind:this={eolBtnEl}
				onclick={() => toggleExclusive("eol")}>{ide.eol}</button
			>
			{#if ide.eolMenu}
				<div
					class="sbmenu align-right"
					role="menu"
					tabindex="-1"
					bind:this={eolMenuEl}
					onkeydown={(e) => menuKeys(e, e.currentTarget as HTMLElement, closeMenus)}
					oncontextmenu={(e) => e.preventDefault()}
				>
					<button
						onclick={() => {
							ide.eol = "LF";
							closeMenus();
						}}
						><span>LF</span>{#if ide.eol === "LF"}<small>✓</small>{/if}</button
					>
					<button
						onclick={() => {
							ide.eol = "LF";
							closeMenus();
							ide.toast("CRLF is a mock — kept LF");
						}}><span>CRLF</span></button
					>
				</div>
			{/if}
		</div>
		<button
			type="button"
			class="it"
			title="Change language mode"
			onclick={() => (ide.langPick = true)}>{ide.active ? languageOf(ide.active) : "--"}</button
		>
		<button
			type="button"
			class="it"
			title="Toggle preview"
			onclick={() => (ide.showPreview = !ide.showPreview)}
			><Icon name="browser" size={13} /> Go Live</button
		>
		<button
			type="button"
			class="it"
			title="Notifications — show notification center"
			aria-haspopup="dialog"
			aria-expanded={ide.notifCenter}
			onclick={() => ide.openOnly(() => (ide.notifCenter = true))}
			><Icon name="bell" size={13} /></button
		>
	</span>
</div>
