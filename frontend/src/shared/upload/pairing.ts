// Selected-file grouping for the Upload feature. Pairs each audio file with a
// sibling .lrc whose base filename matches case-insensitively. Files we can't
// classify are surfaced as `ignored` so the UI can warn the user.

const AUDIO_EXTENSIONS = new Set([
	'mp3',
	'm4a',
	'mp4',
	'ogg',
	'oga',
	'flac',
	'wav',
	'aac',
	'webm',
	'opus'
]);

export type PairedFile = { audio: File; lrc: File | null };

export type PairResult = {
	paired: PairedFile[];
	ignored: File[];
};

export function pairAudioAndLrcFiles(files: readonly File[]): PairResult {
	const audios = files.filter(isAudioFile);
	const lrcByBase = new Map<string, File>();
	const lrcs: File[] = [];

	for (const f of files) {
		if (getExt(f.name) === 'lrc') {
			lrcs.push(f);
			const key = stripExt(f.name).toLowerCase();
			if (!lrcByBase.has(key)) lrcByBase.set(key, f);
		}
	}

	const usedLrc = new Set<File>();
	const paired: PairedFile[] = audios.map((audio) => {
		const key = stripExt(audio.name).toLowerCase();
		const candidate = lrcByBase.get(key);
		if (candidate && !usedLrc.has(candidate)) {
			usedLrc.add(candidate);
			return { audio, lrc: candidate };
		}
		return { audio, lrc: null };
	});

	const ignored: File[] = [];
	for (const f of files) {
		if (isAudioFile(f)) continue;
		if (getExt(f.name) === 'lrc' && usedLrc.has(f)) continue;
		ignored.push(f);
	}

	return { paired, ignored };
}

export function isAudioFile(file: File): boolean {
	if (file.type.startsWith('audio/')) return true;
	const ext = getExt(file.name);
	return AUDIO_EXTENSIONS.has(ext);
}

export function getExt(name: string): string {
	const i = name.lastIndexOf('.');
	return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function stripExt(name: string): string {
	const i = name.lastIndexOf('.');
	return i >= 0 ? name.slice(0, i) : name;
}

export function deriveTitleFromFilename(filename: string): string {
	return stripExt(filename);
}
