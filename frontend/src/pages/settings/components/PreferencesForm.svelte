<script lang="ts">
	import { Button } from '$shared/components/ui/button';
	import { Label } from '$shared/components/ui/label';
	import * as m from '$shared/paraglide/messages';
	import type { FormMessage } from '$shared/forms/superforms';
	import { superForm } from 'sveltekit-superforms';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import type { preferencesSchema } from '../settings.form';

	type Props = {
		data: SuperValidated<Infer<typeof preferencesSchema>, FormMessage>;
	};
	let { data }: Props = $props();

	// svelte-ignore state_referenced_locally
	const { form, message, enhance, submitting } = superForm(data, {
		dataType: 'json'
	});

	const sortOptions = [
		{ value: 'createdAt:desc', label: m.settings_sort_recent },
		{ value: 'title:asc', label: m.settings_sort_title },
		{ value: 'artist:asc', label: m.settings_sort_artist },
		{ value: 'album:asc', label: m.settings_sort_album }
	] as const;
</script>

<form
	method="POST"
	action="?/savePreferences"
	use:enhance
	class="flex flex-col gap-5"
>
	<section class="flex flex-col gap-3">
		<h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
			{m.settings_playback()}
		</h2>
		<label class="flex items-center justify-between gap-3 text-sm">
			<span>{m.settings_auto_play_next()}</span>
			<input type="hidden" name="autoPlayNext" value="false" />
			<input
				type="checkbox"
				name="autoPlayNext"
				value="true"
				class="size-4"
				bind:checked={$form.autoPlayNext}
			/>
		</label>
		<label class="flex items-center justify-between gap-3 text-sm">
			<span>{m.settings_show_mini_player()}</span>
			<input type="hidden" name="showMiniPlayer" value="false" />
			<input
				type="checkbox"
				name="showMiniPlayer"
				value="true"
				class="size-4"
				bind:checked={$form.showMiniPlayer}
			/>
		</label>
		<label class="flex items-center justify-between gap-3 text-sm">
			<span>{m.settings_prefer_synced_lyrics()}</span>
			<input type="hidden" name="preferSyncedLyrics" value="false" />
			<input
				type="checkbox"
				name="preferSyncedLyrics"
				value="true"
				class="size-4"
				bind:checked={$form.preferSyncedLyrics}
			/>
		</label>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
			{m.settings_library()}
		</h2>
		<Label for="defaultLibrarySort">{m.settings_default_sort()}</Label>
		<select
			id="defaultLibrarySort"
			name="defaultLibrarySort"
			class="h-9 rounded-md border border-input bg-background px-2 text-sm"
			bind:value={$form.defaultLibrarySort}
		>
			{#each sortOptions as opt (opt.value)}
				<option value={opt.value}>{opt.label()}</option>
			{/each}
		</select>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
			{m.settings_language()}
		</h2>
		<div class="grid grid-cols-2 gap-2">
			<label
				class="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-foreground"
			>
				<input type="radio" class="sr-only" name="language" value="en" bind:group={$form.language} />
				{m.settings_language_en()}
			</label>
			<label
				class="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-foreground"
			>
				<input type="radio" class="sr-only" name="language" value="zh" bind:group={$form.language} />
				{m.settings_language_zh()}
			</label>
		</div>
	</section>

	<Button type="submit" disabled={$submitting} class="w-full">{m.settings_save()}</Button>

	{#if $message?.type === 'success'}
		<p class="text-xs text-muted-foreground">{m.settings_saved()}</p>
	{/if}
</form>
