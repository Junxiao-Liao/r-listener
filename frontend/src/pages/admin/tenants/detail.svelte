<script lang="ts">
	import { goto } from '$app/navigation';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import ConfirmAction from '$shared/components/ConfirmAction.svelte';
	import { Input } from '$shared/components/ui/input';
	import {
		useAdminTenantQuery,
		useDeleteAdminTenantMutation,
		useUpdateAdminTenantMutation
	} from '$shared/query/admin.query';
	import type { Id } from '$shared/types/dto';

	type Props = { tenantId: Id<'tenant'> };
	let { tenantId }: Props = $props();

	let name = $state('');
	const tenant = useAdminTenantQuery(() => tenantId);
	const updateTenant = useUpdateAdminTenantMutation();
	const deleteTenant = useDeleteAdminTenantMutation();

	$effect(() => {
		if ($tenant.data) name = $tenant.data.name;
	});

	async function save() {
		await $updateTenant.mutateAsync({ tenantId, patch: { name } });
	}

	async function remove() {
		await $deleteTenant.mutateAsync({ tenantId });
		void goto('/admin/tenants');
	}
</script>

<section class="flex flex-col gap-6 py-6">
	<header class="flex flex-col items-start gap-4">
		<Button variant="ghost" class="-ml-2 text-muted-foreground" href="/admin/tenants">
			<ArrowLeft class="mr-2 size-4" />
			<span>{m.admin_back()}</span>
		</Button>
		<h1 class="text-2xl font-semibold">{m.admin_tenant_detail()}</h1>
	</header>

	{#if $tenant.isPending}
		<p class="text-sm text-muted-foreground">{m.admin_loading()}</p>
	{:else if $tenant.isError || !$tenant.data}
		<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{m.admin_tenant_not_found()}
		</p>
	{:else}
		<form class="grid gap-3 rounded-md border border-border p-3" onsubmit={(e) => { e.preventDefault(); void save(); }}>
			<Input bind:value={name} />
			<Button type="submit" disabled={$updateTenant.isPending}>{m.admin_save()}</Button>
		</form>
		<Button href={`/admin/tenants/${tenantId}/members`} variant="outline">
			{m.admin_manage_members()}
		</Button>
		<section class="grid gap-3 rounded-md border border-border p-3">
			<h2 class="text-sm font-semibold">{m.admin_delete_tenant()}</h2>
			<p class="text-sm text-muted-foreground">{m.admin_delete_tenant_hint()}</p>
			<ConfirmAction
				title={m.admin_delete_tenant()}
				description={m.admin_delete_tenant_description()}
				trigger={m.action_delete()}
				confirm={m.action_delete()}
				disabled={$deleteTenant.isPending}
				onconfirm={remove}
			/>
		</section>
	{/if}
</section>
