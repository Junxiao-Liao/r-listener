import { writable, type Readable } from 'svelte/store';
import { ApiError } from '$shared/api/client';
import type {
	ErrorToast,
	ErrorToastId,
	ErrorToastStoreOptions,
	GlobalApiErrorMeta
} from './error-toast.type';

export type ErrorToastStore = Readable<ErrorToast[]> & {
	push: (message: string) => ErrorToastId;
	dismiss: (id: ErrorToastId) => void;
	clear: () => void;
};

const DEFAULT_DURATION_MS = 6_000;

export const suppressGlobalApiErrorToast = { apiErrorToast: false } as const;

export function createErrorToastStore(options: ErrorToastStoreOptions = {}): ErrorToastStore {
	const durationMs = options.durationMs ?? DEFAULT_DURATION_MS;
	const now = options.now ?? Date.now;
	const schedule = options.schedule ?? setTimeout;
	const { subscribe, update, set } = writable<ErrorToast[]>([]);
	let nextId = 1;

	function dismiss(id: ErrorToastId) {
		update((toasts) => toasts.filter((toast) => toast.id !== id));
	}

	return {
		subscribe,
		push: (message) => {
			const id: ErrorToastId = `toast_${nextId++}`;
			const toast = { id, message, createdAt: now() };
			update((toasts) => {
				const duplicate = toasts.some((item) => item.message === message);
				return duplicate ? toasts : [...toasts, toast];
			});
			if (Number.isFinite(durationMs) && durationMs > 0) {
				schedule(() => dismiss(id), durationMs);
			}
			return id;
		},
		dismiss,
		clear: () => set([])
	};
}

export const errorToasts = createErrorToastStore();

export function formatGlobalApiError(error: unknown): string | null {
	if (!(error instanceof ApiError)) return null;
	return `${error.code}: ${error.message}`;
}

export function shouldReportGlobalApiError(meta: GlobalApiErrorMeta | undefined): boolean {
	return meta?.apiErrorToast !== false;
}

export function reportGlobalApiError(
	error: unknown,
	meta: GlobalApiErrorMeta | undefined = undefined,
	store: ErrorToastStore = errorToasts
): void {
	if (!shouldReportGlobalApiError(meta)) return;
	const message = formatGlobalApiError(error);
	if (message) store.push(message);
}

export function registerGlobalApiErrorHandlers(
	report: (error: unknown) => void = (error) => reportGlobalApiError(error)
): () => void {
	const onUnhandledRejection = (event: PromiseRejectionEvent) => {
		if (formatGlobalApiError(event.reason)) {
			report(event.reason);
			event.preventDefault();
		}
	};

	window.addEventListener('unhandledrejection', onUnhandledRejection);
	return () => window.removeEventListener('unhandledrejection', onUnhandledRejection);
}
