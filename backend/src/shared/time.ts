import type { Iso8601 } from './shared.type';

export function toIso8601(date: Date): Iso8601 {
	return date.toISOString() as Iso8601;
}

export function fromUnixTimestampSeconds(value: Date | number): Iso8601 {
	const millis = value instanceof Date ? value.getTime() : value * 1000;
	return toIso8601(new Date(millis));
}

export function toUnixTimestampSeconds(date: Date): number {
	return Math.floor(date.getTime() / 1000);
}

export function fromUnixSecondsToDate(value: number): Date {
	return new Date(value * 1000);
}
