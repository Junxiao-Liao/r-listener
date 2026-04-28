<script lang="ts">
	import * as m from '$shared/paraglide/messages';
	import { Button } from '$shared/components/ui/button';

	type Props = {
		onpick: (files: File[]) => void;
	};
	let { onpick }: Props = $props();

	let dragOver = $state(false);
	let inputEl: HTMLInputElement | null = $state(null);

	function pickFromInput(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		if (files.length > 0) onpick(files);
		input.value = '';
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		const files = Array.from(event.dataTransfer?.files ?? []);
		if (files.length > 0) onpick(files);
	}

	function onDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}
</script>

<section class="flex flex-col gap-4 py-6">
	<header>
		<h1 class="text-2xl font-semibold">{m.upload_title()}</h1>
		<p class="mt-1 text-sm text-muted-foreground">{m.upload_subtitle()}</p>
	</header>

	<button
		type="button"
		class="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors {dragOver
			? 'border-primary bg-primary/5'
			: 'border-border hover:bg-muted/50'}"
		onclick={() => inputEl?.click()}
		ondragover={onDragOver}
		ondragleave={() => (dragOver = false)}
		ondrop={onDrop}
	>
		<p class="text-base font-medium">{m.upload_drop_zone_primary()}</p>
		<p class="text-xs text-muted-foreground">{m.upload_drop_zone_secondary()}</p>
	</button>

	<input
		bind:this={inputEl}
		type="file"
		multiple
		accept="audio/*,.mp3,.m4a,.flac,.wav,.ogg,.opus,.aac,.webm,.lrc"
		class="hidden"
		onchange={pickFromInput}
	/>

	<Button href="/library" variant="outline">{m.upload_back_to_library()}</Button>
</section>
