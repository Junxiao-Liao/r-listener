export function getClientIp(headers: Headers): string {
	const cfConnectingIp = headers.get('CF-Connecting-IP');
	if (cfConnectingIp) return cfConnectingIp;

	const forwardedFor = headers.get('X-Forwarded-For');
	if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || 'unknown';

	return 'unknown';
}
