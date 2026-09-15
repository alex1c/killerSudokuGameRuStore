/**
 * Development-only Phase 4 runtime QA harness.
 *
 * Uses production create/serialize/restore/repository/timer/generator APIs.
 * Always targets PHASE4_QA_STORAGE_KEY — never the user Continue key.
 */

import {
	PLAYABLE_DIFFICULTIES,
	type Difficulty,
} from '../game/difficulty'
import {
	countKillerSolutions,
	generateKillerPuzzle,
	validateKillerPuzzle,
} from '../game/killer'
import {
	createGame,
	gameReducer,
	getElapsedMs,
	hashSeedLabel,
	pauseTimer,
	resumeTimer,
	type GameState,
} from '../gameplay'
import {
	GameSaveRepository,
	MemoryStorageAdapter,
	PHASE4_QA_STORAGE_KEY,
	restoreGameFromSave,
	serializeSavedGame,
	type StorageAdapter,
} from '../storage'

export const PHASE4_QA_PERSISTENCE_SEED_LABEL = 'phase4-qa-persistence-v1'
export const PHASE4_QA_ELAPSED_MS = 137_000

export interface Phase4QaCheck {
	name: string
	passed: boolean
	details?: string
}

export interface Phase4QaResult {
	passed: boolean
	checks: Phase4QaCheck[]
}

export interface Phase4QaGeneratorPresetSummary {
	difficulty: Difficulty
	min: number
	median: number
	max: number
	timesMs: number[]
}

export interface Phase4QaOptions {
	/** Injected storage (defaults to MemoryStorageAdapter for isolation). */
	adapter?: StorageAdapter
	/** Override storage key (defaults to PHASE4_QA_STORAGE_KEY). */
	storageKey?: string
	/** Skip slow generator suite when only persistence is needed. */
	includeGenerator?: boolean
	/** Runs per difficulty for generator QA (default 3). */
	generatorRunsPerPreset?: number
}

function check(
	name: string,
	passed: boolean,
	details?: string,
): Phase4QaCheck {
	return details === undefined ? { name, passed } : { name, passed, details }
}

function arraysEqual(
	a: readonly number[],
	b: readonly number[],
): boolean {
	if (a.length !== b.length) {
		return false
	}
	for (let i = 0; i < a.length; i += 1) {
		if (a[i] !== b[i]) {
			return false
		}
	}
	return true
}

function cagesEqual(
	a: GameState['puzzle']['cages'],
	b: GameState['puzzle']['cages'],
): boolean {
	if (a.length !== b.length) {
		return false
	}
	for (let i = 0; i < a.length; i += 1) {
		const left = a[i]!
		const right = b[i]!
		if (
			left.id !== right.id ||
			left.sum !== right.sum ||
			!arraysEqual(left.cells, right.cells)
		) {
			return false
		}
	}
	return true
}

function puzzleEqual(
	a: GameState['puzzle'],
	b: GameState['puzzle'],
): boolean {
	return (
		a.seed === b.seed &&
		a.attempt === b.attempt &&
		a.difficultyPreset === b.difficultyPreset &&
		arraysEqual(a.board, b.board) &&
		arraysEqual(a.solution, b.solution) &&
		cagesEqual(a.cages, b.cages)
	)
}

function editableCells(board: readonly number[]): number[] {
	const cells: number[] = []
	for (let i = 0; i < board.length; i += 1) {
		if ((board[i] ?? 0) === 0) {
			cells.push(i)
		}
	}
	return cells
}

/**
 * Build a deterministic medium game with known values/notes/elapsed.
 */
export function buildPhase4QaBaselineGame(): GameState {
	let state = createGame({
		seedLabel: PHASE4_QA_PERSISTENCE_SEED_LABEL,
		difficulty: 'medium',
	})
	const editable = editableCells(state.puzzle.board)
	if (editable.length < 4) {
		throw new Error('QA baseline puzzle has fewer than 4 editable cells')
	}

	const valueCellA = editable[0]!
	const valueCellB = editable[1]!
	const noteCellA = editable[2]!
	const noteCellB = editable[3]!

	const digitA = state.puzzle.solution[valueCellA]!
	const digitB = state.puzzle.solution[valueCellB]!

	state = gameReducer(state, { type: 'SELECT_CELL', cell: valueCellA })
	state = gameReducer(state, { type: 'INPUT_DIGIT', digit: digitA })
	state = gameReducer(state, { type: 'SELECT_CELL', cell: valueCellB })
	state = gameReducer(state, { type: 'INPUT_DIGIT', digit: digitB })
	state = gameReducer(state, { type: 'TOGGLE_NOTES_MODE' })
	state = gameReducer(state, { type: 'SELECT_CELL', cell: noteCellA })
	state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 1 })
	state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 4 })
	state = gameReducer(state, { type: 'SELECT_CELL', cell: noteCellB })
	state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 7 })

	// Fixed elapsed (paused) — do not depend on wall clock.
	state = {
		...state,
		timerAccumulatedMs: PHASE4_QA_ELAPSED_MS,
		timerRunningSince: null,
		selectedCell: noteCellB,
	}

	return state
}

