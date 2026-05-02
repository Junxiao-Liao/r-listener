<script lang="ts">
	import { goto } from '$app/navigation';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import {
		useSessionQuery,
		useSwitchTenantMutation
	} from '$shared/query/session.query';
	import { useAdminTenantsQuery } from '$shared/query/admin.query';
	import type { AdminTenantListItemDto, Id, TenantMembershipDto } from '$shared/types/dto';
	import TenantCard from './components/TenantCard.svelte';

	const session = useSessionQuery();
	const switchTenant = useSwitchTenantMutation();

	const isAdmin = $derived(!!$session.data?.user.isAdmin);

	const adminTenants = useAdminTenantsQuery(() => isAdmin);

	const memberships = $derived<TenantMembershipDto[]>($session.data?.tenants ?? []);
	const membershipByTenantId = $derived(
		new Map(memberships.map((membership) => [membership.tenantId, membership]))
	);
	const adminList = $derived<AdminTenantListItemDto[]>($adminTenants.data?.items ?? []);
	const lastActiveTenantId = $derived($session.data?.user.lastActiveTenantId ?? null);

	async function pick(tenantId: Id<'tenant'>) {
		try {
			await $switchTenant.mutateAsync({ tenantId });
			void goto('/', { replaceState: true });
		} catch {
			// Error surfaces via $switchTenant.error.
		}
	}
</script>

{#if $session.isPending}
	<section class="flex flex-col gap-4 py-6">
		<header class="flex flex-col items-start gap-4">
			<Button variant="ghost" class="-ml-2 text-muted-foreground" href="/">
				<ArrowLeft class="mr-2 size-4" />
				<span>{m.nav_home()}</span>
			</Button>
			<h1 class="text-2xl font-semibold">{m.tenants_title()}</h1>
		</header>
		<p class="text-sm text-muted-foreground">{m.tenants_loading()}</p>
	</section>
{:else if $session.data}
	<section class="flex flex-col gap-4 py-6">
		<header class="flex flex-col items-start gap-4">
			<Button variant="ghost" class="-ml-2 text-muted-foreground" href="/">
				<ArrowLeft class="mr-2 size-4" />
				<span>{m.nav_home()}</span>
			</Button>
			<h1 class="text-2xl font-semibold">{m.tenants_title()}</h1>
		</header>

		{#if memberships.length === 0 && isAdmin}
			<p class="rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground">
				{m.tenants_admin_no_memberships_hint()}
			</p>
		{/if}

		<ul class="flex flex-col gap-2">
			{#if isAdmin}
				{#each adminList as tenant (tenant.id)}
					<li>
						<TenantCard
							tenant={membershipByTenantId.get(tenant.id) ?? { tenantId: tenant.id, tenantName: tenant.name }}
							lastUsed={tenant.id === lastActiveTenantId}
							disabled={$switchTenant.isPending}
							onpick={() => pick(tenant.id)}
						/>
					</li>
				{/each}
			{:else}
				{#each memberships as membership (membership.tenantId)}
					<li>
						<TenantCard
							tenant={membership}
							lastUsed={membership.tenantId === lastActiveTenantId && memberships.length === 1}
							disabled={$switchTenant.isPending}
							onpick={() => pick(membership.tenantId)}
						/>
					</li>
				{/each}
			{/if}
		</ul>
	</section>
{/if}
