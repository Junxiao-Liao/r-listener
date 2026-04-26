<script lang="ts">
	import { Button } from '$shared/components/ui/button';
	import * as m from '$shared/paraglide/messages';
	import type { FormMessage } from '$shared/forms/superforms';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import type { CurrentSessionDto } from '$shared/types/dto';
	import type { preferencesSchema } from './settings.form';
	import PreferencesForm from './components/PreferencesForm.svelte';

	type Data = {
		session: CurrentSessionDto;
		form: SuperValidated<Infer<typeof preferencesSchema>, FormMessage>;
	};

	let { data }: { data: Data } = $props();

	const activeMembership = $derived(
		data.session.tenants.find((t) => t.tenantId === data.session.activeTenantId) ?? null
	);
</script>

<section class="flex flex-col gap-8 py-6">
	<header>
		<h1 class="text-2xl font-semibold">{m.settings_title()}</h1>
	</header>

	<section class="flex flex-col gap-3">
		<h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
			{m.settings_account()}
		</h2>
		<dl class="rounded-xl border border-border bg-card">
			<div class="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
				<dt class="text-sm text-muted-foreground">{m.settings_username()}</dt>
				<dd class="text-sm">{data.session.user.username}</dd>
			</div>
			<div class="flex items-center justify-between gap-3 px-4 py-3">
				<dt class="text-sm text-muted-foreground">{m.settings_active_workspace()}</dt>
				<dd class="text-sm">{activeMembership?.tenantName ?? '—'}</dd>
			</div>
		</dl>

		<form method="POST" action="?/switchWorkspace" class="contents">
			<Button type="submit" variant="outline" class="w-full">
				{m.settings_switch_workspace()}
			</Button>
		</form>
		<Button variant="outline" href="/settings/change-password" class="w-full">
			{m.settings_change_password()}
		</Button>
		<form method="POST" action="?/signout" class="contents">
			<Button type="submit" variant="destructive" class="w-full">
				{m.settings_sign_out()}
			</Button>
		</form>
	</section>

	<PreferencesForm data={data.form} />
</section>
