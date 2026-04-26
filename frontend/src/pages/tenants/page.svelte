<script lang="ts">
	import * as m from '$shared/paraglide/messages';
	import type { TenantMembershipDto } from '$shared/types/dto';
	import TenantCard from './components/TenantCard.svelte';

	type Data = {
		memberships: TenantMembershipDto[];
		lastActiveTenantId: string | null;
		isAdminWithNoMemberships: boolean;
	};

	let { data }: { data: Data } = $props();
</script>

<section class="flex flex-col gap-4 py-6">
	<header>
		<h1 class="text-2xl font-semibold">{m.tenants_title()}</h1>
	</header>

	{#if data.memberships.length === 0 && data.isAdminWithNoMemberships}
		<p class="rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground">
			{m.tenants_admin_no_memberships_hint()}
		</p>
	{/if}

	<ul class="flex flex-col gap-2">
		{#each data.memberships as membership (membership.tenantId)}
			<li>
				<TenantCard
					{membership}
					lastUsed={membership.tenantId === data.lastActiveTenantId &&
						data.memberships.length === 1}
				/>
			</li>
		{/each}
	</ul>
</section>
