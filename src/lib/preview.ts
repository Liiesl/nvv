import { mimeOf, normalize, resolveRelative, type VNode } from "#lib/vfs.js";

const EXTERNAL = /^(https?:|data:|blob:|mailto:|tel:|#)/i;

export interface BuiltPreview {
	entryUrl: string;
	urls: string[];
	entry: string;
	warnings: string[];
}

const CONSOLE_HOOK = `<script>(function(){var p=function(m,a){try{parent.postMessage({__nv:1,kind:m,args:a.map(function(x){try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(e){return String(x)}})},'*')}catch(e){}};['log','info','warn','error'].forEach(function(k){var o=console[k];console[k]=function(){p(k,Array.prototype.slice.call(arguments));return o&&o.apply(console,arguments)}});window.addEventListener('error',function(e){p('error',[e.message||String(e.error||e)])})})();</script>`;

const INSPECT_HOOK = `<script>(function(){var on=false;var ov=null;var lb=null;var last=null;function ensure(){if(ov)return;ov=document.createElement('div');ov.setAttribute('data-nv-inspect','overlay');ov.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;background:rgba(56,139,253,0.22);border:1.5px solid #1f6feb;box-shadow:0 0 0 1px rgba(31,111,235,0.35);display:none;margin:0!important;padding:0!important;';document.documentElement.appendChild(ov);lb=document.createElement('div');lb.setAttribute('data-nv-inspect','label');lb.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;background:#1f6feb;color:#fff;font:11px/1.5 monospace,sans-serif;padding:2px 6px;border-radius:4px;display:none;max-width:70vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3);';document.documentElement.appendChild(lb);}function isOv(n){return n&&n.getAttribute&&n.getAttribute('data-nv-inspect');}function sel(el){try{var parts=[];var c=el;while(c&&c.nodeType===1&&c.tagName!=='HTML'&&parts.length<6){var s=c.tagName.toLowerCase();if(c.id){s+='#'+c.id;parts.unshift(s);break;}var cn=c.className&&typeof c.className==='string'?c.className.trim().split(/\\s+/).filter(Boolean):[];if(cn.length){s+='.'+cn.slice(0,2).join('.');}var par=c.parentElement;if(par){var sib=par.children;var same=0;var idx=0;for(var i=0;i<sib.length;i++){if(sib[i].tagName===c.tagName){same++;if(sib[i]===c)idx=same;}}if(same>1){s+=':nth-of-type('+idx+')';}}parts.unshift(s);c=par;}return parts.length?('body > '+parts.join(' > ')):'body';}catch(e){return el.tagName?el.tagName.toLowerCase():'';}}function info(el){var r={left:0,top:0,width:0,height:0};try{r=el.getBoundingClientRect();}catch(e){}var cl=[];try{if(el.classList){for(var j=0;j<el.classList.length;j++)cl.push(el.classList[j]);}}catch(e){}var oh='';try{oh=(el.outerHTML||'').slice(0,600);}catch(e){}return {tag:(el.tagName||'?').toLowerCase(),id:el.id||'',classes:cl,selector:sel(el),width:Math.round(r.width),height:Math.round(r.height),outerHtml:oh};}function send(kind,p){try{var m={__nv:1,kind:kind};for(var k in p)m[k]=p[k];parent.postMessage(m,'*');}catch(e){}}function show(el){if(!el||!el.getBoundingClientRect)return;ensure();var r=el.getBoundingClientRect();if(r.width===0&&r.height===0){ov.style.display='none';lb.style.display='none';return;}ov.style.display='block';ov.style.left=(r.left-2)+'px';ov.style.top=(r.top-2)+'px';ov.style.width=(r.width+4)+'px';ov.style.height=(r.height+4)+'px';var d=info(el);var t=d.tag+(d.id?'#'+d.id:'')+(d.classes.length?'.'+d.classes.slice(0,3).join('.'):'')+'  '+d.width+'x'+d.height;lb.textContent=t;lb.style.display='block';var lw=lb.offsetWidth||160;var lh=lb.offsetHeight||20;var lx=r.left;var ly=r.top-lh-6;if(ly<0)ly=r.bottom+6;if(lx+lw>window.innerWidth-8)lx=window.innerWidth-lw-8;lb.style.left=Math.max(0,lx)+'px';lb.style.top=Math.max(0,ly)+'px';}function hide(){if(ov)ov.style.display='none';if(lb)lb.style.display='none';}function onOver(e){if(!on)return;var t=e.target;if(!t||!t.tagName||isOv(t))return;last=t;show(t);send('inspect-hover',info(t));}function onClick(e){if(!on)return;var t=e.target;if(isOv(t)){e.preventDefault();e.stopPropagation();return;}e.preventDefault();e.stopPropagation();if(t&&t.tagName){last=t;show(t);send('inspect-select',info(t));}}function onScroll(){if(on&&last)show(last);}function onLeave(){if(on){last=null;hide();send('inspect-leave',{});}}function onKey(e){if(e.key==='Escape'){setOff();send('inspect-escape',{});}}function setOn(){ensure();if(on)return;on=true;try{document.documentElement.style.cursor='crosshair';}catch(e){}document.addEventListener('mouseover',onOver,true);document.addEventListener('click',onClick,true);window.addEventListener('scroll',onScroll,true);document.addEventListener('keydown',onKey,true);document.addEventListener('mouseleave',onLeave,true);document.addEventListener('mouseout',function(e){if(on&&!e.relatedTarget)onLeave();},true);}function setOff(){on=false;last=null;hide();try{document.documentElement.style.cursor='';}catch(e){}try{document.removeEventListener('mouseover',onOver,true);}catch(e){}try{document.removeEventListener('click',onClick,true);}catch(e){}try{window.removeEventListener('scroll',onScroll,true);}catch(e){}try{document.removeEventListener('keydown',onKey,true);}catch(e){}try{document.removeEventListener('mouseleave',onLeave,true);}catch(e){}}window.addEventListener('message',function(e){var d=e.data;if(!d||d.__nv!==2||!d.type)return;if(d.type==='inspect-on')setOn();else if(d.type==='inspect-off')setOff();});})();</script>`;

function rewriteCss(css: string, fromFile: string, urlFor: (p: string) => string | null): string {
	return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q: string, u: string) => {
		u = u.trim();
		if (EXTERNAL.test(u)) return m;
		const abs = resolveRelative(fromFile, u.split("#")[0].split("?")[0]);
		const url = urlFor(abs);
		return url ? `url("${url}")` : m;
	});
}

