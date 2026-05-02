export function encodeBase64Cursor(data: unknown): string {
	return btoa(encodeURIComponent(JSON.stringify(data)));
}

export function decodeBase64Cursor<T = unknown>(cursor: string): T {
	return JSON.parse(decodeURIComponent(atob(cursor)));
}
