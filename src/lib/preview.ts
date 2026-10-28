import { mimeOf, normalize, resolveRelative, type VNode } from '#lib/vfs.js';

const EXTERNAL = /^(https?:|data:|blob:|mailto:|tel:|#)/i;

export interface BuiltPreview {
	entryUrl: string;
	urls: string[];
	entry: string;
	warnings: string[];
}

const CONSOLE_HOOK = `<script>(function(){var p=function(m,a){try{parent.postMessage({__nv:1,kind:m,args:a.map(function(x){try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return String(x)}})},'*')}catch(e){}};['log','info','warn','error'].forEach(function(k){var o=console[k];console[k]=function(){p(k,Array.prototype.slice.call(arguments));return o&&o.apply(console,arguments)}});window.addEventListener('error',function(e){p('error',[e.message||String(e.error||e)])})})();</script>`;

function rewriteCss(css: string, fromFile: string, urlFor: (p: string) => string | null): string {
	return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q: string, u: string) => {
		u = u.trim();
		if (EXTERNAL.test(u)) return m;
		const abs = resolveRelative(fromFile, u.split('#')[0].split('?')[0]);
		const url = urlFor(abs);
		return url ? `url("${url}")` : m;
	});
}

function rewriteJs(js: string, fromFile: string, urlFor: (p: string) => string | null): string {
	let out = js.replace(
		/((?:import|export)[^'"]*?from\s*['"])([^'"]+)(['"])/g,
		(m, a: string, spec: string, c: string) => {
			if (EXTERNAL.test(spec) || (!spec.startsWith('.') && !spec.startsWith('/'))) return m;
			const abs = resolveRelative(fromFile, spec);
			const url = urlFor(abs);
			return url ? `${a}${url}${c}` : m;
		}
	);
	out = out.replace(/import\(\s*['"]([^'"]+)['"]\s*\)/g, (m, spec: string) => {
		if (EXTERNAL.test(spec) || (!spec.startsWith('.') && !spec.startsWith('/'))) return m;
		const abs = resolveRelative(fromFile, spec);
		const url = urlFor(abs);
		return url ? `import("${url}")` : m;
	});
	return out;
}

function rewriteHtmlAttr(html: string, fromFile: string, urlFor: (p: string) => string | null): string {
	return html.replace(/\s(src|href)=(['"])([^'"]+)\2/gi, (m, attr: string, q: string, u: string) => {
		if (EXTERNAL.test(u) || u.startsWith('#')) return m;
		const clean = u.split('#')[0].split('?')[0];
		if (!clean || (!clean.startsWith('.') && !clean.startsWith('/'))) return m;
		const abs = resolveRelative(fromFile, clean);
		const url = urlFor(abs);
		if (!url) return m;
		const suffix = u.slice(clean.length);
		return ` ${attr}=${q}${url}${suffix}${q}`;
	});
}

export function buildPreview(
	files: Record<string, VNode>,
	entry = '/index.html',
	old?: BuiltPreview
): BuiltPreview {
	if (old) for (const u of old.urls) try { URL.revokeObjectURL(u); } catch { /* noop */ }
	const warnings: string[] = [];
	const normEntry = normalize(entry);
	if (!files[normEntry]?.type || files[normEntry].type !== 'file') {
		const html = `<h1 style="font-family:sans-serif">No ${normEntry}</h1>`;
		const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
		return { entryUrl: url, urls: [url], entry: normEntry, warnings: ['entry missing'] };
	}

	const urlMap = new Map<string, string>();
	const urls: string[] = [];
	const inProgress = new Set<string>();

	function pick(path: string): string | null {
		const a = normalize(path);
		const cands = [a, a + '/index.html', a + '.js', a + '.css'];
		for (const c of cands) if (files[c]?.type === 'file') return c;
		return null;
	}

	function urlFor(abs: string): string | null {
		const found = pick(abs);
		if (!found) {
			warnings.push(`missing: ${normalize(abs)}`);
			return null;
		}
		if (urlMap.has(found)) return urlMap.get(found)!;
		if (inProgress.has(found)) {
			warnings.push(`circular: ${found}`);
			return null;
		}
		inProgress.add(found);
		const mime = mimeOf(found);
		let content = files[found].content;
		// Recursive resolver so nested ./ imports resolve even if target sorts later.
		const rec = (pp: string): string | null => urlFor(resolveRelative(found, pp) ? pp : pp);
		if (mime === 'text/css') {
			content = rewriteCss(content, found, (rel) => {
				const abs2 = resolveRelative(found, rel);
				return urlFor(abs2);
			});
		} else if (mime === 'text/javascript' || mime === 'text/typescript') {
			content = rewriteJs(content, found, (rel) => {
				const abs2 = resolveRelative(found, rel);
				return urlFor(abs2);
			});
		}
		void rec;
		const u = URL.createObjectURL(new Blob([content], { type: mime }));
		urlMap.set(found, u);
		urls.push(u);
		inProgress.delete(found);
		return u;
	}

	// Build every file once so cross-imports always hit urlMap.
	for (const p of Object.keys(files).sort((x, y) => x.localeCompare(y))) {
		if (files[p]?.type === 'file' && !urlMap.has(p)) urlFor(p);
	}

	let entryHtml = files[normEntry].content;
	entryHtml = rewriteHtmlAttr(entryHtml, normEntry, (rel) => {
		const abs2 = resolveRelative(normEntry, rel);
		return urlMap.get(normalize(abs2)) ?? urlFor(abs2);
	});
	// inline console hook after <head>
	if (/<head[^>]*>/i.test(entryHtml)) entryHtml = entryHtml.replace(/<head[^>]*>/i, (m) => m + CONSOLE_HOOK);
	else entryHtml = CONSOLE_HOOK + entryHtml;
	const entryUrl = URL.createObjectURL(new Blob([entryHtml], { type: 'text/html' }));
	urls.push(entryUrl);
	return { entryUrl, urls, entry: normEntry, warnings };
}
