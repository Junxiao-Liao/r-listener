<script lang="ts">
	import { goto } from '$app/navigation';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import { Input } from '$shared/components/ui/input';
	import EntityCombobox from '$pages/admin/components/EntityCombobox.svelte';
	import {
		applyAdminListFilter,
		clearAdminListFilter
	} from '$pages/admin/admin-list-filter.service';
	import { createUserSelectorSearch } from '$pages/admin/admin-selector.service';
	import {
		useAdminTenantsQuery,
		useCreateAdminTenantMutation
	} from '$shared/query/admin.query';
	import type { Id } from '$shared/types/dto';

	let draftQ = $state('');
	let appliedQ = $state('');
	let name = $state('');
	let ownerUserId = $state<Id<'user'> | ''>('');

	const ownerSearch = createUserSelectorSearch();
	const tenants = useAdminTenantsQuery(() => true, () => ({ q: appliedQ || undefined }));
	const createTenant = useCreateAdminTenantMutation();

	async function submit() {
		const result = await $createTenant.mutateAsync({
			name,
			ownerUserId: ownerUserId as Id<'user'>
		});
		void goto(`/admin/tenants/${result.tenant.id}`);
	}

	function applyFilter() {
		const next = applyAdminListFilter({ draft: draftQ, applied: appliedQ });
		draftQ = next.draft;
		appliedQ = next.applied;
	}

	function clearFilter() {
		const next = clearAdminListFilter();
		draftQ = next.draft;
		appliedQ = next.applied;
	}
</script>

<section class="flex flex-col gap-6 py-6">
	<header class="flex flex-col items-start gap-4">
		<Button variant="ghost" class="-ml-2 text-muted-foreground" href="/admin">
			<ArrowLeft class="mr-2 size-4" />
			<span>{m.admin_back()}</span>
		</Button>
		<h1 class="text-2xl font-semibold">{m.admin_tenants()}</h1>
	</header>

	<form class="grid gap-3 rounded-md border border-border p-3" onsubmit={(e) => { e.preventDefault(); void submit(); }}>
		<h2 class="text-sm font-semibold">{m.admin_create_tenant()}</h2>
		<Input placeholder={m.admin_tenant_name()} bind:value={name} required />
		<EntityCombobox
			bind:value={ownerUserId}
			search={ownerSearch}
			placeholder={m.admin_owner_user_id()}
			required
		/>
		<Button type="submit" disabled={$createTenant.isPending}>{m.admin_create()}</Button>
		{#if $createTenant.error}
			<p class="text-sm text-destructive">{$createTenant.error.message}</p>
		{/if}
	</form>

	<form class="flex flex-col gap-2 sm:flex-row" onsubmit={(e) => { e.preventDefault(); applyFilter(); }}>
		<Input placeholder={m.admin_filter_tenants()} bind:value={draftQ} />
		<div class="flex gap-2">
			<Button type="submit">{m.admin_search()}</Button>
			<Button type="button" variant="outline" onclick={clearFilter}>{m.admin_clear()}</Button>
		</div>
	</form>

	{#if $tenants.isPending}
		<p class="text-sm text-muted-foreground">{m.admin_loading()}</p>
	{:else if $tenants.isError}
		<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{m.admin_tenants_error()}
		</p>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each $tenants.data?.items ?? [] as tenant (tenant.id)}
				<li class="rounded-md border border-border p-3">
					<a class="flex items-center justify-between gap-3" href={`/admin/tenants/${tenant.id}`}>
						<span class="truncate font-medium">{tenant.name}</span>
						<span class="shrink-0 text-xs text-muted-foreground">
							{m.admin_tenant_summary({
								members: tenant.memberCount,
								tracks: tenant.trackCount
							})}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>
