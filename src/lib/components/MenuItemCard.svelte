<script lang="ts">
	import { Coffee, Minus, Plus } from '@lucide/svelte';
	import { formatMoney } from '#lib/format';
	import type { MenuItem } from '#lib/shared/types';

	let {
		item,
		count,
		unit,
		index = 0,
		onOpen,
		onAdd,
		onRemove
	}: {
		item: MenuItem;
		count: number;
		unit: 'toman' | 'rial';
		index?: number;
		onOpen: () => void;
		onAdd: (el: HTMLElement) => void;
		onRemove: () => void;
	} = $props();

	const TAG_LABELS: Record<string, string> = { vegan: 'وگان', gluten_free: 'بدون گلوتن', spicy: 'تند' };
	const hasOptions = $derived(item.groups.length > 0);

	function handleAdd(event: MouseEvent) {
		if (hasOptions) onOpen();
		else onAdd(event.currentTarget as HTMLElement);
	}
</script>

<article
	class="rise flex gap-3 rounded-2xl border border-border bg-surface p-3 transition-opacity"
	class:opacity-50={!item.isAvailable}
	style="animation-delay: {Math.min(index, 8) * 40}ms"
>
	<button type="button" class="flex min-w-0 flex-1 gap-3 text-start" onclick={onOpen} disabled={!item.isAvailable}>
		<div class="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted" aria-hidden="true">
			<Coffee size={26} strokeWidth={1.5} />
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex flex-wrap items-center gap-1.5">
				<h3 class="text-[15px] font-bold leading-6">{item.name}</h3>
				{#if item.isNew}
					<span class="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-on-primary">جدید</span>
				{/if}
				{#if item.isBestseller}
					<span class="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted">پرفروش</span>
				{/if}
			</div>
			{#if item.description}
				<p class="mt-0.5 line-clamp-2 text-xs leading-5 text-muted">{item.description}</p>
			{/if}
			{#if item.tags.length > 0}
				<div class="mt-1 flex flex-wrap gap-1">
					{#each item.tags as tag (tag)}
						<span class="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">{TAG_LABELS[tag] ?? tag}</span>
					{/each}
				</div>
			{/if}
			{#if item.allergens.length > 0}
				<p class="mt-1 text-[11px] text-muted">آلرژن: {item.allergens.join('، ')}</p>
			{/if}
			<p class="mt-1 text-sm font-bold">{formatMoney(item.basePrice, unit)}</p>
		</div>
	</button>

	<div class="flex shrink-0 items-end">
		{#if !item.isAvailable}
			<span class="self-center text-xs text-muted">ناموجود</span>
		{:else if count > 0}
			<div class="flex items-center overflow-hidden rounded-full bg-primary text-on-primary">
				<button type="button" class="grid h-11 w-11 place-items-center" onclick={onRemove} aria-label="کم کردن {item.name}">
					<Minus size={18} />
				</button>
				<span class="min-w-6 text-center text-sm font-bold tabular-nums" aria-live="polite">{count.toLocaleString('fa-IR')}</span>
				<button
					type="button"
					class="grid h-11 w-11 place-items-center"
					onclick={handleAdd}
					aria-label="افزودن {item.name}"
				>
					<Plus size={18} />
				</button>
			</div>
		{:else}
			<button
				type="button"
				class="grid h-11 w-11 place-items-center rounded-full bg-primary text-on-primary transition-transform active:scale-90"
				onclick={handleAdd}
				aria-label="افزودن {item.name}"
			>
				<Plus size={20} />
			</button>
		{/if}
	</div>
</article>
