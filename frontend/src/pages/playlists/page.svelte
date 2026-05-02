<script lang="ts">
	import * as m from '$shared/paraglide/messages';
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '$shared/components/ui/button';
	import SearchBar from '$shared/components/SearchBar.svelte';
	import { isEditor } from '$shared/auth/role';
	import { useSessionQuery } from '$shared/query/session.query';
	import { usePlaylistsQuery } from '$shared/query/playlists.query';
	import PlaylistRow from './components/PlaylistRow.svelte';

	const session = useSessionQuery();
	const editor = $derived(isEditor($session.data));

	let draftQ = $state('');
	let appliedQ = $state('');
	const playlists = usePlaylistsQuery(() => ({
		sort: 'updatedAt:desc',
		q: appliedQ || undefined
	}));

	const items = $derived($playlists.data?.items ?? []);

	$effect(() => {
		if (draftQ.length === 0 && appliedQ.length > 0) {
			appliedQ = '';
		}
	});

	$effect(() => {
		void appliedQ;
		$playlists.refetch();
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
		<h1 class="text-2xl font-semibold">{m.playlists_title()}</h1>
		{#if editor}
			<Button variant="outline" href="/playlists/new">
				<Plus class="size-4" />
				<span>{m.playlists_create()}</span>
			</Button>
		{/if}
	</header>

	<SearchBar
		bind:value={draftQ}
		placeholder={m.playlists_search_placeholder()}
		class="max-w-md"
		onsubmit={submitSearch}
		onclear={clearSearch}
	/>

	{#if $playlists.isPending}
		<p class="text-sm text-muted-foreground">{m.playlists_loading()}</p>
	{:else if $playlists.isError}
		<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{m.playlists_error()}
		</p>
	{:else if items.length === 0}
		<div class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-10 text-center">
			<p class="text-sm font-medium">{m.playlists_empty_title()}</p>
			<p class="text-xs text-muted-foreground">{m.playlists_empty_hint()}</p>
			{#if editor}
				<Button variant="outline" href="/playlists/new">
					<Plus class="size-4" />
					<span>{m.playlists_create()}</span>
				</Button>
			{/if}
		</div>
	{:else}
		<ul class="flex flex-col gap-1">
			{#each items as playlist (playlist.id)}
				<li><PlaylistRow {playlist} /></li>
			{/each}
		</ul>
	{/if}
</section>
