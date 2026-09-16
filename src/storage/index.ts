/**
 * Storage adapters and saved-game repository exports.
 */

export interface StorageAdapter {
	getItem(key: string): Promise<string | null>
	setItem(key: string, value: string): Promise<void>
	removeItem(key: string): Promise<void>
}

/** In-memory adapter for unit tests. */
export class MemoryStorageAdapter implements StorageAdapter {
	private readonly data = new Map<string, string>()

	async getItem(key: string): Promise<string | null> {
		return this.data.has(key) ? this.data.get(key)! : null
	}

	async setItem(key: string, value: string): Promise<void> {
		this.data.set(key, value)
	}

	async removeItem(key: string): Promise<void> {
		this.data.delete(key)
	}
}

export const STORAGE_SCHEMA_VERSION = 1

export {
	SAVED_GAME_SCHEMA_VERSION,
	ACTIVE_GAME_STORAGE_KEY,
	PHASE4_QA_STORAGE_KEY,
	serializeSavedGame,
	parseSavedGame,
	restoreGameFromSave,
	computeEditableProgress,
	formatProgressPercent,
} from './savedGame'
export type {
	SavedGameV1,
	SerializedKillerPuzzleV1,
	LoadSavedGameResult,
} from './savedGame'
export { GameSaveRepository } from './gameSaveRepository'
export {
	PUZZLE_POOL_SCHEMA_VERSION,
	PUZZLE_POOL_STORAGE_KEY,
	POOL_TARGET_COUNTS,
	POOLED_DIFFICULTIES,
	POOL_RECENT_SEEDS_LIMIT,
	createEmptyPuzzlePool,
	parsePuzzlePool,
	serializePuzzlePool,
	createPreparedPuzzle,
	consumePreparedPuzzle,
	appendPreparedPuzzle,
	countPrepared,
	poolNeedsFill,
	nextFillDifficulty,
	isSeedBlocked,
	preparedPuzzleToKillerPuzzle,
	serializeKillerPuzzle,
} from './puzzlePool'
export type {
	PuzzlePoolV1,
	PreparedPuzzleV1,
	PooledDifficulty,
	LoadPuzzlePoolResult,
} from './puzzlePool'
export { PuzzlePoolRepository } from './puzzlePoolRepository'

export {
	SETTINGS_SCHEMA_VERSION,
	SETTINGS_STORAGE_KEY,
	DEFAULT_SETTINGS,
	createEmptySettings,
	parseSettings,
	serializeSettings,
} from './settings'
export type {
	SettingsV1,
	ErrorCheckingMode,
	LoadSettingsResult,
} from './settings'
export { SettingsRepository } from './settingsRepository'

export {
	STATS_SCHEMA_VERSION,
	STATS_STORAGE_KEY,
	UNIQUE_SOLVED_SEEDS_CAP,
	createEmptyStats,
	parseStats,
	serializeStats,
	uniqueKey,
	recordGameStarted,
	recordGameCompleted,
} from './stats'
export type {
	StatsV1,
	DifficultyStatsV1,
	RecordGameCompletedInput,
	LoadStatsResult,
} from './stats'
export { StatsRepository } from './statsRepository'

export {
	DAILY_PROGRESS_SCHEMA_VERSION,
	DAILY_GENERATOR_VERSION,
	DAILY_PROGRESS_STORAGE_KEY,
	DAILY_PUZZLE_CACHE_CAP,
	createEmptyDailyProgress,
	parseDailyProgress,
	serializeDailyProgress,
	localDateString,
	dailySeed,
	markDailyCompleted,
	isDayCompleted,
	monthCalendar,
	putDailyPuzzleCache,
} from './dailyProgress'
export type {
	DailyProgressV1,
	DailyDayProgress,
	LocalDateString,
	LoadDailyProgressResult,
} from './dailyProgress'
export { DailyProgressRepository } from './dailyProgressRepository'

export {
	LEARNING_PROGRESS_SCHEMA_VERSION,
	LEARNING_PROGRESS_STORAGE_KEY,
	createEmptyLearningProgress,
	parseLearningProgress,
	serializeLearningProgress,
	markLessonViewed,
	markLessonInteractiveComplete,
} from './learningProgress'
export type {
	LearningProgressV1,
	LoadLearningProgressResult,
} from './learningProgress'
export { LearningProgressRepository } from './learningProgressRepository'
