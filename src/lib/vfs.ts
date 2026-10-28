import { writable, get } from 'svelte/store';

export type NodeType = 'file' | 'dir';
export interface VNode {
	path: string;
	type: NodeType;
	content: string; // dirs: ''
	mtime: number;
}

export const LS_KEY = 'neverview:vfs:v1';

export function normalize(p: string): string {
	if (!p.startsWith('/')) p = '/' + p;
	p = p.replace(/\/+/g, '/');
	const parts: string[] = [];
	for (const s of p.split('/')) {
		if (!s || s === '.') continue;
		if (s === '..') parts.pop();
		else parts.push(s);
	}
	return '/' + parts.join('/');
}

export function dirname(p: string): string {
	p = normalize(p);
	if (p === '/') return '/';
	const i = p.lastIndexOf('/');
	return i <= 0 ? '/' : p.slice(0, i);
}

export function basename(p: string): string {
	p = normalize(p);
	if (p === '/') return '/';
	return p.slice(p.lastIndexOf('/') + 1);
}

export function join(a: string, b: string): string {
	return normalize(a.replace(/\/$/, '') + '/' + b);
}

export function resolveRelative(fromFile: string, rel: string): string {
	if (rel.startsWith('/')) return normalize(rel);
	const base = dirname(fromFile);
	return normalize(base + '/' + rel);
}

export function languageOf(path: string): string {
	const e = path.split('.').pop()?.toLowerCase() ?? '';
	if (e === 'html' || e === 'htm') return 'html';
	if (e === 'css') return 'css';
	if (e === 'js' || e === 'mjs' || e === 'cjs') return 'javascript';
	if (e === 'ts' || e === 'mts') return 'typescript';
	if (e === 'json') return 'json';
	if (e === 'md' || e === 'markdown') return 'markdown';
	if (e === 'svg' || e === 'xml') return 'xml';
	return 'plaintext';
}

export function mimeOf(path: string): string {
	const e = path.split('.').pop()?.toLowerCase() ?? '';
	if (e === 'html' || e === 'htm') return 'text/html';
	if (e === 'css') return 'text/css';
	if (e === 'js' || e === 'mjs' || e === 'cjs') return 'text/javascript';
	if (e === 'ts' || e === 'mts') return 'text/typescript';
	if (e === 'json') return 'application/json';
	if (e === 'svg') return 'image/svg+xml';
	if (e === 'png') return 'image/png';
	if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
	if (e === 'md') return 'text/markdown';
	return 'text/plain';
}

export const SEED: VNode[] = [
	{
		path: '/index.html',
		type: 'file',
		mtime: Date.now(),
		content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Neverview preview</title>
  <link rel="stylesheet" href="./style.css" />
</head>
<body>
  <main class="card">
    <h1>Neverview v2</h1>
    <p>Edit <code>/index.html</code>, <code>/style.css</code> or <code>/app.js</code> on the left. Preview updates live.</p>
    <button id="btn">Click me</button>
    <p id="out"></p>
  </main>
  <script type="module" src="./app.js"></script>
</body>
</html>
`
	},
	{
		path: '/style.css',
		type: 'file',
		mtime: Date.now(),
		content: `body {
  font-family: system-ui, sans-serif;
  background: #0f172a;
  color: #e2e8f0;
  margin: 0;
  display: grid;
  place-items: center;
  min-height: 100vh;
}

.card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 32px;
  max-width: 460px;
  text-align: center;
}

button {
  background: #007acc;
  color: #fff;
  border: none;
  padding: 8px 18px;
  border-radius: 6px;
  cursor: pointer;
}

button:hover {
  background: #0062a3;
}

code {
  background: #020617;
  padding: 1px 6px;
  border-radius: 4px;
}
`
	},
	{
		path: '/app.js',
		type: 'file',
		mtime: Date.now(),
		content: `import { greet } from './lib.js';
const btn = document.getElementById('btn');
const out = document.getElementById('out');
btn?.addEventListener('click', () => {
  out.textContent = greet('Neverview');
  console.log('button clicked');
});
`
	},
	{
		path: '/lib.js',
		type: 'file',
		mtime: Date.now(),
		content: `export function greet(name) {
  return 'Hello from ' + name + '!';
}
`
	},
	{
		path: '/README.md',
		type: 'file',
		mtime: Date.now(),
		content: `# Neverview v2\n\nClient-side VSCode-like HTML preview.\n\n- Files live in memory + localStorage\n- Monaco is bundled from the monaco-editor npm package\n- Preview resolves relative imports via blob URLs\n`
	}
];

function seedMap(): Record<string, VNode> {
	const m: Record<string, VNode> = { '/': { path: '/', type: 'dir', content: '', mtime: Date.now() } };
	for (const f of SEED) m[f.path] = { ...f };
	return m;
}

function loadInitial(): Record<string, VNode> {
	try {
		if (typeof localStorage === 'undefined') return seedMap();
		const raw = localStorage.getItem(LS_KEY);
		if (!raw) return seedMap();
		const parsed = JSON.parse(raw) as Record<string, VNode>;
		if (!parsed['/index.html']) return seedMap();
		if (!parsed['/']) parsed['/'] = { path: '/', type: 'dir', content: '', mtime: Date.now() };
		return parsed;
	} catch {
		return seedMap();
	}
}

export const files = writable<Record<string, VNode>>(loadInitial());
export const activePath = writable<string>('/index.html');
export const openTabs = writable<string[]>(['/index.html']);
export const dirtyPaths = writable<Set<string>>(new Set());

