<script lang="ts">
	import { goto } from '$app/navigation';
	import * as m from '$shared/paraglide/messages';
	import {
		useSessionQuery,
		useSwitchTenantMutation
	} from '$shared/query/session.query';
	import { useAdminTenantsQuery } from '$shared/query/admin.query';
	import type { AdminTenantListItemDto, Id, TenantMembershipDto } from '$shared/types/dto';
	import TenantCard from './components/TenantCard.svelte';

	const session = useSessionQuery();
	const switchTenant = useSwitchTenantMutation();

	const isAdminWithNoMemberships = $derived(
		!!$session.data?.user.isAdmin && ($session.data?.tenants.length ?? 0) === 0
	);

	const adminTenants = useAdminTenantsQuery(() => isAdminWithNoMemberships);

	const memberships = $derived<TenantMembershipDto[]>($session.data?.tenants ?? []);
	const adminList = $derived<AdminTenantListItemDto[]>($adminTenants.data?.tenants ?? []);
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

{#if $session.data}
	<section class="flex flex-col gap-4 py-6">
		<header>
			<h1 class="text-2xl font-semibold">{m.tenants_title()}</h1>
		</header>

		{#if memberships.length === 0 && isAdminWithNoMemberships}
			<p class="rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground">
				{m.tenants_admin_no_memberships_hint()}
			</p>
		{/if}

		<ul class="flex flex-col gap-2">
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
			{#each adminList as tenant (tenant.id)}
				<li>
					<TenantCard
						tenant={{ tenantId: tenant.id, tenantName: tenant.name }}
						lastUsed={tenant.id === lastActiveTenantId}
						disabled={$switchTenant.isPending}
						onpick={() => pick(tenant.id)}
					/>
				</li>
			{/each}
		</ul>
	</section>
{/if}
