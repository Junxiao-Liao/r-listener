<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import { parseSyncedLrc, type LrcLine } from '$shared/lyrics/lyrics';
	import { formatDurationMs } from '$shared/format/duration';
	import { cn } from '$shared/utils';
	import { trackArtistDisplay } from '$shared/artists/artists';
	import { getPlayer } from '$shared/player/player.context';

	const player = getPlayer();

	const lines: LrcLine[] = $derived.by(() => {
		const t = player.currentTrack;
		if (!t || t.lyricsStatus !== 'synced' || !t.lyricsLrc) return [];
		return parseSyncedLrc(t.lyricsLrc);
	});

	const activeIndex = $derived.by(() => {
		const ms = player.currentTimeMs;
		let idx = -1;
		for (let i = 0; i < lines.length; i++) {
			if (lines[i]!.timeMs <= ms) idx = i;
			else break;
		}
		return idx;
	});

	function onLineClick(line: LrcLine) {
		player.seek(line.timeMs);
		if (!player.isPlaying) player.play();
	}
</script>

<section class="flex flex-col gap-4 py-4">
	<header class="flex items-center gap-2">
		<a
			href="/player"
			class="grid size-9 place-items-center rounded-full hover:bg-muted"
			aria-label={m.lyrics_back_to_player()}
		>
			<ArrowLeft class="size-5" />
		</a>
		<h1 class="text-lg font-semibold">{m.lyrics_title()}</h1>
	</header>

	{#if !player.currentTrack}
		<p class="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
			{m.lyrics_no_track()}
		</p>
	{:else}
		{@const t = player.currentTrack}
		{@const artists = trackArtistDisplay(t)}
		<div class="flex items-center gap-3">
			<span class="flex flex-1 flex-col">
				<span class="text-sm font-medium">{t.title}</span>
				{#if artists}
					<span class="text-xs text-muted-foreground">{artists}</span>
				{/if}
			</span>
		</div>

		{#if t.lyricsStatus === 'none' || !t.lyricsLrc}
			<p class="text-sm text-muted-foreground">{m.track_lyrics_none()}</p>
		{:else if t.lyricsStatus === 'invalid'}
			<p class="text-sm text-amber-700 dark:text-amber-300">{m.track_lyrics_invalid()}</p>
			<pre class="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{t.lyricsLrc}</pre>
		{:else if t.lyricsStatus === 'plain'}
			<pre class="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{t.lyricsLrc}</pre>
		{:else}
			<ul class="flex flex-col gap-1 pb-12">
				{#each lines as line, i (i)}
					<li>
						<button
							type="button"
							class={cn(
								'w-full flex items-baseline gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
								i === activeIndex
									? 'bg-muted text-foreground font-medium'
									: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
							)}
							onclick={() => onLineClick(line)}
						>
							<span class="shrink-0 tabular-nums text-xs text-muted-foreground/70">
								{formatDurationMs(line.timeMs)}
							</span>
							<span>{line.text || ' '}</span>
						</button>
					</li>
				{/each}
			</ul>
			{#if lines.length === 0}
				<p class="text-sm text-muted-foreground">{m.track_lyrics_none()}</p>
			{/if}
		{/if}

		<Button variant="outline" href="/player">{m.lyrics_back_to_player()}</Button>
	{/if}
</section>
