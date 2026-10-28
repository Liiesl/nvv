<script lang="ts">
	import Icon from "#lib/components/Icon.svelte";
	import { ide } from "#lib/ide/ide.svelte.js";
	import { menuKeys, watchOutside } from "#lib/ide/menus/menu.js";

	let accountsBtnEl: HTMLElement | null = $state(null);
	let accountsMenuEl: HTMLElement | null = $state(null);
	let settingsBtnEl: HTMLElement | null = $state(null);
	let settingsMenuEl: HTMLElement | null = $state(null);

	function toggleExclusive(which: "accounts" | "settings") {
		const cur = which === "accounts" ? ide.accountsMenu : ide.settingsMenu;
		ide.closeAllMenus();
		if (!cur) {
			if (which === "accounts") ide.accountsMenu = true;
			else ide.settingsMenu = true;
		}
	}

	$effect(() => {
		if (!ide.accountsMenu) return;
		return watchOutside(
			() => [accountsMenuEl, accountsBtnEl],
			() => ide.closeAllMenus(),
		);
	});
	$effect(() => {
		if (!ide.settingsMenu) return;
		return watchOutside(
			() => [settingsMenuEl, settingsBtnEl],
			() => ide.closeAllMenus(),
		);
	});
</script>

<div class="activity">
	<button
		class:on={ide.sideView === "explorer"}
		title="Explorer (Ctrl+Shift+E)"
		aria-label="Explorer"
		onclick={() => {
			ide.sideView = "explorer";
			ide.sidebar = true;
		}}><Icon name="files" size={22} /></button
	>
	<button
		class:on={ide.sideView === "search"}
		title="Search (Ctrl+Shift+F)"
		aria-label="Search"
		onclick={() => {
			ide.sideView = "search";
			ide.sidebar = true;
		}}
		><Icon name="search" size={22} />
		{#if ide.query.trim()}<span class="badge">!</span>{/if}
	</button>
	<button
		class:on={ide.sideView === "scm"}
		title="Source Control (Ctrl+Shift+G)"
		aria-label="Source Control"
		onclick={() => {
			ide.sideView = "scm";
			ide.sidebar = true;
		}}
		><Icon name="git-branch" size={22} />
		{#if ide.dirty.size > 0}<span class="badge">{ide.dirty.size}</span>{/if}
	</button>
	<button
		class:on={ide.sideView === "debug"}
		title="Run and Debug"
		aria-label="Run and Debug"
		onclick={() => {
			ide.sideView = "debug";
			ide.sidebar = true;
		}}
		><Icon name="debug" size={22} />
		{#if ide.errCount > 0}<span class="badge err">{ide.errCount}</span>{/if}
	</button>
	<button
		class:on={ide.sideView === "ext"}
		title="Extensions"
		aria-label="Extensions"
		onclick={() => {
			ide.sideView = "ext";
			ide.sidebar = true;
		}}><Icon name="extensions" size={22} /></button
	>
	<button
		class:on={ide.showPreview}
		title="Toggle preview"
		aria-label="Toggle preview"
		onclick={() => (ide.showPreview = !ide.showPreview)}><Icon name="browser" size={22} /></button
	>
	<div class="sp"></div>
	<div class="actwrap">
		<button
			title="Accounts"
			aria-label="Accounts"
			aria-haspopup="menu"
			aria-expanded={ide.accountsMenu}
			bind:this={accountsBtnEl}
			onclick={() => toggleExclusive("accounts")}><Icon name="account" size={22} /></button
		>
		{#if ide.accountsMenu}
			<div
				class="actmenu"
				role="menu"
				tabindex="-1"
				bind:this={accountsMenuEl}
				onkeydown={(e) => menuKeys(e, e.currentTarget as HTMLElement, () => ide.closeAllMenus())}
				oncontextmenu={(e) => e.preventDefault()}
			>
				<div class="projmenu-head">Accounts</div>
				<div class="actuser">
					<Icon name="account" size={28} /><span
						>local-user<br /><small>Signed in locally — no account needed</small></span
					>
				</div>
				<div class="sep"></div>
				<button
					onclick={() => {
						ide.toast("No other accounts");
						ide.closeAllMenus();
					}}><span>Manage trusted extensions</span></button
				>
			</div>
		{/if}
	</div>
	<div class="actwrap">
		<button
			class:on={ide.sideView === "settings"}
			title="Manage"
			aria-label="Manage"
			aria-haspopup="menu"
			aria-expanded={ide.settingsMenu}
			bind:this={settingsBtnEl}
			onclick={() => toggleExclusive("settings")}
			><Icon name="settings-gear" size={22} />
			{#if ide.warnCount > 0}<span class="badge">{ide.warnCount}</span>{/if}</button
		>
		{#if ide.settingsMenu}
			<div
				class="actmenu"
				role="menu"
				tabindex="-1"
				bind:this={settingsMenuEl}
				onkeydown={(e) => menuKeys(e, e.currentTarget as HTMLElement, () => ide.closeAllMenus())}
				oncontextmenu={(e) => e.preventDefault()}
			>
				<div class="projmenu-head">Manage</div>
				<button
					onclick={() => {
						ide.sideView = "settings";
						ide.sidebar = true;
						ide.closeAllMenus();
					}}><span>Settings</span><small>Ctrl+,</small></button
				>
				<button
					onclick={() => {
						ide.paletteQ = "> ";
						ide.palette = true;
						ide.closeAllMenus();
					}}><span>Command Palette…</span><small>F1</small></button
				>
				<button
					onclick={() => {
						ide.toast("Color Theme: Dark Modern (default)");
						ide.closeAllMenus();
					}}><span>Color Theme</span><small>Ctrl+K T</small></button
				>
				<button
					onclick={() => {
						ide.toast("Keyboard Shortcuts — F1 then type");
						ide.closeAllMenus();
					}}><span>Keyboard Shortcuts</span><small>Ctrl+K S</small></button
				>
				<div class="sep"></div>
				<button
					onclick={() => {
						ide.toast("Neverview v2 — Monaco + virtual FS");
						ide.closeAllMenus();
					}}><span>About</span></button
				>
			</div>
		{/if}
	</div>
	<button
		title="Notifications"
		aria-label="Notifications"
		aria-haspopup="dialog"
		aria-expanded={ide.notifCenter}
		onclick={() => ide.openOnly(() => (ide.notifCenter = true))}
		><Icon name="bell" size={22} />
		{#if ide.warnCount > 0}<span class="badge">{ide.warnCount}</span>{/if}
	</button>
</div>
