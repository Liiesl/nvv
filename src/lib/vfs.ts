import { writable, get } from "svelte/store";

export type NodeType = "file" | "dir";
export interface VNode {
  path: string;
  type: NodeType;
  content: string; // dirs: ''
  mtime: number;
}

export const LS_KEY = "neverview:vfs:v1";

export function normalize(p: string): string {
  if (!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+/g, "/");
  const parts: string[] = [];
  for (const s of p.split("/")) {
    if (!s || s === ".") continue;
    if (s === "..") parts.pop();
    else parts.push(s);
  }
  return "/" + parts.join("/");
}

export function dirname(p: string): string {
  p = normalize(p);
  if (p === "/") return "/";
  const i = p.lastIndexOf("/");
  return i <= 0 ? "/" : p.slice(0, i);
}

export function basename(p: string): string {
  p = normalize(p);
  if (p === "/") return "/";
  return p.slice(p.lastIndexOf("/") + 1);
}

export function join(a: string, b: string): string {
  return normalize(a.replace(/\/$/, "") + "/" + b);
}

export function resolveRelative(fromFile: string, rel: string): string {
  if (rel.startsWith("/")) return normalize(rel);
  const base = dirname(fromFile);
  return normalize(base + "/" + rel);
}

export function languageOf(path: string): string {
  const e = path.split(".").pop()?.toLowerCase() ?? "";
  if (e === "html" || e === "htm") return "html";
  if (e === "css") return "css";
  if (e === "js" || e === "mjs" || e === "cjs") return "javascript";
  if (e === "ts" || e === "mts") return "typescript";
  if (e === "json") return "json";
  if (e === "md" || e === "markdown") return "markdown";
  if (e === "svg" || e === "xml") return "xml";
  return "plaintext";
}

export function mimeOf(path: string): string {
  const e = path.split(".").pop()?.toLowerCase() ?? "";
  if (e === "html" || e === "htm") return "text/html";
  if (e === "css") return "text/css";
  if (e === "js" || e === "mjs" || e === "cjs") return "text/javascript";
  if (e === "ts" || e === "mts") return "text/typescript";
  if (e === "json") return "application/json";
  if (e === "svg") return "image/svg+xml";
  if (e === "png") return "image/png";
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "md") return "text/markdown";
  return "text/plain";
}

