<script lang="ts">
	import Icon from "#lib/components/Icon.svelte";
	import { ide } from "#lib/ide/ide.svelte.js";
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
			onclick={() => {
				ide.accountsMenu = !ide.accountsMenu;
				ide.settingsMenu = false;
			}}><Icon name="account" size={22} /></button
		>
		{#if ide.accountsMenu}
			<button class="veil" aria-label="Close accounts" onclick={() => (ide.accountsMenu = false)}
			></button>
			<div class="actmenu" role="menu">
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
						ide.accountsMenu = false;
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
			onclick={() => {
				ide.settingsMenu = !ide.settingsMenu;
				ide.accountsMenu = false;
			}}
			><Icon name="settings-gear" size={22} />
			{#if ide.warnCount > 0}<span class="badge">{ide.warnCount}</span>{/if}</button
		>
		{#if ide.settingsMenu}
			<button class="veil" aria-label="Close manage" onclick={() => (ide.settingsMenu = false)}
			></button>
			<div class="actmenu" role="menu">
				<div class="projmenu-head">Manage</div>
				<button
					onclick={() => {
						ide.sideView = "settings";
						ide.sidebar = true;
						ide.settingsMenu = false;
					}}><span>Settings</span><small>Ctrl+,</small></button
				>
				<button
					onclick={() => {
						ide.paletteQ = "> ";
						ide.palette = true;
						ide.settingsMenu = false;
					}}><span>Command Palette…</span><small>F1</small></button
				>
				<button
					onclick={() => {
						ide.toast("Color Theme: Dark Modern (default)");
						ide.settingsMenu = false;
					}}><span>Color Theme</span><small>Ctrl+K T</small></button
				>
				<button
					onclick={() => {
						ide.toast("Keyboard Shortcuts — F1 then type");
						ide.settingsMenu = false;
					}}><span>Keyboard Shortcuts</span><small>Ctrl+K S</small></button
				>
				<div class="sep"></div>
				<button
					onclick={() => {
						ide.toast("Neverview v2 — Monaco + virtual FS");
						ide.settingsMenu = false;
					}}><span>About</span></button
				>
			</div>
		{/if}
	</div>
	<button
		title="Notifications"
		aria-label="Notifications"
		onclick={() => (ide.notifCenter = !ide.notifCenter)}
		><Icon name="bell" size={22} />
		{#if ide.warnCount > 0}<span class="badge">{ide.warnCount}</span>{/if}
	</button>
</div>
