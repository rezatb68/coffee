<script lang="ts">
	let { children, data } = $props();
</script>

<div class="min-h-dvh bg-bg text-content" dir="rtl">
	<header class="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
		<div>
			<h1 class="text-base font-bold">پنل مدیریت</h1>
			<p class="text-xs text-muted">{data.user.name}</p>
		</div>
		<a href="/panel" class="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold hover:bg-surface-2">بازگشت به پنل</a>
	</header>
	{@render children()}
</div>
