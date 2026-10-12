<script lang="ts">
	import type { PageData } from './$types';
	import QRCode from 'qrcode';

	let { data }: { data: PageData } = $props();

	let origin = $state('');
	let qrUrls = $state<Record<number, string>>({});
	let newNumber = $state('');
	let msg = $state('');

	$effect(() => {
		origin = window.location.origin;
		for (const t of data.tables) {
			if (!qrUrls[t.id]) {
				QRCode.toDataURL(`${origin}/t/${t.number}`, { width: 220, margin: 1 }).then((u) => (qrUrls[t.id] = u)).catch(() => {});
			}
		}
	});

	async function addTable() {
		const n = Number(newNumber);
		if (!Number.isInteger(n) || n < 1 || n > 999) {
			msg = 'شماره میز بین ۱ تا ۹۹۹ باید باشد.';
			return;
		}
		msg = '';
		const res = await fetch('/api/admin/tables', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ number: n, isActive: true })
		});
		if (!res.ok) {
			const out = await res.json().catch(() => ({}));
			msg = out.message ?? 'ایجاد نشد.';
			return;
		}
		newNumber = '';
		window.location.reload();
	}

	async function toggle(id: number, isActive: boolean) {
		await fetch('/api/admin/tables', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id, isActive: !isActive })
		}).catch(() => {});
		window.location.reload();
	}
</script>

<main class="mx-auto flex max-w-2xl flex-col gap-4 px-4 pb-16 pt-4">
	<h1 class="text-base font-bold">میزها و کدهای QR</h1>

	<section class="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
		<div class="flex items-end gap-2">
			<label class="flex flex-1 flex-col gap-1">
				<span class="text-xs font-bold">شماره میز جدید</span>
				<input type="number" min="1" max="999" class="rounded-xl border border-border bg-bg p-2 text-sm outline-none focus:border-primary" bind:value={newNumber} />
			</label>
			<button type="button" class="h-11 rounded-xl bg-primary px-4 text-xs font-bold text-on-primary" onclick={addTable}>افزودن میز</button>
		</div>
		{#if msg}<p class="text-xs text-danger">{msg}</p>{/if}
	</section>

	<section class="grid gap-3 sm:grid-cols-2">
		{#each data.tables as t (t.id)}
			<article class="flex gap-3 rounded-2xl border border-border bg-surface p-3">
				{#if qrUrls[t.id]}
					<img src={qrUrls[t.id]} alt="QR میز {t.number}" width="110" height="110" class="h-[110px] w-[110px] rounded-lg bg-white p-1.5" loading="lazy" />
				{:else}
					<div class="h-[110px] w-[110px] animate-pulse rounded-lg bg-surface-2"></div>
				{/if}
				<div class="flex min-w-0 flex-col gap-1.5">
					<p class="text-sm font-bold">میز {t.number}</p>
					<span class="w-fit rounded-full px-2 py-0.5 text-[10px] font-bold {t.isActive ? 'bg-primary text-on-primary' : 'bg-surface-2 text-muted'}">{t.isActive ? 'فعال' : 'غیرفعال'}</span>
					<a href="/t/{t.number}" class="text-[11px] text-muted underline" target="_blank" rel="noopener">مشاهده منوی این میز</a>
					<button type="button" class="mt-auto w-fit rounded-lg border border-border px-2 py-1 text-[11px] font-bold" onclick={() => toggle(t.id, t.isActive)}>
						{t.isActive ? 'غیرفعال کن' : 'فعال کن'}
					</button>
				</div>
			</article>
		{/each}
	</section>
</main>
