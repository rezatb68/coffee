import { getDb } from '#lib/server/db';
import { avgRating, bestsellers, busyHours, paymentSplit, salesSeries } from '#lib/server/reports';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const bucketParam = url.searchParams.get('bucket');
	const bucket = bucketParam === 'week' || bucketParam === 'month' ? bucketParam : 'day';
	const db = getDb();
	return {
		bucket,
		sales: salesSeries(db, bucket),
		bestsellers: bestsellers(db),
		hours: busyHours(db),
		payments: paymentSplit(db),
		rating: avgRating(db)
	};
};
