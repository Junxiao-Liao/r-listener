<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import SearchBar from '$shared/components/SearchBar.svelte';
	import ConfirmAction from '$shared/components/ConfirmAction.svelte';
	import EntityCombobox from '$pages/admin/components/EntityCombobox.svelte';
	import {
		applyAdminListFilter,
		clearAdminListFilter
	} from '$pages/admin/admin-list-filter.service';
	import { createTenantSelectorSearch } from '$pages/admin/admin-selector.service';
	import { formatBytes } from '$shared/format/duration';
	import {
		useAdminTracksQuery,
		useHardDeleteAdminTracksMutation
	} from '$shared/query/admin.query';
	import type { AdminTrackListItemDto, Id } from '$shared/types/dto';

	let draftQ = $state('');
	let appliedQ = $state('');
	let tenantId = $state<Id<'tenant'> | ''>('');
	let selected = $state(new Set<Id<'track'>>());
	let successMessage = $state<string | null>(null);

	const tenantSearch = createTenantSelectorSearch();
	const tracks = useAdminTracksQuery(() => ({
		limit: 50,
		q: appliedQ || undefined,
		tenantId: tenantId || undefined
	}));
	const hardDelete = useHardDeleteAdminTracksMutation();

	const items = $derived($tracks.data?.items ?? []);
	const selectedRows = $derived(items.filter((item) => selected.has(item.id)));
	const selectedCount = $derived(selectedRows.length);
	const selectedBytes = $derived(selectedRows.reduce((sum, item) => sum + item.sizeBytes, 0));
	const allOnPageSelected = $derived(items.length > 0 && items.every((item) => selected.has(item.id)));

	function applyFilter() {
		const next = applyAdminListFilter({ draft: draftQ, applied: appliedQ });
		draftQ = next.draft;
		appliedQ = next.applied;
		clearSelection();
		successMessage = null;
	}

	function clearFilter() {
		const next = clearAdminListFilter();
		draftQ = next.draft;
		appliedQ = next.applied;
		clearSelection();
		successMessage = null;
	}

	function clearTenant() {
		tenantId = '';
		clearSelection();
		successMessage = null;
	}

	function toggleTrack(trackId: Id<'track'>) {
		const next = new Set(selected);
		if (next.has(trackId)) next.delete(trackId);
		else next.add(trackId);
		selected = next;
	}

	function toggleSelectPage() {
		if (allOnPageSelected) {
			clearSelection();
			return;
		}

		const next = new Set(selected);
		for (const track of items) {
			next.add(track.id);
		}
		selected = next;
	}

	function clearSelection() {
		selected = new Set<Id<'track'>>();
	}

	async function deleteSelected() {
		if (selectedCount === 0) return;
		const result = await $hardDelete.mutateAsync({
			trackIds: [...selected]
		});
		clearSelection();
		successMessage = m.admin_tracks_delete_success({
			count: result.deletedCount,
			size: formatBytes(result.freedBytes)
		});
		await $tracks.refetch();
	}

	function trackSecondaryLine(track: AdminTrackListItemDto): string {
		const parts = [track.tenantName];
		if (track.album) parts.push(track.album);
		return parts.join(' · ');
	}

	$effect(() => {
		if (draftQ.length === 0 && appliedQ.length > 0) {
			appliedQ = '';
		}
	});

	$effect(() => {
		void appliedQ;
		void tenantId;
		clearSelection();
		void $tracks.refetch();
	});
</script>

<section class="flex flex-col gap-6 py-6 pb-24">
	<header class="flex flex-col items-start gap-4">
		<Button variant="ghost" class="-ml-2 text-muted-foreground" href="/admin">
			<ArrowLeft class="mr-2 size-4" />
			<span>{m.admin_back()}</span>
		</Button>
		<h1 class="text-2xl font-semibold">{m.admin_tracks()}</h1>
	</header>

	<div class="grid gap-3">
		<SearchBar
			bind:value={draftQ}
			placeholder={m.admin_filter_tracks()}
			onsubmit={(e) => { e.preventDefault(); applyFilter(); }}
			onclear={clearFilter}
		/>
		<div class="flex flex-wrap items-center gap-2">
			<div class="min-w-72 flex-1">
				<EntityCombobox
					bind:value={tenantId}
					search={tenantSearch}
					placeholder={m.admin_filter_by_tenant()}
				/>
			</div>
			<Button variant="outline" onclick={clearTenant}>
				{m.admin_all_tenants()}
			</Button>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
		<Button variant="outline" onclick={toggleSelectPage} disabled={items.length === 0}>
			{allOnPageSelected ? m.admin_clear_selection() : m.admin_select_page()}
		</Button>
		<span class="text-sm text-muted-foreground">
			{m.admin_tracks_selected({ count: selectedCount })}
		</span>
	</div>

	{#if successMessage}
		<p class="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
			{successMessage}
		</p>
	{/if}

	{#if $tracks.isPending}
		<p class="text-sm text-muted-foreground">{m.admin_loading()}</p>
	{:else if $tracks.isError}
		<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{m.admin_tracks_error()}
		</p>
	{:else if items.length === 0}
		<p class="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
			{m.admin_no_results()}
		</p>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each items as track (track.id)}
				<li class="rounded-md border border-border p-3">
					<label class="flex items-start gap-3">
						<input
							type="checkbox"
							checked={selected.has(track.id)}
							onchange={() => toggleTrack(track.id)}
							class="mt-1 size-4"
						/>
						<div class="min-w-0 flex-1">
							<p class="truncate font-medium">{track.title}</p>
							<p class="truncate text-xs text-muted-foreground">{trackSecondaryLine(track)}</p>
							<div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
								<span>{formatBytes(track.sizeBytes)}</span>
								<span>·</span>
								<span>{new Date(track.createdAt).toLocaleString()}</span>
								{#if track.tenantDeleted}
									<span class="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-700">
										{m.admin_track_tenant_deleted()}
									</span>
								{/if}
								{#if track.isDeleted}
									<span class="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-destructive">
										{m.admin_track_soft_deleted()}
									</span>
								{/if}
							</div>
						</div>
					</label>
				</li>
			{/each}
		</ul>
	{/if}

	{#if selectedCount > 0}
		<div
			class="fixed inset-x-0 z-30 mx-auto flex max-w-xl items-center justify-between gap-3 border-t border-border bg-background px-4 py-3 shadow-lg"
			style="bottom: calc(var(--bottom-nav-h, 0px) + var(--mini-player-h, 0px) + env(safe-area-inset-bottom, 0px));"
		>
			<span class="text-sm">{m.admin_tracks_selected({ count: selectedCount })}</span>
			<ConfirmAction
				title={m.admin_tracks_delete_confirm_title()}
				description={m.admin_tracks_delete_confirm_description({
					count: selectedCount,
					size: formatBytes(selectedBytes)
				})}
				trigger={m.admin_tracks_delete()}
				confirm={m.admin_tracks_delete()}
				onconfirm={deleteSelected}
				disabled={$hardDelete.isPending}
				class="w-auto"
			/>
		</div>
	{/if}
</section>
