<script lang="ts">
	import Icon from "#lib/components/Icon.svelte";
	import { ide } from "#lib/ide/ide.svelte.js";

	function panelSashDown(e: PointerEvent) {
		ide.panelDragging = true;
		ide.panelMax = false;
		e.preventDefault();
		ide.setBodyDragCursor("row");
		try {
			(e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
		} catch {
			/* noop */
		}
	}

	function panelSashMove(e: PointerEvent) {
		if (!ide.panelDragging) return;
		e.preventDefault();
		ide.movePanel(e.clientY);
	}

	function panelSashUp(e?: PointerEvent) {
		if (!ide.panelDragging) return;
		ide.panelDragging = false;
		ide.setBodyDragCursor("");
		try {
			const t = e?.currentTarget as HTMLElement | undefined;
			if (e && t?.hasPointerCapture?.(e.pointerId)) t?.releasePointerCapture?.(e.pointerId);
		} catch {
			/* noop */
		}
	}
</script>

{#if ide.showPanel}
	<div
		class="psash"
		role="slider"
		tabindex="0"
		aria-label="Resize panel"
		aria-orientation="horizontal"
		aria-valuenow={Math.round(ide.panelH)}
		aria-valuemin={100}
		aria-valuemax={520}
		onpointerdown={panelSashDown}
		onpointermove={panelSashMove}
		onpointerup={(e) => panelSashUp(e)}
		onpointercancel={(e) => panelSashUp(e)}
		ondblclick={() => (ide.panelH = 168)}
	></div>
	<div class="panel" style={ide.panelMax ? "flex-basis:45vh" : `flex-basis:${ide.panelH}px`}>
		<div class="paneltabs">
			<button class:on={ide.panelTab === "console"} onclick={() => (ide.panelTab = "console")}
				><Icon name="debug" size={13} /> Debug Console</button
			>
			<button class:on={ide.panelTab === "output"} onclick={() => (ide.panelTab = "output")}
				>Output</button
			>
			{#if ide.panelTab === "output"}
				<button
					type="button"
					class="chanpick"
					title="Output channel"
					onclick={() => {
						const order = ["Preview", "Tasks", "Extensions"];
						ide.outputChannel = order[(order.indexOf(ide.outputChannel) + 1) % order.length];
					}}>{ide.outputChannel} ▾</button
				>
			{/if}
			<button class:on={ide.panelTab === "problems"} onclick={() => (ide.panelTab = "problems")}
				><Icon name={ide.problems.length || ide.errCount ? "error" : "check"} size={13} /> Problems
				<span class="pcount">{ide.problems.length + ide.errCount}</span></button
			>
			{#if ide.termTabs.length > 1}
				{#each ide.termTabs as tt, i}
					<button
						class:on={ide.panelTab === "terminal" && ide.activeTerm === i}
						onclick={() => {
							ide.panelTab = "terminal";
							ide.activeTerm = i;
						}}><Icon name="terminal" size={12} /> {tt}</button
					>
				{/each}
			{:else}
				<button class:on={ide.panelTab === "terminal"} onclick={() => (ide.panelTab = "terminal")}
					><Icon name="terminal" size={13} /> Terminal</button
				>
			{/if}
			<span style="flex:1"></span>
			{#if ide.panelTab === "terminal"}
				<button
					title="New terminal (Ctrl+Shift+`)"
					onclick={() => {
						ide.termTabs = [...ide.termTabs, `powershell (${ide.termTabs.length + 1})`];
						ide.activeTerm = ide.termTabs.length - 1;
					}}><span class="plussign">+</span></button
				>
				<button title="Clear terminal" onclick={() => (ide.termLines = [])}
					><Icon name="trash" size={13} /></button
				>
			{:else}
				<input
					class="panelfilter"
					placeholder="Filter (e.g. error)…"
					bind:value={ide.panelFilter}
				/>
				<button onclick={() => (ide.logs = [])} title="Clear Output"
					><Icon name="trash" size={13} /></button
				>
			{/if}
			<button
				title="Views and More Actions…"
				onclick={() => ide.toast("Panel actions: clear · maximize · hide")}
				><Icon name="ellipsis" size={13} /></button
			>
			<button
				title={ide.panelMax ? "Restore" : "Maximize panel"}
				onclick={() => (ide.panelMax = !ide.panelMax)}
				><Icon name={ide.panelMax ? "fullscreen-exit" : "fullscreen"} size={13} /></button
			>
			<button
				onclick={() => (ide.showPanel = false)}
				title="Close panel (Ctrl+J)"
				aria-label="Close panel"><Icon name="close" size={14} /></button
			>
		</div>
		<div class="panelbody">
			{#if ide.panelTab === "terminal"}
				<div class="term" role="log" aria-label="Terminal">
					{#each ide.termLines.slice(-80) as tl}
						<div class="logline {tl.kind}">
							{tl.text}
						</div>
					{/each}
					<form
						class="termin"
						onsubmit={(e) => {
							e.preventDefault();
							ide.runTerm(ide.termInput);
						}}
					>
						<span class="prompt"
							>➜ {ide.activeProjectName} [{ide.termTabs[ide.activeTerm] ?? "powershell"}]$</span
						>
						<input
							bind:value={ide.termInput}
							placeholder="help · ls · open /index.html · entry · echo"
							aria-label="Terminal input"
						/>
					</form>
				</div>
			{:else if ide.panelTab === "problems"}
				<div class="probs">
					<div class="prow phead">
						<span></span><span>File</span><span>Message</span><span>Go</span>
					</div>
					{#each ide.problems as p}
						<button
							type="button"
							class="prow clickable"
							onclick={() => ide.openFile(p.replace("Empty file: ", ""))}
						>
							<Icon name="warning" size={13} />
							<span class="pfile">{p.replace("Empty file: ", "")}</span>
							<span class="pmsg">Empty file</span>
							<small>open →</small>
						</button>
					{/each}
					{#each ide.logs.filter((l) => l.kind === "error") as l}
						<div class="prow error">
							<Icon name="error" size={13} />
							<span class="pfile">preview</span>
							<span class="pmsg">{l.text}</span>
							<small>log</small>
						</div>
					{/each}
					{#if ide.problems.length === 0 && ide.errCount === 0}<div class="logline info">
							<Icon name="check" size={13} /> No problems — working tree clean.
						</div>{/if}
				</div>
			{:else if ide.panelTab === "output" && ide.outputChannel !== "Preview"}
				<div class="logline info">
					[ {ide.outputChannel} ] — No output in this mock channel yet. Run the preview to generate logs.
				</div>
			{:else}
				{#each ide.filteredLogs as l}<div class="logline {l.kind}">
						<span class="ltime">{l.kind}</span>
						{l.text}
					</div>{/each}
				{#if ide.filteredLogs.length === 0}<div class="logline info">
						{ide.panelTab === "output"
							? "Output from build + warnings appears here."
							: "console output from the preview iframe appears here. Run the preview to see logs."}
					</div>{/if}
			{/if}
		</div>
	</div>
{/if}
