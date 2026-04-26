import type { ApiClient } from '$shared/server/api';
import type { PreferencesDto, PreferencesPatch } from '$shared/types/dto';

export const prefsApi = {
	get(api: ApiClient) {
		return api.request<PreferencesDto>('/me/preferences');
	},
	patch(api: ApiClient, patch: PreferencesPatch) {
		return api.request<PreferencesDto>('/me/preferences', {
			method: 'PATCH',
			body: JSON.stringify(patch)
		});
	}
};
