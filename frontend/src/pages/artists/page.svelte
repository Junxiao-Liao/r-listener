<script lang="ts">
	import * as m from '$shared/paraglide/messages';
	import SearchBar from '$shared/components/SearchBar.svelte';
	import { useArtistsQuery } from '$shared/query/artists.query';
	import ArtistRow from './components/ArtistRow.svelte';

	let draftQ = $state('');
	let appliedQ = $state('');
	const artists = useArtistsQuery(() => ({
		q: appliedQ || undefined
	}));

	const items = $derived($artists.data?.items ?? []);

	$effect(() => {
		if (draftQ.length === 0 && appliedQ.length > 0) {
			appliedQ = '';
		}
	});

	$effect(() => {
		void appliedQ;
		$artists.refetch();
	});

	function submitSearch(event: SubmitEvent) {
		event.preventDefault();
		appliedQ = draftQ.trim();
	}

	function clearSearch() {
		draftQ = '';
		appliedQ = '';
	}
</script>

<section class="flex flex-col gap-4 py-6">
	<header class="flex items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">{m.artists_title()}</h1>
	</header>

	<SearchBar
		bind:value={draftQ}
		placeholder={m.artists_search_placeholder()}
		class="max-w-md"
		onsubmit={submitSearch}
		onclear={clearSearch}
	/>

	{#if $artists.isPending}
		<p class="text-sm text-muted-foreground">{m.artists_loading()}</p>
	{:else if $artists.isError}
		<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{m.artists_error()}
		</p>
	{:else if items.length === 0}
		<p class="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
			{m.artists_empty()}
		</p>
	{:else}
		<ul class="flex flex-col gap-1">
			{#each items as artist (artist.id)}
				<li><ArtistRow {artist} /></li>
			{/each}
		</ul>
	{/if}
</section>
