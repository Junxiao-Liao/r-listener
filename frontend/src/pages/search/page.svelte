<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Search from '@lucide/svelte/icons/search';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import { Input } from '$shared/components/ui/input';
	import { useSearchQuery } from '$shared/query/search.query';
	import PlaylistRow from '../playlists/components/PlaylistRow.svelte';
	import TrackRow from '../library/components/TrackRow.svelte';

	let q = $state(page.url.searchParams.get('q') ?? '');
	const submittedQ = $derived(page.url.searchParams.get('q')?.trim() ?? '');
	const search = useSearchQuery(() => ({ q: submittedQ, limit: 20 }));

	const tracks = $derived(
		$search.data?.items.flatMap((item) => (item.kind === 'track' ? [item.track] : [])) ?? []
	);
	const playlists = $derived(
		$search.data?.items.flatMap((item) => (item.kind === 'playlist' ? [item.playlist] : [])) ?? []
	);
	const hasResults = $derived(tracks.length > 0 || playlists.length > 0);

	$effect(() => {
		q = submittedQ;
	});

	function submitSearch(event: SubmitEvent) {
		event.preventDefault();
		const value = q.trim();
		if (!value) return;
		void goto(`/search?q=${encodeURIComponent(value)}`);
	}
</script>

<section class="flex flex-col gap-5 py-6">
	<header class="flex flex-col gap-3">
		<h1 class="text-2xl font-semibold">{m.search_title()}</h1>
		<form class="flex gap-2" onsubmit={submitSearch} role="search">
			<Input
				type="search"
				placeholder={m.search_placeholder()}
				bind:value={q}
				aria-label={m.search_placeholder()}
				class="min-w-0 flex-1"
			/>
			<Button type="submit" disabled={q.trim().length === 0}>
				<Search class="size-4" />
				<span>{m.search_submit()}</span>
			</Button>
		</form>
	</header>

	{#if submittedQ.length === 0}
		<p class="rounded-md border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
			{m.search_start_hint()}
		</p>
	{:else if $search.isPending}
		<div class="flex flex-col gap-2" aria-busy="true">
			{#each Array.from({ length: 5 }) as _, i (i)}
				<div class="flex items-center gap-3 rounded-lg px-3 py-2">
					<span class="size-12 rounded-md bg-muted"></span>
					<span class="flex flex-1 flex-col gap-1">
						<span class="h-3 w-1/3 rounded bg-muted"></span>
						<span class="h-2 w-1/2 rounded bg-muted/70"></span>
					</span>
				</div>
			{/each}
		</div>
	{:else if $search.isError}
		<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{m.search_error()}
		</p>
	{:else if !hasResults}
		<p class="rounded-md border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
			{m.search_empty({ q: submittedQ })}
		</p>
	{:else}
		{#if tracks.length > 0}
			<section class="flex flex-col gap-2">
				<h2 class="text-sm font-semibold uppercase text-muted-foreground">
					{m.search_tracks_section()}
				</h2>
				<ul class="flex flex-col gap-1">
					{#each tracks as track (track.id)}
						<li><TrackRow {track} siblings={tracks} /></li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if playlists.length > 0}
			<section class="flex flex-col gap-2">
				<h2 class="text-sm font-semibold uppercase text-muted-foreground">
					{m.search_playlists_section()}
				</h2>
				<ul class="flex flex-col gap-1">
					{#each playlists as playlist (playlist.id)}
						<li><PlaylistRow {playlist} /></li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}
</section>
