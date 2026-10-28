// CDN-hosted Monaco loader. No npm monaco dependency.
export const MONACO_VERSION = '0.52.2';
export const MONACO_CDN = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs`;

declare global {
	interface Window {
		require?: // eslint-disable-next-line @typescript-eslint/no-explicit-any
		((deps: string[], cb: (...args: never[]) => void) => void) & { config: (c: unknown) => void };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		monaco?: any;
	}
}

let loadPromise: Promise<unknown> | null = null;

function injectScript(src: string): Promise<void> {
	return new Promise((resolve, reject) => {
		if (document.querySelector(`script[src="${src}"]`)) return resolve();
		const s = document.createElement('script');
		s.src = src;
		s.async = true;
		s.onload = () => resolve();
		s.onerror = () => reject(new Error('monaco loader failed'));
		document.head.appendChild(s);
	});
}

export function loadMonaco(): Promise<unknown> {
	if (typeof window === 'undefined') return Promise.reject(new Error('ssr'));
	if (window.monaco) return Promise.resolve(window.monaco);
	if (loadPromise) return loadPromise;
	loadPromise = (async () => {
		// Worker proxy so CDN build works without bundling workers.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(self as any).MonacoEnvironment = {
			getWorkerUrl: () =>
				URL.createObjectURL(
					new Blob(
						[
							`self.MonacoEnvironment={baseUrl:'${MONACO_CDN}/'};importScripts('${MONACO_CDN}/base/worker/workerMain.js');`
						],
						{ type: 'text/javascript' }
					)
				)
		};
		await injectScript(`${MONACO_CDN}/loader.js`);
		await new Promise<void>((resolve, reject) => {
			try {
				window.require!.config({ paths: { vs: MONACO_CDN } });
				window.require!(['vs/editor/editor.main'], () => resolve());
				setTimeout(() => reject(new Error('monaco timeout')), 20000);
			} catch (e) {
				reject(e as Error);
			}
		});
		return window.monaco;
	})();
	return loadPromise;
}
