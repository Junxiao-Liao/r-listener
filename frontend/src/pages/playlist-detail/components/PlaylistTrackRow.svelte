<script lang="ts">
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { isEditor } from '$shared/auth/role';
	import * as m from '$shared/paraglide/messages';
	import { formatDurationMs } from '$shared/format/duration';
	import { useSessionQuery } from '$shared/query/session.query';
	import { useRemovePlaylistTrackMutation } from '$shared/query/playlists.query';
	import { usePlayListMutation } from '$shared/player/play-list';
	import { getPlayer } from '$shared/player/player.context';
	import type { Id, PlaylistTrackDto } from '$shared/types/dto';

	type Props = {
		item: PlaylistTrackDto;
		siblings: PlaylistTrackDto[];
		playlistId: Id<'playlist'>;
	};
	let { item, siblings, playlistId }: Props = $props();

	const session = useSessionQuery();
	const editor = $derived(isEditor($session.data));
	const playList = usePlayListMutation();
	const remove = useRemovePlaylistTrackMutation(playlistId);
	const player = getPlayer();

	const subtitle = $derived(
		[item.track.artist, item.track.album]
			.filter((v): v is string => !!v && v.length > 0)
			.join(' · ')
	);

	async function play() {
		const tracks = siblings.map((s) => s.track).filter((t) => t.status === 'ready');
		const state = await $playList.mutateAsync({ tracks, startTrackId: item.track.id });
		player.setQueueState(state, { autoplay: true });
	}

	async function removeTrack() {
		await $remove.mutateAsync({ trackId: item.track.id });
	}
</script>

<div class="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted focus-within:bg-muted">
	<span class="w-6 text-right text-xs text-muted-foreground tabular-nums">{item.position}</span>
	<button
		type="button"
		disabled={item.track.status !== 'ready' || $playList.isPending}
		class="flex min-w-0 flex-1 flex-col text-left disabled:cursor-not-allowed disabled:opacity-70"
		onclick={play}
	>
		<span class="truncate text-sm font-medium">{item.track.title}</span>
		{#if subtitle.length > 0}
			<span class="truncate text-xs text-muted-foreground">{subtitle}</span>
		{/if}
	</button>
	<span class="shrink-0 text-xs text-muted-foreground tabular-nums">
		{formatDurationMs(item.track.durationMs)}
	</span>
	{#if editor}
		<button
			type="button"
			class="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
			aria-label={m.playlist_track_remove()}
			disabled={$remove.isPending}
			onclick={removeTrack}
		>
			<Trash2 class="size-4" />
		</button>
	{/if}
</div>
