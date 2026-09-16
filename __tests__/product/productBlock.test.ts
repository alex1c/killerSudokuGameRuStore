/**
 * Smart Hint + product-block unit tests.
 */

import {
	formatHint,
	formatStalledHint,
	createHintSession,
	advanceHintSession,
	presentHint,
	placementFromHint,
	findHintStep,
} from '../../src/hints'
import type { LogicalStep } from '../../src/game/logic'
import { generateKillerPuzzle } from '../../src/game/killer'
import { createGameFromPuzzle } from '../../src/gameplay'
import {
	dailySeed,
	localDateString,
	markDailyCompleted,
	createEmptyDailyProgress,
	isDayCompleted,
	parseDailyProgress,
	createEmptyStats,
	recordGameStarted,
	recordGameCompleted,
	uniqueKey,
	parseStats,
	createEmptySettings,
	parseSettings,
	DEFAULT_SETTINGS,
	markLessonViewed,
	markLessonInteractiveComplete,
	createEmptyLearningProgress,
	parseLearningProgress,
	MemoryStorageAdapter,
	SettingsRepository,
} from '../../src/storage'
import { getDailySeed } from '../../src/daily'
import { LESSONS } from '../../src/learning'

function sampleStep(
	technique: LogicalStep['technique'],
	data: Record<string, unknown> = {},
): LogicalStep {
	return {
		technique,
		placements: [{ cell: 0, digit: 5 }],
		eliminations: [],
		relatedCells: [0, 1, 2],
		explanationData: { digit: 5, unit: 'row', unitIndex: 0, ...data },
		difficultyWeight: 1,
	}
}

describe('smart hint', () => {
	it('formats each major technique without crashing', () => {
		const techniques: LogicalStep['technique'][] = [
			'naked_single',
			'hidden_single',
			'cage_single',
			'cage_combination',
			'cage_candidate_elimination',
			'locked_candidate',
			'rule_of_45',
			'cage_intersection',
			'innie_outie',
		]
		for (const technique of techniques) {
			for (const level of [1, 2, 3, 4] as const) {
				const formatted = formatHint(
					sampleStep(technique, {
						targetSum: 17,
						remaining: 8,
					}),
					level,
				)
				expect(formatted.body.length).toBeGreaterThan(0)
				expect(formatted.stalled).toBe(false)
			}
		}
	})

	it('advances levels and supports apply placement', () => {
		const puzzle = generateKillerPuzzle({
			seed: 70001,
			difficultyPreset: 'easy',
		})
		const state = createGameFromPuzzle(puzzle)
		const session = createHintSession(state)
		if (session.stalled) {
			expect(presentHint(session).stalled).toBe(true)
			return
		}
		expect(presentHint(session).level).toBe(1)
		const l2 = advanceHintSession(session)
		expect(presentHint(l2).level).toBe(2)
		let current = l2
		while (current.level < 4) {
			current = advanceHintSession(current)
		}
		const view = presentHint(current)
		expect(view.level).toBe(4)
		if (current.step && current.step.placements.length > 0) {
			expect(placementFromHint(current.step)).not.toBeNull()
			expect(view.canApply).toBe(true)
		}
	})

	it('does not use solution digits outside LogicalStep placements', () => {
		const puzzle = generateKillerPuzzle({
			seed: 70002,
			difficultyPreset: 'easy',
		})
		const state = createGameFromPuzzle(puzzle)
		const step = findHintStep(state)
		if (step === null) {
			expect(formatStalledHint().stalled).toBe(true)
			return
		}
		for (const placement of step.placements) {
			// Placement must match current logical candidates path, and be a
			// valid solution digit — but must come from the step, not a leak.
			expect(puzzle.solution[placement.cell]).toBe(placement.digit)
		}
	})

	it('reports stalled honestly', () => {
		const stalled = formatStalledHint()
		expect(stalled.stalled).toBe(true)
		expect(stalled.canApply).toBe(false)
		expect(stalled.body).toContain('недоступна')
	})
})

