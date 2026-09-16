/**
 * Production Yandex Mobile Ads unit IDs + calm advertising policy.
 */

export const YANDEX_AD_UNITS = {
	homeBanner: 'R-M-20057709-1',
	statsBanner: 'R-M-20057709-2',
	learningBanner: 'R-M-20057709-3',
	interstitial: 'R-M-20057709-4',
	rewarded: 'R-M-20057709-5',
	appOpen: 'R-M-20057709-6',
} as const

export type BannerPlacement = 'home' | 'stats' | 'learning'

export const BANNER_UNIT_BY_PLACEMENT: Record<BannerPlacement, string> = {
	home: YANDEX_AD_UNITS.homeBanner,
	stats: YANDEX_AD_UNITS.statsBanner,
	learning: YANDEX_AD_UNITS.learningBanner,
}

/**
 * App Open is configured but disabled for v1 — never shown on launch.
 */
export const APP_OPEN_AD = {
	unitId: YANDEX_AD_UNITS.appOpen,
	enabled: false as const,
}

export interface AdsPolicy {
	/** Never show interstitial during active solving. */
	interstitialDuringPlay: false
	/** Interstitial only after normal (non-daily) puzzle completion. */
	interstitialOnDailyCompletion: false
	/** Banners must never appear on GameScreen. */
	bannerOnGameScreen: false
	minInterstitialGapMs: number
	maxInterstitialsPerSession: number
	/** Session must be this old before the first interstitial is eligible. */
	minSessionAgeBeforeInterstitialMs: number
	/** Rewarded SDK wired but no mandatory placement in v1. */
	rewardedMandatory: false
	allowedBannerPlacements: readonly BannerPlacement[]
}

export const ADS_POLICY: AdsPolicy = {
	interstitialDuringPlay: false,
	interstitialOnDailyCompletion: false,
	bannerOnGameScreen: false,
	minInterstitialGapMs: 5 * 60 * 1000,
	maxInterstitialsPerSession: 1,
	minSessionAgeBeforeInterstitialMs: 30_000,
	rewardedMandatory: false,
	allowedBannerPlacements: ['home', 'stats', 'learning'],
}

export function bannerUnitId(placement: BannerPlacement): string {
	return BANNER_UNIT_BY_PLACEMENT[placement]
}

export function isGameScreenBannerAllowed(): boolean {
	return ADS_POLICY.bannerOnGameScreen
}
