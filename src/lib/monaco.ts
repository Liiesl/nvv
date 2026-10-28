// Local Monaco bundled from the `monaco-editor` npm dependency (no CDN).
// The editor API is lazy-loaded in the browser so it never runs during SSR.
// The editor web worker is bundled by Vite via `?worker`. Language workers
// (css/html/json/ts) are bundled automatically through
// `new URL(..., import.meta.url)` inside the package.
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';

export type MonacoApi = typeof import('monaco-editor');

let loadPromise: Promise<MonacoApi> | null = null;

export function loadMonaco(): Promise<MonacoApi> {
	if (typeof window === 'undefined') return Promise.reject(new Error('ssr'));
	if (loadPromise) return loadPromise;
	loadPromise = (async () => {
		(self as unknown as { MonacoEnvironment?: { getWorker: () => Worker } }).MonacoEnvironment =
			{
				getWorker: () => new EditorWorker()
			};
		return import('monaco-editor');
	})();
	return loadPromise;
}
