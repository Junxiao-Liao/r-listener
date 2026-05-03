<script lang="ts">
	import * as m from '$shared/paraglide/messages';
	import SearchBar from '$shared/components/SearchBar.svelte';
	import { useArtistsQuery } from '$shared/query/artists.query';
	import type { ArtistDto } from '$shared/types/dto';
	import ArtistRow from './components/ArtistRow.svelte';

	let draftQ = $state('');
	let appliedQ = $state('');
	let sort = $state('name:asc');

	const sortOptions = [
		{ value: 'name:asc' as const, label: m.sort_name_asc },
		{ value: 'name:desc' as const, label: m.sort_name_desc }
	];

	const artists = useArtistsQuery(() => ({
		q: appliedQ || undefined
	}));

	const allItems = $derived($artists.data?.items ?? []);

	const collator = new Intl.Collator('zh-CN');
	const items = $derived(sorted(allItems, sort, collator));

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

	function sorted(list: ArtistDto[], s: string, c: Intl.Collator): ArtistDto[] {
		const [field, dir] = s.split(':');
		const desc = dir === 'desc';
		const copy = [...list];
		copy.sort((a, b) => {
			if (field === 'name') {
				return desc ? c.compare(b.name, a.name) : c.compare(a.name, b.name);
			}
			return 0;
		});
		return copy;
	}
</script>

<section class="flex flex-col gap-4 py-6">
	<header class="flex items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">{m.artists_title()}</h1>
	</header>

	<div class="flex items-center gap-2">
		<SearchBar
			bind:value={draftQ}
			placeholder={m.artists_search_placeholder()}
			class="flex-1 max-w-md"
			onsubmit={submitSearch}
			onclear={clearSearch}
		/>
		<select
			class="h-9 shrink-0 rounded-md border border-input bg-background px-2 text-sm"
			bind:value={sort}
		>
			{#each sortOptions as opt (opt.value)}
				<option value={opt.value}>{opt.label()}</option>
			{/each}
		</select>
	</div>

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
