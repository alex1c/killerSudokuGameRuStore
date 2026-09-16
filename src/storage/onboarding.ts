/**
 * Onboarding persistence schema (product block).
 * Versioned JSON under killerSudoku.onboarding.v1 — separate from active game.
 */

import type { OnboardingV1 } from '../onboarding/types'

export const ONBOARDING_SCHEMA_VERSION = 1 as const
export const ONBOARDING_STORAGE_KEY = 'killerSudoku.onboarding.v1'

export type { OnboardingV1 }

export type LoadOnboardingResult =
	| { ok: true; onboarding: OnboardingV1 }
	| { ok: false; reason: string }

/** Fresh incomplete onboarding (also corrupt-recovery fallback). */
export function createEmptyOnboarding(): OnboardingV1 {
	return {
		schemaVersion: ONBOARDING_SCHEMA_VERSION,
		completed: false,
		completedAt: null,
	}
}

/**
 * Parse onboarding JSON. Empty/missing → incomplete defaults.
 * Corrupt / wrong-version payloads return ok:false (repository clears + empty).
 */
export function parseOnboarding(raw: string | null): LoadOnboardingResult {
	if (raw === null || raw.trim() === '') {
		return { ok: true, onboarding: createEmptyOnboarding() }
	}
	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch {
		return { ok: false, reason: 'invalid-json' }
	}
	if (parsed === null || typeof parsed !== 'object') {
		return { ok: false, reason: 'not-object' }
	}
	const doc = parsed as Partial<OnboardingV1>
	if (doc.schemaVersion !== ONBOARDING_SCHEMA_VERSION) {
		return { ok: false, reason: 'schema-version' }
	}
	if (typeof doc.completed !== 'boolean') {
		return { ok: false, reason: 'completed' }
	}
	const completedAtOk =
		doc.completedAt === null ||
		(typeof doc.completedAt === 'number' &&
			Number.isFinite(doc.completedAt))
	if (!completedAtOk) {
		return { ok: false, reason: 'completedAt' }
	}
	return {
		ok: true,
		onboarding: {
			schemaVersion: ONBOARDING_SCHEMA_VERSION,
			completed: doc.completed,
			completedAt: doc.completedAt as number | null,
		},
	}
}

export function serializeOnboarding(onboarding: OnboardingV1): string {
	return JSON.stringify(onboarding)
}

/** Pure: mark onboarding completed (sets completedAt). */
export function markOnboardingCompleted(
	onboarding: OnboardingV1,
	completedAt: number = Date.now(),
): OnboardingV1 {
	return {
		...onboarding,
		completed: true,
		completedAt,
	}
}
