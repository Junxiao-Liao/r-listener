export type ErrorToastId = `toast_${number}`;

export type ErrorToast = {
	id: ErrorToastId;
	message: string;
	createdAt: number;
};

export type GlobalApiErrorMeta = {
	apiErrorToast?: boolean;
};

export type ErrorToastScheduler = (
	callback: () => void,
	delayMs: number
) => ReturnType<typeof setTimeout>;

export type ErrorToastStoreOptions = {
	durationMs?: number;
	now?: () => number;
	schedule?: ErrorToastScheduler;
};
