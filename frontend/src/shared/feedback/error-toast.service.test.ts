import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { ApiError } from '$shared/api/client';
import {
	createErrorToastStore,
	formatGlobalApiError,
	reportGlobalApiError,
	shouldReportGlobalApiError
} from './error-toast.service';

describe('global API error toast service', () => {
	it('formats API errors as code plus message', () => {
		const error = new ApiError(422, 'weak_password', 'Password is too weak.');

		expect(formatGlobalApiError(error)).toBe('weak_password: Password is too weak.');
	});

	it('ignores non-API errors', () => {
		expect(formatGlobalApiError(new Error('Nope'))).toBeNull();
		expect(formatGlobalApiError('Nope')).toBeNull();
	});

	it('honors the per-query or per-mutation opt-out marker', () => {
		expect(shouldReportGlobalApiError(undefined)).toBe(true);
		expect(shouldReportGlobalApiError({})).toBe(true);
		expect(shouldReportGlobalApiError({ apiErrorToast: true })).toBe(true);
		expect(shouldReportGlobalApiError({ apiErrorToast: false })).toBe(false);
	});

	it('reports eligible API errors to the toast store', () => {
		const store = createErrorToastStore({ durationMs: Number.POSITIVE_INFINITY, now: () => 1 });
		const error = new ApiError(422, 'weak_password', 'Password is too weak.');

		reportGlobalApiError(error, undefined, store);

		expect(get(store)).toEqual([
			{ id: 'toast_1', message: 'weak_password: Password is too weak.', createdAt: 1 }
		]);
	});

	it('does not report opted-out API errors', () => {
		const store = createErrorToastStore({ durationMs: Number.POSITIVE_INFINITY });
		const error = new ApiError(422, 'weak_password', 'Password is too weak.');

		reportGlobalApiError(error, { apiErrorToast: false }, store);

		expect(get(store)).toEqual([]);
	});
});
