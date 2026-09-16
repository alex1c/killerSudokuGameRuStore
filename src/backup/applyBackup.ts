/**
 * Apply a validated BackupV1 to persistence repositories.
 *
 * Contract:
 * - Call `applyBackupValidated` only with a backup that already passed
 *   `validateBackup` (or an equivalent trusted source). Validation prevents
 *   partial *schema* corruption; AsyncStorage writes are still best-effort
 *   sequential and are not transactionally rolled back on mid-write failure.
 * - Prefer `applyBackupAtomic` for the validate-then-write path.
 */

import type { DailyProgressV1 } from '../daily/types'
import type { LearningProgressV1 } from '../learning/types'
import type { OnboardingV1 } from '../onboarding/types'
import type { SettingsV1 } from '../settings/types'
import type { StatsV1 } from '../stats/types'
import type { SavedGameV1 } from '../storage/savedGame'
import type { BackupV1 } from './types'
import { validateBackup } from './validateBackup'

/**
 * Persistence hooks used while restoring a backup.
 * Implementations typically delegate to the existing *Repository classes.
 * `saveActiveGame(null)` should clear the active-game slot.
 */
export interface BackupApplyRepos {
	saveSettings(settings: SettingsV1): Promise<void>
	saveStats(stats: StatsV1): Promise<void>
	saveDaily(daily: DailyProgressV1): Promise<void>
	saveLearning(learning: LearningProgressV1): Promise<void>
	saveActiveGame(game: SavedGameV1 | null): Promise<void>
	saveOnboarding(onboarding: OnboardingV1): Promise<void>
}

export type ApplyBackupResult =
	| { ok: true }
	| { ok: false; reason: string }

/**
 * Write every present slice from a validated backup, sequentially.
 *
 * Must only be called with a validated BackupV1. If any save throws, the
 * error propagates — earlier writes may already have landed (no easy
 * AsyncStorage rollback). Full validation up front prevents writing
 * malformed product schemas.
 */
export async function applyBackupValidated(
	backup: BackupV1,
	repos: BackupApplyRepos,
): Promise<void> {
	const { data } = backup

	if (data.settings !== undefined) {
		await repos.saveSettings(data.settings)
	}
	if (data.stats !== undefined) {
		await repos.saveStats(data.stats)
	}
	if (data.daily !== undefined) {
		await repos.saveDaily(data.daily)
	}
	if (data.learning !== undefined) {
		await repos.saveLearning(data.learning)
	}
	if (data.activeGame !== undefined) {
		await repos.saveActiveGame(data.activeGame)
	}
	if (data.onboarding !== undefined) {
		await repos.saveOnboarding(data.onboarding)
	}
}

/**
 * Validate raw backup JSON, then apply all slices sequentially.
 *
 * On validation failure returns `{ ok: false, reason }` without writing.
 * On write failure returns `{ ok: false, reason }` — caller should assume
 * a partial apply may have occurred; AsyncStorage does not support easy
 * multi-key rollback. Validation still prevents partial schema corruption.
 */
export async function applyBackupAtomic(
	raw: string,
	repos: BackupApplyRepos,
): Promise<ApplyBackupResult> {
	const validated = validateBackup(raw)
	if (!validated.ok) {
		return { ok: false, reason: validated.reason }
	}

	try {
		await applyBackupValidated(validated.backup, repos)
		return { ok: true }
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'write-failed'
		return { ok: false, reason: `write:${message}` }
	}
}
