<script lang="ts">
	import { goto } from '$app/navigation';
	import * as m from '$shared/paraglide/messages';
	import { useSessionQuery } from '$shared/query/session.query';
	import { isEditor } from '$shared/auth/role';
	import { Button } from '$shared/components/ui/button';
	import { pairAudioAndLrcFiles, type PairedFile } from '$shared/upload/pairing';
	import { extractMetadata } from '$shared/upload/metadata';
	import PickStep from './components/PickStep.svelte';
	import ReviewStep from './components/ReviewStep.svelte';
	import ProgressStep from './components/ProgressStep.svelte';
	import { metadataToItem, type UploadItem, type UploadStep } from './upload.types';

	const session = useSessionQuery();
	const editor = $derived(isEditor($session.data));

	let step = $state<UploadStep>('pick');
	let items = $state<UploadItem[]>([]);
	let preparing = $state(false);
	let prepareError = $state<string | null>(null);
	let ignoredCount = $state(0);

	async function handlePicked(files: File[]) {
		const { paired, ignored } = pairAudioAndLrcFiles(files);
		ignoredCount = ignored.length;

		if (paired.length === 0) {
			prepareError = m.upload_no_audio_selected();
			return;
		}

		preparing = true;
		prepareError = null;
		try {
			const prepared = await Promise.all(paired.map(prepareItem));
			items = prepared;
			step = 'review';
		} catch (err) {
			prepareError = err instanceof Error ? err.message : m.upload_prepare_error();
		} finally {
			preparing = false;
		}
	}

	async function prepareItem(p: PairedFile): Promise<UploadItem> {
		const metadata = await extractMetadata(p.audio);
		const externalLrcText = p.lrc ? await p.lrc.text() : null;
		return metadataToItem(p.audio, p.lrc, metadata, externalLrcText);
	}

	function removeItem(id: string) {
		items = items.filter((i) => i.id !== id);
		if (items.length === 0) step = 'pick';
	}

	function startUpload() {
		step = 'progress';
	}

	function goBackToPick() {
		items = [];
		ignoredCount = 0;
		step = 'pick';
	}
</script>

{#if !editor}
	<section class="flex flex-col gap-4 py-6">
		<p class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
			{m.upload_viewer_blocked()}
		</p>
		<Button variant="outline" onclick={() => goto('/library')}>{m.upload_back_to_library()}</Button>
	</section>
{:else if preparing}
	<section class="flex flex-col gap-3 py-6">
		<p class="text-sm text-muted-foreground">{m.upload_preparing()}</p>
	</section>
{:else if step === 'pick'}
	<PickStep onpick={handlePicked} />
	{#if prepareError}
		<p class="text-sm text-destructive" role="alert">{prepareError}</p>
	{/if}
{:else if step === 'review'}
	{#if ignoredCount > 0}
		<p class="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
			{m.upload_review_ignored({ count: ignoredCount })}
		</p>
	{/if}
	<ReviewStep
		bind:items
		onstart={startUpload}
		onremove={removeItem}
		oncancel={goBackToPick}
	/>
{:else}
	<ProgressStep {items} onfinish={goBackToPick} />
{/if}
