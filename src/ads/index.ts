/**
 * Ads domain barrel — config, limiter, banner, interstitial, rewarded.
 */

export {
	YANDEX_AD_UNITS,
	BANNER_UNIT_BY_PLACEMENT,
	APP_OPEN_AD,
	GAME_BANNER,
	ADS_POLICY,
	bannerUnitId,
	isGameScreenBannerAllowed,
} from './config'
export type { BannerPlacement, AdsPolicy } from './config'

export {
	InterstitialLimiter,
	getInterstitialLimiter,
	__resetInterstitialLimiterForTests,
} from './limiter'
export type {
	InterstitialDecision,
	InterstitialDecisionContext,
	InterstitialDenyReason,
	InterstitialLimiterState,
} from './limiter'

export { initializeYandexAds, isYandexAdsInitialized } from './sdk'
export { AdBanner } from './banner'
export { maybeShowCompletionInterstitial } from './interstitial'
export type { ShowInterstitialResult } from './interstitial'
export { getRewardedConfig, preloadRewardedAd } from './rewarded'
