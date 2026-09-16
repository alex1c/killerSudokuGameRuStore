/**
 * Build a pool-free BackupV1 from optional product slices.
 */

import {
	BACKUP_APP_ID,
	BACKUP_VERSION,
	type BackupParts,
	type BackupV1,
} from './types'

/**
 * Assemble a BackupV1 document.
 * Only defined parts are copied into `data` (undefined keys are omitted).
 * Puzzle pool is never included.
 */
export function buildBackup(
	parts: BackupParts,
	createdAt: string = new Date().toISOString(),
): BackupV1 {
	const data: BackupV1['data'] = {}

	if (parts.settings !== undefined) {
		data.settings = parts.settings
	}
	if (parts.stats !== undefined) {
		data.stats = parts.stats
	}
	if (parts.daily !== undefined) {
		data.daily = parts.daily
	}
	if (parts.learning !== undefined) {
		data.learning = parts.learning
	}
	if (parts.activeGame !== undefined) {
		data.activeGame = parts.activeGame
	}
	if (parts.onboarding !== undefined) {
		data.onboarding = parts.onboarding
	}

	return {
		backupVersion: BACKUP_VERSION,
		createdAt,
		app: BACKUP_APP_ID,
		data,
	}
}

/** Serialize a BackupV1 document to a JSON string. */
export function serializeBackup(backup: BackupV1): string {
	return JSON.stringify(backup)
}
