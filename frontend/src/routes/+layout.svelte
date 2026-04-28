<script lang="ts">
	import { onMount } from 'svelte';
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { setLocale, getLocale } from '$shared/paraglide/runtime';
	import { applyThemeFromCookie } from '$shared/theme/theme';
	import { createQueryClient } from '$shared/query/client';
	import favicon from '$shared/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();

	const queryClient = createQueryClient();

	if (typeof document !== 'undefined') {
		const lang = document.documentElement.lang;
		if ((lang === 'en' || lang === 'zh') && getLocale() !== lang) {
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

<QueryClientProvider client={queryClient}>
	{@render children()}
</QueryClientProvider>
