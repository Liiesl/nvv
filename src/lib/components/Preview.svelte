<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { buildPreview, type BuiltPreview } from "#lib/preview.js";
	import type { VNode } from "#lib/vfs.js";
	import type { InspectPayload } from "#lib/inspect.js";
	import { isInspectKind } from "#lib/inspect.js";
	import Icon from "./Icon.svelte";

	let {
		files,
		entry = "/index.html",
		projectId = null,
		auto = true,
		onLog,
		zoomed = false,
		onToggleZoom,
		onInspectSelect,
	}: {
		files: Record<string, VNode>;
		entry: string;
		projectId: string | null;
		auto: boolean;
		onLog: (kind: string, text: string) => void;
		zoomed?: boolean;
		onToggleZoom?: () => void;
		onInspectSelect?: (info: InspectPayload | null) => void;
	} = $props();

	let built: BuiltPreview | null = $state(null);
	let frame: HTMLIFrameElement | null = $state(null);
	let t: ReturnType<typeof setTimeout> | null = null;
	let inspectOn = $state(false);
	let hover = $state<InspectPayload | null>(null);
	let selected = $state<InspectPayload | null>(null);

	function rebuild() {
		built = buildPreview(files, entry, built ?? undefined);
		for (const w of built.warnings) onLog("warn", w);
		// Stale hover info points at the old document — drop it.
		// Keep the pinned selection so Monaco doesn't flicker on every keystroke.
		hover = null;
	}

	function schedule() {
		if (!auto) return;
		if (t) clearTimeout(t);
		t = setTimeout(rebuild, 450);
	}

	function sendInspect() {
		try {
			frame?.contentWindow?.postMessage(
				{ __nv: 2, type: inspectOn ? "inspect-on" : "inspect-off" },
				"*",
			);
		} catch {
			/* noop */
		}
		if (!inspectOn) {
			// Belt and suspenders: if the postMessage is lost during a
			// reload, directly hide any overlay left in the live document.
			try {
				const doc = frame?.contentDocument;
				const ov = doc?.querySelector?.('[data-nv-inspect="overlay"]') as HTMLElement | null;
				const lb = doc?.querySelector?.('[data-nv-inspect="label"]') as HTMLElement | null;
				if (ov) ov.style.display = "none";
				if (lb) lb.style.display = "none";
				if (doc?.documentElement) (doc.documentElement as HTMLElement).style.cursor = "";
			} catch {
				/* cross-origin or not ready — postMessage is the path */
			}
		}
	}

	function toggleInspect() {
		inspectOn = !inspectOn;
		hover = null;
		if (!inspectOn) selected = null;
		else selected = null;
		onInspectSelect?.(null);
		sendInspect();
		try {
			frame?.focus?.();
		} catch {
			/* noop */
		}
	}

	async function copyText(text: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			try {
				const ta = document.createElement("textarea");
				ta.value = text;
				document.body.appendChild(ta);
				ta.select();
				document.execCommand("copy");
				ta.remove();
			} catch {
				/* noop */
			}
		}
	}

	$effect(() => {
		void files;
		void entry;
		schedule();
	});

	onMount(() => {
		rebuild();
		const h = (e: MessageEvent) => {
			const d = e.data as {
				__nv?: number;
				kind?: string;
				args?: string[];
				tag?: string;
				id?: string;
				classes?: string[];
				selector?: string;
				width?: number;
				height?: number;
				outerHtml?: string;
			} | null;
			if (!d || d.__nv !== 1) return;
			if (isInspectKind(d.kind)) {
				if (d.kind === "inspect-hover") {
					hover = {
						tag: d.tag ?? "?",
						id: d.id ?? "",
						classes: d.classes ?? [],
						selector: d.selector ?? "",
						width: d.width ?? 0,
						height: d.height ?? 0,
						outerHtml: d.outerHtml ?? "",
					};
				} else if (d.kind === "inspect-select") {
					const info: InspectPayload = {
						tag: d.tag ?? "?",
						id: d.id ?? "",
						classes: d.classes ?? [],
						selector: d.selector ?? "",
						width: d.width ?? 0,
						height: d.height ?? 0,
						outerHtml: d.outerHtml ?? "",
					};
					selected = info;
					hover = info;
					onInspectSelect?.(info);
				} else if (d.kind === "inspect-escape") {
					inspectOn = false;
					hover = null;
					selected = null;
					onInspectSelect?.(null);
					sendInspect();
				} else if (d.kind === "inspect-leave") {
					// Pointer left the preview document: drop hover text.
					// Keep the pinned selection + Monaco highlight intact.
					hover = null;
				}
				return;
			}
			onLog(d.kind ?? "log", (d.args ?? []).join(" "));
		};
		const onKey = (e: KeyboardEvent) => {
			const mod = e.ctrlKey || e.metaKey;
			if (mod && e.shiftKey && (e.key.toLowerCase() === "c" || e.key.toLowerCase() === "с")) {
				e.preventDefault();
				toggleInspect();
			} else if (e.key === "Escape" && inspectOn) {
				inspectOn = false;
				hover = null;
				onInspectSelect?.(null);
				sendInspect();
			}
		};
		window.addEventListener("message", h);
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("message", h);
			window.removeEventListener("keydown", onKey);
		};
	});

	onDestroy(() => {
		if (t) clearTimeout(t);
		if (built)
			for (const u of built.urls)
				try {
					URL.revokeObjectURL(u);
				} catch {
					/* noop */
				}
	});

	export function refresh() {
		rebuild();
	}
	export function clearInspectSelection() {
		// Called when the user takes over in Monaco: unpin but stay in
		// inspect mode so the next hover still highlights.
		selected = null;
		hover = null;
	}
	export function openNewTab() {
		try {
			const target = new URL("preview", window.location.href);
			if (projectId) target.searchParams.set("project", projectId);
			if (entry) target.searchParams.set("entry", entry);
			target.searchParams.set("live", "1");
			window.open(target.toString(), "_blank", "noopener");
			return;
		} catch {
			/* fall through to blob snapshot */
		}
		if (built) window.open(built.entryUrl, "_blank", "noopener");
	}
