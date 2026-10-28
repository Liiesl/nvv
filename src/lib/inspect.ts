export interface InspectPayload {
	tag: string;
	id: string;
	classes: string[];
	selector: string;
	width: number;
	height: number;
	outerHtml: string;
}

export type InspectKind = "inspect-hover" | "inspect-select" | "inspect-escape" | "inspect-leave";

export function isInspectKind(kind: string | undefined): kind is InspectKind {
	return (
		kind === "inspect-hover" ||
		kind === "inspect-select" ||
		kind === "inspect-escape" ||
		kind === "inspect-leave"
	);
}

/** Build a unique-ish CSS selector for an element (parent-side fallback). */
export function buildSelectorPath(tag: string, id: string, classes: string[]): string {
	const t = tag.toLowerCase() || "div";
	if (id) return `${t}#${id}`;
	if (classes.length) return `${t}.${classes.slice(0, 2).join(".")}`;
	return t;
}

export function describeInspect(p: InspectPayload | null): string {
	if (!p) return "";
	const id = p.id ? `#${p.id}` : "";
	const cls = p.classes.length ? `.${p.classes.slice(0, 3).join(".")}` : "";
	return `${p.tag}${id}${cls} ${p.width}x${p.height}`;
}
