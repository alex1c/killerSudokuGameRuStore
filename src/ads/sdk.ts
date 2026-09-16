/**
 * Yandex Mobile Ads SDK bootstrap — fire-and-forget, never blocks Home.
 */

import { MobileAds } from 'yandex-mobile-ads'

let initialized = false
let initializing: Promise<void> | null = null

/**
 * Initialize Yandex Mobile Ads once. Errors are swallowed.
 */
export function initializeYandexAds(): Promise<void> {
	if (initialized) {
		return Promise.resolve()
	}
	if (initializing) {
		return initializing
	}
	initializing = (async () => {
		try {
			await MobileAds.initialize()
			initialized = true
			if (typeof __DEV__ !== 'undefined' && __DEV__) {
				try {
					MobileAds.enableLogging(true)
				} catch {
					// Optional debug logging.
				}
			}
		} catch (error) {
			if (typeof __DEV__ !== 'undefined' && __DEV__) {
				console.warn('[ads] Yandex MobileAds.initialize failed', error)
			}
		} finally {
			initializing = null
		}
	})()
	return initializing
}

export function isYandexAdsInitialized(): boolean {
	return initialized
}

export function __resetYandexAdsForTests(): void {
	initialized = false
	initializing = null
}
