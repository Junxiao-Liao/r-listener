<script lang="ts">
	import { goto } from '$app/navigation';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import { Input } from '$shared/components/ui/input';
	import { Label } from '$shared/components/ui/label';
	import { ApiError } from '$shared/api/client';
	import { useSessionQuery } from '$shared/query/session.query';
	import {
		useClearLyricsMutation,
		useSetLyricsMutation,
		useTrackQuery,
		useUpdateTrackMutation
	} from '$shared/query/tracks.query';
	import { isEditor } from '$shared/auth/role';
	import { detectLyricsStatus } from '$shared/lyrics/lyrics';
	import type { Id, TrackPatch } from '$shared/types/dto';
	import { trackMetadataSchema, type TrackMetadataForm } from './edit-music-metadata.form';

	type Props = { trackId: Id<'track'> };
	let { trackId }: Props = $props();

	const session = useSessionQuery();
	const editor = $derived(isEditor($session.data));

	const track = useTrackQuery(() => trackId);
	const update = useUpdateTrackMutation();
	const setLyrics = useSetLyricsMutation();
	const clearLyrics = useClearLyricsMutation();

	let title = $state('');
	let artist = $state('');
	let album = $state('');
	let trackNumber = $state('');
	let genre = $state('');
	let year = $state('');
	let durationMs = $state('');
	let lyricsText = $state('');
	let initialised = $state(false);
	let submitted = $state(false);
	let formError = $state<string | null>(null);
	let saving = $state(false);

	$effect(() => {
		if (initialised || !$track.data) return;
		const t = $track.data;
		title = t.title;
		artist = t.artist ?? '';
		album = t.album ?? '';
		trackNumber = t.trackNumber != null ? String(t.trackNumber) : '';
		genre = t.genre ?? '';
		year = t.year != null ? String(t.year) : '';
		durationMs = t.durationMs != null ? String(t.durationMs) : '';
		lyricsText = t.lyricsLrc ?? '';
		initialised = true;
	});

	const lyricsStatus = $derived(detectLyricsStatus(lyricsText));
	const lyricsStatusLabel = $derived.by(() => {
		switch (lyricsStatus) {
			case 'synced':
				return m.lyrics_status_synced();
			case 'plain':
				return m.lyrics_status_plain();
			case 'invalid':
				return m.lyrics_status_invalid();
			default:
				return m.lyrics_status_none();
		}
	});

	let fieldErrors = $derived.by((): Partial<Record<keyof TrackMetadataForm, string>> => {
		if (!submitted) return {};
		const parsed = trackMetadataSchema.safeParse({
			title,
			artist,
			album,
			trackNumber,
			genre,
			year,
			durationMs
		});
		if (parsed.success) return {};
		const issues: Partial<Record<keyof TrackMetadataForm, string>> = {};
		for (const issue of parsed.error.issues) {
			const key = issue.path[0] as keyof TrackMetadataForm | undefined;
			if (key && !issues[key]) issues[key] = issue.message;
		}
		return issues;
	});

	function buildPatch(form: TrackMetadataForm, original: TrackPatch): TrackPatch {
		const out: TrackPatch = {};
		const t = $track.data;
		if (!t) return out;

		if (form.title !== t.title) out.title = form.title;
		const artistVal = (artist.trim().length === 0 ? null : artist.trim());
		if (artistVal !== t.artist) out.artist = artistVal;
		const albumVal = (album.trim().length === 0 ? null : album.trim());
		if (albumVal !== t.album) out.album = albumVal;
		if (form.trackNumber !== t.trackNumber) out.trackNumber = form.trackNumber;
		const genreVal = (genre.trim().length === 0 ? null : genre.trim());
		if (genreVal !== t.genre) out.genre = genreVal;
		if (form.year !== t.year) out.year = form.year;
		if (form.durationMs !== t.durationMs) out.durationMs = form.durationMs;

		void original;
		return out;
	}

	async function handleSave(event: SubmitEvent) {
		event.preventDefault();
		submitted = true;
		formError = null;

		const parsed = trackMetadataSchema.safeParse({
			title,
			artist,
			album,
			trackNumber,
			genre,
			year,
			durationMs
		});
		if (!parsed.success || !$track.data) return;

		saving = true;
		try {
			const patch = buildPatch(parsed.data, {});
			if (Object.keys(patch).length > 0) {
				await $update.mutateAsync({ trackId, patch });
			}

			const trimmed = lyricsText.trimEnd();
			const original = ($track.data.lyricsLrc ?? '').trimEnd();
			if (trimmed !== original) {
				if (trimmed.length === 0) {
					await $clearLyrics.mutateAsync({ trackId });
				} else {
					await $setLyrics.mutateAsync({ trackId, lyricsLrc: trimmed });
				}
			}

			void goto(`/library/${trackId}`, { replaceState: true });
		} catch (err) {
			if (err instanceof ApiError) {
				formError = err.message;
			} else {
				formError = m.edit_track_error_generic();
			}
		} finally {
			saving = false;
		}
	}

	async function handleLrcFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const text = await file.text();
		lyricsText = text;
		input.value = '';
	}