describe('daily', () => {
	it('is deterministic for date + difficulty', () => {
		const a = getDailySeed('2026-09-16', 'hard')
		const b = getDailySeed('2026-09-16', 'hard')
		const c = getDailySeed('2026-09-17', 'hard')
		const d = getDailySeed('2026-09-16', 'easy')
		expect(a).toBe(b)
		expect(a).not.toBe(c)
		expect(a).not.toBe(d)
		expect(a).toBe(dailySeed('2026-09-16', 'hard'))
	})

	it('uses local calendar date', () => {
		const date = new Date(2026, 8, 16, 23, 30, 0)
		expect(localDateString(date)).toBe('2026-09-16')
	})

	it('tracks completion and streak', () => {
		let progress = createEmptyDailyProgress()
		progress = markDailyCompleted(progress, '2026-09-15', 'easy')
		expect(isDayCompleted(progress.days['2026-09-15'])).toBe(true)
		expect(progress.currentStreak).toBe(1)
		progress = markDailyCompleted(progress, '2026-09-16', 'medium')
		expect(progress.currentStreak).toBe(2)
		expect(progress.bestStreak).toBe(2)
		progress = markDailyCompleted(progress, '2026-09-18', 'hard')
		expect(progress.currentStreak).toBe(1)
	})

	it('rejects corrupt daily payload', () => {
		expect(parseDailyProgress('{').ok).toBe(false)
	})
})

describe('statistics', () => {
	it('records started after meaningful semantics and completions', () => {
		let stats = createEmptyStats()
		stats = recordGameStarted(stats, 'medium')
		expect(stats.byDifficulty.medium.started).toBe(1)
		stats = recordGameCompleted(stats, {
			difficulty: 'medium',
			seed: 42,
			elapsedMs: 12_000,
			isReplayUnique: true,
		})
		expect(stats.byDifficulty.medium.completed).toBe(1)
		expect(stats.byDifficulty.medium.bestTimeMs).toBe(12_000)
		expect(stats.uniqueSolvedSeeds).toContain(uniqueKey('medium', 42))
		const beforeUnique = stats.uniqueSolvedSeeds.length
		stats = recordGameCompleted(stats, {
			difficulty: 'medium',
			seed: 42,
			elapsedMs: 9_000,
			isReplayUnique: false,
		})
		expect(stats.uniqueSolvedSeeds.length).toBe(beforeUnique)
		expect(stats.byDifficulty.medium.bestTimeMs).toBe(9_000)
	})

	it('rejects corrupt stats', () => {
		expect(parseStats('nope').ok).toBe(false)
	})
})

describe('settings', () => {
	it('defaults and persists', async () => {
		expect(DEFAULT_SETTINGS.autoClearNotes).toBe(true)
		expect(DEFAULT_SETTINGS.errorChecking).toBe('off')
		const adapter = new MemoryStorageAdapter()
		const repo = new SettingsRepository(adapter)
		await repo.save({
			...createEmptySettings(),
			showTimer: false,
			errorChecking: 'immediate',
		})
		const loaded = await repo.load()
		expect(loaded.showTimer).toBe(false)
		expect(loaded.errorChecking).toBe('immediate')
		expect(parseSettings('{').ok).toBe(false)
	})
})

describe('learning', () => {
	it('has interactive lessons and progress helpers', () => {
		expect(LESSONS.length).toBeGreaterThanOrEqual(8)
		const interactive = LESSONS.filter((l) => l.interactive)
		expect(interactive.length).toBeGreaterThanOrEqual(5)
		let progress = createEmptyLearningProgress()
		progress = markLessonViewed(progress, 'sudoku-rules')
		progress = markLessonInteractiveComplete(progress, 'sudoku-rules')
		expect(progress.viewedLessonIds).toContain('sudoku-rules')
		expect(progress.completedInteractiveIds).toContain('sudoku-rules')
		expect(parseLearningProgress('x').ok).toBe(false)
	})
})
