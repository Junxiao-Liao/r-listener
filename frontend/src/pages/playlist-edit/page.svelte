<script lang="ts">
	import { goto } from '$app/navigation';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import { Input } from '$shared/components/ui/input';
	import { Label } from '$shared/components/ui/label';
	import CoverPlaceholder from '$shared/cover/CoverPlaceholder.svelte';
	import {
		useDeletePlaylistMutation,
		usePlaylistQuery,
		useUpdatePlaylistMutation
	} from '$shared/query/playlists.query';
	import { ApiError } from '$shared/api/client';
	import type { Id } from '$shared/types/dto';

	type Props = { id: Id<'playlist'> };
	let { id }: Props = $props();

	const playlist = usePlaylistQuery(() => id);
	const update = useUpdatePlaylistMutation(id);
	const remove = useDeletePlaylistMutation();

	let name = $state('');
	let description = $state('');
	let initialized = $state(false);
	let nameError = $state<string | null>(null);
	let confirmDelete = $state(false);

	$effect(() => {
		if (!initialized && $playlist.data) {
			name = $playlist.data.name;
			description = $playlist.data.description ?? '';
			initialized = true;
		}
	});

	async function save(ev: SubmitEvent) {
		ev.preventDefault();
		nameError = null;
		const trimmed = name.trim();
		if (!trimmed) {
			nameError = m.playlist_name_required();
			return;
		}
		try {
			await $update.mutateAsync({
				name: trimmed,
				description: description.trim() || null
			});
			void goto(`/playlists/${id}`);
		} catch (err) {
			if (err instanceof ApiError && err.code === 'playlist_name_conflict') {
				nameError = m.playlist_name_conflict();
				return;
			}
			throw err;
		}
	}

	async function deletePlaylist() {
		await $remove.mutateAsync({ id });
		void goto('/playlists');
	}
</script>

<section class="flex flex-col gap-4 py-6">
	<header class="flex items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">{m.playlist_edit_title()}</h1>
		<Button variant="outline" href={`/playlists/${id}`}>{m.playlist_edit_cancel()}</Button>
	</header>

	{#if $playlist.isPending}
		<p class="text-sm text-muted-foreground">{m.playlist_detail_loading()}</p>
	{:else if $playlist.isError}
		<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{m.playlist_detail_error()}
		</p>
	{:else}
		<form class="flex max-w-md flex-col gap-4" onsubmit={save}>
			<div class="flex justify-center">
				<CoverPlaceholder seed={name || '?'} class="size-32 text-3xl" />
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="playlist-name">{m.playlist_field_name()}</Label>
				<Input id="playlist-name" type="text" bind:value={name} required maxlength={200} />
				{#if nameError}
					<p class="text-xs text-destructive" role="alert">{nameError}</p>
				{/if}
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="playlist-desc">{m.playlist_field_description()}</Label>
				<textarea
					id="playlist-desc"
					bind:value={description}
					class="min-h-[5rem] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
					maxlength={2000}
				></textarea>
			</div>

			<div class="flex gap-2">
				<Button type="submit" disabled={$update.isPending} class="flex-1">
					{m.playlist_edit_save()}
				</Button>
			</div>
		</form>

		<div class="mt-6 flex max-w-md flex-col gap-2 border-t border-border pt-4">
			{#if !confirmDelete}
				<Button
					variant="outline"
					class="text-destructive"
					onclick={() => (confirmDelete = true)}
				>
					{m.playlist_edit_delete()}
				</Button>
			{:else}
				<p class="text-sm font-medium">{m.playlist_edit_delete_confirm()}</p>
				<p class="text-xs text-muted-foreground">{m.playlist_edit_delete_confirm_body()}</p>
				<div class="flex gap-2">
					<Button variant="outline" class="flex-1" onclick={() => (confirmDelete = false)}>
						{m.playlist_edit_delete_no()}
					</Button>
					<Button
						class="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
						onclick={deletePlaylist}
						disabled={$remove.isPending}
					>
						{m.playlist_edit_delete_yes()}
					</Button>
				</div>
			{/if}
		</div>
	{/if}
</section>