</script>

{#if !editor}
	<section class="flex flex-col gap-4 py-6">
		<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{m.track_edit_viewer_blocked()}
		</p>
		<Button variant="outline" href={`/library/${trackId}`}>{m.track_back()}</Button>
	</section>
{:else if $track.isPending}
	<p class="py-6 text-sm text-muted-foreground">{m.track_loading()}</p>
{:else if $track.isError || !$track.data}
	<section class="flex flex-col gap-4 py-6">
		<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{m.track_not_found()}
		</p>
		<Button variant="outline" href="/library">{m.track_back_to_library()}</Button>
	</section>
{:else}
	<form class="flex flex-col gap-6 py-6" onsubmit={handleSave}>
		<header>
			<h1 class="text-2xl font-semibold">{m.edit_track_title()}</h1>
			<p class="mt-1 truncate text-sm text-muted-foreground">{$track.data.title}</p>
		</header>

		<section class="grid gap-4 sm:grid-cols-2">
			<div class="flex flex-col gap-1.5 sm:col-span-2">
				<Label for="title">{m.track_field_title()}</Label>
				<Input id="title" bind:value={title} />
				{#if fieldErrors.title}
					<p class="text-xs text-destructive">{fieldErrors.title}</p>
				{/if}
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="artist">{m.track_field_artist()}</Label>
				<Input id="artist" bind:value={artist} />
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="album">{m.track_field_album()}</Label>
				<Input id="album" bind:value={album} />
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="trackNumber">{m.track_field_track_number()}</Label>
				<Input id="trackNumber" inputmode="numeric" bind:value={trackNumber} />
				{#if fieldErrors.trackNumber}
					<p class="text-xs text-destructive">{fieldErrors.trackNumber}</p>
				{/if}
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="year">{m.track_field_year()}</Label>
				<Input id="year" inputmode="numeric" bind:value={year} />
				{#if fieldErrors.year}
					<p class="text-xs text-destructive">{fieldErrors.year}</p>
				{/if}
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="genre">{m.track_field_genre()}</Label>
				<Input id="genre" bind:value={genre} />
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="duration">{m.track_field_duration_ms()}</Label>
				<Input id="duration" inputmode="numeric" bind:value={durationMs} />
				{#if fieldErrors.durationMs}
					<p class="text-xs text-destructive">{fieldErrors.durationMs}</p>
				{/if}
			</div>
		</section>

		<section class="flex flex-col gap-2">
			<div class="flex items-center justify-between gap-2">
				<Label for="lyrics">{m.track_section_lyrics()}</Label>
				<span class="text-xs text-muted-foreground">{lyricsStatusLabel}</span>
			</div>
			<textarea
				id="lyrics"
				rows="10"
				bind:value={lyricsText}
				class="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
				placeholder={m.edit_track_lyrics_placeholder()}
			></textarea>
			<div class="flex flex-wrap items-center gap-2">
				<label class="cursor-pointer text-sm text-primary underline-offset-4 hover:underline">
					{m.edit_track_load_lrc()}
					<input type="file" accept=".lrc,text/plain" class="hidden" onchange={handleLrcFile} />
				</label>
				{#if lyricsText.length > 0}
					<button
						type="button"
						class="text-sm text-muted-foreground underline-offset-4 hover:underline"
						onclick={() => (lyricsText = '')}
					>
						{m.edit_track_clear_lyrics()}
					</button>
				{/if}
			</div>
		</section>

		{#if formError}
			<p class="text-sm text-destructive" role="alert">{formError}</p>
		{/if}

		<div class="flex flex-col gap-2 sm:flex-row">
			<Button type="submit" disabled={saving} class="sm:flex-1">
				{m.edit_track_save()}
			</Button>
			<Button
				type="button"
				variant="outline"
				disabled={saving}
				href={`/library/${trackId}`}
				class="sm:flex-1"
			>
				{m.action_cancel()}
			</Button>
		</div>
	</form>
{/if}
