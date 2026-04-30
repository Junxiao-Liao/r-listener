import { MutationCache, QueryCache, QueryClient } from '@tanstack/svelte-query';
import { ApiError } from '$shared/api/client';
import { reportGlobalApiError } from '$shared/feedback/error-toast.service';
import type { GlobalApiErrorMeta } from '$shared/feedback/error-toast.type';

function shouldRetry(failureCount: number, error: unknown): boolean {
	if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
	return failureCount < 2;
}

export function createQueryClient(): QueryClient {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (error, query) => reportGlobalApiError(error, query.meta as GlobalApiErrorMeta)
		}),
		mutationCache: new MutationCache({
			onError: (error, _variables, _context, mutation) =>
				reportGlobalApiError(error, mutation.options.meta as GlobalApiErrorMeta)
		}),
		defaultOptions: {
			queries: {
				staleTime: 30_000,
				retry: shouldRetry,
				refetchOnWindowFocus: false
			},
			mutations: {
				retry: shouldRetry
			}
		}
	});
}
