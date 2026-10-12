<script lang="ts">
	import { animate } from 'motion';
	import type { Snippet } from 'svelte';

	let {
		label,
		onClose,
		children
	}: { label: string; onClose: () => void; children: Snippet } = $props();

	let panel = $state<HTMLDivElement>();
	let overlay = $state<HTMLDivElement>();
	let startY = 0;
	let dragY = 0;
	let dragging = false;
	let closing = false;

	const duration = () =>
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.25;

	$effect(() => {
		if (!panel || !overlay) return;
		animate(overlay, { opacity: [0, 1] }, { duration: duration() });
		animate(panel, { transform: ['translateY(100%)', 'translateY(0%)'] }, { duration: duration(), ease: [0.2, 0.8, 0.2, 1] });
	});

	function close() {
		if (closing) return;
		closing = true;
		if (!panel || !overlay) return onClose();
		Promise.all([
			animate(overlay, { opacity: [1, 0] }, { duration: duration() }).finished,
			animate(panel, { transform: ['translateY(0%)', 'translateY(100%)'] }, { duration: duration() }).finished
		]).then(onClose);
	}

	function onPointerDown(event: PointerEvent) {
		dragging = true;
		startY = event.clientY;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function onPointerMove(event: PointerEvent) {
		if (!dragging || !panel) return;
		dragY = Math.max(0, event.clientY - startY);
		panel.style.transform = `translateY(${dragY}px)`;
	}

	function onPointerUp() {
		if (!dragging || !panel) return;
		dragging = false;
		if (dragY > 120) {
			dragY = 0;
			panel.style.transform = '';
			close();
			return;
		}
		animate(panel, { transform: [`translateY(${dragY}px)`, 'translateY(0px)'] }, { duration: 0.2 });
		panel.style.transform = '';
		dragY = 0;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') close();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="fixed inset-0 z-50 flex items-end justify-center">
	<div bind:this={overlay} class="absolute inset-0 bg-black/40" aria-hidden="true" onclick={close} role="presentation"></div>
	<div
		bind:this={panel}
		role="dialog"
		aria-modal="true"
		aria-label={label}
		class="relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl bg-surface pb-[max(env(safe-area-inset-bottom),16px)] shadow-2xl"
	>
		<div
			class="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center"
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			role="presentation"
		>
			<span class="h-1.5 w-10 rounded-full bg-border"></span>
		</div>
		<div class="overflow-y-auto overscroll-contain px-5 pb-2">
			{@render children()}
		</div>
	</div>
</div>
