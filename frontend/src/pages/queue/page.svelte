<script lang="ts">
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import Play from '@lucide/svelte/icons/play';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import CoverPlaceholder from '$shared/cover/CoverPlaceholder.svelte';
	import { formatDurationMs } from '$shared/format/duration';
	import { trackArtistDisplay } from '$shared/artists/artists';
	import { getPlayer } from '$shared/player/player.context';
	import {
		useClearQueueMutation,
		useDeleteQueueItemMutation,
		useQueueQuery,
		useUpdateQueueItemMutation
	} from '$shared/query/queue.query';
	import type { Id, QueueItemDto } from '$shared/types/dto';
	import { cn } from '$shared/utils';

	const player = getPlayer();
	const queueQuery = useQueueQuery();
	const updateItem = useUpdateQueueItemMutation();
	const deleteItem = useDeleteQueueItemMutation();
	const clearQueue = useClearQueueMutation();

	let confirmingClear = $state(false);
	let confirmRemoveId: Id<'queue_item'> | null = $state(null);
	let dragId: Id<'queue_item'> | null = $state(null);
	let dragOverId: Id<'queue_item'> | null = $state(null);

	const items = $derived<QueueItemDto[]>($queueQuery.data?.items ?? []);

	function onDragStart(id: Id<'queue_item'>, ev: DragEvent) {
		dragId = id;
		ev.dataTransfer?.setData('text/plain', id);
		if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
	}

	function onDragOver(id: Id<'queue_item'>, ev: DragEvent) {
		ev.preventDefault();
		dragOverId = id;
		if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
	}

	async function onDrop(id: Id<'queue_item'>, ev: DragEvent) {
		ev.preventDefault();
		const sourceId = dragId;
		dragId = null;
		dragOverId = null;
		if (!sourceId || sourceId === id) return;

		const targetIdx = items.findIndex((q) => q.id === id);
		if (targetIdx < 0) return;

		await $updateItem.mutateAsync({
			itemId: sourceId,
			position: targetIdx + 1
		});
	}

	function onDragEnd() {
		dragId = null;
		dragOverId = null;
	}

	async function playNow(item: QueueItemDto) {
		const state = await $updateItem.mutateAsync({ itemId: item.id, isCurrent: true });
		player.setQueueState(state, { autoplay: true });
	}

	async function remove(item: QueueItemDto) {
		await $deleteItem.mutateAsync({ itemId: item.id });
		confirmRemoveId = null;
	}

	async function clearAll() {
		await $clearQueue.mutateAsync();
		confirmingClear = false;
	}
</script>

<section class="flex flex-col gap-4 py-6">
	<header class="flex items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">{m.queue_title()}</h1>
		{#if items.length > 0}
			<Button
				variant="outline"
				size="sm"
				onclick={() => (confirmingClear = true)}
				disabled={$clearQueue.isPending}
			>
				<Trash2 class="size-4" />
				<span>{m.queue_clear()}</span>
			</Button>
		{/if}
	</header>

	{#if confirmingClear}
		<div class="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
			<p class="text-sm">{m.queue_clear_confirm()}</p>
			<div class="mt-3 flex flex-col gap-2 sm:flex-row">
				<Button
					variant="destructive"
					disabled={$clearQueue.isPending}
					onclick={clearAll}
					class="sm:flex-1"
				>
					{m.queue_clear()}
				</Button>
				<Button
					variant="outline"
					disabled={$clearQueue.isPending}
					onclick={() => (confirmingClear = false)}
					class="sm:flex-1"
				>
					{m.action_cancel()}
				</Button>
			</div>
		</div>
	{/if}

	{#if $queueQuery.isPending}
		<p class="text-sm text-muted-foreground">{m.home_loading()}</p>
	{:else if $queueQuery.isError}
		<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{m.queue_error()}
		</p>
	{:else if items.length === 0}
		<p class="rounded-md bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
			{m.queue_empty()}
		</p>
	{:else}
		<ul class="flex flex-col gap-1">
			{#each items as item (item.id)}
				{@const isCurrent = item.isCurrent}
				{@const isOver = dragOverId === item.id && dragId !== item.id}
				<li
					draggable="true"
					ondragstart={(e) => onDragStart(item.id, e)}
					ondragover={(e) => onDragOver(item.id, e)}
					ondrop={(e) => onDrop(item.id, e)}
					ondragend={onDragEnd}
					class={cn(
						'flex items-center gap-2 rounded-lg px-2 py-2 transition-colors',
						isCurrent ? 'bg-muted' : 'hover:bg-muted/40',
						isOver && 'ring-2 ring-foreground/30'
					)}
				>
					<span
						class="grid size-7 cursor-grab place-items-center text-muted-foreground active:cursor-grabbing"
						aria-label={m.queue_reorder_handle()}
					>
						<GripVertical class="size-4" />
					</span>
					<CoverPlaceholder seed={item.track.title} class="size-10 text-base shrink-0" />
					<button
						type="button"
						class="flex min-w-0 flex-1 flex-col items-start text-left"
						onclick={() => playNow(item)}
					>
						<span class="flex w-full items-center gap-2 text-sm font-medium">
							<span class="truncate">{item.track.title}</span>
							{#if isCurrent}
								<span
									class="rounded bg-foreground/10 px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-foreground"
								>
									{m.queue_now_playing()}
								</span>
							{/if}
						</span>
						{#if trackArtistDisplay(item.track)}
							<span class="truncate text-xs text-muted-foreground">{trackArtistDisplay(item.track)}</span>
						{/if}
					</button>
					<span class="shrink-0 text-xs tabular-nums text-muted-foreground">
						{formatDurationMs(item.track.durationMs)}
					</span>
					<button
						type="button"
						class="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
						aria-label={m.queue_play_now()}
						onclick={() => playNow(item)}
					>
						<Play class="size-4" />
					</button>
					{#if confirmRemoveId === item.id}
						<span class="flex items-center gap-1">
							<Button
								variant="destructive"
								size="xs"
								disabled={$deleteItem.isPending}
								onclick={() => remove(item)}
							>
								{m.action_remove()}
							</Button>
							<Button
								variant="ghost"
								size="xs"
								disabled={$deleteItem.isPending}
								onclick={() => (confirmRemoveId = null)}
							>
								{m.action_cancel()}
							</Button>
						</span>
					{:else}
						<button
							type="button"
							class="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
							aria-label={m.queue_remove()}
							onclick={() => (confirmRemoveId = item.id)}
							disabled={$deleteItem.isPending}
						>
							<X class="size-4" />
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
