<script lang="ts">
	import { goto } from '$app/navigation';
	import Search from '@lucide/svelte/icons/search';
	import Upload from '@lucide/svelte/icons/upload';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import { Input } from '$shared/components/ui/input';
	import { useSessionQuery } from '$shared/query/session.query';
	import { useTracksInfiniteQuery } from '$shared/query/tracks.query';
	import { isEditor } from '$shared/auth/role';
	import TrackRow from './components/TrackRow.svelte';

	const session = useSessionQuery();
	const editor = $derived(isEditor($session.data));

	const tracks = useTracksInfiniteQuery(() => ({
		sort: 'createdAt:desc'
	}));

	const items = $derived($tracks.data?.pages.flatMap((p) => p.items) ?? []);
	const hasMore = $derived(!!$tracks.hasNextPage);
	const loadingMore = $derived($tracks.isFetchingNextPage);

	let q = $state('');

	function submitSearch(event: SubmitEvent) {
		event.preventDefault();
		const value = q.trim();
		if (!value) return;
		void goto(`/search?q=${encodeURIComponent(value)}`);
	}
</script>

<section class="flex flex-col gap-4 py-6">
	<header class="flex items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">{m.library_title()}</h1>
		{#if editor}
			<Button variant="outline" href="/library/upload">
				<Upload class="size-4" />
				<span>{m.library_upload()}</span>
			</Button>
		{/if}
	</header>

	<form class="flex gap-2" onsubmit={submitSearch} role="search">
		<Input
			type="search"
			placeholder={m.home_search_placeholder()}
			bind:value={q}
			aria-label={m.home_search_placeholder()}
			class="min-w-0 flex-1"
		/>
		<Button type="submit" disabled={q.trim().length === 0}>
			<Search class="size-4" />
			<span>{m.search_submit()}</span>
		</Button>
	</form>

	{#if $tracks.isPending}
		<ul class="flex flex-col gap-2" aria-busy="true">
			{#each Array.from({ length: 6 }) as _, i (i)}
				<li class="flex items-center gap-3 rounded-lg px-3 py-2">
					<span class="size-12 rounded-md bg-muted"></span>
					<span class="flex flex-1 flex-col gap-1">
						<span class="h-3 w-1/3 rounded bg-muted"></span>
						<span class="h-2 w-1/2 rounded bg-muted/70"></span>
					</span>
				</li>
			{/each}
		</ul>
	{:else if $tracks.isError}
		<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{m.library_error()}
		</p>
	{:else if items.length === 0}
		<div class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-10 text-center">
			<p class="text-sm text-muted-foreground">{m.library_empty()}</p>
			{#if editor}
				<Button variant="outline" href="/library/upload">
					<Upload class="size-4" />
					<span>{m.library_upload()}</span>
				</Button>
			{/if}
		</div>
	{:else}
		<ul class="flex flex-col gap-1">
			{#each items as track (track.id)}
				<li>
					<TrackRow {track} siblings={items} />
				</li>
			{/each}
		</ul>

		{#if hasMore}
			<div class="flex justify-center pt-2">
				<Button
					variant="outline"
					disabled={loadingMore}
					onclick={() => $tracks.fetchNextPage()}
				>
					{loadingMore ? m.library_loading_more() : m.library_load_more()}
				</Button>
			</div>
		{/if}
	{/if}
</section>
