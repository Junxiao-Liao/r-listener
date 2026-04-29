<script lang="ts">
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import { Input } from '$shared/components/ui/input';
	import { isEditor } from '$shared/auth/role';
	import { useSessionQuery } from '$shared/query/session.query';
	import { usePlaylistsQuery } from '$shared/query/playlists.query';
	import PlaylistRow from './components/PlaylistRow.svelte';

	const session = useSessionQuery();
	const editor = $derived(isEditor($session.data));

	let q = $state('');
	const playlists = usePlaylistsQuery(() => ({
		sort: 'updatedAt:desc',
		q: q.trim() || undefined
	}));

	const items = $derived($playlists.data?.items ?? []);
</script>

<section class="flex flex-col gap-4 py-6">
	<header class="flex items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">{m.playlists_title()}</h1>
		{#if editor}
			<Button href="/playlists/new">{m.playlists_create()}</Button>
		{/if}
	</header>

	<Input
		type="search"
		placeholder={m.playlists_search_placeholder()}
		bind:value={q}
		class="max-w-md"
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
				<Button variant="outline" href="/playlists/new">{m.playlists_create()}</Button>
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
