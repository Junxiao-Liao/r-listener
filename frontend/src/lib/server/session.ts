// Kept in a separate module so both the API client and any future
// +hooks.server session loader can import the cookie name without
// pulling the request/response helpers.
export const SESSION_COOKIE = 'session';