export const SEED: VNode[] = [
  {
    path: "/index.html",
    type: "file",
    mtime: Date.now(),
    content: `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Neverview preview — bench rig</title>
  <link rel="stylesheet" href="./style.css" />
</head>
<body>
  <header class="bar">
    <p class="brand"><span class="lamp" aria-hidden="true"></span> Neverview bench</p>
    <button id="theme" type="button">Switch to light</button>
  </header>
  <main class="grid">
    <section class="hero">
      <h1>Small bench, live preview.</h1>
      <p class="lede">Edit <code>/index.html</code>, <code>/style.css</code> or <code>/app.js</code> on the left. The preview on the right updates live.</p>
      <ul class="try">
        <li><code>app.js</code> wires every button below</li>
        <li><code>lib.js</code> is imported as a module</li>
        <li>Open the Console panel to see logs</li>
      </ul>
      <div class="readout" id="readout">
        <span>Total presses</span>
        <strong id="countLabel">0 presses</strong>
      </div>
    </section>
    <section class="rig" aria-label="Playground">
      <h2>Try it</h2>
      <div class="row" role="group" aria-label="Counter">
        <button id="minus" type="button">−</button>
        <button id="plus" type="button" class="primary">+ Press</button>
        <button id="reset" type="button">Reset</button>
      </div>
      <form id="greetForm">
        <label for="nameInput">Say hello</label>
        <div class="row">
          <input id="nameInput" name="name" value="Neverview" maxlength="40" autocomplete="off" />
          <button type="submit" class="primary">Greet</button>
        </div>
      </form>
      <p class="out" id="greetOut" aria-live="polite"></p>
      <p class="hint">Tip: press Greet, then check the Console panel below the preview.</p>
      <button id="logBtn" type="button">Log to console</button>
    </section>
  </main>
  <footer>Seed project: <code>/index.html</code> + <code>/style.css</code> + <code>/app.js</code> + <code>/lib.js</code></footer>
  <script type="module" src="./app.js"></script>
</body>
</html>
`,
  },
  {
    path: "/style.css",
    type: "file",
    mtime: Date.now(),
    content: `:root {
  --base: #12161f;
  --panel: #1a212f;
  --ink: #e8e6df;
  --muted: #9aa3b2;
  --lamp: #f0ad3d;
  --ok: #5fc993;
  --line: #2a3345;
  --radius: 14px;
}

[data-theme="light"] {
  --base: #f2efe7;
  --panel: #ffffff;
  --ink: #1c2330;
  --muted: #5d6878;
  --lamp: #9a6200;
  --ok: #157a4c;
  --line: #d9d3c4;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  background: var(--base);
  color: var(--ink);
  min-height: 100vh;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 22px;
  border-bottom: 1px solid var(--line);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-weight: 650;
}

.lamp {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--lamp);
  box-shadow: 0 0 12px var(--lamp);
}

.grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 18px;
  max-width: 960px;
  margin: 0 auto;
  padding: 22px;
}

.hero,
.rig {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 22px;
}

h1 {
  margin: 0 0 10px;
  font-size: clamp(1.6rem, 3vw, 2.2rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
}

h2 {
  margin: 0 0 12px;
  font-size: 1.05rem;
}

.lede {
  color: var(--muted);
  line-height: 1.55;
  max-width: 38ch;
  margin: 0 0 12px;
}

.try {
  margin: 0;
  padding-left: 18px;
  color: var(--muted);
  line-height: 1.65;
  font-size: 0.92rem;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.85em;
  background: rgba(127, 140, 160, 0.18);
  border: 1px solid var(--line);
  padding: 1px 6px;
  border-radius: 5px;
}

.readout {
  margin-top: 18px;
  padding: 14px 16px;
  border: 1px dashed var(--line);
  border-radius: 10px;
  background-image: radial-gradient(var(--line) 1px, transparent 1px);
  background-size: 12px 12px;
}

.readout span {
  font-size: 0.8rem;
  color: var(--muted);
}

.readout strong {
  display: block;
  margin-top: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 1.4rem;
}

.readout.pop strong {
  animation: nudge 0.25s ease-out;
}

@keyframes nudge {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

.row {
  display: flex;
  gap: 8px;
  align-items: center;
}

button {
  font: inherit;
  color: var(--ink);
  background: var(--base);
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 8px 14px;
  cursor: pointer;
}

button.primary {
  background: var(--lamp);
  border-color: transparent;
  color: #1a1206;
  font-weight: 650;
}

button:hover {
  filter: brightness(1.08);
}

button:active {
  transform: translateY(1px);
}

button:focus-visible,
input:focus-visible {
  outline: 2px solid var(--lamp);
  outline-offset: 2px;
}

form {
  margin-top: 18px;
}

label {
  display: block;
  margin: 0 0 6px;
  font-size: 0.85rem;
  color: var(--muted);
}

input {
  flex: 1;
  min-width: 0;
  font: inherit;
  color: var(--ink);
  background: var(--base);
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 8px 10px;
}

.out {
  min-height: 1.5em;
  margin: 10px 0 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--ok);
}

.hint {
  color: var(--muted);
  font-size: 0.85rem;
  line-height: 1.5;
}

#logBtn {
  margin-top: 12px;
}

footer {
  padding: 0 22px 28px;
  text-align: center;
  color: var(--muted);
  font-size: 0.85rem;
}

@media (max-width: 720px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
`,
  },
  {
    path: "/app.js",
    type: "file",
    mtime: Date.now(),
    content: `import { greet, formatCount } from './lib.js';

let count = 0;
const countLabel = document.getElementById('countLabel');
const readout = document.getElementById('readout');
const minus = document.getElementById('minus');
const plus = document.getElementById('plus');
const reset = document.getElementById('reset');
const form = document.getElementById('greetForm');
const nameInput = document.getElementById('nameInput');
const greetOut = document.getElementById('greetOut');
const themeBtn = document.getElementById('theme');
const logBtn = document.getElementById('logBtn');

function render(pop) {
  countLabel.textContent = formatCount(count);
  if (pop && readout) {
    readout.classList.remove('pop');
    void readout.offsetWidth;
    readout.classList.add('pop');
  }
}

minus?.addEventListener('click', () => {
  count = Math.max(0, count - 1);
  render(true);
});

plus?.addEventListener('click', () => {
  count += 1;
  render(true);
});

reset?.addEventListener('click', () => {
  count = 0;
  render(false);
});

form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = greet(nameInput ? nameInput.value : '');
  if (greetOut) greetOut.textContent = msg;
  console.log(msg);
});

themeBtn?.addEventListener('click', () => {
  const root = document.documentElement;
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  root.dataset.theme = next;
  themeBtn.textContent = next === 'light' ? 'Switch to dark' : 'Switch to light';
});

logBtn?.addEventListener('click', () => {
  console.log('bench check:', greet('Neverview'), '-', formatCount(count));
});

render(false);
`,
  },
  {
    path: "/lib.js",
    type: "file",
    mtime: Date.now(),
    content: `export function greet(name) {
  const clean = String(name || '').trim() || 'Neverview';
  return 'Hello from ' + clean + '!';
}

export function formatCount(n) {
  const num = Number(n) || 0;
  return num + (num === 1 ? ' press' : ' presses');
}
`,
  },
  {
    path: "/README.md",
    type: "file",
    mtime: Date.now(),
    content:
      "# Neverview v2 - seed bench\n\nSmall interactive starter. Edit files on the left, preview updates live.\n\n- index.html - header, hero and playground layout\n- style.css - bench theme, dark and light via data-theme\n- app.js - counter, greeter form, theme toggle, console demo\n- lib.js - greet(name) and formatCount(n), imported by app.js\n\nTry: press +, submit the greeter, toggle the theme, then open the Console panel below the preview.\n",
  },
];

