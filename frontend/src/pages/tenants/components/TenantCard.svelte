<script lang="ts">
	import * as m from '$shared/paraglide/messages';
	import type { Id, TenantRole } from '$shared/types/dto';
	import { cn } from '$shared/utils';

	export type TenantCardModel = {
		tenantId: Id<'tenant'>;
		tenantName: string;
		role?: TenantRole;
	};

	type Props = {
		tenant: TenantCardModel;
		lastUsed?: boolean;
		disabled?: boolean;
		onpick: () => void;
	};
	let { tenant, lastUsed = false, disabled = false, onpick }: Props = $props();

	function roleLabel(role: TenantRole | undefined): string {
		switch (role) {
			case 'owner':
				return m.tenants_role_owner();
			case 'member':
				return m.tenants_role_member();
			case 'viewer':
				return m.tenants_role_viewer();
			default:
				return m.tenants_role_admin_access();
		}
	}
</script>

<button
	type="button"
	{disabled}
	onclick={onpick}
	class={cn(
		'flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left',
		'hover:border-foreground/20 active:bg-secondary',
		'disabled:cursor-not-allowed disabled:opacity-60'
	)}
>
	<div class="min-w-0 flex-1 flex flex-col gap-0.5">
		<span class="truncate font-medium leading-tight">{tenant.tenantName}</span>
		<span class="text-xs text-muted-foreground">{roleLabel(tenant.role)}</span>
	</div>
	{#if lastUsed}
		<span
			class="rounded-full border border-border px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground"
		>
			{m.tenants_last_used()}
		</span>
	{/if}
</button>
