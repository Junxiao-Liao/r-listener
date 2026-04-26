import type { ApiClient } from '$shared/server/api';
import type {
	CurrentSessionDto,
	SigninResult,
	SwitchTenantResult
} from '$shared/types/dto';

export type SigninInput = { username: string; password: string };
export type ChangePasswordInput = { currentPassword: string; newPassword: string };

export const authApi = {
	signin(api: ApiClient, input: SigninInput) {
		return api.request<SigninResult>('/auth/signin', {
			method: 'POST',
			body: JSON.stringify(input)
		});
	},

	signout(api: ApiClient) {
		return api.request<void>('/auth/signout', { method: 'POST' });
	},

	switchTenant(api: ApiClient, tenantId: string) {
		return api.request<SwitchTenantResult>('/auth/switch-tenant', {
			method: 'POST',
			body: JSON.stringify({ tenantId })
		});
	},

	changePassword(api: ApiClient, input: ChangePasswordInput) {
		return api.request<void>('/auth/change-password', {
			method: 'POST',
			body: JSON.stringify(input)
		});
	},

	getSession(api: ApiClient, onResponse?: (res: Response) => void) {
		return api.request<CurrentSessionDto>('/auth/session', { onResponse });
	}
};
