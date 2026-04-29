<script lang="ts">
	import { goto } from '$app/navigation';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import { Input } from '$shared/components/ui/input';
	import { Label } from '$shared/components/ui/label';
	import CoverPlaceholder from '$shared/cover/CoverPlaceholder.svelte';
	import { useCreatePlaylistMutation } from '$shared/query/playlists.query';
	import { ApiError } from '$shared/api/client';

	const create = useCreatePlaylistMutation();

	let name = $state('');
	let description = $state('');
	let nameError = $state<string | null>(null);

	async function submit(ev: SubmitEvent) {
		ev.preventDefault();
		nameError = null;
		const trimmed = name.trim();
		if (!trimmed) {
			nameError = m.playlist_name_required();
			return;
		}
		try {
			const created = await $create.mutateAsync({
				name: trimmed,
				description: description.trim() || null
			});
			void goto(`/playlists/${created.id}`);
		} catch (err) {
			if (err instanceof ApiError && err.code === 'playlist_name_conflict') {
				nameError = m.playlist_name_conflict();
				return;
			}
			throw err;
		}
	}
</script>

<section class="flex flex-col gap-4 py-6">
	<header class="flex items-center justify-between gap-2">
		<h1 class="text-2xl font-semibold">{m.playlist_create_title()}</h1>
		<Button variant="outline" href="/playlists">{m.playlist_create_cancel()}</Button>
	</header>

	<form class="flex max-w-md flex-col gap-4" onsubmit={submit}>
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
			<Label for="playlist-desc">{m.playlist_field_description_optional()}</Label>
			<textarea
				id="playlist-desc"
				bind:value={description}
				class="min-h-[5rem] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
				maxlength={2000}
			></textarea>
		</div>

		<Button type="submit" disabled={$create.isPending}>{m.playlist_create_save()}</Button>
	</form>
</section>
