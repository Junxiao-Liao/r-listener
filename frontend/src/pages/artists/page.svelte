<script lang="ts">
	import * as m from '$shared/paraglide/messages';
	import { Input } from '$shared/components/ui/input';
	import { useArtistsQuery } from '$shared/query/artists.query';
	import ArtistRow from './components/ArtistRow.svelte';

	let q = $state('');
	const artists = useArtistsQuery(() => ({
		q: q.trim() || undefined
	}));

	const items = $derived($artists.data?.items ?? []);
</script>

<section class="flex flex-col gap-4 py-6">
	<header class="flex items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">{m.artists_title()}</h1>
	</header>

	<Input
		type="search"
		placeholder={m.artists_search_placeholder()}
		bind:value={q}
		class="max-w-md"
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
