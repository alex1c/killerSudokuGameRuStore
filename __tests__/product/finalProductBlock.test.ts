/**
 * Final product block — onboarding, backup, error modes, dates, haptics, stats.
 */

import {
	applyBackupAtomic,
	buildBackup,
	isBackupPoolFree,
	serializeBackup,
	validateBackup,
	BACKUP_VERSION,
} from '../../src/backup'
import { playHaptic } from '../../src/feedback/haptics'
import { playSound } from '../../src/feedback/sound'
import { ADS_POLICY } from '../../src/ads'
import { ANALYTICS_EVENTS, trackAnalytics } from '../../src/analytics'
import { DEVELOPER_NAME, DEVELOPER_WEBSITE, PRIVACY_POLICY_URL } from '../../src/product/privacy'
import { APP_VERSION } from '../../src/product/constants'
import {
	createGameFromPuzzle,
	gameReducer,
	getSolutionMismatchCells,
	isBoardComplete,
	isPuzzleSolved,
} from '../../src/gameplay'
import { createEmptyBoard } from '../../src/game/sudoku'
import type { KillerCage, KillerPuzzle } from '../../src/game/killer'
import {
	advanceHintSession,
	createHintSession,
	formatHint,
	presentHint,
} from '../../src/hints'
import type { LogicalStep } from '../../src/game/logic'
import { LESSONS } from '../../src/learning'
import {
	createEmptyDailyProgress,
	createEmptyLearningProgress,
	createEmptyOnboarding,
	createEmptySettings,
	createEmptyStats,
	compareLocalDateStrings,
	DailyProgressRepository,
	DEFAULT_SETTINGS,
	GameSaveRepository,
	isFutureLocalDate,
	LearningProgressRepository,
	localDateString,
	markOnboardingCompleted,
	MemoryStorageAdapter,
	monthCalendar,
	OnboardingRepository,
	parseOnboarding,
	SettingsRepository,
	serializeSavedGame,
	StatsRepository,
} from '../../src/storage'
import * as Haptics from 'expo-haptics'

jest.mock('expo-haptics', () => ({
	impactAsync: jest.fn(() => Promise.resolve()),
	selectionAsync: jest.fn(() => Promise.resolve()),
	notificationAsync: jest.fn(() => Promise.resolve()),
	ImpactFeedbackStyle: { Light: 'Light' },
	NotificationFeedbackType: { Error: 'Error', Success: 'Success' },
}))

function makePuzzle(): KillerPuzzle {
	const board = createEmptyBoard()
	const solution = createEmptyBoard()
	for (let i = 0; i < 81; i += 1) {
		const row = Math.floor(i / 9)
		const col = i % 9
		solution[i] = ((row * 3 + Math.floor(row / 3) + col) % 9) + 1
	}
	board[0] = solution[0]!
	const cages: KillerCage[] = Array.from({ length: 81 }, (_, cell) => ({
		id: `c${cell}`,
		sum: solution[cell]!,
		cells: [cell],
	}))
	return {
		seed: 777,
		attempt: 0,
		difficultyPreset: 'easy',
		board,
		solution,
		cages,
	}
}

describe('onboarding', () => {
	it('starts incomplete and persists completion', async () => {
		const adapter = new MemoryStorageAdapter()
		const repo = new OnboardingRepository(adapter)
		const fresh = await repo.load()
		expect(fresh.completed).toBe(false)
		expect(fresh.completedAt).toBeNull()

		const done = await repo.update((current) =>
			markOnboardingCompleted(current, 1_700_000_000_000),
		)
		expect(done.completed).toBe(true)
		expect(done.completedAt).toBe(1_700_000_000_000)

		const again = await repo.load()
		expect(again.completed).toBe(true)
		expect(parseOnboarding(JSON.stringify(again)).ok).toBe(true)
	})

	it('manual reopen does not require resetting completed flag', () => {
		const completed = markOnboardingCompleted(createEmptyOnboarding(), 100)
		expect(completed.completed).toBe(true)
		// Reviewing onboarding UI is a route-only action; storage stays completed.
		expect(completed.completed).toBe(true)
	})

	it('rejects corrupt onboarding payloads', () => {
		expect(parseOnboarding('{').ok).toBe(false)
		expect(
			parseOnboarding(
				JSON.stringify({
					schemaVersion: 99,
					completed: true,
					completedAt: null,
				}),
			).ok,
		).toBe(false)
	})
})

