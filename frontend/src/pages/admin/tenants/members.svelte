<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import ConfirmAction from '$shared/components/ConfirmAction.svelte';
	import EntityCombobox from '$pages/admin/components/EntityCombobox.svelte';
	import { createUserSelectorSearch } from '$pages/admin/admin-selector.service';
	import {
		useAdminTenantMembersQuery,
		useCreateAdminMembershipMutation,
		useDeleteAdminMembershipMutation,
		useUpdateAdminMembershipMutation
	} from '$shared/query/admin.query';
	import type { Id, TenantRole } from '$shared/types/dto';

	type Props = { tenantId: Id<'tenant'> };
	let { tenantId }: Props = $props();

	let userId = $state<Id<'user'> | ''>('');
	let role = $state<TenantRole>('member');
	let pendingRole = $state<Record<string, TenantRole>>({});

	const userSearch = (params: Parameters<ReturnType<typeof createUserSelectorSearch>>[0]) =>
		createUserSelectorSearch({ excludeTenantId: tenantId })(params);
	const members = useAdminTenantMembersQuery(() => tenantId);
	const createMembership = useCreateAdminMembershipMutation();
	const updateMembership = useUpdateAdminMembershipMutation();
	const deleteMembership = useDeleteAdminMembershipMutation();

	const ownerCount = $derived(($members.data?.items ?? []).filter((member) => member.role === 'owner').length);

	async function addMember() {
		await $createMembership.mutateAsync({ tenantId, userId: userId as Id<'user'>, role });
		userId = '';
	}

	async function updateRole(memberUserId: Id<'user'>) {
		await $updateMembership.mutateAsync({
			tenantId,
			userId: memberUserId,
			role: pendingRole[memberUserId] ?? 'member'
		});
	}

	async function removeMember(memberUserId: Id<'user'>) {
		await $deleteMembership.mutateAsync({ tenantId, userId: memberUserId });
	}
</script>

<section class="flex flex-col gap-6 py-6">
	<header class="flex flex-col items-start gap-4">
		<Button variant="ghost" class="-ml-2 text-muted-foreground" href={`/admin/tenants/${tenantId}`}>
			<ArrowLeft class="mr-2 size-4" />
			<span>{m.admin_back()}</span>
		</Button>
		<h1 class="text-2xl font-semibold">{m.admin_members()}</h1>
	</header>

	<form class="grid gap-3 rounded-md border border-border p-3" onsubmit={(e) => { e.preventDefault(); void addMember(); }}>
		<h2 class="text-sm font-semibold">{m.admin_add_member()}</h2>
		<EntityCombobox
			bind:value={userId}
			search={userSearch}
			placeholder={m.admin_user_id()}
			required
		/>
		<select class="h-9 rounded-md border border-input bg-background px-2 text-sm" bind:value={role}>
			<option value="owner">{m.admin_role_owner()}</option>
			<option value="member">{m.admin_role_member()}</option>
			<option value="viewer">{m.admin_role_viewer()}</option>
		</select>
		<Button type="submit" disabled={$createMembership.isPending}>{m.admin_add()}</Button>
		{#if $createMembership.error}
			<p class="text-sm text-destructive">{$createMembership.error.message}</p>
		{/if}
	</form>

	{#if $members.isPending}
		<p class="text-sm text-muted-foreground">{m.admin_loading()}</p>
	{:else if $members.isError}
		<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{m.admin_members_error()}
		</p>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each $members.data?.items ?? [] as member (member.user.id)}
				{@const removingLastOwner = member.role === 'owner' && ownerCount <= 1}
				<li class="grid gap-3 rounded-md border border-border p-3">
					<div>
						<p class="truncate font-medium">{member.user.username}</p>
						<p class="text-xs text-muted-foreground">{member.user.id}</p>
					</div>
					<select
						class="h-9 rounded-md border border-input bg-background px-2 text-sm"
						value={pendingRole[member.user.id] ?? member.role}
						onchange={(e) => (pendingRole[member.user.id] = e.currentTarget.value as TenantRole)}
						disabled={removingLastOwner}
					>
						<option value="owner">{m.admin_role_owner()}</option>
						<option value="member">{m.admin_role_member()}</option>
						<option value="viewer">{m.admin_role_viewer()}</option>
					</select>
					{#if removingLastOwner}
						<p class="text-sm text-muted-foreground">{m.admin_last_owner_guard()}</p>
					{/if}
					<div class="flex gap-2">
						<Button
							variant="outline"
							disabled={removingLastOwner || $updateMembership.isPending}
							onclick={() => void updateRole(member.user.id)}
						>
							{m.admin_update()}
						</Button>
						<ConfirmAction
							title={m.admin_remove_member()}
							description={m.admin_remove_member_description()}
							trigger={m.action_remove()}
							confirm={m.action_remove()}
							class="min-w-0 flex-1 shrink"
							disabled={removingLastOwner || $deleteMembership.isPending}
							onconfirm={() => removeMember(member.user.id)}
						/>
					</div>
					{#if $updateMembership.error || $deleteMembership.error}
						<p class="text-sm text-destructive">
							{($updateMembership.error ?? $deleteMembership.error)?.message}
						</p>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