let saveT: ReturnType<typeof setTimeout> | null = null;
function scheduleSave() {
	if (typeof localStorage === 'undefined') return;
	if (saveT) clearTimeout(saveT);
	saveT = setTimeout(() => {
		try {
			localStorage.setItem(LS_KEY, JSON.stringify(get(files)));
			dirtyPaths.set(new Set());
		} catch {
			/* quota exceeded: keep in-memory */
		}
	}, 400);
}
files.subscribe(() => scheduleSave());

export function ensureDir(path: string) {
	path = normalize(path);
	const snap = get(files);
	if (snap[path]) return;
	const parent = dirname(path);
	if (parent !== path) ensureDir(parent);
	const f = { ...get(files) };
	f[path] = { path, type: 'dir', content: '', mtime: Date.now() };
	files.set(f);
}

export function createFile(path: string, content = '') {
	path = normalize(path);
	const f = { ...get(files) };
	if (f[path]) throw new Error('exists');
	ensureDir(dirname(path));
	f[path] = { path, type: 'file', content, mtime: Date.now() };
	files.set({ ...get(files), [path]: f[path] });
	openFile(path);
}

export function createFolder(path: string) {
	path = normalize(path);
	const f = get(files);
	if (f[path]) throw new Error('exists');
	ensureDir(path);
}

export function writeFile(path: string, content: string) {
	path = normalize(path);
	const f = get(files);
	const n = f[path];
	if (!n || n.type !== 'file') return;
	files.set({ ...f, [path]: { ...n, content, mtime: Date.now() } });
	const d = new Set(get(dirtyPaths));
	d.add(path);
	dirtyPaths.set(d);
}

export function renamePath(oldP: string, newP: string) {
	oldP = normalize(oldP);
	newP = normalize(newP);
	if (oldP === newP) return;
	const snap = get(files);
	const node = snap[oldP];
	if (!node) return;
	if (snap[newP]) throw new Error('target exists');
	ensureDir(dirname(newP));
	const f = { ...get(files) };
	if (node.type === 'file') {
		delete f[oldP];
		f[newP] = { ...node, path: newP, mtime: Date.now() };
	} else {
		for (const k of Object.keys(snap)) {
			if (k === oldP || k.startsWith(oldP + '/')) {
				const nk = newP + k.slice(oldP.length);
				f[nk] = { ...snap[k], path: nk, mtime: Date.now() };
				if (nk !== k) delete f[k];
			}
		}
	}
	files.set(f);
	const tabs = get(openTabs).map((t) =>
		t === oldP ? newP : t.startsWith(oldP + '/') ? newP + t.slice(oldP.length) : t
	);
	openTabs.set(tabs);
	if (get(activePath) === oldP || get(activePath).startsWith(oldP + '/')) {
		activePath.set(get(activePath).replace(oldP, newP));
	}
}

export function removePath(path: string) {
	path = normalize(path);
	if (path === '/') return;
	const f = { ...get(files) };
	for (const k of Object.keys(f)) {
		if (k === path || k.startsWith(path + '/')) delete f[k];
	}
	files.set(f);
	openTabs.set(get(openTabs).filter((t) => t !== path && !t.startsWith(path + '/')));
	if (get(activePath) === path || get(activePath).startsWith(path + '/')) {
		const rest = get(openTabs);
		activePath.set(rest[0] ?? '/index.html');
	}
}

export function openFile(path: string) {
	path = normalize(path);
	const f = get(files);
	if (!f[path] || f[path].type !== 'file') return;
	const tabs = get(openTabs);
	if (!tabs.includes(path)) openTabs.set([...tabs, path]);
	activePath.set(path);
}

export function closeTab(path: string) {
	const tabs = get(openTabs).filter((t) => t !== path);
	openTabs.set(tabs);
	if (get(activePath) === path) activePath.set(tabs[tabs.length - 1] ?? '');
}

export function resetWorkspace() {
	files.set(seedMap());
	openTabs.set(['/index.html']);
	activePath.set('/index.html');
	try {
		localStorage.removeItem(LS_KEY);
	} catch {
		/* noop */
	}
}

export interface TreeNode {
	path: string;
	name: string;
	type: NodeType;
	children: TreeNode[];
}

export function buildTree(f: Record<string, VNode>): TreeNode[] {
	const root: TreeNode = { path: '/', name: '/', type: 'dir', children: [] };
	const byPath: Record<string, TreeNode> = { '/': root };
	const dirs = Object.values(f)
		.filter((n) => n.type === 'dir')
		.sort((a, b) => a.path.localeCompare(b.path));
	const fileNodes = Object.values(f)
		.filter((n) => n.type === 'file')
		.sort((a, b) => a.path.localeCompare(b.path));
	for (const d of dirs) {
		if (d.path === '/') continue;
		const parent = byPath[dirname(d.path)] ?? root;
		const node: TreeNode = { path: d.path, name: basename(d.path), type: 'dir', children: [] };
		byPath[d.path] = node;
		parent.children.push(node);
	}
	for (const fl of fileNodes) {
		const parent = byPath[dirname(fl.path)] ?? root;
		parent.children.push({ path: fl.path, name: basename(fl.path), type: 'file', children: [] });
	}
	const sortFn = (a: TreeNode, b: TreeNode) =>
		a.type !== b.type ? (a.type === 'dir' ? -1 : 1) : a.name.localeCompare(b.name);
	const walk = (n: TreeNode) => {
		n.children.sort(sortFn);
		n.children.forEach(walk);
	};
	walk(root);
	return root.children;
}
