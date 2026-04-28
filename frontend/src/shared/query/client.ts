import { QueryClient } from '@tanstack/svelte-query';
import { ApiError } from '$shared/api/client';

function shouldRetry(failureCount: number, error: unknown): boolean {
	if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
	return failureCount < 2;
}

export function createQueryClient(): QueryClient {
	return new QueryClient({
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
