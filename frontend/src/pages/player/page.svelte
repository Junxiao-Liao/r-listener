<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ListMusic from '@lucide/svelte/icons/list-music';
	import Mic2 from '@lucide/svelte/icons/mic-2';
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import SkipBack from '@lucide/svelte/icons/skip-back';
	import SkipForward from '@lucide/svelte/icons/skip-forward';
	import * as m from '$shared/paraglide/messages';
	import CoverPlaceholder from '$shared/cover/CoverPlaceholder.svelte';
	import { formatDurationMs } from '$shared/format/duration';
	import { trackArtistDisplay } from '$shared/artists/artists';
	import { getPlayer } from '$shared/player/player.context';

	const player = getPlayer();

	const durationMs = $derived(player.durationMs || player.currentTrack?.durationMs || 0);

	function onScrubInput(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const ms = Number(input.value);
		player.seek(ms);
	}
</script>

<section class="flex flex-col gap-6 py-4">
	<header class="flex items-center justify-between">
		<a
			href="/"
			class="grid size-9 place-items-center rounded-full hover:bg-muted"
			aria-label={m.player_back()}
		>
			<ChevronDown class="size-5" />
		</a>
		<h1 class="text-sm font-medium uppercase tracking-wide text-muted-foreground">
			{m.player_open_full()}
		</h1>
		<a
			href="/queue"
			class="grid size-9 place-items-center rounded-full hover:bg-muted"
			aria-label={m.player_view_queue()}
		>
			<ListMusic class="size-5" />
		</a>
	</header>

	{#if !player.currentTrack}
		<div class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-16 text-center">
			<p class="text-sm text-muted-foreground">{m.player_no_track()}</p>
			<p class="text-xs text-muted-foreground">{m.player_no_track_hint()}</p>
		</div>
	{:else}
		{@const t = player.currentTrack}
		{@const artists = trackArtistDisplay(t)}
		<div class="flex flex-col items-center gap-6 px-4">
			<CoverPlaceholder seed={t.title} class="aspect-square w-full max-w-[18rem] text-5xl" />

			<div class="flex w-full flex-col items-center gap-1 text-center">
				<h2 class="line-clamp-2 text-xl font-semibold">{t.title}</h2>
				{#if artists || t.album}
					<p class="line-clamp-1 text-sm text-muted-foreground">
						{[artists, t.album].filter(Boolean).join(' · ')}
					</p>
				{/if}
			</div>

			<div class="flex w-full flex-col gap-1">
				<input
					type="range"
					min={0}
					max={durationMs > 0 ? durationMs : 1}
					step={1000}
					value={player.currentTimeMs}
					oninput={onScrubInput}
					aria-label={m.player_seek()}
					class="w-full cursor-pointer accent-foreground"
				/>
				<div class="flex justify-between text-xs tabular-nums text-muted-foreground">
					<span>{formatDurationMs(player.currentTimeMs)}</span>
					<span>{formatDurationMs(durationMs)}</span>
				</div>
			</div>

			<div class="flex items-center gap-6">
				<button
					type="button"
					class="grid size-12 place-items-center rounded-full hover:bg-muted"
					aria-label={m.player_prev()}
					onclick={() => player.prev()}
				>
					<SkipBack class="size-6" />
				</button>
				<button
					type="button"
					class="grid size-16 place-items-center rounded-full bg-foreground text-background hover:opacity-90"
					aria-label={player.isPlaying ? m.player_pause() : m.player_play()}
					onclick={() => player.togglePlay()}
				>
					{#if player.isPlaying}
						<Pause class="size-7" />
					{:else}
						<Play class="size-7" />
					{/if}
				</button>
				<button
					type="button"
					class="grid size-12 place-items-center rounded-full hover:bg-muted"
					aria-label={m.player_next()}
					onclick={() => player.next()}
				>
					<SkipForward class="size-6" />
				</button>
			</div>

			<div class="flex w-full items-center justify-around pt-2">
				<a
					href="/player/lyrics"
					class="flex flex-col items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
				>
					<Mic2 class="size-5" />
					<span>{m.player_view_lyrics()}</span>
				</a>
				<a
					href="/queue"
					class="flex flex-col items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
				>
					<ListMusic class="size-5" />
					<span>{m.player_view_queue()}</span>
				</a>
			</div>
		</div>
	{/if}
</section>
