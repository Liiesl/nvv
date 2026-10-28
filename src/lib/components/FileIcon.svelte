<script lang="ts">
    import Icon from "./Icon.svelte";
    import type { IconName } from "#lib/icons.js";

    let {
        name,
        type = "file",
        expanded = false,
    }: {
        name: string;
        type?: "file" | "dir";
        expanded?: boolean;
    } = $props();

    const ext = $derived(name.split(".").pop()?.toLowerCase() ?? "");

    const spec = $derived.by((): { icon: IconName; color: string } => {
        if (type === "dir") {
            return expanded
                ? { icon: "folder-opened", color: "#c5c5c5" }
                : { icon: "folder", color: "#c5c5c5" };
        }

        switch (ext) {
            case "html":
            case "htm":
                return { icon: "file-code", color: "#e37933" };
            case "css":
            case "scss":
            case "sass":
            case "less":
                return { icon: "file-code", color: "#519aba" };
            case "js":
            case "mjs":
            case "cjs":
                return { icon: "file-code", color: "#cbcb41" };
            case "ts":
            case "mts":
            case "cts":
                return { icon: "file-code", color: "#519aba" };
            case "json":
                return { icon: "json", color: "#cbcb41" };
            case "md":
            case "markdown":
                return { icon: "markdown", color: "#519aba" };
            case "svg":
            case "xml":
                return { icon: "file-code", color: "#a074c4" };
            default:
                return { icon: "file", color: "#d4d7d6" };
        }
    });
</script>

<span class="fileicon" style:color={spec.color}>
    <Icon name={spec.icon} />
</span>

<style>
    .fileicon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 16px;
    }
</style>
