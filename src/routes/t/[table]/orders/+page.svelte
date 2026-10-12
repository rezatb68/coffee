<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import type { PageData } from './$types';
	import { history } from '#lib/client/store.svelte';
	import { formatMoney, formatNumber, formatTime } from '#lib/format';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>سفارش‌های من</title>
</svelte:head>

<div class="flex min-h-dvh flex-col gap-4 px-4 pb-10 pt-[max(env(safe-area-inset-top),16px)]">
	<header class="flex items-center gap-3">
		<a href="/t/{data.tableNumber}" class="grid h-11 w-11 place-items-center rounded-2xl bg-surface-2" aria-label="بازگشت به منو">
			<ChevronRight size={20} />
		</a>
		<h1 class="text-base font-bold">سفارش‌های من</h1>
	</header>

	{#if history.entries.length === 0}
		<p class="py-16 text-center text-sm text-muted">هنوز سفارشی روی این دستگاه ثبت نشده.</p>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each history.entries as entry (entry.code + entry.createdAt)}
				<li>
					<a href="/t/{entry.tableNumber}/order/{entry.code}" class="flex items-center justify-between rounded-2xl border border-border bg-surface p-4">
						<span>
							<span class="block font-bold tabular-nums">کد {formatNumber(Number(entry.code))}</span>
							<span class="text-xs text-muted">میز {formatNumber(entry.tableNumber)} · {formatTime(entry.createdAt)}</span>
						</span>
						<span class="text-sm tabular-nums">{formatMoney(entry.total)}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
