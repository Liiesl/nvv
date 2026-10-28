<script lang="ts">
	import Icon from "#lib/components/Icon.svelte";
	import { ide } from "#lib/ide/ide.svelte.js";
	import { languageOf } from "#lib/vfs.js";
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
			onclick={() => (ide.branchMenu = !ide.branchMenu)}
			><Icon name="git-branch" size={13} />
			{ide.currentBranch}{ide.isDirty ? "*" : ""}</button
		>
		{#if ide.branchMenu}
			<button class="veil up" aria-label="Close branches" onclick={() => (ide.branchMenu = false)}
			></button>
			<div class="sbmenu" role="menu">
				<div class="projmenu-head">Branch</div>
				{#each ide.branches as b}
					<button
						onclick={() => {
							ide.currentBranch = b;
							ide.branchMenu = false;
							ide.toast(`Switched to ${b} (mock)`);
						}}
						><span>{b}</span>{#if b === ide.currentBranch}<small>✓ current</small>{/if}</button
					>
				{/each}
				<div class="sep"></div>
				<button
					onclick={() => {
						ide.branchMenu = false;
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
				onclick={() => (ide.indentMenu = !ide.indentMenu)}
				>{ide.useSpaces ? "Spaces" : "Tabs"}: {ide.indentSize}</button
			>
			{#if ide.indentMenu}
				<button class="veil up" aria-label="Close indent" onclick={() => (ide.indentMenu = false)}
				></button>
				<div class="sbmenu" role="menu">
					<div class="projmenu-head">Indentation</div>
					<button
						onclick={() => {
							ide.useSpaces = true;
							ide.indentMenu = false;
						}}
						><span>Spaces</span>{#if ide.useSpaces}<small>✓</small>{/if}</button
					>
					<button
						onclick={() => {
							ide.useSpaces = false;
							ide.indentMenu = false;
						}}
						><span>Tabs</span>{#if !ide.useSpaces}<small>✓</small>{/if}</button
					>
					<div class="sep"></div>
					{#each [2, 4, 8] as n}
						<button
							onclick={() => {
								ide.indentSize = n;
								ide.indentMenu = false;
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
				onclick={() => (ide.encodingMenu = !ide.encodingMenu)}>{ide.encoding}</button
			>
			{#if ide.encodingMenu}
				<button
					class="veil up"
					aria-label="Close encoding"
					onclick={() => (ide.encodingMenu = false)}
				></button>
				<div class="sbmenu" role="menu">
					{#each ["UTF-8", "UTF-16 LE", "Western (Windows 1252)"] as e}
						<button
							onclick={() => {
								ide.encoding = e === "UTF-8" ? "UTF-8" : "UTF-8";
								ide.encodingMenu = false;
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
				onclick={() => (ide.eolMenu = !ide.eolMenu)}>{ide.eol}</button
			>
			{#if ide.eolMenu}
				<button class="veil up" aria-label="Close eol" onclick={() => (ide.eolMenu = false)}
				></button>
				<div class="sbmenu" role="menu">
					<button
						onclick={() => {
							ide.eol = "LF";
							ide.eolMenu = false;
						}}
						><span>LF</span>{#if ide.eol === "LF"}<small>✓</small>{/if}</button
					>
					<button
						onclick={() => {
							ide.eol = "CRLF";
							ide.eolMenu = false;
							ide.toast("CRLF is a mock — kept LF");
							ide.eol = "LF";
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
			onclick={() => (ide.notifCenter = !ide.notifCenter)}><Icon name="bell" size={13} /></button
		>
	</span>
</div>
