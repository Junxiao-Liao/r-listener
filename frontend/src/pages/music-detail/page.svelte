<script lang="ts">
	import { goto } from '$app/navigation';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import CoverPlaceholder from '$shared/cover/CoverPlaceholder.svelte';
	import { formatBytes, formatDurationMs } from '$shared/format/duration';
	import { getPlayer } from '$shared/player/player.context';
	import { usePlayListMutation } from '$shared/player/play-list';
	import { useAddQueueItemsMutation } from '$shared/query/queue.query';
	import { useSessionQuery } from '$shared/query/session.query';
	import {
		useDeleteTrackMutation,
		useTrackQuery
	} from '$shared/query/tracks.query';
	import { isEditor } from '$shared/auth/role';
	import type { Id } from '$shared/types/dto';

	type Props = { trackId: Id<'track'> };
	let { trackId }: Props = $props();

	const session = useSessionQuery();
	const editor = $derived(isEditor($session.data));
	const player = getPlayer();

	const track = useTrackQuery(() => trackId);
	const remove = useDeleteTrackMutation();
	const playList = usePlayListMutation();
	const addToQueue = useAddQueueItemsMutation();

	let confirmingDelete = $state(false);

	async function confirmDelete() {
		await $remove.mutateAsync({ trackId });
		void goto('/library', { replaceState: true });
	}

	async function playNow() {
		const t = $track.data;
		if (!t || t.status !== 'ready') return;
		const state = await $playList.mutateAsync({ tracks: [t], startTrackId: t.id });
		player.setQueueState(state, { autoplay: true });
	}

	async function appendToQueue() {
		const t = $track.data;
		if (!t || t.status !== 'ready') return;
		const state = await $addToQueue.mutateAsync({ trackIds: [t.id], position: null });
		player.setQueueState(state);
	}

	const subtitle = $derived(
		($track.data?.artist || '').trim() + ($track.data?.album ? ` · ${$track.data.album}` : '')
	);
</script>

<section class="flex flex-col gap-6 py-6">
	{#if $track.isPending}
		<p class="text-sm text-muted-foreground">{m.track_loading()}</p>
	{:else if $track.isError || !$track.data}
		<div class="flex flex-col gap-3">
			<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{m.track_not_found()}
			</p>
			<Button variant="outline" href="/library">{m.track_back_to_library()}</Button>
		</div>
	{:else}
		{@const t = $track.data}
		<header class="flex items-start gap-4">
			<CoverPlaceholder seed={t.title} class="size-24 text-2xl" />
			<div class="flex min-w-0 flex-1 flex-col gap-1">
				<h1 class="truncate text-xl font-semibold">{t.title}</h1>
				{#if subtitle.length > 0}
					<p class="truncate text-sm text-muted-foreground">{subtitle}</p>
				{/if}
				<p class="text-xs text-muted-foreground">
					{formatDurationMs(t.durationMs)}
					{#if t.year}
						· {t.year}
					{/if}
					{#if t.genre}
						· {t.genre}
					{/if}
				</p>
			</div>
		</header>

		{#if t.status === 'ready'}
			<div class="flex flex-col gap-2 sm:flex-row">
				<Button disabled={$playList.isPending} onclick={playNow} class="sm:flex-1">
					{m.queue_play_now()}
				</Button>
				<Button
					variant="outline"
					disabled={$addToQueue.isPending}
					onclick={appendToQueue}
					class="sm:flex-1"
				>
					{m.queue_add_to_end()}
				</Button>
			</div>
		{:else}
			<p class="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
				{m.track_pending_hint()}
			</p>
		{/if}

		<dl class="grid grid-cols-1 gap-2 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2">
			<div class="flex justify-between gap-3">
				<dt class="text-muted-foreground">{m.track_field_track_number()}</dt>
				<dd>{t.trackNumber ?? '—'}</dd>
			</div>
			<div class="flex justify-between gap-3">
				<dt class="text-muted-foreground">{m.track_field_size()}</dt>
				<dd>{formatBytes(t.sizeBytes)}</dd>
			</div>
			<div class="flex justify-between gap-3">
				<dt class="text-muted-foreground">{m.track_field_format()}</dt>
				<dd class="truncate">{t.contentType}</dd>
			</div>
			<div class="flex justify-between gap-3">
				<dt class="text-muted-foreground">{m.track_field_uploaded()}</dt>
				<dd>{new Date(t.createdAt).toLocaleDateString()}</dd>
			</div>
		</dl>

		<section class="flex flex-col gap-2">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
				{m.track_section_lyrics()}
			</h2>
			{#if !t.lyricsLrc}
				<p class="text-sm text-muted-foreground">{m.track_lyrics_none()}</p>
			{:else if t.lyricsStatus === 'invalid'}
				<p class="text-sm text-amber-700 dark:text-amber-300">{m.track_lyrics_invalid()}</p>
				<pre class="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{t.lyricsLrc}</pre>
			{:else}
				<pre class="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{t.lyricsLrc}</pre>
			{/if}
		</section>

		{#if editor}
			<div class="flex flex-col gap-2 sm:flex-row">
				<Button variant="outline" href={`/library/${t.id}/edit`} class="sm:flex-1">
					{m.track_edit()}
				</Button>
				<Button
					variant="destructive"
					disabled={$remove.isPending}
					onclick={() => (confirmingDelete = true)}
					class="sm:flex-1"
				>
					{m.track_delete()}
				</Button>
			</div>
		{/if}

		{#if confirmingDelete}
			<div class="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
				<p class="text-sm">{m.track_delete_confirm_question()}</p>
				<p class="mt-1 text-xs text-muted-foreground">{m.track_delete_confirm_hint()}</p>
				<div class="mt-3 flex flex-col gap-2 sm:flex-row">
					<Button
						variant="destructive"
						disabled={$remove.isPending}
						onclick={confirmDelete}
						class="sm:flex-1"
					>
						{m.track_delete()}
					</Button>
					<Button
						variant="outline"
						disabled={$remove.isPending}
						onclick={() => (confirmingDelete = false)}
						class="sm:flex-1"
					>
						{m.action_cancel()}
					</Button>
				</div>
				{#if $remove.isError}
					<p class="mt-2 text-sm text-destructive">{m.track_delete_error()}</p>
				{/if}
			</div>
		{/if}
	{/if}
</section>
