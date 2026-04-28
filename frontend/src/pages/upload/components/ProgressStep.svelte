<script lang="ts">
	import { untrack } from 'svelte';
	import { useQueryClient } from '@tanstack/svelte-query';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import { ApiError, api } from '$shared/api/client';
	import { queryKeys } from '$shared/query/keys';
	import { formatDurationMs } from '$shared/format/duration';
	import type {
		FinalizeTrackInput,
		Id,
		TrackDto,
		TrackListResponse
	} from '$shared/types/dto';
	import type { UploadItem, UploadProgressItem } from '../upload.types';

	type Props = {
		items: UploadItem[];
		onfinish: () => void;
	};
	let { items, onfinish }: Props = $props();

	const qc = useQueryClient();

	let progress = $state<UploadProgressItem[]>(
		untrack(() =>
			items.map((item) => ({
				item,
				trackId: null,
				status: 'queued' as const,
				progress: 0,
				error: null
			}))
		)
	);
	let started = $state(false);
	let allDone = $state(false);

	let pendingFromServer = $state<TrackDto[]>([]);
	let pendingLoading = $state(true);
	let pendingError = $state<string | null>(null);

	async function refreshPending() {
		pendingLoading = true;
		pendingError = null;
		try {
			const search = new URLSearchParams({
				sort: 'createdAt:desc',
				includePending: 'true',
				limit: '50'
			});
			const res = await api<TrackListResponse>(`/tracks?${search.toString()}`);
			pendingFromServer = res.items.filter((t) => t.status === 'pending');
		} catch (err) {
			pendingError = err instanceof Error ? err.message : 'Failed to load pending uploads.';
		} finally {
			pendingLoading = false;
		}
	}

	async function deletePending(trackId: Id<'track'>) {
		try {
			await api<void>(`/tracks/${trackId}`, { method: 'DELETE' });
			pendingFromServer = pendingFromServer.filter((t) => t.id !== trackId);
			void qc.invalidateQueries({ queryKey: queryKeys.tracks });
		} catch {
			// ignore — user can retry
		}
	}

	async function uploadOne(idx: number) {
		const entry = progress[idx]!;
		const item = entry.item;

		const fd = new FormData();
		fd.set('file', item.audio, item.audio.name);
		fd.set('title', item.title);
		if (item.artist) fd.set('artist', item.artist);
		if (item.album) fd.set('album', item.album);

		progress[idx] = { ...entry, status: 'uploading', progress: 0, error: null };

		let track: TrackDto;
		try {
			track = await api<TrackDto>('/tracks', { method: 'POST', body: fd });
		} catch (err) {
			progress[idx] = {
				...progress[idx]!,
				status: 'error',
				error: err instanceof ApiError ? err.message : m.upload_progress_unknown_error()
			};
			return;
		}

		progress[idx] = {
			...progress[idx]!,
			trackId: track.id,
			status: 'finalizing'
		};

		const finalize: FinalizeTrackInput = {
			durationMs:
				item.durationMs && item.durationMs > 0 ? item.durationMs : await probeDuration(item.audio)
		};
		if (item.resolvedLyricsLrc && item.resolvedLyricsLrc.trim().length > 0) {
			finalize.lyricsLrc = item.resolvedLyricsLrc;
		}
		if (item.trackNumber != null) finalize.trackNumber = item.trackNumber;
		if (item.genre) finalize.genre = item.genre;
		if (item.year != null) finalize.year = item.year;

		try {
			await api<TrackDto>(`/tracks/${track.id}/finalize`, {
				method: 'POST',
				body: finalize
			});
			progress[idx] = { ...progress[idx]!, status: 'done', progress: 1 };
		} catch (err) {
			progress[idx] = {
				...progress[idx]!,
				status: 'error',
				error: err instanceof ApiError ? err.message : m.upload_progress_unknown_error()
			};
		}
	}

	async function probeDuration(file: File): Promise<number> {
		return new Promise((resolve) => {
			const url = URL.createObjectURL(file);
			const audio = document.createElement('audio');
			audio.preload = 'metadata';
			audio.src = url;
			audio.addEventListener('loadedmetadata', () => {
				URL.revokeObjectURL(url);
				const ms =
					Number.isFinite(audio.duration) && audio.duration > 0
						? Math.round(audio.duration * 1000)
						: 1;
				resolve(ms);
			});
			audio.addEventListener('error', () => {
				URL.revokeObjectURL(url);
				resolve(1);
			});
		});
	}

	async function runQueue() {
		if (started) return;
		started = true;
		for (let i = 0; i < progress.length; i++) {
			if (progress[i]!.status === 'done') continue;
			await uploadOne(i);
		}
		void qc.invalidateQueries({ queryKey: queryKeys.tracks });
		await refreshPending();
		allDone = progress.every((p) => p.status === 'done' || p.status === 'error');
	}

	$effect(() => {
		void runQueue();
	});

	$effect(() => {
		void refreshPending();
	});

	async function retryItem(idx: number) {
		await uploadOne(idx);
		void qc.invalidateQueries({ queryKey: queryKeys.tracks });
		await refreshPending();
		allDone = progress.every((p) => p.status === 'done' || p.status === 'error');
	}
