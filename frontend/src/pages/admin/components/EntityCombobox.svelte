<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import Search from '@lucide/svelte/icons/search';
	import { Button } from '$shared/components/ui/button';
	import { Input } from '$shared/components/ui/input';
	import * as m from '$shared/paraglide/messages';
	import {
		mergeEntityPage,
		optionById
	} from './entity-combobox.service';
	import type {
		EntityComboboxId,
		EntityComboboxOption,
		EntityComboboxSearch
	} from './entity-combobox.type';

	type Props<TId extends EntityComboboxId = EntityComboboxId> = {
		value: TId | '';
		search: EntityComboboxSearch<TId>;
		placeholder: string;
		required?: boolean;
		disabled?: boolean;
		limit?: number;
	};

	let {
		value = $bindable(''),
		search,
		placeholder,
		required = false,
		disabled = false,
		limit = 25
	}: Props = $props();

	let isOpen = $state(false);
	let searchText = $state('');
	let selectedLabel = $state('');
	let items = $state<EntityComboboxOption[]>([]);
	let nextCursor = $state<string | null>(null);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let requestSeq = 0;

	const selected = $derived(optionById(items, value));

	$effect(() => {
		if (selected) {
			selectedLabel = selected.label;
			searchText = selected.label;
		}
		if (!value) {
			selectedLabel = '';
		}
	});

	$effect(() => {
		if (!isOpen) return;
		const q = searchText;
		void loadPage('replace', q);
	});

	async function loadPage(mode: 'replace' | 'append', q = searchText) {
		const seq = ++requestSeq;
		isLoading = true;
		error = null;
		try {
			const page = await search({
				q: q.trim() || undefined,
				limit,
				cursor: mode === 'append' ? nextCursor : undefined
			});
			if (seq !== requestSeq) return;
			const merged = mergeEntityPage({ items, nextCursor }, page, mode);
			items = merged.items;
			nextCursor = merged.nextCursor;
		} catch (err) {
			if (seq !== requestSeq) return;
			error = err instanceof Error ? err.message : m.admin_error();
		} finally {
			if (seq === requestSeq) isLoading = false;
		}
	}

	function open() {
		if (disabled) return;
		isOpen = true;
	}

	function handleInput() {
		if (value && searchText !== selectedLabel) value = '';
		isOpen = true;
	}

	function selectOption(option: EntityComboboxOption) {
		value = option.id;
		selectedLabel = option.label;
		searchText = option.label;
		isOpen = false;
	}
</script>

<div class="relative">
	<div class="flex gap-2">
		<div class="relative min-w-0 flex-1">
			<Search class="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				class="pl-8 pr-8"
				{placeholder}
				bind:value={searchText}
				{disabled}
				role="combobox"
				aria-expanded={isOpen}
				aria-autocomplete="list"
				aria-required={required}
				onfocus={open}
				oninput={handleInput}
			/>
			<button
				type="button"
				class="absolute right-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted"
				disabled={disabled}
				aria-label={placeholder}
				onclick={() => (isOpen = !isOpen)}
			>
				<ChevronDown class="size-4" />
			</button>
		</div>
	</div>
	<input class="sr-only" tabindex="-1" aria-hidden="true" value={value} {required} />

	{#if isOpen}
		<div
			class="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-background p-1 shadow-md"
			role="listbox"
		>
			{#if error}
				<p class="px-2 py-2 text-sm text-destructive">{error}</p>
			{:else if items.length === 0 && isLoading}
				<p class="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
					<Loader2 class="size-4 animate-spin" />
					{m.admin_loading()}
				</p>
			{:else if items.length === 0}
				<p class="px-2 py-2 text-sm text-muted-foreground">{m.admin_no_results()}</p>
			{:else}
				{#each items as item (item.id)}
					<button
						type="button"
						class="grid w-full gap-0.5 rounded-sm px-2 py-2 text-left text-sm hover:bg-muted"
						role="option"
						aria-selected={item.id === value}
						onclick={() => selectOption(item)}
					>
						<span class="truncate font-medium">{item.label}</span>
						<span class="truncate text-xs text-muted-foreground">{item.detail}</span>
					</button>
				{/each}
				{#if nextCursor}
					<Button
						type="button"
						variant="ghost"
						class="mt-1 w-full justify-center"
						disabled={isLoading}
						onclick={() => void loadPage('append')}
					>
						{#if isLoading}
							<Loader2 class="size-4 animate-spin" />
						{/if}
						{m.admin_load_more()}
					</Button>
				{/if}
			{/if}
		</div>
	{/if}
</div>
