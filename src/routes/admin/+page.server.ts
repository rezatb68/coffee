import { getDb } from '#lib/server/db';
import { getCafeInfo, getSettingsRow } from '#lib/server/menu';
import { getAdminMenu, listTables } from '#lib/server/admin';
import { getTrialStatus } from '#lib/server/license';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const db = getDb();
	const s = getSettingsRow(db);
	return {
		cafe: getCafeInfo(db),
		menu: getAdminMenu(db),
		tables: listTables(db),
		license: getTrialStatus(db),
		zarinpalMerchantId: s.zarinpalMerchantId,
		soundStyle: s.soundStyle,
		speakNewOrder: s.speakNewOrder
	};
};

