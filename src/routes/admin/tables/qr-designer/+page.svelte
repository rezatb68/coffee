<script lang="ts">
	import type { PageData } from './$types';
	import QRCode from 'qrcode';

	let { data }: { data: PageData } = $props();

	type Rs = { id: number; number: number; isActive: boolean };

	let selectedId = $state<number>(data.tables[0]?.id ?? 0);
	let tableNumbers = $derived(data.tables);
	let table = $derived(tableNumbers.find((t: Rs) => t.id === selectedId) ?? null);

	let dark = $state('#111111');
	let light = $state('#ffffff');
	let corner = $state(0); // 0..1
	let eye = $state<'square' | 'rounded' | 'circle'>('rounded');

	let previewUrl = $state('');
	let previewBusy = $state(false);
	let msg = $state('');
	let logoFile: File | null = null;
	let logoName = $state('');
	let includeLogo = $state(false);

	const QR_EYE_LABELS: Record<string, string> = { square: 'مربع', rounded: 'گرد', circle: 'دایره' };

	$effect(() => {
		// Restore persisted designer prefs from this browser.
		try {
			const saved = sessionStorage.getItem('qr-designer');
			if (saved) {
				const s = JSON.parse(saved) as { dark?: string; light?: string; corner?: number; eye?: string; logoSvg?: string };
				if (s.dark) dark = s.dark;
				if (s.light) light = s.light;
				if (typeof s.corner === 'number') corner = s.corner;
				if (s.eye === 'square' || s.eye === 'rounded' || s.eye === 'circle') eye = s.eye;
				if (s.logoSvg && s.logoSvg.startsWith('<svg')) {
					defaultLogoSvg = s.logoSvg;
					logoName = 'لوگوی ذخیره‌شده';
					includeLogo = true;
				}
			}
		} catch {
			// ignore
		}
	});

	let defaultLogoSvg = $state<string | null>(null);

	function persist() {
		try {
			sessionStorage.setItem('qr-designer', JSON.stringify(serialize()));
		} catch {
			// ignore
		}
	}

	function serialize(): Record<string, unknown> {
		return {
			dark: dark,
			light: light,
			corner: corner,
			eye: eye,
			logoSvg: includeLogo && defaultLogoSvg ? defaultLogoSvg : null
		};
	}

	function hexOk(v: string): boolean {
		return /^#[0-9a-fA-F]{6}$/.test(v);
	}

	async function refreshPreview() {
		if (!table) return;
		if (!hexOk(dark) || !hexOk(light)) {
			msg = 'رنگ باید به‌شکل #RRGGBB باشد.';
			return;
		}
		previewBusy = true;
		msg = '';
		try {
			persist();
			const params = new URLSearchParams({ dark: dark.slice(1), light: light.slice(1), corner: String(corner), eye, size: '360' });
			if (includeLogo && defaultLogoSvg) params.set('logoSvg', defaultLogoSvg);
			const res = await fetch(`/api/admin/tables/${table.id}/qr?${params.toString()}`, { headers: { accept: 'image/svg+xml' } });
			if (!res.ok) {
				const out = await res.json().catch(() => ({}));
				msg = out.message ?? 'پیش‌نمایش ساخته نشد.';
				return;
			}
			const svg = await res.text();
			previewUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
		} catch {
			msg = 'اتصال برقرار نشد.';
		} finally {
			previewBusy = false;
		}
	}

	// Regenerate preview when settings or table change (debounced by microtask).
	let lastKey = '';
	$effect(() => {
		const key = `${selectedId}|${dark}|${light}|${corner}|${eye}|${includeLogo}|${logoName}`;
		if (key === lastKey) return;
		lastKey = key;
		const handle = setTimeout(refreshPreview, 180);
		return () => clearTimeout(handle);
	});

	function handleLogo(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		if (!/\.svg$/i.test(file.name) && file.type !== 'image/svg+xml') {
			msg = 'فقط فایل SVG پذیرفته می‌شود.';
			return;
		}
		if (file.size > 60_000) {
			msg = 'فایل لوگو باید زیر ۶۰ کیلوبایت باشد.';
			return;
		}
		logoFile = file;
		logoName = file.name;
		file
			.text()
			.then((txt) => {
				defaultLogoSvg = txt;
				includeLogo = true;
				msg = '';
			})
			.catch(() => (msg = 'خواندن فایل لوگو ناموفق بود.'));
	}

	function clearLogo() {
		defaultLogoSvg = null;
		logoName = '';
		includeLogo = false;
	}

	function downloadUrl(format: 'svg' | 'png' | 'card') {
		if (!table) return '#';
		const params = new URLSearchParams();
		params.set('dark', dark.replace('#', ''));
		params.set('light', light.replace('#', ''));
		params.set('corner', String(corner));
		params.set('eye', eye);
		params.set('format', format);
		params.set('size', format === 'png' ? '800' : '512');
		if (includeLogo && defaultLogoSvg) params.set('logoSvg', defaultLogoSvg);
		return `/api/admin/tables/${table.id}/qr?${params.toString()}`;
	}

	function printCard() {
		window.open(downloadUrl('card'), '_blank');
	}
</script>