</script>

<div class="pvbar">
	<span>Preview: {entry}</span>
	<span class="url">{built?.entryUrl ?? ""}</span>
	<button class="iconbtn" onclick={refresh} title="Refresh"><Icon name="refresh" /></button>
	<button
		class="iconbtn"
		class:on={inspectOn}
		onclick={toggleInspect}
		title="Inspect: hover highlight (Ctrl+Shift+C)"
		aria-label="Toggle inspect mode"
		aria-pressed={inspectOn}><Icon name="inspect" /></button
	>
	{#if onToggleZoom}
		<button
			class="iconbtn"
			onclick={onToggleZoom}
			title={zoomed ? "Exit zoom (Esc)" : "Zoom preview (same tab)"}
			aria-label={zoomed ? "Exit preview zoom" : "Zoom preview"}
			aria-pressed={zoomed}><Icon name={zoomed ? "fullscreen-exit" : "fullscreen"} /></button
		>
	{/if}
	<button class="iconbtn" onclick={openNewTab} title="Open in new tab"
		><Icon name="link-external" /></button
	>
</div>
{#if inspectOn}
	<div class="inspectbar" role="status">
		{#if selected ?? hover}
			{@const info = selected ?? hover}
			<span class="tag">{info?.tag}</span>
			{#if info?.id}<span class="iid">#{info.id}</span>{/if}
			{#if info?.classes?.length}<span class="cls">.{info.classes.slice(0, 3).join(".")}</span>{/if}
			<span class="dims">{info?.width}x{info?.height}</span>
			<code class="sel">{info?.selector}</code>
			<span class="sp"></span>
			<button class="mini" onclick={() => info && copyText(info.selector)}>Copy selector</button>
			<button class="mini" onclick={() => info && copyText(info.outerHtml)}>Copy HTML</button>
			{#if selected}<button
					class="mini"
					onclick={() => {
						selected = null;
						onInspectSelect?.(null);
					}}>Clear</button
				>{/if}
		{:else}
			<span class="hint">Hover page to highlight — click to pin. Esc to exit.</span>
		{/if}
	</div>
{/if}
{#if built}
	<iframe
		class="pvframe"
		bind:this={frame}
		title="preview"
		src={built.entryUrl}
		onload={sendInspect}
		sandbox="allow-scripts allow-same-origin allow-modals allow-forms allow-popups"
	></iframe>
{/if}
