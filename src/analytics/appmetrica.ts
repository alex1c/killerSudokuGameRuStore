/**
 * AppMetrica client — production API key, async one-shot activate.
 */

import AppMetrica from '@appmetrica/react-native-analytics'
import { APP_VERSION, APP_VERSION_CODE } from '../app/constants'
import {
	type AnalyticsClient,
	type AnalyticsEventName,
	setAnalyticsClient,
} from './index'

/** Production AppMetrica API key (do not substitute). */
export const APPMETRICA_API_KEY = '8a30492c-caff-4584-aa4b-176dd809e0d7'

let activated = false

/**
 * Create a client that reports events via AppMetrica.reportEvent.
 * Failures are swallowed — never throw into UI.
 */
export function createAppMetricaClient(): AnalyticsClient {
	return {
		track(event: AnalyticsEventName, params?: Record<string, unknown>) {
			try {
				if (!activated) {
					return
				}
				AppMetrica.reportEvent(event, params)
			} catch {
				// Ignore SDK errors.
			}
		},
	}
}

/**
 * Activate AppMetrica once. Non-blocking; safe to call from startup effect.
 * Does not await network — Home must not wait on this.
 */
export function initializeAppMetrica(): void {
	if (activated) {
		return
	}
	try {
		AppMetrica.activate({
			apiKey: APPMETRICA_API_KEY,
			appVersion: APP_VERSION,
			appBuildNumber: APP_VERSION_CODE,
			logs: typeof __DEV__ !== 'undefined' && __DEV__,
			sessionTimeout: 120,
			crashReporting: true,
			statisticsSending: true,
		})
		activated = true
		setAnalyticsClient(createAppMetricaClient())
	} catch (error) {
		if (typeof __DEV__ !== 'undefined' && __DEV__) {
			console.warn('[analytics] AppMetrica activate failed', error)
		}
	}
}

/** Test helper — reset activation flag between suites. */
export function __resetAppMetricaForTests(): void {
	activated = false
}
