<script lang="ts">
	import { goto } from '$app/navigation';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import ConfirmAction from '$shared/components/ConfirmAction.svelte';
	import { Input } from '$shared/components/ui/input';
	import { useSessionQuery } from '$shared/query/session.query';
	import {
		useAdminUserQuery,
		useDeleteAdminUserMutation,
		useResetAdminUserPasswordMutation,
		useUpdateAdminUserMutation
	} from '$shared/query/admin.query';
	import type { Id, TenantRole } from '$shared/types/dto';

	type Props = { userId: Id<'user'> };
	let { userId }: Props = $props();

	let username = $state('');
	let isAdmin = $state(false);
	let isActive = $state(true);
	let newPassword = $state('');

	const session = useSessionQuery();
	const user = useAdminUserQuery(() => userId);
	const updateUser = useUpdateAdminUserMutation();
	const resetPassword = useResetAdminUserPasswordMutation();
	const deleteUser = useDeleteAdminUserMutation();

	$effect(() => {
		if ($user.data) {
			username = $user.data.username;
			isAdmin = $user.data.isAdmin;
			isActive = $user.data.isActive;
		}
	});

	const isSelf = $derived($session.data?.user.id === userId);

	async function save() {
		await $updateUser.mutateAsync({ userId, patch: { username, isAdmin, isActive } });
	}

	async function reset() {
		await $resetPassword.mutateAsync({ userId, newPassword });
		newPassword = '';
	}

	async function remove() {
		await $deleteUser.mutateAsync({ userId });
		void goto('/admin/users');
	}

	function roleLabel(role: TenantRole) {
		if (role === 'owner') return m.admin_role_owner();
		if (role === 'viewer') return m.admin_role_viewer();
		return m.admin_role_member();
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

	{#if $user.data}
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

		<section class="grid gap-2">
			<h2 class="text-sm font-semibold">{m.admin_memberships()}</h2>
			{#each $user.data.memberships as membership}
				<p class="rounded-md border border-border px-3 py-2 text-sm">
					{membership.tenantName} · {roleLabel(membership.role)}
				</p>
			{/each}
		</section>

		<form class="grid gap-3 rounded-md border border-border p-3" onsubmit={(e) => { e.preventDefault(); void reset(); }}>
			<h2 class="text-sm font-semibold">{m.admin_reset_password()}</h2>
			<Input type="password" bind:value={newPassword} required />
			<Button type="submit" variant="outline" disabled={$resetPassword.isPending}>
				{m.admin_reset_password()}
			</Button>
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
