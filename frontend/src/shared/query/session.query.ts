import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
import { api, ApiError } from '$shared/api/client';
import { suppressGlobalApiErrorToast } from '$shared/feedback/error-toast.service';
import { queryKeys } from '$shared/query/keys';
import { applyTheme, setThemeCookie } from '$shared/theme/theme';
import { setLocale } from '$shared/paraglide/runtime';
import type {
	CurrentSessionDto,
	Id,
	SwitchTenantResult
} from '$shared/types/dto';

export type SigninInput = { username: string; password: string };
export type ChangePasswordInput = { currentPassword: string; newPassword: string };

export function useSessionQuery() {
	return createQuery<CurrentSessionDto | null, ApiError>({
		queryKey: queryKeys.session,
		queryFn: async () => {
			try {
				return await api<CurrentSessionDto>('/auth/session');
			} catch (error) {
				if (error instanceof ApiError && error.status === 401) return null;
				throw error;
			}
		}
	});
}

export function useSigninMutation() {
	const qc = useQueryClient();
	return createMutation<CurrentSessionDto, ApiError, SigninInput>({
		mutationFn: (input) => api<CurrentSessionDto>('/auth/signin', { method: 'POST', body: input }),
		meta: suppressGlobalApiErrorToast,
		onSuccess: (session) => {
			qc.setQueryData(queryKeys.session, session);
			setThemeCookie(session.preferences.theme);
			applyTheme(session.preferences.theme);
			void setLocale(session.preferences.language, { reload: false });
		}
	});
}

export function useSignoutMutation() {
	const qc = useQueryClient();
	return createMutation<void, ApiError, void>({
		mutationFn: () => api<void>('/auth/signout', { method: 'POST' }),
		onSettled: () => {
			qc.setQueryData(queryKeys.session, null);
			qc.removeQueries();
		}
	});
}

export function useSwitchTenantMutation() {
	const qc = useQueryClient();
	return createMutation<SwitchTenantResult, ApiError, { tenantId: Id<'tenant'> }>({
		mutationFn: ({ tenantId }) =>
			api<SwitchTenantResult>('/auth/switch-tenant', {
				method: 'POST',
				body: { tenantId }
			}),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: queryKeys.session });
		}
	});
}

export function useChangePasswordMutation() {
	return createMutation<void, ApiError, ChangePasswordInput>({
		mutationFn: (input) => api<void>('/auth/change-password', { method: 'POST', body: input }),
		meta: suppressGlobalApiErrorToast
	});
}
