<script lang="ts">
	import * as m from '$shared/paraglide/messages';
	import type { TenantMembershipDto } from '$shared/types/dto';
	import { cn } from '$shared/utils';

	type Props = {
		membership: TenantMembershipDto;
		lastUsed?: boolean;
	};
	let { membership, lastUsed = false }: Props = $props();

	function roleLabel(role: TenantMembershipDto['role']): string {
		switch (role) {
			case 'owner':
				return m.tenants_role_owner();
			case 'member':
				return m.tenants_role_member();
			case 'viewer':
				return m.tenants_role_viewer();
		}
	}
</script>

<form method="POST" class="contents">
	<input type="hidden" name="tenantId" value={membership.tenantId} />
	<button
		type="submit"
		class={cn(
			'flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left',
			'hover:border-foreground/20 active:bg-secondary'
		)}
	>
		<div class="flex flex-col gap-0.5">
			<span class="font-medium leading-tight">{membership.tenantName}</span>
			<span class="text-xs text-muted-foreground">{roleLabel(membership.role)}</span>
		</div>
		{#if lastUsed}
			<span
				class="rounded-full border border-border px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground"
			>
				{m.tenants_last_used()}
			</span>
		{/if}
	</button>
</form>