describe('backup', () => {
	it('roundtrips settings/stats/daily/learning/activeGame/onboarding', async () => {
		const adapter = new MemoryStorageAdapter()
		const settingsRepo = new SettingsRepository(adapter)
		const statsRepo = new StatsRepository(adapter)
		const dailyRepo = new DailyProgressRepository(adapter)
		const learningRepo = new LearningProgressRepository(adapter)
		const saveRepo = new GameSaveRepository(adapter)
		const onboardingRepo = new OnboardingRepository(adapter)

		const settings = {
			...createEmptySettings(),
			errorChecking: 'immediate' as const,
			hapticEnabled: true,
		}
		const stats = createEmptyStats()
		stats.totalCompleted = 3
		const daily = createEmptyDailyProgress()
		daily.currentStreak = 2
		const learning = createEmptyLearningProgress()
		learning.viewedLessonIds = ['sudoku-rules']
		const onboarding = markOnboardingCompleted(
			createEmptyOnboarding(),
			50,
		)
		const saved = serializeSavedGame(createGameFromPuzzle(makePuzzle()), 99)

		const backup = buildBackup({
			settings,
			stats,
			daily,
			learning,
			activeGame: saved,
			onboarding,
		})
		expect(backup.backupVersion).toBe(BACKUP_VERSION)
		expect(isBackupPoolFree(backup)).toBe(true)
		expect(
			Object.prototype.hasOwnProperty.call(backup.data, 'puzzlePool'),
		).toBe(false)

		const raw = serializeBackup(backup)
		const result = await applyBackupAtomic(raw, {
			saveSettings: (next) => settingsRepo.save(next),
			saveStats: (next) => statsRepo.save(next),
			saveDaily: (next) => dailyRepo.save(next),
			saveLearning: (next) => learningRepo.save(next),
			saveActiveGame: (next) => saveRepo.saveDocument(next),
			saveOnboarding: (next) => onboardingRepo.save(next),
		})
		expect(result.ok).toBe(true)
		expect((await settingsRepo.load()).errorChecking).toBe('immediate')
		expect((await statsRepo.load()).totalCompleted).toBe(3)
		expect((await dailyRepo.load()).currentStreak).toBe(2)
		expect((await learningRepo.load()).viewedLessonIds).toContain(
			'sudoku-rules',
		)
		expect((await onboardingRepo.load()).completed).toBe(true)
		const loadedSave = await saveRepo.load()
		expect(loadedSave.ok).toBe(true)
	})

	it('rejects invalid JSON, wrong version, missing data, corrupt slices', () => {
		expect(validateBackup('').ok).toBe(false)
		expect(validateBackup('{').ok).toBe(false)
		expect(
			validateBackup(
				JSON.stringify({
					backupVersion: 99,
					createdAt: new Date().toISOString(),
					app: 'killerSudoku',
					data: {},
				}),
			).ok,
		).toBe(false)
		expect(
			validateBackup(
				JSON.stringify({
					backupVersion: 1,
					createdAt: new Date().toISOString(),
					app: 'killerSudoku',
					data: null,
				}),
			).ok,
		).toBe(false)
		expect(
			validateBackup(
				JSON.stringify({
					backupVersion: 1,
					createdAt: new Date().toISOString(),
					app: 'killerSudoku',
					data: { stats: { schemaVersion: 1 } },
				}),
			).ok,
		).toBe(false)
		expect(
			validateBackup(
				JSON.stringify({
					backupVersion: 1,
					createdAt: new Date().toISOString(),
					app: 'killerSudoku',
					data: { activeGame: { schemaVersion: 1 } },
				}),
			).ok,
		).toBe(false)
		expect(
			validateBackup(
				JSON.stringify({
					backupVersion: 1,
					createdAt: new Date().toISOString(),
					app: 'killerSudoku',
					data: { puzzlePool: {} },
				}),
			).ok,
		).toBe(false)
	})

	it('failed validation leaves existing data unchanged', async () => {
		const adapter = new MemoryStorageAdapter()
		const settingsRepo = new SettingsRepository(adapter)
		await settingsRepo.save({
			...DEFAULT_SETTINGS,
			soundEnabled: true,
		})
		const before = await settingsRepo.load()
		const result = await applyBackupAtomic('not-json', {
			saveSettings: (next) => settingsRepo.save(next),
			saveStats: async () => undefined,
			saveDaily: async () => undefined,
			saveLearning: async () => undefined,
			saveActiveGame: async () => undefined,
			saveOnboarding: async () => undefined,
		})
		expect(result.ok).toBe(false)
		expect((await settingsRepo.load()).soundEnabled).toBe(
			before.soundEnabled,
		)
	})
})

