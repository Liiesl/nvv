<script lang="ts">
    import { icons, type IconDefinition, type IconName } from "#lib/icons.js";

    let {
        name,
        size = 16,
        class: cls = "",
        title,
    }: {
        name: IconName;
        size?: number;
        class?: string;
        title?: string;
    } = $props();

    const icon = $derived(icons[name] as IconDefinition);
</script>

<svg
    class="nv-icon {cls}"
    width={size}
    height={size}
    viewBox={icon.viewBox}
    fill="currentColor"
    role={title ? "img" : undefined}
    aria-hidden={title ? undefined : "true"}
>
    {#if title}<title>{title}</title>{/if}
    {#each icon.paths as path}
        <path d={path.d} fill-rule={path.fillRule} clip-rule={path.clipRule} />
    {/each}
</svg>

<style>
    .nv-icon {
        display: block;
        flex: 0 0 auto;
    }
</style>
