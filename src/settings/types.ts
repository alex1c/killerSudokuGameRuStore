/**
 * User settings schema (product block).
 * Pure types — persistence lives in src/storage/settings.ts.
 */

/** When the UI checks answers against the solution (rule conflicts stay separate). */
export type ErrorCheckingMode = 'immediate' | 'on_complete' | 'off'

/**
 * Versioned settings document.
 * `errorChecking` defaults to `'off'` so solution-mismatch hints stay quiet;
 * cage / row / column / box rule conflicts remain visible regardless.
 */
export interface SettingsV1 {
	schemaVersion: 1
	errorChecking: ErrorCheckingMode
	highlightSameNumbers: boolean
	highlightRelated: boolean
	autoClearNotes: boolean
	showTimer: boolean
	soundEnabled: boolean
	hapticEnabled: boolean
}