</script>

<section class="flex flex-col gap-4 py-6">
	<header>
		<h1 class="text-2xl font-semibold">{m.upload_progress_title()}</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			{m.upload_progress_subtitle({
				done: progress.filter((p) => p.status === 'done').length,
				total: progress.length
			})}
		</p>
	</header>

	<ul class="flex flex-col gap-2">
		{#each progress as p, idx (p.item.id)}
			<li class="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm">
				<div class="flex items-center justify-between gap-2">
					<span class="truncate font-medium">{p.item.title}</span>
					<span class="text-xs text-muted-foreground">
						{#if p.status === 'queued'}
							{m.upload_progress_queued()}
						{:else if p.status === 'uploading'}
							{m.upload_progress_uploading()}
						{:else if p.status === 'finalizing'}
							{m.upload_progress_finalizing()}
						{:else if p.status === 'done'}
							{m.upload_progress_done()}
						{:else if p.status === 'error'}
							{m.upload_progress_error()}
						{/if}
					</span>
				</div>
				{#if p.status === 'error' && p.error}
					<p class="text-xs text-destructive">{p.error}</p>
					<button
						type="button"
						class="self-start text-xs text-primary underline-offset-4 hover:underline"
						onclick={() => retryItem(idx)}
					>
						{m.upload_progress_retry()}
					</button>
				{/if}
			</li>
		{/each}
	</ul>

	<div class="flex flex-col gap-2 sm:flex-row">
		<Button href="/library" disabled={!allDone} class="sm:flex-1">
			{m.upload_progress_done_cta()}
		</Button>
		<Button onclick={onfinish} variant="outline" class="sm:flex-1">
			{m.upload_progress_more()}
		</Button>
	</div>

	<section class="flex flex-col gap-2">
		<h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
			{m.upload_stuck_title()}
		</h2>
		{#if pendingLoading}
			<p class="text-xs text-muted-foreground">{m.upload_stuck_loading()}</p>
		{:else if pendingError}
			<p class="text-xs text-destructive">{pendingError}</p>
		{:else if pendingFromServer.length === 0}
			<p class="text-xs text-muted-foreground">{m.upload_stuck_none()}</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each pendingFromServer as t (t.id)}
					<li class="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
						<div class="flex min-w-0 flex-col">
							<span class="truncate font-medium">{t.title}</span>
							<span class="text-xs text-muted-foreground">
								{new Date(t.createdAt).toLocaleString()} · {formatDurationMs(t.durationMs)}
							</span>
						</div>
						<button
							type="button"
							class="text-xs text-destructive underline-offset-4 hover:underline"
							onclick={() => deletePending(t.id)}
						>
							{m.action_delete()}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</section>
