<script lang="ts">
	import { goto } from '$app/navigation';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Clock3 from '@lucide/svelte/icons/clock-3';
	import History from '@lucide/svelte/icons/history';
	import Library from '@lucide/svelte/icons/library';
	import ListMusic from '@lucide/svelte/icons/list-music';
	import PlayCircle from '@lucide/svelte/icons/play-circle';
	import Search from '@lucide/svelte/icons/search';
	import Upload from '@lucide/svelte/icons/upload';
	import User from '@lucide/svelte/icons/user';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import { Input } from '$shared/components/ui/input';
	import { useSessionQuery } from '$shared/query/session.query';
	import { useContinueListeningQuery, useRecentTracksQuery } from '$shared/query/playback.query';
	import { useTracksInfiniteQuery } from '$shared/query/tracks.query';
	import { usePlaylistsQuery } from '$shared/query/playlists.query';
	import { isEditor } from '$shared/auth/role';
	import TrackRow from '../library/components/TrackRow.svelte';
	import PlaylistRow from '../playlists/components/PlaylistRow.svelte';

	const session = useSessionQuery();
	const continueListening = useContinueListeningQuery();
	const recentTracks = useRecentTracksQuery();
	const recentUploaded = useTracksInfiniteQuery(() => ({
		sort: 'createdAt:desc'
	}));
	const recentPlaylists = usePlaylistsQuery(() => ({
		sort: 'updatedAt:desc'
	}));

	let q = $state('');

	const activeMembership = $derived(
		$session.data?.tenants.find((t) => t.tenantId === $session.data?.activeTenantId) ?? null
	);
	const editor = $derived(isEditor($session.data));
	const continueItems = $derived($continueListening.data?.items.slice(0, 3) ?? []);
	const recentItems = $derived($recentTracks.data?.items.slice(0, 4) ?? []);
	const uploadedItems = $derived($recentUploaded.data?.pages.flatMap((p) => p.items).slice(0, 4) ?? []);
	const playlistItems = $derived($recentPlaylists.data?.items.slice(0, 4) ?? []);

	function submitSearch(event: SubmitEvent) {
		event.preventDefault();
		const value = q.trim();
		if (!value) return;
		void goto(`/search?q=${encodeURIComponent(value)}`);
	}
</script>

{#if $session.data}
	<section class="flex flex-col gap-6 py-6">
		<header class="flex items-center justify-between">
			<Button variant="ghost" href="/tenants" class="h-auto flex items-center gap-1.5 px-2 py-1 -ml-2 text-xl font-semibold hover:bg-muted/50 rounded-md transition-colors">
				<span>{activeMembership?.tenantName ?? '—'}</span>
				<ChevronDown class="size-4 text-muted-foreground" />
			</Button>
			<div class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
				<User class="size-4" />
				<span>{$session.data.user.username}</span>
			</div>
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

		<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
			<Button href="/library" variant="outline">
				<Library class="size-4" />
				<span>{m.nav_library()}</span>
			</Button>
			<Button href="/playlists" variant="outline">
				<ListMusic class="size-4" />
				<span>{m.nav_playlists()}</span>
			</Button>
			<Button href="/player" variant="outline">
				<PlayCircle class="size-4" />
				<span>{m.nav_player()}</span>
			</Button>
			{#if editor}
				<Button variant="outline" href="/library/upload">
					<Upload class="size-4" />
					<span>{m.nav_upload()}</span>
				</Button>
			{/if}
		</div>

		<section class="flex flex-col gap-2">
			<div class="flex items-center justify-between gap-2">
				<h2 class="flex items-center gap-2 text-base font-semibold">
					<Clock3 class="size-4" />
					<span>{m.home_continue_listening()}</span>
				</h2>
			</div>
			{#if $continueListening.isPending}
				<p class="text-sm text-muted-foreground">{m.home_loading()}</p>
			{:else if $continueListening.isError}
				<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{m.home_section_error()}</p>
			{:else if continueItems.length === 0}
				<p class="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
					{m.home_continue_empty()}
				</p>
			{:else}
				<ul class="flex flex-col gap-1">
					{#each continueItems as item (item.track.id)}
						<li><TrackRow track={item.track} siblings={continueItems.map((i) => i.track)} /></li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="flex flex-col gap-2">
			<h2 class="flex items-center gap-2 text-base font-semibold">
				<History class="size-4" />
				<span>{m.home_recently_played()}</span>
			</h2>
			{#if $recentTracks.isPending}
				<p class="text-sm text-muted-foreground">{m.home_loading()}</p>
			{:else if $recentTracks.isError}
				<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{m.home_section_error()}</p>
			{:else if recentItems.length === 0}
				<p class="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
					{m.home_recent_empty()}
				</p>
			{:else}
				<ul class="flex flex-col gap-1">
					{#each recentItems as item (item.track.id)}
						<li><TrackRow track={item.track} siblings={recentItems.map((i) => i.track)} /></li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="flex flex-col gap-2">
			<div class="flex items-center justify-between gap-2">
				<h2 class="text-base font-semibold">{m.home_recently_uploaded()}</h2>
			</div>
			{#if $recentUploaded.isPending}
				<p class="text-sm text-muted-foreground">{m.home_loading()}</p>
			{:else if $recentUploaded.isError}
				<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{m.home_section_error()}</p>
			{:else if uploadedItems.length === 0}
				<p class="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
					{m.home_uploaded_empty()}
				</p>
			{:else}
				<ul class="flex flex-col gap-1">
					{#each uploadedItems as track (track.id)}
						<li><TrackRow {track} siblings={uploadedItems} /></li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="flex flex-col gap-2">
			<div class="flex items-center justify-between gap-2">
				<h2 class="text-base font-semibold">{m.home_recently_updated_playlists()}</h2>
			</div>
			{#if $recentPlaylists.isPending}
				<p class="text-sm text-muted-foreground">{m.home_loading()}</p>
			{:else if $recentPlaylists.isError}
				<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{m.home_section_error()}</p>
			{:else if playlistItems.length === 0}
				<p class="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
					{m.home_playlists_empty()}
				</p>
			{:else}
				<ul class="flex flex-col gap-1">
					{#each playlistItems as playlist (playlist.id)}
						<li><PlaylistRow {playlist} /></li>
					{/each}
				</ul>
			{/if}
		</section>
	</section>
{/if}
