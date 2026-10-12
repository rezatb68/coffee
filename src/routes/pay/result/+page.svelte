<script lang="ts">
	import { page } from '$app/state';
	const ok = page.url.searchParams.get('state') === 'ok';
</script>

<main class="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
	<h1 class="text-xl font-bold">{ok ? 'پرداخت با موفقیت انجام شد' : 'پرداخت ناموفق بود'}</h1>
	<p class="text-sm text-muted">
		{ok ? 'سفارش شما ثبت شد و به آشپزخانه ارسال گردید.' : 'اگر مبلغ از حساب شما کسر شده تا ۷۲ ساعت بازگشت داده می‌شود. می‌توانید دوباره تلاش کنید.'}
	</p>
	<a href="/" class="mt-3 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-on-primary">بازگشت به منو</a>
</main>
