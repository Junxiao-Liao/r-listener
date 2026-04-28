<script lang="ts">
	import { goto } from '$app/navigation';
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';
	import {
		useSessionQuery,
		useSignoutMutation
	} from '$shared/query/session.query';
	import PreferencesForm from './components/PreferencesForm.svelte';

	const session = useSessionQuery();
	const signout = useSignoutMutation();

	const activeMembership = $derived(
		$session.data?.tenants.find((t) => t.tenantId === $session.data?.activeTenantId) ?? null
	);

	async function handleSignout() {
		await $signout.mutateAsync();
		void goto('/signin', { replaceState: true });
	}
</script>

{#if $session.data}
	<section class="flex flex-col gap-8 py-6">
		<header>
			<h1 class="text-2xl font-semibold">{m.settings_title()}</h1>
		</header>

		<section class="flex flex-col gap-3">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
				{m.settings_account()}
			</h2>
			<dl class="rounded-xl border border-border bg-card">
				<div
					class="flex items-center justify-between gap-3 border-b border-border px-4 py-3"
				>
					<dt class="text-sm text-muted-foreground">{m.settings_username()}</dt>
					<dd class="text-sm">{$session.data.user.username}</dd>
				</div>
				<div class="flex items-center justify-between gap-3 px-4 py-3">
					<dt class="text-sm text-muted-foreground">{m.settings_active_workspace()}</dt>
					<dd class="text-sm">{activeMembership?.tenantName ?? '—'}</dd>
				</div>
			</dl>

			<Button variant="outline" href="/tenants" class="w-full">
				{m.settings_switch_workspace()}
			</Button>
			<Button variant="outline" href="/settings/change-password" class="w-full">
				{m.settings_change_password()}
			</Button>
			<Button
				variant="destructive"
				class="w-full"
				disabled={$signout.isPending}
				onclick={handleSignout}
			>
				{m.settings_sign_out()}
			</Button>
		</section>

		<PreferencesForm preferences={$session.data.preferences} />
	</section>
{/if}
