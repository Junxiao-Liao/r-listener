import type { ApiErrorBody, ApiErrorCode } from '../types/dto';
import { SESSION_COOKIE } from './session';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export type ApiRequestInit = Omit<RequestInit, 'headers'> & {
	headers?: HeadersInit;
	onResponse?: (response: Response) => void;
};

export type ApiClient = {
	request<T = unknown>(path: string, init?: ApiRequestInit): Promise<T>;
};

// Thin BFF client. Always invoked from +server / +page.server / load
// functions — never from the browser — so the session cookie forwards
// host-to-host and the backend URL stays out of the client bundle.
export function createApiClient(opts: {
	backendUrl: string;
	frontendOrigin: string;
	sessionToken?: string | null;
	fetch: typeof fetch;
}): ApiClient {
	return {
		async request<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
			const { onResponse, ...rest } = init;
			const headers = new Headers(rest.headers);
			const method = (rest.method ?? 'GET').toUpperCase();

			if (opts.sessionToken) {
				headers.set('cookie', `${SESSION_COOKIE}=${opts.sessionToken}`);
			}
			if (rest.body && !headers.has('content-type')) {
				headers.set('content-type', 'application/json');
			}
			// Backend enforceMutationOrigin requires this on every mutating request.
			if (MUTATING_METHODS.has(method) && !headers.has('origin')) {
				headers.set('origin', opts.frontendOrigin);
			}

			const res = await opts.fetch(new URL(path, opts.backendUrl), { ...rest, headers });
			onResponse?.(res);

			if (!res.ok) {
				throw await ApiError.fromResponse(res);
			}
			return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
		}
	};
}

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly code: ApiErrorCode,
		message: string,
		public readonly fields?: Record<string, string>
	) {
		super(message);
		this.name = 'ApiError';
	}

	static async fromResponse(res: Response): Promise<ApiError> {
		const text = await res.text().catch(() => '');
		try {
			const body = JSON.parse(text) as ApiErrorBody;
			if (body?.error?.code) {
				return new ApiError(res.status, body.error.code, body.error.message, body.error.fields);
			}
		} catch {
			// fallthrough
		}
		return new ApiError(res.status, 'internal_error', text || `Backend error ${res.status}`);
	}
}
