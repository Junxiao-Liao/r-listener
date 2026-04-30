<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import { useSessionQuery } from '$shared/query/session.query';

	const session = useSessionQuery();
	const homeHref = $derived($session.data?.activeTenantId ? '/' : '/tenants');
</script>

<section class="flex flex-col gap-6 py-6">
	<header class="flex flex-col items-start gap-4">
		<Button variant="ghost" class="-ml-2 text-muted-foreground" href={homeHref}>
			<ArrowLeft class="mr-2 size-4" />
			<span>{m.admin_home()}</span>
		</Button>
		<h1 class="text-2xl font-semibold">{m.admin_dashboard_title()}</h1>
	</header>

	<nav class="grid gap-2">
		<Button href="/admin/users" variant="outline" class="justify-start">{m.admin_users()}</Button>
		<Button href="/admin/tenants" variant="outline" class="justify-start">{m.admin_tenants()}</Button>
	</nav>
</section>
