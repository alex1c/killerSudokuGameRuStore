/**
 * Validate a backup JSON string against BackupV1 + nested product schemas.
 * Reuses existing storage parsers so corrupt nested docs are rejected uniformly.
 */

import { parseDailyProgress } from '../storage/dailyProgress'
import { parseLearningProgress } from '../storage/learningProgress'
import { parseOnboarding } from '../storage/onboarding'
import { parseSavedGame } from '../storage/savedGame'
import { parseSettings } from '../storage/settings'
import { parseStats } from '../storage/stats'
import {
	BACKUP_APP_ID,
	BACKUP_DATA_KEYS,
	BACKUP_FORBIDDEN_POOL_KEYS,
	BACKUP_VERSION,
	type BackupDataV1,
	type BackupV1,
} from './types'

export type ValidateBackupResult =
	| { ok: true; backup: BackupV1 }
	| { ok: false; reason: string }

const ALLOWED_DATA_KEY_SET: ReadonlySet<string> = new Set(BACKUP_DATA_KEYS)

/**
 * True when the backup data object has no puzzle-pool keys.
 * Valid BackupV1 documents are always pool-free by construction / validation.
 */
export function isBackupPoolFree(backup: BackupV1): boolean {
	const data = backup.data as Record<string, unknown>
	for (const key of BACKUP_FORBIDDEN_POOL_KEYS) {
		if (Object.prototype.hasOwnProperty.call(data, key)) {
			return false
		}
	}
	return true
}

function isIsoTimestamp(value: unknown): value is string {
	if (typeof value !== 'string' || value.trim() === '') {
		return false
	}
	const ms = Date.parse(value)
	return Number.isFinite(ms)
}

/**
 * Parse and validate a backup JSON string.
 * Rejects invalid JSON, wrong backupVersion / app, pool keys, and malformed
 * nested product schemas (via existing parse* helpers).
 */
export function validateBackup(raw: string): ValidateBackupResult {
	if (typeof raw !== 'string' || raw.trim() === '') {
		return { ok: false, reason: 'empty' }
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

	const doc = parsed as Partial<BackupV1>
	if (doc.backupVersion !== BACKUP_VERSION) {
		return { ok: false, reason: 'backup-version' }
	}
	if (doc.app !== BACKUP_APP_ID) {
		return { ok: false, reason: 'app' }
	}
	if (!isIsoTimestamp(doc.createdAt)) {
		return { ok: false, reason: 'createdAt' }
	}
	if (doc.data === null || typeof doc.data !== 'object') {
		return { ok: false, reason: 'data' }
	}

	const dataRaw = doc.data as Record<string, unknown>

	// Reject puzzle-pool (and any other unknown) keys under data.
	for (const key of Object.keys(dataRaw)) {
		if (
			(BACKUP_FORBIDDEN_POOL_KEYS as readonly string[]).includes(key)
		) {
			return { ok: false, reason: `pool-key:${key}` }
		}
		if (!ALLOWED_DATA_KEY_SET.has(key)) {
			return { ok: false, reason: `unknown-data-key:${key}` }
		}
	}

	const data: BackupDataV1 = {}

	if (Object.prototype.hasOwnProperty.call(dataRaw, 'settings')) {
		const value = dataRaw.settings
		if (value === null || typeof value !== 'object') {
			return { ok: false, reason: 'settings:not-object' }
		}
		const nested = parseSettings(JSON.stringify(value))
		if (!nested.ok) {
			return { ok: false, reason: `settings:${nested.reason}` }
		}
		data.settings = nested.settings
	}

	if (Object.prototype.hasOwnProperty.call(dataRaw, 'stats')) {
		const value = dataRaw.stats
		if (value === null || typeof value !== 'object') {
			return { ok: false, reason: 'stats:not-object' }
		}
		const nested = parseStats(JSON.stringify(value))
		if (!nested.ok) {
			return { ok: false, reason: `stats:${nested.reason}` }
		}
		data.stats = nested.stats
	}

	if (Object.prototype.hasOwnProperty.call(dataRaw, 'daily')) {
		const value = dataRaw.daily
		if (value === null || typeof value !== 'object') {
			return { ok: false, reason: 'daily:not-object' }
		}
		const nested = parseDailyProgress(JSON.stringify(value))
		if (!nested.ok) {
			return { ok: false, reason: `daily:${nested.reason}` }
		}
		data.daily = nested.progress
	}

	if (Object.prototype.hasOwnProperty.call(dataRaw, 'learning')) {
		const value = dataRaw.learning
		if (value === null || typeof value !== 'object') {
			return { ok: false, reason: 'learning:not-object' }
		}
		const nested = parseLearningProgress(JSON.stringify(value))
		if (!nested.ok) {
			return { ok: false, reason: `learning:${nested.reason}` }
		}
		data.learning = nested.progress
	}

	if (Object.prototype.hasOwnProperty.call(dataRaw, 'activeGame')) {
		const active = dataRaw.activeGame
		if (active === null) {
			data.activeGame = null
		} else if (typeof active !== 'object') {
			return { ok: false, reason: 'activeGame:not-object' }
		} else {
			const nested = parseSavedGame(JSON.stringify(active))
			if (!nested.ok) {
				return { ok: false, reason: `activeGame:${nested.reason}` }
			}
			data.activeGame = nested.save
		}
	}

	if (Object.prototype.hasOwnProperty.call(dataRaw, 'onboarding')) {
		const value = dataRaw.onboarding
		if (value === null || typeof value !== 'object') {
			return { ok: false, reason: 'onboarding:not-object' }
		}
		const nested = parseOnboarding(JSON.stringify(value))
		if (!nested.ok) {
			return { ok: false, reason: `onboarding:${nested.reason}` }
		}
		data.onboarding = nested.onboarding
	}

	const backup: BackupV1 = {
		backupVersion: BACKUP_VERSION,
		createdAt: doc.createdAt,
		app: BACKUP_APP_ID,
		data,
	}

	// Validated BackupV1 is pool-free; keep the assert for defense in depth.
	if (!isBackupPoolFree(backup)) {
		return { ok: false, reason: 'pool-present' }
	}

	return { ok: true, backup }
}
