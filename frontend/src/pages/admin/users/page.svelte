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
	import { createTenantSelectorSearch } from '$pages/admin/admin-selector.service';
	import {
		useAdminUsersQuery,
		useCreateAdminUserMutation
	} from '$shared/query/admin.query';
	import type { Id, TenantRole } from '$shared/types/dto';

	let draftQ = $state('');
	let appliedQ = $state('');
	let username = $state('');
	let password = $state('');
	let isAdmin = $state(false);
	let tenantId = $state<Id<'tenant'> | ''>('');
	let role = $state<TenantRole>('member');

	const tenantSearch = createTenantSelectorSearch();
	const users = useAdminUsersQuery(() => ({ q: appliedQ || undefined, includeInactive: true }));
	const createUser = useCreateAdminUserMutation();

	function userStatusLabel(isActive: boolean) {
		return isActive ? m.admin_user_status_active() : m.admin_user_status_inactive();
	}

	async function submit() {
		const created = await $createUser.mutateAsync({
			username,
			password,
			isAdmin,
			initialMembership: tenantId ? { tenantId, role } : undefined
		});
		void goto(`/admin/users/${created.id}`);
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
		<h1 class="text-2xl font-semibold">{m.admin_users()}</h1>
	</header>

	<form class="grid gap-3 rounded-md border border-border p-3" onsubmit={(e) => { e.preventDefault(); void submit(); }}>
		<h2 class="text-sm font-semibold">{m.admin_create_user()}</h2>
		<Input placeholder={m.admin_username()} bind:value={username} required />
		<Input placeholder={m.admin_temporary_password()} type="password" bind:value={password} required />
		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" bind:checked={isAdmin} />
			{m.admin_platform_admin()}
		</label>
		<EntityCombobox
			bind:value={tenantId}
			search={tenantSearch}
			placeholder={m.admin_initial_tenant_id()}
		/>
		<select class="h-9 rounded-md border border-input bg-background px-2 text-sm" bind:value={role}>
			<option value="owner">{m.admin_role_owner()}</option>
			<option value="member">{m.admin_role_member()}</option>
			<option value="viewer">{m.admin_role_viewer()}</option>
		</select>
		<Button type="submit" disabled={$createUser.isPending}>{m.admin_create()}</Button>
		{#if $createUser.error}
			<p class="text-sm text-destructive">{$createUser.error.message}</p>
		{/if}
	</form>

	<form class="flex flex-col gap-2 sm:flex-row" onsubmit={(e) => { e.preventDefault(); applyFilter(); }}>
		<Input placeholder={m.admin_filter_users()} bind:value={draftQ} />
		<div class="flex gap-2">
			<Button type="submit">{m.admin_search()}</Button>
			<Button type="button" variant="outline" onclick={clearFilter}>{m.admin_clear()}</Button>
		</div>
	</form>

	{#if $users.isPending}
		<p class="text-sm text-muted-foreground">{m.admin_loading()}</p>
	{:else if $users.isError}
		<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{m.admin_users_error()}
		</p>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each $users.data?.items ?? [] as user (user.id)}
				<li class="rounded-md border border-border p-3">
					<a class="flex items-center justify-between gap-3" href={`/admin/users/${user.id}`}>
						<span class="truncate font-medium">{user.username}</span>
						<span class="shrink-0 text-xs text-muted-foreground">
							{m.admin_user_summary({
								count: user.workspaceCount,
								status: userStatusLabel(user.isActive)
							})}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>
