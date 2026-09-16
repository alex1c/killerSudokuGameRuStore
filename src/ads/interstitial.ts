/**
 * Interstitial show path — post normal completion only; never blocks save.
 */

import {
	InterstitialAdLoader,
	type InterstitialAd,
} from 'yandex-mobile-ads'
import { YANDEX_AD_UNITS } from './config'
import {
	getInterstitialLimiter,
	type InterstitialDecisionContext,
} from './limiter'
import { initializeYandexAds } from './sdk'

const LOAD_TIMEOUT_MS = 4_000

export type ShowInterstitialResult =
	| { shown: true }
	| { shown: false; reason: string }

/**
 * Attempt interstitial after completion bookkeeping.
 * Returns immediately-ish; failures never throw to callers.
 */
export async function maybeShowCompletionInterstitial(
	context: InterstitialDecisionContext,
): Promise<ShowInterstitialResult> {
	const limiter = getInterstitialLimiter()
	const decision = limiter.canShow(context)
	if (!decision.allowed) {
		return { shown: false, reason: decision.reason }
	}

	try {
		await initializeYandexAds()
		const loader = await withTimeout(
			InterstitialAdLoader.create(),
			LOAD_TIMEOUT_MS,
		)
		if (!loader) {
			return { shown: false, reason: 'loader-unavailable' }
		}

		const ad = await withTimeout(
			loader.loadAd({ adUnitId: YANDEX_AD_UNITS.interstitial }),
			LOAD_TIMEOUT_MS,
		)
		if (!ad) {
			return { shown: false, reason: 'unavailable' }
		}

		await showAndWaitDismiss(ad)
		limiter.markShown()
		return { shown: true }
	} catch (error) {
		if (typeof __DEV__ !== 'undefined' && __DEV__) {
			console.warn('[ads] interstitial failed', error)
		}
		return {
			shown: false,
			reason: error instanceof Error ? error.message : 'error',
		}
	}
}

function showAndWaitDismiss(ad: InterstitialAd): Promise<void> {
	return new Promise((resolve) => {
		let settled = false
		const finish = () => {
			if (settled) {
				return
			}
			settled = true
			resolve()
		}
		ad.onAdDismissed = () => finish()
		ad.onAdFailedToShow = () => finish()
		try {
			ad.show()
		} catch {
			finish()
		}
		// Hard cap so completion UI never waits forever.
		setTimeout(finish, LOAD_TIMEOUT_MS + 2_000)
	})
}

function withTimeout<T>(
	promise: Promise<T>,
	ms: number,
): Promise<T | null> {
	return new Promise((resolve) => {
		let done = false
		const timer = setTimeout(() => {
			if (!done) {
				done = true
				resolve(null)
			}
		}, ms)
		promise
			.then((value) => {
				if (!done) {
					done = true
					clearTimeout(timer)
					resolve(value)
				}
			})
			.catch(() => {
				if (!done) {
					done = true
					clearTimeout(timer)
					resolve(null)
				}
			})
	})
}