function seedMap(): Record<string, VNode> {
  const m: Record<string, VNode> = {
    "/": { path: "/", type: "dir", content: "", mtime: Date.now() },
  };
  for (const f of SEED) m[f.path] = { ...f };
  return m;
}

export function seedFileMap(): Record<string, VNode> {
  return seedMap();
}

export function blankFileMap(): Record<string, VNode> {
  const now = Date.now();
  return {
    "/": { path: "/", type: "dir", content: "", mtime: now },
    "/index.html": {
      path: "/index.html",
      type: "file",
      mtime: now,
      content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Blank project</title>
</head>
<body>
  <h1>Blank project</h1>
</body>
</html>
`,
    },
  };
}

export function cloneFileMap(
  src: Record<string, VNode>,
): Record<string, VNode> {
  const out: Record<string, VNode> = {};
  for (const [k, v] of Object.entries(src)) out[k] = { ...v };
  if (!out["/"])
    out["/"] = { path: "/", type: "dir", content: "", mtime: Date.now() };
  return out;
}

function loadInitial(): Record<string, VNode> {
  // Active-project content is loaded by projects.ts after init.
  // Keep SSR/initial render deterministic: start from seed.
  // Migration from the legacy single-workspace key happens in projects.ts.
  return seedMap();
}

export const files = writable<Record<string, VNode>>(loadInitial());
export const activePath = writable<string>("/index.html");
export const openTabs = writable<string[]>(["/index.html"]);
export const dirtyPaths = writable<Set<string>>(new Set());

export function ensureDir(path: string) {
  path = normalize(path);
  const snap = get(files);
  if (snap[path]) return;
  const parent = dirname(path);
  if (parent !== path) ensureDir(parent);
  const f = { ...get(files) };
  f[path] = { path, type: "dir", content: "", mtime: Date.now() };
  files.set(f);
}

export function createFile(path: string, content = "") {
  path = normalize(path);
  const f = { ...get(files) };
  if (f[path]) throw new Error("exists");
  ensureDir(dirname(path));
  f[path] = { path, type: "file", content, mtime: Date.now() };
  files.set({ ...get(files), [path]: f[path] });
  openFile(path);
}

export function createFolder(path: string) {
  path = normalize(path);
  const f = get(files);
  if (f[path]) throw new Error("exists");
  ensureDir(path);
}

export function writeFile(path: string, content: string) {
  path = normalize(path);
  const f = get(files);
  const n = f[path];
  if (!n || n.type !== "file") return;
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
  if (snap[newP]) throw new Error("target exists");
  ensureDir(dirname(newP));
  const f = { ...get(files) };
  if (node.type === "file") {
    delete f[oldP];
    f[newP] = { ...node, path: newP, mtime: Date.now() };
  } else {
    for (const k of Object.keys(snap)) {
      if (k === oldP || k.startsWith(oldP + "/")) {
        const nk = newP + k.slice(oldP.length);
        f[nk] = { ...snap[k], path: nk, mtime: Date.now() };
        if (nk !== k) delete f[k];
      }
    }
  }
  files.set(f);
  const tabs = get(openTabs).map((t) =>
    t === oldP
      ? newP
      : t.startsWith(oldP + "/")
        ? newP + t.slice(oldP.length)
        : t,
  );
  openTabs.set(tabs);
  if (get(activePath) === oldP || get(activePath).startsWith(oldP + "/")) {
    activePath.set(get(activePath).replace(oldP, newP));
  }
}

export function removePath(path: string) {
  path = normalize(path);
  if (path === "/") return;
  const f = { ...get(files) };
  for (const k of Object.keys(f)) {
    if (k === path || k.startsWith(path + "/")) delete f[k];
  }
  files.set(f);
  openTabs.set(
    get(openTabs).filter((t) => t !== path && !t.startsWith(path + "/")),
  );
  if (get(activePath) === path || get(activePath).startsWith(path + "/")) {
    const rest = get(openTabs);
    activePath.set(rest[0] ?? "/index.html");
  }
}

export function openFile(path: string) {
  path = normalize(path);
  const f = get(files);
  if (!f[path] || f[path].type !== "file") return;
  const tabs = get(openTabs);
  if (!tabs.includes(path)) openTabs.set([...tabs, path]);
  activePath.set(path);
}

export function closeTab(path: string) {
  const tabs = get(openTabs).filter((t) => t !== path);
  openTabs.set(tabs);
  if (get(activePath) === path) activePath.set(tabs[tabs.length - 1] ?? "");
}

export function closeOthers(keep: string) {
  keep = normalize(keep);
  const tabs = get(openTabs).filter((t) => t === keep);
  openTabs.set(tabs.length ? tabs : [keep]);
  activePath.set(keep);
}

export function closeToRight(keep: string) {
  keep = normalize(keep);
  const tabs = get(openTabs);
  const i = tabs.indexOf(keep);
  if (i < 0) return;
  openTabs.set(tabs.slice(0, i + 1));
  activePath.set(keep);
}

export function closeAll() {
  openTabs.set([]);
  activePath.set("");
}

export function reorderTabs(from: string, to: string) {
  from = normalize(from);
  to = normalize(to);
  if (from === to) return;
  const tabs = [...get(openTabs)];
  const fi = tabs.indexOf(from);
  const ti = tabs.indexOf(to);
  if (fi < 0 || ti < 0) return;
  tabs.splice(fi, 1);
  tabs.splice(ti, 0, from);
  openTabs.set(tabs);
}

export function moveTabTo(from: string, index: number) {
  from = normalize(from);
  const tabs = get(openTabs).filter((t) => t !== from);
  const clamped = Math.max(0, Math.min(index, tabs.length));
  tabs.splice(clamped, 0, from);
  openTabs.set(tabs);
}

export function resetWorkspace() {
  // Per-project reset: only resets the active working set.
  // Persistence is owned by projects.ts (subscribed to these stores).
  files.set(seedMap());
  openTabs.set(["/index.html"]);
  activePath.set("/index.html");
}

export interface TreeNode {
  path: string;
  name: string;
  type: NodeType;
  children: TreeNode[];
}

export function buildTree(f: Record<string, VNode>): TreeNode[] {
  const root: TreeNode = { path: "/", name: "/", type: "dir", children: [] };
  const byPath: Record<string, TreeNode> = { "/": root };
  const dirs = Object.values(f)
    .filter((n) => n.type === "dir")
    .sort((a, b) => a.path.localeCompare(b.path));
  const fileNodes = Object.values(f)
    .filter((n) => n.type === "file")
    .sort((a, b) => a.path.localeCompare(b.path));
  for (const d of dirs) {
    if (d.path === "/") continue;
    const parent = byPath[dirname(d.path)] ?? root;
    const node: TreeNode = {
      path: d.path,
      name: basename(d.path),
      type: "dir",
      children: [],
    };
    byPath[d.path] = node;
    parent.children.push(node);
  }
  for (const fl of fileNodes) {
    const parent = byPath[dirname(fl.path)] ?? root;
    parent.children.push({
      path: fl.path,
      name: basename(fl.path),
      type: "file",
      children: [],
    });
  }
  const sortFn = (a: TreeNode, b: TreeNode) =>
    a.type !== b.type
      ? a.type === "dir"
        ? -1
        : 1
      : a.name.localeCompare(b.name);
  const walk = (n: TreeNode) => {
    n.children.sort(sortFn);
    n.children.forEach(walk);
  };
  walk(root);
  return root.children;
}