function assertPersistedEqual(
	label: string,
	expected: GameState,
	restored: GameState,
	elapsedMs: number,
): Phase4QaCheck {
	const ok =
		restored.puzzle.seed === expected.puzzle.seed &&
		restored.puzzle.difficultyPreset ===
			expected.puzzle.difficultyPreset &&
		puzzleEqual(restored.puzzle, expected.puzzle) &&
		arraysEqual(restored.values, expected.values) &&
		arraysEqual(restored.notes, expected.notes) &&
		restored.timerAccumulatedMs === elapsedMs &&
		restored.timerRunningSince === null

	return check(
		label,
		ok,
		ok
			? undefined
			: `seed=${restored.puzzle.seed} elapsed=${restored.timerAccumulatedMs}`,
	)
}

/**
 * Persistence / timer / replacement / completion suite.
 */
export async function runPhase4PersistenceQa(
	options: Phase4QaOptions = {},
): Promise<Phase4QaResult> {
	const adapter = options.adapter ?? new MemoryStorageAdapter()
	const storageKey = options.storageKey ?? PHASE4_QA_STORAGE_KEY
	const repo = new GameSaveRepository(adapter, storageKey)
	await repo.clear()
	await repo.flush()

	const checks: Phase4QaCheck[] = []

	// --- Roundtrip #1 ---
	const baseline = buildPhase4QaBaselineGame()
	const baselineSnapshot = serializeSavedGame(baseline, 1_700_000_000_000)
	await repo.savePlaying(baseline, baselineSnapshot.savedAt)
	await repo.flush()

	const loaded1 = await repo.load()
	if (!loaded1.ok) {
		checks.push(check('roundtrip #1', false, loaded1.reason))
	} else {
		const restored1 = restoreGameFromSave(loaded1.save)
		checks.push(
			assertPersistedEqual(
				'roundtrip #1',
				baseline,
				restored1,
				PHASE4_QA_ELAPSED_MS,
			),
		)
		checks.push(
			check(
				'transient reset',
				restored1.selectedCell === null &&
					restored1.history.length === 0 &&
					restored1.timerRunningSince === null,
			),
		)

		// Discard baseline reference — second roundtrip from restored only.
		let working = restored1
		const editable = editableCells(working.puzzle.board)
		const nextValueCell =
			editable.find((cell) => working.values[cell] === 0) ?? editable[0]!
		const nextNoteCell =
			editable.find(
				(cell) =>
					cell !== nextValueCell && working.values[cell] === 0,
			) ?? editable[1]!

		working = gameReducer(working, {
			type: 'SELECT_CELL',
			cell: nextValueCell,
		})
		working = gameReducer(working, {
			type: 'INPUT_DIGIT',
			digit: working.puzzle.solution[nextValueCell]!,
		})
		working = gameReducer(working, { type: 'TOGGLE_NOTES_MODE' })
		working = gameReducer(working, {
			type: 'SELECT_CELL',
			cell: nextNoteCell,
		})
		working = gameReducer(working, { type: 'INPUT_DIGIT', digit: 2 })
		working = {
			...working,
			timerAccumulatedMs: PHASE4_QA_ELAPSED_MS + 45_000,
			timerRunningSince: null,
		}

		const secondSnapshot = serializeSavedGame(working, 1_700_000_100_000)
		await repo.savePlaying(working, secondSnapshot.savedAt)
		await repo.flush()

		const loaded2 = await repo.load()
		if (!loaded2.ok) {
			checks.push(check('roundtrip #2', false, loaded2.reason))
		} else {
			const restored2 = restoreGameFromSave(loaded2.save)
			checks.push(
				assertPersistedEqual(
					'roundtrip #2',
					working,
					restored2,
					PHASE4_QA_ELAPSED_MS + 45_000,
				),
			)
			const notStale =
				!arraysEqual(restored2.values, baseline.values) ||
				!arraysEqual(restored2.notes, baseline.notes) ||
				restored2.timerAccumulatedMs !== PHASE4_QA_ELAPSED_MS
			checks.push(
				check(
					'roundtrip #2 not stale #1',
					notStale &&
						restored2.timerAccumulatedMs ===
							PHASE4_QA_ELAPSED_MS + 45_000,
				),
			)
		}
	}

	// --- Latest-wins queue ---
	const gameA = createGame({ seed: 101, difficulty: 'easy' })
	const gameB = createGame({ seed: 202, difficulty: 'medium' })
	const gameC = createGame({ seed: 303, difficulty: 'hard' })
	void repo.savePlaying(gameA, 10)
	void repo.savePlaying(gameB, 20)
	await repo.savePlaying(gameC, 30)
	await repo.flush()
	const latest = await repo.load()
	checks.push(
		check(
			'latest wins',
			latest.ok &&
				latest.save.seed === gameC.puzzle.seed &&
				latest.save.difficulty === 'hard',
			latest.ok ? `seed=${latest.save.seed}` : latest.reason,
		),
	)

	// --- Timer: background gap excluded ---
	let acc = 0
	let since: number | null = null
	;({ accumulatedMs: acc, runningSince: since } = resumeTimer(
		acc,
		since,
		100_000,
	))
	;({ accumulatedMs: acc, runningSince: since } = pauseTimer(
		acc,
		since,
		105_000,
	))
	// background 105000 → 125000: timer paused → +0
	;({ accumulatedMs: acc, runningSince: since } = resumeTimer(
		acc,
		since,
		125_000,
	))
	;({ accumulatedMs: acc, runningSince: since } = pauseTimer(
		acc,
		since,
		130_000,
	))
	const backgroundOk = acc === 10_000 && since === null
	checks.push(
		check(
			'timer background',
			backgroundOk,
			`elapsedMs=${acc}`,
		),
	)

	// --- Killed duration: wall gap must not inflate elapsed ---
	const killedBase = createGame({ seed: 404, difficulty: 'easy' })
	const killedState: GameState = {
		...killedBase,
		timerAccumulatedMs: 55_000,
		timerRunningSince: null,
	}
	await repo.savePlaying(killedState, 2_000_000_000_000)
	await repo.flush()
	const afterKill = await repo.load()
	if (!afterKill.ok) {
		checks.push(check('killed gap', false, afterKill.reason))
	} else {
		const restoredKill = restoreGameFromSave(afterKill.save)
		const resumed = resumeTimer(
			restoredKill.timerAccumulatedMs,
			restoredKill.timerRunningSince,
			2_000_000_000_000 + 3_600_000,
		)
		const afterResumeSecond = getElapsedMs(
			resumed.accumulatedMs,
			resumed.runningSince,
			2_000_000_000_000 + 3_600_000 + 1_000,
		)
		checks.push(
			check(
				'killed gap',
				restoredKill.timerAccumulatedMs === 55_000 &&
					afterResumeSecond === 56_000,
				`restored=${restoredKill.timerAccumulatedMs} after1s=${afterResumeSecond}`,
			),
		)
	}

	// --- Duplicate pause/resume must not double-count ---
	acc = 0
	since = null
	;({ accumulatedMs: acc, runningSince: since } = resumeTimer(
		acc,
		since,
		1_000,
	))
	;({ accumulatedMs: acc, runningSince: since } = resumeTimer(
		acc,
		since,
		1_500,
	))
	;({ accumulatedMs: acc, runningSince: since } = pauseTimer(
		acc,
		since,
		3_000,
	))
	;({ accumulatedMs: acc, runningSince: since } = pauseTimer(
		acc,
		since,
		9_000,
	))
	checks.push(
		check(
			'duplicate accumulation',
			acc === 2_000 && since === null,
			`elapsedMs=${acc}`,
		),
	)

	// --- Replacement Cancel / Confirm ---
	const replaceA = createGame({
		seedLabel: 'phase4-qa-replace-A',
		difficulty: 'easy',
	})
	const replaceB = createGame({
		seedLabel: 'phase4-qa-replace-B',
		difficulty: 'expert',
	})
	await repo.savePlaying(replaceA)
	await repo.flush()
	// Cancel: do not write B — storage must remain A
	const afterCancel = await repo.load()
	checks.push(
		check(
			'replacement Cancel',
			afterCancel.ok && afterCancel.save.seed === replaceA.puzzle.seed,
		),
	)
	await repo.savePlaying(replaceB)
	await repo.flush()
	const afterConfirm = await repo.load()
	checks.push(
		check(
			'replacement Confirm',
			afterConfirm.ok &&
				afterConfirm.save.seed === replaceB.puzzle.seed &&
				afterConfirm.save.difficulty === 'expert' &&
				afterConfirm.save.seed !== replaceA.puzzle.seed,
		),
	)
	checks.push(
		check(
			'replacement stale A gone',
			afterConfirm.ok && afterConfirm.save.seed === replaceB.puzzle.seed,
		),
	)

	// --- Completion cleanup ---
	await repo.savePlaying(createGame({ seed: 909, difficulty: 'medium' }))
	await repo.flush()
	await repo.clear()
	await repo.flush()
	const afterComplete = await repo.load()
	checks.push(
		check('completion cleanup', !afterComplete.ok, afterComplete.ok ? 'still present' : afterComplete.reason),
	)

	// --- Corrupt smoke ---
	await adapter.setItem(storageKey, '{not-json')
	const corrupt = await repo.load()
	checks.push(
		check(
			'corrupt smoke',
			!corrupt.ok,
			corrupt.ok ? 'accepted corrupt' : corrupt.reason,
		),
	)

	const passed = checks.every((item) => item.passed)
	return { passed, checks }
}

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) {
		return 0
	}
	const idx = Math.min(
		sorted.length - 1,
		Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
	)
	return sorted[idx]!
}

