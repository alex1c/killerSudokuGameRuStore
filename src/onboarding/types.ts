/**
 * First-run onboarding schema (product block).
 * Pure types — persistence lives in src/storage/onboarding.ts.
 */

/**
 * Versioned onboarding document.
 * `completed` defaults to false until the user finishes (or skips) onboarding.
 */
export interface OnboardingV1 {
	schemaVersion: 1
	completed: boolean
	/** Unix ms when onboarding was completed; null while incomplete. */
	completedAt: number | null
}
