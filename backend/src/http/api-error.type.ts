export type ApiErrorCode =
	| 'validation_failed'
	| 'unauthenticated'
	| 'invalid_credentials'
	| 'account_disabled'
	| 'admin_required'
	| 'no_active_tenant'
	| 'tenant_forbidden'
	| 'insufficient_role'
	| 'forbidden_origin'
	| 'not_found'
	| 'user_not_found'
	| 'tenant_not_found'
	| 'track_not_found'
	| 'queue_item_not_found'
	| 'username_conflict'
	| 'already_member'
	| 'playlist_name_conflict'
	| 'track_already_in_playlist'
	| 'track_already_finalized'
	| 'track_not_ready'
	| 'payload_too_large'
	| 'unsupported_media_type'
	| 'weak_password'
	| 'cannot_self_downgrade'
	| 'cannot_self_delete'
	| 'cannot_remove_last_owner'
	| 'upload_missing'
	| 'rate_limited'
	| 'internal_error';

export type ApiErrorFieldMap = Record<string, string>;

export type ApiErrorBody = {
	error: {
		code: ApiErrorCode;
		message: string;
		fields?: ApiErrorFieldMap;
	};
};
