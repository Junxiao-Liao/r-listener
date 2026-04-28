import type { ApiErrorBody, ApiErrorCode } from '$shared/types/dto';

export type ApiRequestInit = Omit<RequestInit, 'headers' | 'body'> & {
	headers?: HeadersInit;
	body?: unknown;
};

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly code: ApiErrorCode,
		message: string,
		public readonly fields?: Record<string, string>,
		public readonly details?: ApiErrorBody['error']['details']
	) {
		super(message);
		this.name = 'ApiError';
	}

	static async fromResponse(res: Response): Promise<ApiError> {
		const text = await res.text().catch(() => '');
		try {
			const body = JSON.parse(text) as ApiErrorBody;
			if (body?.error?.code) {
				return new ApiError(
					res.status,
					body.error.code,
					body.error.message,
					body.error.fields,
					body.error.details
				);
			}
		} catch {
			// fall through
		}
		return new ApiError(res.status, 'internal_error', text || `Backend error ${res.status}`);
	}
}

// Browser-side client — calls the backend through the same origin (`/api/...`).
// The session cookie is sent automatically because it is first-party.
export async function api<T = unknown>(path: string, init: ApiRequestInit = {}): Promise<T> {
	const { body, headers: rawHeaders, ...rest } = init;
	const headers = new Headers(rawHeaders);
	const hasJsonBody = body !== undefined && body !== null && !(body instanceof FormData);
	if (hasJsonBody && !headers.has('content-type')) {
		headers.set('content-type', 'application/json');
	}
	const res = await fetch(path.startsWith('/api') ? path : `/api${path}`, {
		...rest,
		headers,
		body: hasJsonBody ? JSON.stringify(body) : (body as BodyInit | null | undefined)
	});
	if (!res.ok) throw await ApiError.fromResponse(res);
	if (res.status === 204) return undefined as T;
	const ct = res.headers.get('content-type') ?? '';
	if (!ct.includes('application/json')) return undefined as T;
	return (await res.json()) as T;
}
