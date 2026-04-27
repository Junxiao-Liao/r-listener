<script lang="ts">
	import { Button } from '$shared/components/ui/button';
	import { Label } from '$shared/components/ui/label';
	import * as m from '$shared/paraglide/messages';
	import { getLocale, setLocale } from '$shared/paraglide/runtime';
	import { applyTheme } from '$shared/theme/theme';
	import type { Language, Theme } from '$shared/types/dto';
	import { cn } from '$shared/utils';
	import type { FormMessage } from '$shared/forms/superforms';
	import { superForm } from 'sveltekit-superforms';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { autosavePreference, createPreferenceActionSaver } from '../settings.autosave';
	import type { preferencesSchema } from '../settings.form';

	type Props = {
		data: SuperValidated<Infer<typeof preferencesSchema>, FormMessage>;
	};
	let { data }: Props = $props();

	// svelte-ignore state_referenced_locally
	const { form, message, enhance, submitting } = superForm(data);

	const sortOptions = [
		{ value: 'createdAt:desc', label: m.settings_sort_recent },
		{ value: 'title:asc', label: m.settings_sort_title },
		{ value: 'artist:asc', label: m.settings_sort_artist },
		{ value: 'album:asc', label: m.settings_sort_album }
	] as const;

	const themeOptions = [
		{ value: 'system', label: m.settings_theme_system },
		{ value: 'light', label: m.settings_theme_light },
		{ value: 'dark', label: m.settings_theme_dark }
	] as const;

	const languageOptions = [
		{ value: 'en', label: m.settings_language_en },
		{ value: 'zh', label: m.settings_language_zh }
	] as const;

	const saveVisualPreference = createPreferenceActionSaver();

	function getInitialTheme(): Theme {
		return data.data.theme ?? 'system';
	}

	function getInitialLanguage(): Language {
		return data.data.language ?? (getLocale() as Language);
	}

	let selectedTheme = $state<Theme>(getInitialTheme());
	let savedTheme = $state<Theme>(getInitialTheme());
	let selectedLanguage = $state<Language>(getInitialLanguage());
	let savedLanguage = $state<Language>(getInitialLanguage());
	let pendingVisualPreference = $state<'theme' | 'language' | null>(null);
	let visualPreferenceError = $state<'theme' | 'language' | null>(null);

	$effect(() => {
		applyTheme(selectedTheme);
	});

	async function pickTheme(theme: Theme) {
		if (theme === selectedTheme || pendingVisualPreference) return;
		const lastSaved = savedTheme;
		selectedTheme = theme;
		$form.theme = theme;
		visualPreferenceError = null;
		pendingVisualPreference = 'theme';

		try {
			await autosavePreference({
				lastSaved,
				persist: async () => (await saveVisualPreference({ theme })).theme,
				onSaved: (value) => {
					savedTheme = value;
					selectedTheme = value;
					$form.theme = value;
				},
				onRevert: (value) => {
					selectedTheme = value;
					$form.theme = value;
				},
				onError: () => {
					visualPreferenceError = 'theme';
				}
			});
		} finally {
			pendingVisualPreference = null;
		}
	}

	async function pickLanguage(language: Language) {
		if (language === selectedLanguage || pendingVisualPreference) return;
		const lastSaved = savedLanguage;
		selectedLanguage = language;
		$form.language = language;
		visualPreferenceError = null;
		pendingVisualPreference = 'language';

		try {
			await setLocale(language, { reload: false });
			await autosavePreference({
				lastSaved,
				persist: async () => (await saveVisualPreference({ language })).language,
				onSaved: (value) => {
					savedLanguage = value;
					selectedLanguage = value;
					$form.language = value;
				},
				onRevert: (value) => {
					selectedLanguage = value;
					$form.language = value;
					void setLocale(value, { reload: false });
				},
				onError: () => {
					visualPreferenceError = 'language';
				}
			});
		} finally {
			pendingVisualPreference = null;
		}
	}
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
			{m.settings_appearance()}
		</h2>
		<div class="grid grid-cols-3 gap-2 rounded-md bg-muted p-1" role="radiogroup" aria-label={m.settings_appearance()}>
			{#each themeOptions as opt (opt.value)}
				<button
					type="button"
					role="radio"
					aria-checked={selectedTheme === opt.value}
					disabled={pendingVisualPreference !== null}
					onclick={() => pickTheme(opt.value)}
					class={cn(
						'flex h-9 cursor-pointer items-center justify-center rounded-sm px-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70',
						selectedTheme === opt.value
							? 'bg-background font-medium text-foreground shadow-sm ring-1 ring-foreground/20'
							: 'text-muted-foreground hover:text-foreground'
					)}
				>
					{opt.label()}
				</button>
			{/each}
		</div>
		{#if visualPreferenceError === 'theme'}
			<p class="text-xs text-destructive">{m.settings_autosave_theme_error()}</p>
		{/if}
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
			{m.settings_language()}
		</h2>
		<div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label={m.settings_language()}>
			{#each languageOptions as opt (opt.value)}
				<button
					type="button"
					role="radio"
					aria-checked={selectedLanguage === opt.value}
					disabled={pendingVisualPreference !== null}
					onclick={() => pickLanguage(opt.value)}
					class={cn(
						'flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70',
						selectedLanguage === opt.value
							? 'border-foreground bg-muted text-foreground'
							: 'border-border text-muted-foreground hover:text-foreground'
					)}
				>
					{opt.label()}
				</button>
			{/each}
		</div>
		{#if visualPreferenceError === 'language'}
			<p class="text-xs text-destructive">{m.settings_autosave_language_error()}</p>
		{/if}
	</section>

	<Button type="submit" disabled={$submitting} class="w-full">{m.settings_save()}</Button>

	{#if $message?.type === 'success'}
		<p class="text-xs text-muted-foreground">{m.settings_saved()}</p>
	{/if}
</form>
