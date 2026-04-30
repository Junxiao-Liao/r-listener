<script lang="ts">
	import { goto } from '$app/navigation';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import ConfirmAction from '$shared/components/ConfirmAction.svelte';
	import { Input } from '$shared/components/ui/input';
	import { Label } from '$shared/components/ui/label';
	import PasswordRulesHint from '$pages/change-password/components/PasswordRulesHint.svelte';
	import EntityCombobox from '$pages/admin/components/EntityCombobox.svelte';
	import { createTenantSelectorSearch } from '$pages/admin/admin-selector.service';
	import { validateAdminResetPassword } from './admin-reset-password.form';
	import { useSessionQuery } from '$shared/query/session.query';
	import {
		useCreateAdminMembershipMutation,
		useAdminUserQuery,
		useDeleteAdminUserMutation,
		useDeleteAdminMembershipMutation,
		useResetAdminUserPasswordMutation,
		useUpdateAdminMembershipMutation,
		useUpdateAdminUserMutation
	} from '$shared/query/admin.query';
	import type { Id, TenantRole } from '$shared/types/dto';

	type Props = { userId: Id<'user'> };
	let { userId }: Props = $props();

	let username = $state('');
	let isAdmin = $state(false);
	let isActive = $state(true);
	let newPassword = $state('');
	let resetPasswordError = $state<'weak_password' | null>(null);
	let tenantId = $state<Id<'tenant'> | ''>('');
	let membershipRole = $state<TenantRole>('member');
	let pendingRole = $state<Record<string, TenantRole>>({});

	const session = useSessionQuery();
	const user = useAdminUserQuery(() => userId);
	const updateUser = useUpdateAdminUserMutation();
	const resetPassword = useResetAdminUserPasswordMutation();
	const deleteUser = useDeleteAdminUserMutation();
	const createMembership = useCreateAdminMembershipMutation();
	const updateMembership = useUpdateAdminMembershipMutation();
	const deleteMembership = useDeleteAdminMembershipMutation();
	const tenantSearch = (params: Parameters<ReturnType<typeof createTenantSelectorSearch>>[0]) =>
		createTenantSelectorSearch({ excludeUserId: userId })(params);

	$effect(() => {
		if ($user.data) {
			username = $user.data.username;
			isAdmin = $user.data.isAdmin;
			isActive = $user.data.isActive;
		}
	});

	const isSelf = $derived($session.data?.user.id === userId);
	const ownerCount = $derived(
		($user.data?.memberships ?? []).filter((membership) => membership.role === 'owner').length
	);

	async function save() {
		await $updateUser.mutateAsync({ userId, patch: { username, isAdmin, isActive } });
	}

	async function reset() {
		resetPasswordError = null;
		await $resetPassword.mutateAsync({ userId, newPassword });
		newPassword = '';
	}

	function validateResetPasswordBeforeConfirm(): boolean {
		const validation = validateAdminResetPassword(newPassword);
		resetPasswordError = validation.ok ? null : validation.error;
		return validation.ok;
	}

	async function remove() {
		await $deleteUser.mutateAsync({ userId });
		void goto('/admin/users');
	}

	async function addMembership() {
		await $createMembership.mutateAsync({
			tenantId: tenantId as Id<'tenant'>,
			userId,
			role: membershipRole
		});
		tenantId = '';
	}

	async function updateMembershipRole(tenantId: Id<'tenant'>) {
		await $updateMembership.mutateAsync({
			tenantId,
			userId,
			role: pendingRole[tenantId] ?? 'member'
		});
	}

	async function removeMembership(tenantId: Id<'tenant'>) {
		await $deleteMembership.mutateAsync({ tenantId, userId });
	}
</script>

