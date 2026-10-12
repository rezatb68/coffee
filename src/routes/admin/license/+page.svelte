<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let status = $state(data.status);

	let key = $state('');
	let msg = $state('');
	let busy = $state(false);

	async function activate() {
		if (!key.trim()) return;
		busy = true;
		msg = '';
		try {
			const res = await fetch('/api/admin/license', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ key: key.trim() })
			});
			const out = await res.json().catch(() => ({}));
			if (res.ok) {
				status = out;
				msg = 'لایسنس فعال شد. از خرید شما سپاسگزاریم!';
				key = '';
				await goto('/admin', { invalidateAll: true });
			} else {
				msg = out.message ?? 'فعال‌سازی انجام نشد.';
			}
		} catch {
			msg = 'اتصال برقرار نشد.';
		} finally {
			busy = false;
		}
	}

	const expires = (v: number | null) => (v === null ? 'دائمی' : new Date(v).toLocaleDateString('fa-IR'));
</script>

<main class="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-6">
	<section class="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
		<h2 class="text-base font-bold">وضعیت لایسنس</h2>
		{#if status.mode === 'licensed'}
			<div class="rounded-xl bg-surface-2 p-4 text-sm">
				<p class="mb-1 font-bold text-success">✓ نسخه‌ی لایسنس‌دار</p>
				<p>دارنده: {status.licenseHolder}</p>
				<p>انقضا: {expires(status.licenseExpiresAt)}</p>
			</div>
		{:else if status.mode === 'trial_expired'}
			<div class="rounded-xl bg-surface-2 p-4 text-sm">
				<p class="mb-1 font-bold text-danger">مهلت دوره‌ی آزمایشی به پایان رسیده است</p>
				<p class="text-xs text-muted">منو برای مهمانانید نمایش می‌ماند اما سفارش‌گیری بسته است. با فعال‌کردن لایسنس ادامه دهید.</p>
			</div>
		{:else}
			<div class="rounded-xl bg-surface-2 p-4 text-sm">
				<p class="mb-1 font-bold">دوره‌ی آزمایشی {status.daysLeft} روز باقی‌مانده</p>
				<p class="text-xs text-muted">پایان دوره: {new Date(status.trialEndsAt).toLocaleDateString('fa-IR')}</p>
				<div class="mt-2 h-2 overflow-hidden rounded-full bg-bg">
					<div class="h-full bg-primary" style={`width:${Math.min(100, (status.daysLeft / 7) * 100)}%`}></div>
				</div>
			</div>
		{/if}
	</section>

	<section class="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
		<h2 class="text-sm font-bold">فعال‌سازی لایسنس</h2>
		<p class="text-xs text-muted">کلید را از فروشنده دریافت کرده‌اید؟ اینجا وارد کنید. اعتبارسنجی کامل آفلاین انجام می‌شود.</p>
		<input class="rounded-xl border border-border bg-bg p-3 text-xs font-mono outline-none focus:border-primary" bind:value={key} placeholder="XXXX....-XXXX....-..." />
		<button type="button" class="h-11 rounded-xl bg-primary text-sm font-bold text-on-primary disabled:opacity-50" onclick={activate} disabled={busy || !key.trim()}>فعال‌سازی</button>
		{#if msg}<p class="text-xs text-muted">{msg}</p>{/if}
	</section>
</main>