function rewriteJs(js: string, fromFile: string, urlFor: (p: string) => string | null): string {
	let out = js.replace(
		/((?:import|export)[^'"]*?from\s*['"])([^'"]+)(['"])/g,
		(m, a: string, spec: string, c: string) => {
			if (EXTERNAL.test(spec) || (!spec.startsWith(".") && !spec.startsWith("/"))) return m;
			const abs = resolveRelative(fromFile, spec);
			const url = urlFor(abs);
			return url ? `${a}${url}${c}` : m;
		},
	);
	out = out.replace(/import\(\s*['"]([^'"]+)['"]\s*\)/g, (m, spec: string) => {
		if (EXTERNAL.test(spec) || (!spec.startsWith(".") && !spec.startsWith("/"))) return m;
		const abs = resolveRelative(fromFile, spec);
		const url = urlFor(abs);
		return url ? `import("${url}")` : m;
	});
	return out;
}

function rewriteHtmlAttr(
	html: string,
	fromFile: string,
	urlFor: (p: string) => string | null,
): string {
	return html.replace(
		/\s(src|href)=(['"])([^'"]+)\2/gi,
		(m, attr: string, q: string, u: string) => {
			if (EXTERNAL.test(u) || u.startsWith("#")) return m;
			const clean = u.split("#")[0].split("?")[0];
			if (!clean || (!clean.startsWith(".") && !clean.startsWith("/"))) return m;
			const abs = resolveRelative(fromFile, clean);
			const url = urlFor(abs);
			if (!url) return m;
			const suffix = u.slice(clean.length);
			return ` ${attr}=${q}${url}${suffix}${q}`;
		},
	);
}

export function buildPreview(
	files: Record<string, VNode>,
	entry = "/index.html",
	old?: BuiltPreview,
): BuiltPreview {
	if (old)
		for (const u of old.urls)
			try {
				URL.revokeObjectURL(u);
			} catch {
				/* noop */
			}
	const warnings: string[] = [];
	const normEntry = normalize(entry);
	if (!files[normEntry]?.type || files[normEntry].type !== "file") {
		const html = `<h1 style="font-family:sans-serif">No ${normEntry}</h1>`;
		const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
		return {
			entryUrl: url,
			urls: [url],
			entry: normEntry,
			warnings: ["entry missing"],
		};
	}

	const urlMap = new Map<string, string>();
	const urls: string[] = [];
	const inProgress = new Set<string>();

	function pick(path: string): string | null {
		const a = normalize(path);
		const cands = [a, a + "/index.html", a + ".js", a + ".css"];
		for (const c of cands) if (files[c]?.type === "file") return c;
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
		if (mime === "text/css") {
			content = rewriteCss(content, found, (rel) => {
				const abs2 = resolveRelative(found, rel);
				return urlFor(abs2);
			});
		} else if (mime === "text/javascript" || mime === "text/typescript") {
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
		if (files[p]?.type === "file" && !urlMap.has(p)) urlFor(p);
	}

	let entryHtml = files[normEntry].content;
	entryHtml = rewriteHtmlAttr(entryHtml, normEntry, (rel) => {
		const abs2 = resolveRelative(normEntry, rel);
		return urlMap.get(normalize(abs2)) ?? urlFor(abs2);
	});
	// inline console hook + inspect hook after <head>
	if (/<head[^>]*>/i.test(entryHtml))
		entryHtml = entryHtml.replace(/<head[^>]*>/i, (m) => m + CONSOLE_HOOK + INSPECT_HOOK);
	else entryHtml = CONSOLE_HOOK + INSPECT_HOOK + entryHtml;
	const entryUrl = URL.createObjectURL(new Blob([entryHtml], { type: "text/html" }));
	urls.push(entryUrl);
	return { entryUrl, urls, entry: normEntry, warnings };
}
