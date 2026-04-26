// Project-typed superforms message envelope. Action errors flow back as
// { type: 'error', code }, allowing clients to look up a localized string
// from the message catalog without leaking backend strings into the UI.

import type { ErrorStatus } from 'sveltekit-superforms';

export type FormMessage = {
	type: 'error' | 'success';
	code?: string;
};

// Backend ApiError.status is a runtime number; superforms' message() expects
// an `ErrorStatus` literal-union. Coerce safely (defaulting to 400 outside the
// 400-599 band) so we can forward backend statuses verbatim where applicable.
export function asErrorStatus(status: number): ErrorStatus {
	return (status >= 400 && status < 600 ? status : 400) as ErrorStatus;
}

export { superValidate, fail, message, setError } from 'sveltekit-superforms';
// We use zod 4. Re-export the v4 adapter under the friendlier `zod` name.
export { zod4 as zod } from 'sveltekit-superforms/adapters';
