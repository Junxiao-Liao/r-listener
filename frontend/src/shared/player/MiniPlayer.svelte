<script lang="ts">
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import SkipForward from '@lucide/svelte/icons/skip-forward';
	import * as m from '$shared/paraglide/messages';
	import CoverPlaceholder from '$shared/cover/CoverPlaceholder.svelte';
	import { trackArtistDisplay } from '$shared/artists/artists';
	import { getPlayer } from './player.context';

	const player = getPlayer();

	const progressPct = $derived.by(() => {
		const dur = player.durationMs || player.currentTrack?.durationMs || 0;
		if (!dur) return 0;
		return Math.min(100, Math.max(0, (player.currentTimeMs / dur) * 100));
	});
</script>

{#if player.currentTrack}
	{@const t = player.currentTrack}
	<div
		class="border-t border-border bg-background/95 backdrop-blur"
		role="region"
		aria-label={m.mini_player_region()}
	>
		<a
			href="/player"
			class="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 focus:outline-none focus-visible:bg-muted/40"
		>
			<CoverPlaceholder seed={t.title} class="size-10 text-base shrink-0" />
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="truncate text-sm font-medium">{t.title}</span>
				<span class="truncate text-xs text-muted-foreground">
					{trackArtistDisplay(t)}
				</span>
			</span>
			<button
				type="button"
				class="grid size-9 place-items-center rounded-full hover:bg-muted shrink-0"
				aria-label={player.isPlaying ? m.player_pause() : m.player_play()}
				onclick={(e) => {
					e.preventDefault();
					player.togglePlay();
				}}
			>
				{#if player.isPlaying}
					<Pause class="size-5" />
				{:else}
					<Play class="size-5" />
				{/if}
			</button>
			<button
				type="button"
				class="grid size-9 place-items-center rounded-full hover:bg-muted shrink-0"
				aria-label={m.player_next()}
				onclick={(e) => {
					e.preventDefault();
					player.next();
				}}
			>
				<SkipForward class="size-5" />
			</button>
		</a>
		<div class="h-0.5 bg-muted">
			<div class="h-full bg-foreground/70 transition-[width]" style:width={`${progressPct}%`}></div>
		</div>
	</div>
{/if}
