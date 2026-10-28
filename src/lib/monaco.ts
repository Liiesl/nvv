// Local Monaco bundled from the `monaco-editor` npm dependency (no CDN).
// The editor API is lazy-loaded in the browser so it never runs during SSR.
// All workers are bundled by Vite via `?worker` and dispatched by language
// label. Routing everything to EditorWorker breaks TS/JS/CSS/HTML/JSON
// language features (getCodeFixesAtPosition, getSyntacticDiagnostics, ...).
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/language/json/json.worker?worker";
import CssWorker from "monaco-editor/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/language/html/html.worker?worker";
import TsWorker from "monaco-editor/language/typescript/ts.worker?worker";

export type MonacoApi = typeof import("monaco-editor");

let loadPromise: Promise<MonacoApi> | null = null;

export function loadMonaco(): Promise<MonacoApi> {
	if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
	if (loadPromise) return loadPromise;
	loadPromise = (async () => {
		(
			self as unknown as {
				MonacoEnvironment?: { getWorker: (_: unknown, label: string) => Worker };
			}
		).MonacoEnvironment = {
			getWorker: (_: unknown, label: string) => {
				if (label === "json") return new JsonWorker();
				if (label === "css" || label === "scss" || label === "less") return new CssWorker();
				if (label === "html" || label === "handlebars" || label === "razor")
					return new HtmlWorker();
				if (label === "typescript" || label === "javascript") return new TsWorker();
				return new EditorWorker();
			},
		};
		return import("monaco-editor");
	})();
	return loadPromise;
}
