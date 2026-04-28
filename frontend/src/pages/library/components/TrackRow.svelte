<script lang="ts">
	import CoverPlaceholder from '$shared/cover/CoverPlaceholder.svelte';
	import { formatDurationMs } from '$shared/format/duration';
	import * as m from '$shared/paraglide/messages';
	import type { TrackDto } from '$shared/types/dto';

	type Props = { track: TrackDto };
	let { track }: Props = $props();

	const subtitle = $derived(
		[track.artist, track.album].filter((v): v is string => !!v && v.length > 0).join(' · ')
	);
</script>

<a
	href={`/library/${track.id}`}
	class="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted focus-visible:bg-muted focus:outline-none"
>
	<CoverPlaceholder seed={track.title} class="size-12 text-lg" />
	<span class="flex min-w-0 flex-1 flex-col">
		<span class="flex items-center gap-2 text-sm font-medium">
			<span class="truncate">{track.title}</span>
			{#if track.status === 'pending'}
				<span class="rounded bg-amber-500/20 px-1.5 py-0.5 text-[0.65rem] font-medium text-amber-700 dark:text-amber-300">
					{m.library_status_pending()}
				</span>
			{/if}
		</span>
		{#if subtitle.length > 0}
			<span class="truncate text-xs text-muted-foreground">{subtitle}</span>
		{/if}
	</span>
	<span class="shrink-0 text-xs text-muted-foreground tabular-nums">
		{formatDurationMs(track.durationMs)}
	</span>
</a>