<section class="flex flex-col gap-6 py-6">
	<header class="flex flex-col items-start gap-4">
		<Button variant="ghost" class="-ml-2 text-muted-foreground" href="/admin/users">
			<ArrowLeft class="mr-2 size-4" />
			<span>{m.admin_back()}</span>
		</Button>
		<h1 class="text-2xl font-semibold">{m.admin_user_detail()}</h1>
	</header>

	{#if $user.isPending}
		<p class="text-sm text-muted-foreground">{m.admin_loading()}</p>
	{:else if $user.isError || !$user.data}
		<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{m.admin_user_not_found()}
		</p>
	{:else}
		<form class="grid gap-3 rounded-md border border-border p-3" onsubmit={(e) => { e.preventDefault(); void save(); }}>
			<Input bind:value={username} />
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={isAdmin} disabled={isSelf} />
				{m.admin_platform_admin()}
			</label>
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={isActive} disabled={isSelf} />
				{m.admin_user_status_active()}
			</label>
			{#if isSelf}
				<p class="text-sm text-muted-foreground">{m.admin_self_update_guard()}</p>
			{/if}
			<Button type="submit" disabled={$updateUser.isPending}>{m.admin_save()}</Button>
		</form>

		<section class="grid gap-3 rounded-md border border-border p-3">
			<h2 class="text-sm font-semibold">{m.admin_memberships()}</h2>

			<form class="grid gap-3" onsubmit={(e) => { e.preventDefault(); void addMembership(); }}>
				<EntityCombobox
					bind:value={tenantId}
					search={tenantSearch}
					placeholder={m.admin_tenant_name()}
					required
				/>
				<select class="h-9 rounded-md border border-input bg-background px-2 text-sm" bind:value={membershipRole}>
					<option value="owner">{m.admin_role_owner()}</option>
					<option value="member">{m.admin_role_member()}</option>
					<option value="viewer">{m.admin_role_viewer()}</option>
				</select>
				<Button type="submit" disabled={$createMembership.isPending}>{m.admin_add()}</Button>
				{#if $createMembership.error}
					<p class="text-sm text-destructive">{$createMembership.error.message}</p>
				{/if}
			</form>

			{#each $user.data.memberships as membership}
				{@const removingLastOwner = membership.role === 'owner' && ownerCount <= 1}
				<div class="grid gap-3 rounded-md border border-border p-3">
					<div>
						<p class="truncate font-medium">{membership.tenantName}</p>
						<p class="text-xs text-muted-foreground">{membership.tenantId}</p>
					</div>
					<select
						class="h-9 rounded-md border border-input bg-background px-2 text-sm"
						value={pendingRole[membership.tenantId] ?? membership.role}
						onchange={(e) => (pendingRole[membership.tenantId] = e.currentTarget.value as TenantRole)}
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
							onclick={() => void updateMembershipRole(membership.tenantId)}
						>
							{m.admin_save()}
						</Button>
						<ConfirmAction
							title={m.admin_remove_member()}
							description={m.admin_remove_member_description()}
							trigger={m.action_remove()}
							confirm={m.action_remove()}
							class="min-w-0 flex-1 shrink"
							disabled={removingLastOwner || $deleteMembership.isPending}
							onconfirm={() => removeMembership(membership.tenantId)}
						/>
					</div>
					{#if $updateMembership.error || $deleteMembership.error}
						<p class="text-sm text-destructive">
							{($updateMembership.error ?? $deleteMembership.error)?.message}
						</p>
					{/if}
				</div>
			{/each}
		</section>

		<form class="grid gap-3 rounded-md border border-border p-3" onsubmit={(e) => { e.preventDefault(); }}>
			<h2 class="text-sm font-semibold">{m.admin_reset_password()}</h2>
			<div class="grid gap-1.5">
				<Label for="admin-new-password">{m.change_password_new()}</Label>
				<Input
					id="admin-new-password"
					type="password"
					autocomplete="new-password"
					bind:value={newPassword}
					aria-invalid={resetPasswordError === 'weak_password'}
					required
					oninput={() => (resetPasswordError = null)}
				/>
				<PasswordRulesHint />
				{#if resetPasswordError === 'weak_password'}
					<p class="text-xs text-destructive" role="alert">{m.change_password_error_weak()}</p>
				{/if}
			</div>
			<ConfirmAction
				title={m.admin_reset_password_confirm_title()}
				description={m.admin_reset_password_confirm_description()}
				trigger={m.admin_reset_password()}
				confirm={m.admin_reset_password()}
				disabled={!newPassword || $resetPassword.isPending}
				onbeforeopen={validateResetPasswordBeforeConfirm}
				onconfirm={reset}
			/>
		</form>

		<section class="grid gap-3 rounded-md border border-border p-3">
			<h2 class="text-sm font-semibold">{m.admin_delete_user()}</h2>
			<ConfirmAction
				title={m.admin_delete_user()}
				description={m.admin_delete_user_description()}
				trigger={m.action_delete()}
				confirm={m.action_delete()}
				disabled={isSelf || $deleteUser.isPending}
				onconfirm={remove}
			/>
		</section>
	{/if}
</section>
