<script lang="ts">
	import Upload from '@lucide/svelte/icons/upload';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import SearchBar from '$shared/components/SearchBar.svelte';
	import { useSessionQuery } from '$shared/query/session.query';
	import { useTracksQuery } from '$shared/query/tracks.query';
	import { isEditor } from '$shared/auth/role';
	import type { TrackDto } from '$shared/types/dto';
	import TrackRow from './components/TrackRow.svelte';

	const session = useSessionQuery();
	const editor = $derived(isEditor($session.data));

	let draftQ = $state('');
	let appliedQ = $state('');
	let sort = $state('title:asc');
	let displayCount = $state(50);

	const sortOptions = [
		{ value: 'title:asc' as const, label: m.sort_title_asc },
		{ value: 'title:desc' as const, label: m.sort_title_desc },
		{ value: 'album:asc' as const, label: m.sort_album_asc },
		{ value: 'createdAt:desc' as const, label: m.settings_sort_recent },
		{ value: 'durationMs:asc' as const, label: m.sort_duration_short }
	];

	const tracks = useTracksQuery(() => ({
		q: appliedQ || undefined
	}));

	const allItems = $derived($tracks.data?.items ?? []);

	const collator = new Intl.Collator('zh-CN');
	const items = $derived<TrackDto[]>(sorted(allItems, sort, collator));
	const visible = $derived(items.slice(0, displayCount));
	const hasMore = $derived(visible.length < items.length);

	$effect(() => {
		if (draftQ.length === 0 && appliedQ.length > 0) {
			appliedQ = '';
		}
	});

	$effect(() => {
		void appliedQ;
		$tracks.refetch();
	});

	$effect(() => {
		displayCount = 50;
		void sort;
	});

	function submitSearch(event: SubmitEvent) {
		event.preventDefault();
		appliedQ = draftQ.trim();
	}

	function clearSearch() {
		draftQ = '';
		appliedQ = '';
	}

	function showMore() {
		displayCount += 50;
	}

	function sorted(list: TrackDto[], s: string, c: Intl.Collator): TrackDto[] {
		const [field, dir] = s.split(':');
		const desc = dir === 'desc';
		const copy = [...list];
		copy.sort((a, b) => {
			let cmp = 0;
			if (field === 'title') {
				cmp = c.compare(a.title, b.title);
			} else if (field === 'album') {
				cmp = c.compare(a.album ?? '', b.album ?? '');
			} else if (field === 'durationMs') {
				cmp = (a.durationMs ?? 0) - (b.durationMs ?? 0);
			} else if (field === 'createdAt') {
				cmp = a.createdAt.localeCompare(b.createdAt);
			}
			return desc ? -cmp : cmp;
		});
		return copy;
	}
</script>

<section class="flex flex-col gap-4 py-6">
	<header class="flex items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">{m.library_title()}</h1>
		{#if editor}
			<Button variant="outline" href="/library/upload">
				<Upload class="size-4" />
				<span>{m.library_upload()}</span>
			</Button>
		{/if}
	</header>

	<div class="flex items-center gap-2">
		<SearchBar
			bind:value={draftQ}
			placeholder={m.library_search_placeholder()}
			onsubmit={submitSearch}
			onclear={clearSearch}
			class="flex-1"
		/>
		<select
			class="h-9 shrink-0 rounded-md border border-input bg-background px-2 text-sm"
			bind:value={sort}
		>
			{#each sortOptions as opt (opt.value)}
				<option value={opt.value}>{opt.label()}</option>
			{/each}
		</select>
	</div>

	{#if $tracks.isPending}
		<ul class="flex flex-col gap-2" aria-busy="true">
			{#each Array.from({ length: 6 }) as _, i (i)}
				<li class="flex items-center gap-3 rounded-lg px-3 py-2">
					<span class="size-12 rounded-md bg-muted"></span>
					<span class="flex flex-1 flex-col gap-1">
						<span class="h-3 w-1/3 rounded bg-muted"></span>
						<span class="h-2 w-1/2 rounded bg-muted/70"></span>
					</span>
				</li>
			{/each}
		</ul>
	{:else if $tracks.isError}
		<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{m.library_error()}
		</p>
	{:else if items.length === 0}
		<div class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-10 text-center">
			<p class="text-sm text-muted-foreground">{m.library_empty()}</p>
			{#if editor}
				<Button variant="outline" href="/library/upload">
					<Upload class="size-4" />
					<span>{m.library_upload()}</span>
				</Button>
			{/if}
		</div>
	{:else}
		<ul class="flex flex-col gap-1">
			{#each visible as track (track.id)}
				<li>
					<TrackRow {track} siblings={visible} />
				</li>
			{/each}
		</ul>

		{#if hasMore}
			<div class="flex justify-center pt-2">
				<Button
					variant="outline"
					onclick={showMore}
				>
					{m.library_load_more()}
				</Button>
			</div>
		{/if}
	{/if}
</section>
