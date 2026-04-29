<script lang="ts">
	import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical';
	import Info from '@lucide/svelte/icons/info';
	import ListMusic from '@lucide/svelte/icons/list-music';
	import ListPlus from '@lucide/svelte/icons/list-plus';
	import Play from '@lucide/svelte/icons/play';
	import PlaySquare from '@lucide/svelte/icons/play-square';
	import { goto } from '$app/navigation';
	import * as m from '$shared/paraglide/messages';
	import { isEditor } from '$shared/auth/role';
	import { useAddQueueItemsMutation } from '$shared/query/queue.query';
	import { useSessionQuery } from '$shared/query/session.query';
	import AddToPlaylistSheet from '$shared/player/AddToPlaylistSheet.svelte';
	import { usePlayListMutation } from '$shared/player/play-list';
	import { getPlayer } from '$shared/player/player.context';
	import type { TrackDto } from '$shared/types/dto';

	type Props = {
		track: TrackDto;
		// Tracks that should populate the queue when "Play now" is invoked.
		// Defaults to [track].
		siblings?: TrackDto[];
		// Whether to show the "Show details" option (default true).
		showDetailsLink?: boolean;
	};

	let { track, siblings, showDetailsLink = true }: Props = $props();

	const session = useSessionQuery();
	const editor = $derived(isEditor($session.data));
	const addItems = useAddQueueItemsMutation();
	const playList = usePlayListMutation();
	const player = getPlayer();

	let open = $state(false);
	let showPlaylistSheet = $state(false);
	let containerEl: HTMLDivElement | undefined;
	const canQueue = $derived(track.status === 'ready');

	function close() {
		open = false;
	}

	function onWindowPointerDown(ev: PointerEvent) {
		if (!open) return;
		if (containerEl && !containerEl.contains(ev.target as Node)) close();
	}

	function onKey(ev: KeyboardEvent) {
		if (ev.key === 'Escape') close();
	}

	async function playNow() {
		close();
		const list = siblings && siblings.length > 0 ? siblings : [track];
		const state = await $playList.mutateAsync({ tracks: list, startTrackId: track.id });
		player.setQueueState(state, { autoplay: true });
	}

	async function playNext() {
		close();
		const queueLen = player.queue.length;
		const idx = player.currentItemId
			? player.queue.findIndex((q) => q.id === player.currentItemId)
			: -1;
		const insertAt = idx >= 0 ? idx + 2 : queueLen + 1;
		await $addItems.mutateAsync({
			trackIds: [track.id],
			position: insertAt > queueLen + 1 ? null : insertAt
		});
	}

	async function addToEnd() {
		close();
		await $addItems.mutateAsync({ trackIds: [track.id], position: null });
	}

	function showDetails() {
		close();
		void goto(`/library/${track.id}`);
	}

	function openPlaylistPicker() {
		close();
		showPlaylistSheet = true;
	}
</script>

<svelte:window onpointerdown={onWindowPointerDown} onkeydown={onKey} />

<div bind:this={containerEl} class="relative">
	<button
		type="button"
		class="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label="More actions"
		onclick={(e) => {
			e.preventDefault();
			e.stopPropagation();
			open = !open;
		}}
	>
		<EllipsisVertical class="size-5" />
	</button>

	{#if open}
		<div
			role="menu"
			class="absolute right-0 z-20 mt-1 flex min-w-[12rem] flex-col gap-0.5 rounded-md border border-border bg-popover p-1 text-sm shadow-md"
		>
			{#if canQueue}
				<button
					type="button"
					role="menuitem"
					class="flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted"
					onclick={playNow}
					disabled={$playList.isPending}
				>
					<Play class="size-4" />
					<span>{m.queue_play_now()}</span>
				</button>
				<button
					type="button"
					role="menuitem"
					class="flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted"
					onclick={playNext}
					disabled={$addItems.isPending}
				>
					<PlaySquare class="size-4" />
					<span>{m.queue_add_play_next()}</span>
				</button>
				<button
					type="button"
					role="menuitem"
					class="flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted"
					onclick={addToEnd}
					disabled={$addItems.isPending}
				>
					<ListPlus class="size-4" />
					<span>{m.queue_add_to_end()}</span>
				</button>
			{/if}
			{#if editor && canQueue}
				<button
					type="button"
					role="menuitem"
					class="flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted"
					onclick={openPlaylistPicker}
				>
					<ListMusic class="size-4" />
					<span>{m.track_action_add_to_playlist()}</span>
				</button>
			{/if}
			{#if showDetailsLink}
				<button
					type="button"
					role="menuitem"
					class="flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted"
					onclick={showDetails}
				>
					<Info class="size-4" />
					<span>{m.track_details()}</span>
				</button>
			{/if}
		</div>
	{/if}
</div>

{#if showPlaylistSheet}
	<AddToPlaylistSheet
		trackId={track.id}
		onclose={() => (showPlaylistSheet = false)}
	/>
{/if}
