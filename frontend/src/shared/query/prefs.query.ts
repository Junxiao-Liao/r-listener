import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import { api, ApiError } from '$shared/api/client';
import { queryKeys } from '$shared/query/keys';
import { setLocale } from '$shared/paraglide/runtime';
import { applyTheme, setThemeCookie } from '$shared/theme/theme';
import type {
	CurrentSessionDto,
	PreferencesDto,
	PreferencesPatch
} from '$shared/types/dto';

export function useUpdatePreferencesMutation() {
	const qc = useQueryClient();
	return createMutation<PreferencesDto, ApiError, PreferencesPatch>({
		mutationFn: (patch) =>
			api<PreferencesDto>('/me/preferences', { method: 'PATCH', body: patch }),
		onSuccess: (preferences) => {
			qc.setQueryData<CurrentSessionDto | null>(queryKeys.session, (prev) =>
				prev ? { ...prev, preferences } : prev
			);
			if (preferences.theme) {
				setThemeCookie(preferences.theme);
				applyTheme(preferences.theme);
			}
			if (preferences.language) {
				void setLocale(preferences.language);
			}
		}
	});
}
