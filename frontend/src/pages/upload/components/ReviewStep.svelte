<script lang="ts">
	import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import { Input } from '$shared/components/ui/input';
	import ArtistChipsInput from '$shared/artists/ArtistChipsInput.svelte';
	import CoverPlaceholder from '$shared/cover/CoverPlaceholder.svelte';
	import { formatDurationMs, formatBytes } from '$shared/format/duration';
	import { swapUploadItemTitleAndArtists, type UploadItem } from '../upload.types';

	type Props = {
		items: UploadItem[];
		onstart: () => void;
		onremove: (id: string) => void;
		oncancel: () => void;
	};
	let { items = $bindable(), onstart, onremove, oncancel }: Props = $props();

	function setField<K extends keyof UploadItem>(id: string, key: K, value: UploadItem[K]) {
		const idx = items.findIndex((i) => i.id === id);
		if (idx < 0) return;
		items[idx] = { ...items[idx]!, [key]: value };
	}

	function swapTitleAndArtists(id: string) {
		const idx = items.findIndex((i) => i.id === id);
		if (idx < 0) return;
		items[idx] = swapUploadItemTitleAndArtists(items[idx]!);
	}
</script>

<section class="flex flex-col gap-4 py-6">
	<header class="flex items-start justify-between gap-2">
		<div>
			<h1 class="text-2xl font-semibold">{m.upload_review_title()}</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				{m.upload_review_subtitle({ count: items.length })}
			</p>
		</div>
	</header>

	<ul class="flex flex-col gap-3">
		{#each items as item (item.id)}
			<li class="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
				<div class="flex items-start gap-3">
					<CoverPlaceholder seed={item.title} class="size-12 text-base" />
					<div class="flex min-w-0 flex-1 flex-col gap-1">
						<p class="truncate text-xs text-muted-foreground">{item.audio.name}</p>
						<p class="text-xs text-muted-foreground">
							{formatBytes(item.audio.size)}
							{#if item.durationMs != null}
								· {formatDurationMs(item.durationMs)}
							{/if}
							{#if item.lyricsSource === 'external'}
								· {m.upload_review_lyrics_external()}
							{:else if item.lyricsSource === 'embedded'}
								· {m.upload_review_lyrics_embedded()}
							{/if}
						</p>
					</div>
					<button
						type="button"
						class="text-xs text-muted-foreground underline-offset-4 hover:underline"
						onclick={() => onremove(item.id)}
					>
						{m.action_remove()}
					</button>
				</div>

				<div class="grid gap-2 sm:grid-cols-3">
					<label class="flex flex-col gap-1 text-xs">
						<span class="text-muted-foreground">{m.track_field_title()}</span>
						<Input
							value={item.title}
							oninput={(e: Event) => setField(item.id, 'title', (e.currentTarget as HTMLInputElement).value)}
						/>
					</label>
					<label class="flex flex-col gap-1 text-xs">
						<span class="text-muted-foreground">{m.track_field_artist()}</span>
						<ArtistChipsInput bind:value={item.artistNames} />
					</label>
					<label class="flex flex-col gap-1 text-xs">
						<span class="text-muted-foreground">{m.track_field_album()}</span>
						<Input
							value={item.album ?? ''}
							oninput={(e: Event) => {
								const v = (e.currentTarget as HTMLInputElement).value;
								setField(item.id, 'album', v.length > 0 ? v : null);
							}}
						/>
					</label>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="self-start"
					onclick={() => swapTitleAndArtists(item.id)}
				>
					<ArrowLeftRight class="size-4" />
					{m.action_swap()}
				</Button>
			</li>
		{/each}
	</ul>

	<div class="flex flex-col gap-2 sm:flex-row">
		<Button onclick={onstart} disabled={items.length === 0} class="sm:flex-1">
			{m.upload_review_start({ count: items.length })}
		</Button>
		<Button onclick={oncancel} variant="outline" class="sm:flex-1">{m.action_cancel()}</Button>
	</div>
</section>
