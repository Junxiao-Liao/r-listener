import { SESSION_COOKIE } from './session';

export type ApiClient = {
	request<T = unknown>(path: string, init?: RequestInit): Promise<T>;
};

// Thin BFF client. Always invoked from +server / +page.server / load
// functions — never from the browser — so the session cookie forwards
// host-to-host and the backend URL stays out of the client bundle.
export function createApiClient(opts: {
	backendUrl: string;
	sessionToken?: string | null;
	fetch: typeof fetch;
}): ApiClient {
	return {
		async request<T>(path: string, init: RequestInit = {}): Promise<T> {
			const headers = new Headers(init.headers);
			if (opts.sessionToken) {
				headers.set('cookie', `${SESSION_COOKIE}=${opts.sessionToken}`);
			}
			if (init.body && !headers.has('content-type')) {
				headers.set('content-type', 'application/json');
			}

			const res = await opts.fetch(new URL(path, opts.backendUrl), { ...init, headers });
			if (!res.ok) {
				throw new ApiError(res.status, await res.text().catch(() => ''));
			}
			return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
		}
	};
}

export class ApiError extends Error {
	constructor(
		public status: number,
		public detail: string
	) {
		super(`backend ${status}: ${detail}`);
	}
}
