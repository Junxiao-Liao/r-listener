type PlatformLike = { env: { BACKEND_URL?: string; FRONTEND_ORIGIN?: string } };

export function getFrontendOrigin(platform: PlatformLike | undefined): string {
	const origin = platform?.env.FRONTEND_ORIGIN;
	if (!origin) {
		throw new Error('FRONTEND_ORIGIN env var is not set');
	}
	return origin;
}

export function getBackendUrl(platform: PlatformLike | undefined): string {
	const url = platform?.env.BACKEND_URL;
	if (!url) {
		throw new Error('BACKEND_URL env var is not set');
	}
	return url;
}
