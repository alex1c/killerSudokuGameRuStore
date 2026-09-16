/**
 * Export / import backup schema (product block).
 * Pure types — builders and validators live alongside this file.
 *
 * Intentionally omits the prepared puzzle pool (device-local cache only).
 */

import type { DailyProgressV1 } from '../daily/types'
import type { LearningProgressV1 } from '../learning/types'
import type { OnboardingV1 } from '../onboarding/types'
import type { SettingsV1 } from '../settings/types'
import type { StatsV1 } from '../stats/types'
import type { SavedGameV1 } from '../storage/savedGame'

export const BACKUP_VERSION = 1 as const
export const BACKUP_APP_ID = 'killerSudoku' as const

/**
 * Optional product slices included in a backup.
 * Puzzle pool keys must never appear here.
 */
export interface BackupDataV1 {
	settings?: SettingsV1
	stats?: StatsV1
	daily?: DailyProgressV1
	learning?: LearningProgressV1
	activeGame?: SavedGameV1 | null
	onboarding?: OnboardingV1
}

/**
 * Versioned backup envelope.
 * `createdAt` is an ISO-8601 timestamp string.
 */
export interface BackupV1 {
	backupVersion: 1
	createdAt: string
	app: typeof BACKUP_APP_ID
	data: BackupDataV1
}

/** Optional parts supplied when constructing a backup. */
export type BackupParts = BackupDataV1

/** Keys allowed under BackupV1.data (pool is deliberately excluded). */
export const BACKUP_DATA_KEYS = [
	'settings',
	'stats',
	'daily',
	'learning',
	'activeGame',
	'onboarding',
] as const

export type BackupDataKey = (typeof BACKUP_DATA_KEYS)[number]

/** Keys that must never appear in a pool-free backup payload. */
export const BACKUP_FORBIDDEN_POOL_KEYS = [
	'puzzlePool',
	'pool',
	'preparedPuzzles',
] as const
