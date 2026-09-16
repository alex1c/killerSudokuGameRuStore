/**
 * In-memory interstitial session limiter (not persisted to AsyncStorage).
 */

import { ADS_POLICY } from './config'

export interface InterstitialDecisionContext {
	/** True when the completed puzzle was a Daily challenge. */
	isDaily: boolean
	/** Unix ms "now" — injectable for tests. */
	now?: number
}

export interface InterstitialLimiterState {
	sessionStartedAt: number
	shownThisSession: number
	lastShownAt: number | null
}

export type InterstitialDenyReason =
	| 'daily'
	| 'session-cap'
	| 'gap'
	| 'session-too-young'

export type InterstitialDecision =
	| { allowed: true }
	| { allowed: false; reason: InterstitialDenyReason }

/**
 * Session-scoped limiter. Construct once per app process.
 */
export class InterstitialLimiter {
	private readonly state: InterstitialLimiterState

	constructor(sessionStartedAt: number = Date.now()) {
		this.state = {
			sessionStartedAt,
			shownThisSession: 0,
			lastShownAt: null,
		}
	}

	getSnapshot(): InterstitialLimiterState {
		return { ...this.state }
	}

	/**
	 * Pure policy check — does not mutate. Daily completions are always denied.
	 */
	canShow(context: InterstitialDecisionContext): InterstitialDecision {
		// Daily is a retention feature — never interrupt in v1.
		if (context.isDaily) {
			return { allowed: false, reason: 'daily' }
		}

		const now = context.now ?? Date.now()
		const age = now - this.state.sessionStartedAt
		if (age < ADS_POLICY.minSessionAgeBeforeInterstitialMs) {
			return { allowed: false, reason: 'session-too-young' }
		}
		if (
			this.state.shownThisSession >= ADS_POLICY.maxInterstitialsPerSession
		) {
			return { allowed: false, reason: 'session-cap' }
		}
		if (
			this.state.lastShownAt !== null &&
			now - this.state.lastShownAt < ADS_POLICY.minInterstitialGapMs
		) {
			return { allowed: false, reason: 'gap' }
		}
		return { allowed: true }
	}

	/** Record a successful interstitial impression. */
	markShown(now: number = Date.now()): void {
		this.state.shownThisSession += 1
		this.state.lastShownAt = now
	}
}

let sharedLimiter: InterstitialLimiter | null = null

export function getInterstitialLimiter(): InterstitialLimiter {
	if (sharedLimiter === null) {
		sharedLimiter = new InterstitialLimiter()
	}
	return sharedLimiter
}

/** Test helper — reset process singleton. */
export function __resetInterstitialLimiterForTests(): void {
	sharedLimiter = null
}
