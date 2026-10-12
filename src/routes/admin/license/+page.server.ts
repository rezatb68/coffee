import { getDb } from '#lib/server/db';
import { getTrialStatus } from '#lib/server/license';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return { status: getTrialStatus(getDb()) };
};
