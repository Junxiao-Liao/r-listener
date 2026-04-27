<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import favicon from '$shared/assets/favicon.svg';
	import { applyThemeFromCookie } from '$shared/theme/theme';

	let { children } = $props();

	onMount(() => {
		applyThemeFromCookie();
		const media = window.matchMedia?.('(prefers-color-scheme: dark)');
		if (!media) return;
		const sync = () => applyThemeFromCookie();
		media.addEventListener('change', sync);
		return () => media.removeEventListener('change', sync);
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
