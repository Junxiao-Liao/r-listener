<script lang="ts">
	import { onMount } from 'svelte';
	import { setLocale } from '$shared/paraglide/runtime';
	import '../app.css';
	import favicon from '$shared/assets/favicon.svg';
	import { applyThemeFromCookie } from '$shared/theme/theme';

	let { children } = $props();

	if (typeof document !== 'undefined') {
		const lang = document.documentElement.lang;
		if (lang === 'en' || lang === 'zh') {
			void setLocale(lang, { reload: false });
		}
	}

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
