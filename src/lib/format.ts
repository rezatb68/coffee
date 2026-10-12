export function formatMoney(amount: number, unit: 'toman' | 'rial' = 'toman'): string {
	return `${amount.toLocaleString('fa-IR')} ${unit === 'rial' ? 'ریال' : 'تومان'}`;
}

export function formatTime(ms: number): string {
	return new Date(ms).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

export function formatNumber(n: number): string {
	return n.toLocaleString('fa-IR');
}

/** Normalizes Arabic/Persian letter variants so search matches regardless of keyboard. */
export function normalizeFa(text: string): string {
	return text
		.replace(/[يى]/g, 'ی')
		.replace(/ك/g, 'ک')
		.replace(/\u200c/g, ' ')
		.toLowerCase()
		.trim();
}