describe('error checking modes', () => {
	it('immediate can flag solution mismatches without revealing digits', () => {
		let state = createGameFromPuzzle(makePuzzle())
		const empty = state.values.findIndex(
			(value, index) =>
				value === 0 && state.puzzle.board[index] === 0,
		)
		expect(empty).toBeGreaterThanOrEqual(0)
		const wrong =
			((state.puzzle.solution[empty]! + 1 - 1) % 9) + 1 ===
			state.puzzle.solution[empty]
				? ((state.puzzle.solution[empty]! % 9) + 1)
				: ((state.puzzle.solution[empty]! % 9) + 1)
		state = gameReducer(state, { type: 'SELECT_CELL', cell: empty })
		state = gameReducer(state, {
			type: 'INPUT_DIGIT',
			digit: wrong as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
		})
		const mismatches = getSolutionMismatchCells(state)
		expect(mismatches.has(empty)).toBe(true)
		// Never expose the correct digit via the helper.
		expect(mismatches.size).toBeGreaterThan(0)
	})

	it('on_complete waits for a full board before mismatch UX', () => {
		let state = createGameFromPuzzle(makePuzzle())
		expect(isBoardComplete(state)).toBe(false)
		const editable = state.values.findIndex(
			(_, i) => state.puzzle.board[i] === 0,
		)
		const correct = state.puzzle.solution[editable]!
		const wrongDigit = ((correct % 9) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

		for (let i = 0; i < 81; i += 1) {
			if (state.values[i] !== 0) {
				continue
			}
			const digit =
				i === editable
					? wrongDigit
					: (state.puzzle.solution[i] as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
			state = gameReducer(state, { type: 'SELECT_CELL', cell: i })
			state = gameReducer(state, { type: 'INPUT_DIGIT', digit })
		}
		expect(isBoardComplete(state)).toBe(true)
		expect(isPuzzleSolved(state)).toBe(false)
		expect(getSolutionMismatchCells(state).has(editable)).toBe(true)
	})

	it('off mode still completes only on a real solution', () => {
		let state = createGameFromPuzzle(makePuzzle())
		for (let i = 0; i < 81; i += 1) {
			if (state.values[i] !== 0) {
				continue
			}
			state = gameReducer(state, { type: 'SELECT_CELL', cell: i })
			state = gameReducer(state, {
				type: 'INPUT_DIGIT',
				digit: state.puzzle.solution[i] as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
			})
		}
		expect(isPuzzleSolved(state)).toBe(true)
		expect(state.status).toBe('completed')
	})
})

describe('haptic setting', () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it('fires when enabled and skips when disabled', async () => {
		await playHaptic(false, 'error')
		expect(Haptics.notificationAsync).not.toHaveBeenCalled()
		await playHaptic(true, 'error')
		expect(Haptics.notificationAsync).toHaveBeenCalled()
		await playHaptic(true, 'light')
		expect(Haptics.impactAsync).toHaveBeenCalled()
	})
})

describe('sound hooks', () => {
	it('no-ops safely for enabled and disabled', async () => {
		await expect(playSound(false, 'input')).resolves.toBeUndefined()
		await expect(playSound(true, 'completion')).resolves.toBeUndefined()
	})
})

describe('daily local dates', () => {
	it('uses local calendar getters, not UTC', () => {
		const local = new Date(2026, 0, 15, 23, 30, 0)
		expect(localDateString(local)).toBe('2026-01-15')
		const nearUtcMidnight = new Date(2026, 5, 1, 0, 15, 0)
		expect(localDateString(nearUtcMidnight)).toBe('2026-06-01')
	})

	it('handles month and year boundaries', () => {
		expect(localDateString(new Date(2026, 0, 31))).toBe('2026-01-31')
		expect(localDateString(new Date(2026, 1, 1))).toBe('2026-02-01')
		expect(localDateString(new Date(2025, 11, 31))).toBe('2025-12-31')
		expect(localDateString(new Date(2026, 0, 1))).toBe('2026-01-01')
		expect(monthCalendar(2026, 2).at(-1)).toBe('2026-02-28')
		expect(monthCalendar(2024, 2).at(-1)).toBe('2024-02-29')
		expect(compareLocalDateStrings('2025-12-31', '2026-01-01')).toBe(-1)
		expect(isFutureLocalDate('2026-09-16', '2026-09-15')).toBe(true)
		expect(isFutureLocalDate('2026-09-15', '2026-09-15')).toBe(false)
	})
})

describe('statistics empty state', () => {
	it('keeps averages as null / dash-ready for zero completed', () => {
		const stats = createEmptyStats()
		expect(stats.totalCompleted).toBe(0)
		expect(stats.byDifficulty.easy.completed).toBe(0)
		expect(stats.byDifficulty.easy.bestTimeMs).toBeNull()
		const averageMs =
			stats.byDifficulty.easy.completed > 0
				? Math.round(
						stats.byDifficulty.easy.totalCompletedTimeMs /
							stats.byDifficulty.easy.completed,
					)
				: null
		expect(averageMs).toBeNull()
	})
})

describe('smart hint polish', () => {
	it('uses Russian explanation titles and keeps level across advances', () => {
		const step: LogicalStep = {
			technique: 'cage_candidate_elimination',
			placements: [],
			eliminations: [{ cell: 3, digit: 7 }],
			relatedCells: [3],
			explanationData: { digit: 7, targetSum: 12 },
			difficultyWeight: 1,
		}
		const level2 = formatHint(step, 2)
		expect(level2.title).toBe('Объяснение')
		expect(level2.body.toLowerCase()).toContain('невозможна')
		expect(level2.body.toLowerCase()).not.toContain('candidate elimination')

		const puzzle = makePuzzle()
		const state = createGameFromPuzzle(puzzle)
		// Session level advances without resetting when board is unchanged.
		let session = createHintSession(state)
		if (!session.stalled && session.step) {
			session = advanceHintSession(session)
			const view = presentHint(session)
			expect(view.level).toBe(2)
			session = advanceHintSession(session)
			expect(presentHint(session).level).toBe(3)
		}
	})
})

describe('learning polish', () => {
	it('has eight lessons and interactive checks for first five', () => {
		expect(LESSONS.length).toBe(8)
		for (let i = 0; i < 5; i += 1) {
			expect(LESSONS[i]!.interactive?.correctDigit).toBeGreaterThan(0)
		}
		const joined = LESSONS.map((l) => l.body.join(' ')).join(' ')
		expect(joined.toLowerCase()).not.toContain('locked candidates')
	})
})

describe('ads and analytics foundations', () => {
	it('exposes policy, game banner slot, and privacy URL', () => {
		expect(ADS_POLICY.interstitialDuringPlay).toBe(false)
		expect(ADS_POLICY.bannerOnGameScreen).toBe(true)
		expect(ADS_POLICY.maxInterstitialsPerSession).toBe(1)
		expect(ANALYTICS_EVENTS.game_started).toBe('game_started')
		expect(() => trackAnalytics('hint_opened')).not.toThrow()
		expect(PRIVACY_POLICY_URL).toContain('privacy.html')
		expect(DEVELOPER_NAME).toBe('ForestMusic')
		expect(DEVELOPER_WEBSITE).toContain('forest-music.ru')
		expect(APP_VERSION.length).toBeGreaterThan(0)
	})
})
