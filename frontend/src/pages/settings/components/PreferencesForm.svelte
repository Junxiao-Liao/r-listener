<script lang="ts">
	import { Label } from '$shared/components/ui/label';
	import * as m from '$shared/paraglide/messages';
	import { applyTheme } from '$shared/theme/theme';
	import type {
		Language,
		LibrarySort,
		PreferencesDto,
		Theme
	} from '$shared/types/dto';
	import { cn } from '$shared/utils';
	import { useUpdatePreferencesMutation } from '$shared/query/prefs.query';

	type Props = { preferences: PreferencesDto };
	let { preferences }: Props = $props();

	const update = useUpdatePreferencesMutation();

	let pendingVisualPreference = $state<'theme' | 'language' | null>(null);
	let visualPreferenceError = $state<'theme' | 'language' | null>(null);

	const theme = $derived<Theme>(preferences.theme);
	const language = $derived<Language>(preferences.language);
	const autoPlayNext = $derived(preferences.autoPlayNext);
	const showMiniPlayer = $derived(preferences.showMiniPlayer);
	const preferSyncedLyrics = $derived(preferences.preferSyncedLyrics);
	const defaultLibrarySort = $derived<LibrarySort>(preferences.defaultLibrarySort);

	const sortOptions = [
		{ value: 'createdAt:desc', label: m.settings_sort_recent },
		{ value: 'title:asc', label: m.settings_sort_title },
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

	async function pickTheme(next: Theme) {
		if (next === theme || pendingVisualPreference) return;
		pendingVisualPreference = 'theme';
		visualPreferenceError = null;
		applyTheme(next);
		try {
			await $update.mutateAsync({ theme: next });
		} catch {
			visualPreferenceError = 'theme';
			applyTheme(theme);
		} finally {
			pendingVisualPreference = null;
		}
	}

	async function pickLanguage(next: Language) {
		if (next === language || pendingVisualPreference) return;
		pendingVisualPreference = 'language';
		visualPreferenceError = null;
		try {
			await $update.mutateAsync({ language: next });
		} catch {
			visualPreferenceError = 'language';
		} finally {
			pendingVisualPreference = null;
		}
	}

	function pickSort(next: LibrarySort) {
		if (next === defaultLibrarySort) return;
		void $update.mutateAsync({ defaultLibrarySort: next });
	}
</script>

<div class="flex flex-col gap-5">
	<section class="flex flex-col gap-3">
		<h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
			{m.settings_playback()}
		</h2>
		<label class="flex items-center justify-between gap-3 text-sm">
			<span>{m.settings_auto_play_next()}</span>
			<input
				type="checkbox"
				checked={autoPlayNext}
				onchange={() => $update.mutate({ autoPlayNext: !autoPlayNext })}
				class="size-4"
			/>
		</label>
		<label class="flex items-center justify-between gap-3 text-sm">
			<span>{m.settings_show_mini_player()}</span>
			<input
				type="checkbox"
				checked={showMiniPlayer}
				onchange={() => $update.mutate({ showMiniPlayer: !showMiniPlayer })}
				class="size-4"
			/>
		</label>
		<label class="flex items-center justify-between gap-3 text-sm">
			<span>{m.settings_prefer_synced_lyrics()}</span>
			<input
				type="checkbox"
				checked={preferSyncedLyrics}
				onchange={() => $update.mutate({ preferSyncedLyrics: !preferSyncedLyrics })}
				class="size-4"
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
			class="h-9 rounded-md border border-input bg-background px-2 text-sm"
			value={defaultLibrarySort}
			onchange={(event) => pickSort(event.currentTarget.value as LibrarySort)}
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
		<div
			class="grid grid-cols-3 gap-2 rounded-md bg-muted p-1"
			role="radiogroup"
			aria-label={m.settings_appearance()}
		>
			{#each themeOptions as opt (opt.value)}
				<button
					type="button"
					role="radio"
					aria-checked={theme === opt.value}
					disabled={pendingVisualPreference !== null}
					onclick={() => pickTheme(opt.value)}
					class={cn(
						'flex h-9 cursor-pointer items-center justify-center rounded-sm px-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70',
						theme === opt.value
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
					aria-checked={language === opt.value}
					disabled={pendingVisualPreference !== null}
					onclick={() => pickLanguage(opt.value)}
					class={cn(
						'flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70',
						language === opt.value
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
</div>
