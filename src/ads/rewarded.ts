/**
 * Rewarded ads — SDK-ready, no mandatory v1 placement (Smart Hint stays free).
 */

import { RewardedAdLoader } from 'yandex-mobile-ads'
import { ADS_POLICY, YANDEX_AD_UNITS } from './config'
import { initializeYandexAds } from './sdk'

export interface RewardedAvailability {
	unitId: string
	mandatory: false
	/** True when SDK path exists; v1 has no UX that requires watching an ad. */
	runtimePlacement: 'none'
}

export function getRewardedConfig(): RewardedAvailability {
	return {
		unitId: YANDEX_AD_UNITS.rewarded,
		mandatory: ADS_POLICY.rewardedMandatory,
		runtimePlacement: 'none',
	}
}

/**
 * Optional preload for a future non-mandatory help boost.
 * Not called from Smart Hint in v1.
 */
export async function preloadRewardedAd(): Promise<boolean> {
	try {
		await initializeYandexAds()
		const loader = await RewardedAdLoader.create()
		const ad = await loader.loadAd({
			adUnitId: YANDEX_AD_UNITS.rewarded,
		})
		return ad != null
	} catch {
		return false
	}
}
