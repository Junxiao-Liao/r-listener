import { z } from 'zod';

export const switchTenantSchema = z.object({
	tenantId: z.string().min(1, 'Tenant id is required.')
});

export type SwitchTenantForm = z.infer<typeof switchTenantSchema>;
export const defaultSwitchTenantForm: SwitchTenantForm = { tenantId: '' };
