<script lang="ts">
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import { useSessionQuery } from '$shared/query/session.query';

	const session = useSessionQuery();
	const activeMembership = $derived(
		$session.data?.tenants.find((t) => t.tenantId === $session.data?.activeTenantId) ?? null
	);
</script>

{#if $session.data}
	<section class="flex flex-col gap-6 py-6">
		<header class="flex flex-col gap-1">
			<p class="text-sm text-muted-foreground">{m.home_workspace()}</p>
			<h1 class="text-2xl font-semibold">
				{activeMembership?.tenantName ?? '—'}
			</h1>
			<p class="text-sm text-muted-foreground">
				{m.home_greeting()}
				{$session.data.user.username}
			</p>
		</header>

		<div class="flex flex-col gap-2">
			<Button variant="outline" href="/tenants">
				{m.settings_switch_workspace()}
			</Button>
			<Button variant="outline" href="/settings">
				{m.settings_title()}
			</Button>
		</div>
	</section>
{/if}