<main class="mx-auto flex max-w-3xl flex-col gap-4 px-4 pb-16 pt-4">
	<div class="flex items-center justify-between gap-2">
		<h1 class="text-base font-bold">طراح QR میز</h1>
		<a href="/admin/tables" class="rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-surface-2">بازگشت</a>
	</div>

	<section class="grid gap-4 sm:grid-cols-2">
		<div class="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
			<h2 class="text-sm font-bold">ظاهر QR</h2>
			<label class="flex flex-col gap-1">
				<span class="text-xs font-bold">میز</span>
				<select class="rounded-xl border border-border bg-bg p-2 text-sm outline-none focus:border-primary" bind:value={selectedId}>
					{#each tableNumbers as t (t.id)}
						<option value={t.id}>میز {t.number}{t.isActive ? '' : ' (غیرفعال)'}</option>
					{/each}
				</select>
			</label>
			<div class="flex gap-3">
				<label class="flex flex-1 flex-col gap-1">
					<span class="text-xs font-bold">رنگ کد</span>
					<input type="color" class="h-10 w-20 rounded border border-border" bind:value={dark} />
				</label>
				<label class="flex flex-1 flex-col gap-1">
					<span class="text-xs font-bold">رنگ پس‌زمینه</span>
					<input type="color" class="h-10 w-20 rounded border border-border" bind:value={light} />
				</label>
			</div>
			<label class="flex flex-col gap-1">
				<span class="text-xs font-bold">گردی ماژول‌ها ({Math.round(corner * 100)}٪)</span>
				<input type="range" min="0" max="1" step="0.1" bind:value={corner} />
			</label>
			<div class="flex flex-col gap-1">
				<span class="text-xs font-bold">شکل چشم‌های مکان‌یاب</span>
				<div class="flex gap-1.5">
					{#each ['square', 'rounded', 'circle'] as e, i (e)}
						{@const sx = ['مربع', 'گرد', 'دایره'][i]}
						<button
							type="button"
							class="rounded-full border px-3 py-1.5 text-xs font-bold {eye === e ? 'border-primary bg-primary text-on-primary' : 'border-border bg-bg'}"
							onclick={() => (eye = e as 'square' | 'rounded' | 'circle')}
						>
							{QR_EYE_LABELS[e] ?? sx}
						</button>
					{/each}
				</div>
			</div>
			<label class="flex items-center justify-between rounded-xl border border-border p-2">
				<span class="text-xs font-bold">لوگو در مرکز</span>
				<input type="checkbox" class="h-5 w-5 accent-[var(--c-primary)]" bind:checked={includeLogo} disabled={!defaultLogoSvg} />
			</label>
			{#if includeLogo && defaultLogoSvg}
				<button type="button" class="self-start rounded-lg border border-danger px-2 py-1 text-[11px] font-bold text-danger" onclick={clearLogo}>حذف لوگو</button>
			{/if}
			<label class="h-9 cursor-pointer self-start rounded-xl border border-border px-3 text-xs font-bold leading-9 hover:bg-surface-2">
				آپلود لوگو (SVG)
				<input type="file" accept=".svg,image/svg+xml" class="hidden" onchange={handleLogo} />
			</label>
			{#if logoName}<p class="text-[11px] text-muted">لوگوی فعلی: {logoName}</p>{/if}
		</div>

		<div class="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-4">
			<h2 class="self-start text-sm font-bold">پیش‌نمایش</h2>
			{#if previewUrl && !previewBusy}
				<img src={previewUrl} alt="پیش‌نمایش QR میز" width="280" height="280" class="rounded-xl border border-border" />
			{:else}
				<div class="flex h-[280px] w-[280px] items-center justify-center rounded-xl border border-border bg-surface-2 text-xs text-muted">
					{previewBusy ? 'در حال ساخت…' : '—'}
				</div>
			{/if}
			<p class="text-[11px] text-muted">هر ۳ تضمین خوانایی حفظ شده است (سطح خطای H وقتی لوگو فعال است).</p>
		</div>
	</section>

	{#if msg}<p class="rounded-xl bg-surface-2 px-3 py-2 text-xs text-danger">{msg}</p>{/if}

	<section class="flex flex-wrap gap-2 rounded-2xl border border-border bg-surface p-4">
		<h2 class="w-full text-sm font-bold">خروجی برای «{table ? `میز ${table.number}` : '—'}»</h2>
		<a class="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary" href={downloadUrl('svg')} download="table-qr.svg">دانلود SVG</a>
		<a class="rounded-xl border border-border px-4 py-2 text-xs font-bold hover:bg-surface-2" href={downloadUrl('png')} download="table-qr.png">دانلود PNG</a>
		<a class="rounded-xl border border-border px-4 py-2 text-xs font-bold hover:bg-surface-2" href={downloadUrl('card')} download="table-card.svg">کارت میزی (SVG)</a>
		<button type="button" class="rounded-xl border border-border px-4 py-2 text-xs font-bold hover:bg-surface-2" onclick={printCard}>چاپ / ذخیره PDF کارت</button>
		<p class="w-full text-[11px] text-muted">برای PDF، دکمه‌ی «چاپ / ذخیره PDF» را بزن و در پنجره‌ی چاپ، مقصد را «Save as PDF» انتخاب کن.</p>
	</section>
</main>

<style>
	/* Small tweak so range input is readable in dark too. */
	input[type='range'] {
		accent-color: var(--c-primary);
	}
</style>
