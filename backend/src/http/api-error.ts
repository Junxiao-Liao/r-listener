import type { ZodError } from 'zod';
import type { ApiErrorBody, ApiErrorCode, ApiErrorFieldMap } from './api-error.type';

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly code: ApiErrorCode,
		message: string,
		public readonly fields?: ApiErrorFieldMap
	) {
		super(message);
		this.name = 'ApiError';
	}
}

export function apiError(
	status: number,
	code: ApiErrorCode,
	message: string,
	fields?: ApiErrorFieldMap
): ApiError {
	return new ApiError(status, code, message, fields);
}

export function formatApiError(error: ApiError): ApiErrorBody {
	return {
		error: {
			code: error.code,
			message: error.message,
			...(error.fields ? { fields: error.fields } : {})
		}
	};
}

export function validationError(fields: ApiErrorFieldMap): ApiError {
	return apiError(400, 'validation_failed', 'Invalid input.', fields);
}

export function fieldsFromZodError(error: ZodError): ApiErrorFieldMap {
	return error.issues.reduce<ApiErrorFieldMap>((fields, issue) => {
		const path = issue.path.join('.');
		fields[path || '_'] = issue.message;
		return fields;
	}, {});
}

export function internalError(): ApiError {
	return apiError(500, 'internal_error', 'Internal server error.');
}