function monotonicMs(): number {
	if (
		typeof performance !== 'undefined' &&
		typeof performance.now === 'function'
	) {
		return performance.now()
	}
	return Date.now()
}

/**
 * Generator correctness + timing smoke (Android JS or Node).
 */
export async function runPhase4GeneratorQa(
	options: Phase4QaOptions = {},
): Promise<Phase4QaResult> {
	const runs = options.generatorRunsPerPreset ?? 3
	const checks: Phase4QaCheck[] = []
	const summaries: Phase4QaGeneratorPresetSummary[] = []

	for (const difficulty of PLAYABLE_DIFFICULTIES) {
		const times: number[] = []
		for (let i = 0; i < runs; i += 1) {
			const seed = hashSeedLabel(`phase4-qa-gen-${difficulty}-${i}`)
			const t0 = monotonicMs()
			let puzzle
			try {
				puzzle = generateKillerPuzzle({
					seed,
					difficultyPreset: difficulty,
				})
			} catch (error) {
				checks.push(
					check(
						`generator ${difficulty}#${i}`,
						false,
						error instanceof Error ? error.message : String(error),
					),
				)
				continue
			}
			const generationMs = monotonicMs() - t0
			times.push(generationMs)

			const validation = validateKillerPuzzle({
				solution: puzzle.solution,
				cages: puzzle.cages,
			})
			const solutions = countKillerSolutions(
				{ board: puzzle.board, cages: puzzle.cages },
				2,
				80_000,
			)
			const again = generateKillerPuzzle({
				seed,
				difficultyPreset: difficulty,
			})
			const deterministic =
				arraysEqual(again.board, puzzle.board) &&
				again.cages.length === puzzle.cages.length

			checks.push(
				check(
					`generator ${difficulty}#${i}`,
					validation.valid && solutions === 1 && deterministic,
					`ms=${generationMs.toFixed(0)} unique=${solutions} det=${deterministic}`,
				),
			)
		}

		times.sort((a, b) => a - b)
		summaries.push({
			difficulty,
			min: times[0] ?? 0,
			median: percentile(times, 50),
			max: times[times.length - 1] ?? 0,
			timesMs: times,
		})
	}

	for (const summary of summaries) {
		checks.push(
			check(
				`generator summary ${summary.difficulty}`,
				true,
				`min=${summary.min.toFixed(0)} median=${summary.median.toFixed(0)} max=${summary.max.toFixed(0)}`,
			),
		)
	}

	const passed = checks.every((item) => item.passed)
	return { passed, checks }
}

/**
 * Full Phase 4 QA (persistence + generator).
 */
export async function runPhase4Qa(
	options: Phase4QaOptions = {},
): Promise<Phase4QaResult> {
	const includeGenerator = options.includeGenerator !== false
	const persistence = await runPhase4PersistenceQa(options)
	const generator = includeGenerator
		? await runPhase4GeneratorQa(options)
		: { passed: true, checks: [] as Phase4QaCheck[] }

	const checks = [...persistence.checks, ...generator.checks]
	const passed = checks.every((item) => item.passed)
	const result: Phase4QaResult = { passed, checks }
	logPhase4QaSummary(result)
	return result
}

/** Human-readable console summary for Metro / Node. */
export function logPhase4QaSummary(result: Phase4QaResult): void {
	console.log('[Phase4QA] RESULT:', result.passed ? 'PASS' : 'FAIL')
	for (const item of result.checks) {
		const mark = item.passed ? '✓' : '✗'
		const details = item.details ? ` — ${item.details}` : ''
		console.log(`[Phase4QA] ${mark} ${item.name}${details}`)
	}
}
