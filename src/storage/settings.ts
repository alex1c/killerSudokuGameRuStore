/**
 * Settings persistence schema (product block).
 * Versioned JSON under killerSudoku.settings.v1 — separate from active game.
 */

import type { ErrorCheckingMode, SettingsV1 } from '../settings/types'

export const SETTINGS_SCHEMA_VERSION = 1 as const
export const SETTINGS_STORAGE_KEY = 'killerSudoku.settings.v1'

export type { ErrorCheckingMode, SettingsV1 }

/**
 * Factory defaults.
 * errorChecking is 'off' so solution-mismatch checks stay quiet by default;
 * standard sudoku / killer rule conflicts are unaffected by this flag.
 */
export const DEFAULT_SETTINGS: SettingsV1 = {
	schemaVersion: SETTINGS_SCHEMA_VERSION,
	errorChecking: 'off',
	highlightSameNumbers: true,
	highlightRelated: true,
	autoClearNotes: true,
	showTimer: true,
	soundEnabled: false,
	hapticEnabled: false,
}

export type LoadSettingsResult =
	| { ok: true; settings: SettingsV1 }
	| { ok: false; reason: string }

function isErrorCheckingMode(value: unknown): value is ErrorCheckingMode {
	return (
		value === 'immediate' || value === 'on_complete' || value === 'off'
	)
}

function isBoolean(value: unknown): value is boolean {
	return typeof value === 'boolean'
}

/**
 * Parse settings JSON. Empty/missing → defaults.
 * Corrupt / wrong-version payloads return ok:false (repository clears + defaults).
 */
export function parseSettings(raw: string | null): LoadSettingsResult {
	if (raw === null || raw.trim() === '') {
		return { ok: true, settings: { ...DEFAULT_SETTINGS } }
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
	const doc = parsed as Partial<SettingsV1>
	if (doc.schemaVersion !== SETTINGS_SCHEMA_VERSION) {
		return { ok: false, reason: 'schema-version' }
	}
	if (!isErrorCheckingMode(doc.errorChecking)) {
		return { ok: false, reason: 'errorChecking' }
	}
	if (
		!isBoolean(doc.highlightSameNumbers) ||
		!isBoolean(doc.highlightRelated) ||
		!isBoolean(doc.autoClearNotes) ||
		!isBoolean(doc.showTimer) ||
		!isBoolean(doc.soundEnabled) ||
		!isBoolean(doc.hapticEnabled)
	) {
		return { ok: false, reason: 'shape' }
	}
	return {
		ok: true,
		settings: {
			schemaVersion: SETTINGS_SCHEMA_VERSION,
			errorChecking: doc.errorChecking,
			highlightSameNumbers: doc.highlightSameNumbers,
			highlightRelated: doc.highlightRelated,
			autoClearNotes: doc.autoClearNotes,
			showTimer: doc.showTimer,
			soundEnabled: doc.soundEnabled,
			hapticEnabled: doc.hapticEnabled,
		},
	}
}

export function serializeSettings(settings: SettingsV1): string {
	return JSON.stringify(settings)
}

/** Alias used by the repository when recovering from corrupt storage. */
export function createEmptySettings(): SettingsV1 {
	return { ...DEFAULT_SETTINGS }
}
