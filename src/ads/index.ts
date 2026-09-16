/**
 * Ads placement policy & hooks — no production SDK / IDs in this build.
 */

export type AdPlacement =
	| 'home_banner'
	| 'stats_banner'
	| 'learning_banner'
	| 'post_completion_interstitial'
	| 'optional_rewarded_hint'

export interface AdsPolicy {
	/** Never show interstitial during active solving. */
	interstitialDuringPlay: false
	/** Preferred interstitial point. */
	interstitialPlacement: 'post_completion_interstitial'
	/** Minimum gap between interstitials (ms). */
	minInterstitialGapMs: number
	/** Soft cap per app session for v1. */
	maxInterstitialsPerSession: number
	/** Banners must not shrink the GameScreen board. */
	bannerOnGameScreen: false
	allowedBannerPlacements: readonly AdPlacement[]
}

export const ADS_POLICY: AdsPolicy = {
	interstitialDuringPlay: false,
	interstitialPlacement: 'post_completion_interstitial',
	minInterstitialGapMs: 5 * 60 * 1000,
	maxInterstitialsPerSession: 1,
	bannerOnGameScreen: false,
	allowedBannerPlacements: [
		'home_banner',
		'stats_banner',
		'learning_banner',
	],
}

export interface AdsClient {
	showBanner?(placement: AdPlacement): void
	hideBanner?(placement: AdPlacement): void
	showInterstitial?(placement: AdPlacement): Promise<boolean>
	showRewarded?(placement: AdPlacement): Promise<boolean>
}

/** No-op until real RuStore/Yandex Ads IDs are provided. */
export const noopAds: AdsClient = {}

let activeAds: AdsClient = noopAds

export function setAdsClient(client: AdsClient): void {
	activeAds = client
}

export function getAdsClient(): AdsClient {
	return activeAds
}
