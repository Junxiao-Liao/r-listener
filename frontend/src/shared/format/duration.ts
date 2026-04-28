export function formatDurationMs(ms: number | null | undefined): string {
	if (ms == null || !Number.isFinite(ms) || ms < 0) return '--:--';
	const totalSec = Math.floor(ms / 1000);
	const hours = Math.floor(totalSec / 3600);
	const minutes = Math.floor((totalSec % 3600) / 60);
	const seconds = totalSec % 60;
	if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
	return `${minutes}:${pad2(seconds)}`;
}

export function formatBytes(bytes: number | null | undefined): string {
	if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—';
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	if (kb < 1024) return `${kb.toFixed(1)} KB`;
	const mb = kb / 1024;
	if (mb < 1024) return `${mb.toFixed(1)} MB`;
	const gb = mb / 1024;
	return `${gb.toFixed(1)} GB`;
}

function pad2(n: number): string {
	return n.toString().padStart(2, '0');
}
