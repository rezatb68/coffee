<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const BUCKETS = [
		{ id: 'day', label: '۳۰ روز اخیر (روزانه)' },
		{ id: 'week', label: '۱۲ هفته اخیر (هفتگی)' },
		{ id: 'month', label: '۱۲ ماه اخیر (ماهانه)' }
	] as const;

	const money = (n: number) => Math.round(n).toLocaleString('fa-IR');
	const maxRevenue = $derived(Math.max(1000, ...data.sales.map((s) => s.revenue)));
	const maxHour = $derived(Math.max(1, ...data.hours.map((h) => h.orders)));
</script>

<main class="mx-auto flex max-w-3xl flex-col gap-5 px-4 pb-16 pt-4">
	<div class="flex flex-wrap items-center gap-2">
		<h1 class="text-base font-bold">گزارش فروش</h1>
		<div class="ms-auto flex gap-1.5">
			{#each BUCKETS as b (b.id)}
				<a href="/admin/reports?bucket={b.id}" class="rounded-full border border-border px-3 py-1.5 text-xs font-bold {data.bucket === b.id ? 'bg-primary text-on-primary border-primary' : 'bg-surface'}">{b.label}</a>
			{/each}
			<a href="/api/admin/reports?bucket={data.bucket}&format=csv" class="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-bold">خروجی CSV</a>
		</div>
	</div>

	<section class="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
		<h2 class="text-sm font-bold">درآمد و تعداد سفارش</h2>
		{#if data.sales.length === 0}
			<p class="text-xs text-muted">داده‌ای نیست. بعد از اولین سفارش، اینجا گزارش می‌بینی.</p>
		{/if}
		{#each data.sales as row (row.bucket)}
			<div class="flex items-center gap-3 text-xs">
				<span class="w-24 shrink-0 tabular-nums text-muted">{row.bucket}</span>
				<div class="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
					<div class="h-full bg-primary" style="width:{Math.max(3, Math.round((row.revenue / maxRevenue) * 100))}%"></div>
				</div>
				<span class="w-20 shrink-0 text-end tabular-nums">{money(row.revenue)}</span>
				<span class="w-12 shrink-0 text-end tabular-nums text-muted">{row.orders}</span>
			</div>
		{/each}
	</section>

	<div class="grid gap-4 sm:grid-cols-2">
		<section class="rounded-2xl border border-border bg-surface p-4">
			<h2 class="mb-2 text-sm font-bold">پرفروش‌ترین‌ها (۳۰ روز)</h2>
			{#if data.bestsellers.length === 0}<p class="text-xs text-muted">داده‌ای نیست.</p>{/if}
			<ul class="flex flex-col gap-1.5 text-xs">
				{#each data.bestsellers as b (b.name)}
					<li class="flex justify-between gap-2"><span class="min-w-0 truncate">{b.name}</span><span class="shrink-0 tabular-nums text-muted">{b.qty} عدد</span></li>
				{/each}
			</ul>
		</section>

		<section class="rounded-2xl border border-border bg-surface p-4">
			<h2 class="mb-2 text-sm font-bold">ساعات شلوغ</h2>
			{#if data.hours.length === 0}<p class="text-xs text-muted">داده‌ای نیست.</p>{/if}
			<div class="flex items-end gap-1">
				{#each data.hours as h (h.hour)}
					<div class="flex flex-1 flex-col items-center gap-1" title="{h.hour}:00 — {h.orders}">
						<div class="w-full rounded-t bg-primary" style="height:{Math.round((h.orders / maxHour) * 40) + 4}px"></div>
						<span class="text-[9px] text-muted">{h.hour}</span>
					</div>
				{/each}
			</div>
		</section>

		<section class="rounded-2xl border border-border bg-surface p-4">
			<h2 class="mb-2 text-sm font-bold">تفکیک روش پرداخت (۳۰ روز)</h2>
			<ul class="flex flex-col gap-1.5 text-xs">
				{#each data.payments as p (p.method)}
					<li class="flex justify-between gap-2"><span>{p.method === 'in_person' ? 'حضوری' : 'آنلاین'}</span><span class="tabular-nums text-muted">{p.orders} سفارش · {money(p.revenue)}</span></li>
				{/each}
				{#if data.payments.length === 0}<li class="text-muted">داده‌ای نیست.</li>{/if}
			</ul>
		</section>

		<section class="rounded-2xl border border-border bg-surface p-4">
			<h2 class="mb-2 text-sm font-bold">رضایت مشتری</h2>
			<p class="text-3xl font-bold tabular-nums">{data.rating.count === 0 ? '—' : data.rating.avg.toFixed(1).replace('.', '٫')}</p>
			<p class="text-xs text-muted">{data.rating.count === 0 ? 'هنوز نظری ثبت نشده.' : `از ${data.rating.count} نظر در ۳۰ روز`}</p>
		</section>
	</div>
</main>
