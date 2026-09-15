/**
 * Calibrated Killer Sudoku puzzle generation (Phase 6 / 6P).
 *
 * seed → solved board → cages → uniqueness dig → grade calibrate → puzzle
 *
 * Search solver (`countKillerSolutions` / incremental dig) owns uniqueness.
 * Logical grader (`gradeDifficulty`) owns human difficulty acceptance.
 * Wrong grades and `unrated` are rejected — never silently remapped.
 */

import { createSeededRandom, shuffledCopy } from '../../utils/seededRandom'
import {
	getCagePreset,
	type Difficulty,
	type CageGenerationPreset,
} from '../difficulty'
import { gradeDifficulty } from '../logic'
import { generateSolvedBoard } from '../sudoku/generateSolvedBoard'
import {
	BOARD_CELLS,
	type SudokuBoard,
} from '../sudoku/types'
import { calibrateBoardToGrade, difficultyRank } from './calibrateGrade'
import { generateKillerCages } from './cageGenerator'
import { type KillerCage } from './cages'
import {
	createEmptyAttemptProfile,
	formatGenerationProfile,
	summarizeGenerationProfile,
	type GenerationAttemptProfile,
	type GenerationProfile,
} from './generationProfile'
import { digGivensIncremental, countKillerSolutions } from './solver'
import { validateKillerPuzzle } from './validator'
import { isValidSudoku } from '../sudoku/validation'

export interface GenerateKillerPuzzleOptions {
	seed: number
	difficultyPreset?: Difficulty
	preset?: CageGenerationPreset
	maxAttempts?: number
	/** When true, collect stage timings / call counters (dev + QA). */
	profile?: boolean
}

export interface KillerPuzzle {
	seed: number
	attempt: number
	difficultyPreset: Difficulty
	board: SudokuBoard
	solution: SudokuBoard
	cages: KillerCage[]
	/** Present when generateKillerPuzzle was called with profile: true. */
	profile?: GenerationProfile
}

export class KillerPuzzleGenerationError extends Error {
	readonly seed: number
	readonly attempts: number
	readonly targetDifficulty: Difficulty
	readonly profile?: GenerationProfile

	constructor(
		seed: number,
		attempts: number,
		targetDifficulty: Difficulty,
		message: string,
		profile?: GenerationProfile,
	) {
		super(message)
		this.name = 'KillerPuzzleGenerationError'
		this.seed = seed
		this.attempts = attempts
		this.targetDifficulty = targetDifficulty
		this.profile = profile
	}
}

/**
 * True when the known solution still satisfies the clue board + cages.
 * Cheaper than a full re-solve after uniqueness is already proven.
 */
function solutionMatchesPuzzle(
	solution: SudokuBoard,
	board: SudokuBoard,
	cages: readonly KillerCage[],
): boolean {
	if (!isValidSudoku(solution)) {
		return false
	}
	for (let i = 0; i < BOARD_CELLS; i += 1) {
		const clue = board[i] ?? 0
		if (clue !== 0 && clue !== solution[i]) {
			return false
		}
	}
	for (const cage of cages) {
		const digits = new Set<number>()
		let sum = 0
		for (const cell of cage.cells) {
			const digit = solution[cell] ?? 0
			if (digit < 1 || digit > 9 || digits.has(digit)) {
				return false
			}
			digits.add(digit)
			sum += digit
		}
		if (sum !== cage.sum) {
			return false
		}
	}
	return true
}

export interface DigGivensResult {
	board: SudokuBoard
	/** Cells successfully emptied, in dig order (first removed first). */
	removedCells: number[]
	candidateDigAttempts: number
	uniquenessChecks: number
}

/**
 * Dig givens from a full solution while uniqueness holds.
 * Records removal order so calibrateBoardToGrade can re-add deterministically.
 *
 * Stops early once gradeDifficulty is already at least as hard as `target`
 * (checked every few successful removals after a minimum empty count).
 */
export function digGivensWithOrder(
	solution: SudokuBoard,
	cages: readonly KillerCage[],
	seed: number,
	preset: CageGenerationPreset,
	target: Difficulty = preset.id,
): DigGivensResult {
	const rng = createSeededRandom(seed >>> 0)
	const order = shuffledCopy(
		Array.from({ length: BOARD_CELLS }, (_, index) => index),
		rng,
	)
	const targetRank = difficultyRank(target)
	// Do not grade until enough cells are empty — early boards are always Easy.
	const minEmptyBeforeGrade =
		target === 'easy'
			? Math.max(40, preset.maxEmptyCells - 8)
			: target === 'medium'
				? 52
				: target === 'hard'
					? 58
					: 62
	let lastGradeEmpty = -1

	const dug = digGivensIncremental(
		solution,
		cages,
		order,
		preset.maxEmptyCells,
		preset.digNodeLimit,
		(board, emptyCount) => {
			if (emptyCount < minEmptyBeforeGrade) {
				return false
			}
			// Grade at most every 4 new empties to limit logical-solver cost.
			if (lastGradeEmpty >= 0 && emptyCount - lastGradeEmpty < 4) {
				return false
			}
			lastGradeEmpty = emptyCount
			const grade = gradeDifficulty({ board, cages })
			const rank = difficultyRank(grade.level)
			// Exact target mid-dig: keep digging toward maxEmpty so Easy/Medium
			// do not stop with too many givens. Overshoot (harder/unrated) stops.
			if (rank > targetRank) {
				return true
			}
			if (
				grade.level === target &&
				emptyCount >= preset.maxEmptyCells - 2
			) {
				return true
			}
			return false
		},
	)
	return {
		board: dug.board,
		removedCells: dug.removedCells,
		candidateDigAttempts: dug.candidateDigAttempts,
		uniquenessChecks: dug.uniquenessChecks,
	}
}

/** Monotonic clock for generation instrumentation (dev + profiling). */
function monotonicMs(): number {
	if (
		typeof performance !== 'undefined' &&
		typeof performance.now === 'function'
	) {
		return performance.now()
	}
	return Date.now()
}

export type CalibratedAttemptResult =
	| { ok: true; puzzle: KillerPuzzle; profile: GenerationAttemptProfile }
	| {
			ok: false
			reason:
				| 'validation'
				| 'non-unique'
				| 'solver-mismatch'
				| 'rejected-unrated'
				| 'rejected-wrong-grade'
				| 'calibrate-mismatch'
				| 'error'
			detail?: string
			observedGrade?: string
			profile: GenerationAttemptProfile
	  }

/**
 * One deterministic proposal attempt for (baseSeed, attempt, preset).
 * Used by generateKillerPuzzle and calibrated yield analysis.
 */
export function tryCalibratedKillerAttempt(options: {
	baseSeed: number
	attempt: number
	preset: CageGenerationPreset
}): CalibratedAttemptResult {
	const { baseSeed, attempt, preset } = options
	const target = preset.id
	const boardSeed = (baseSeed + attempt * 0x9e3779b9) >>> 0
	const cageSeed = (baseSeed ^ (attempt * 0x85ebca6b)) >>> 0
	const digSeed = (baseSeed + attempt * 0xc2b2ae35) >>> 0
	const fillSeed = (baseSeed ^ (attempt * 0x27d4eb2d)) >>> 0
	const profile = createEmptyAttemptProfile(attempt)
	const attemptStarted = monotonicMs()

	try {
		let t0 = monotonicMs()
		const solution = generateSolvedBoard(boardSeed)
		profile.solvedBoardMs = monotonicMs() - t0

		t0 = monotonicMs()
		const cages = generateKillerCages(solution, cageSeed, { preset })
		profile.cageGenerationMs = monotonicMs() - t0

		t0 = monotonicMs()
		const validation = validateKillerPuzzle({ solution, cages })
		profile.validationMs = monotonicMs() - t0
		if (!validation.valid) {
			profile.totalMs = monotonicMs() - attemptStarted
			profile.rejectReason = 'validation'
			return {
				ok: false,
				reason: 'validation',
				detail: validation.errors.map((error) => error.code).join(','),
				profile,
			}
		}

		// Phase 6P: never run a full empty-board uniqueness search.
		// Cage-only puzzles are almost never unique, and the probe burned
		// tens of thousands of Hermes nodes before dig even started.
		t0 = monotonicMs()
		const dug = digGivensWithOrder(
			solution,
			cages,
			digSeed,
			preset,
			target,
		)
		profile.digMs = monotonicMs() - t0
		profile.uniquenessMs += profile.digMs
		profile.searchSolverCalls += dug.uniquenessChecks
		profile.uniquenessChecks += dug.uniquenessChecks
		profile.candidateDigAttempts += dug.candidateDigAttempts
		const board = dug.board
		const removedCells = dug.removedCells
		profile.initialPuzzleMs = 0

		t0 = monotonicMs()
		profile.searchSolverCalls += 1
		profile.uniquenessChecks += 1
		const solutionCount = countKillerSolutions(
			{ board, cages },
			2,
			preset.digNodeLimit,
		)
		profile.uniquenessMs += monotonicMs() - t0
		if (solutionCount !== 1) {
			profile.totalMs = monotonicMs() - attemptStarted
			profile.rejectReason = 'non-unique'
			return {
				ok: false,
				reason: 'non-unique',
				detail: String(solutionCount),
				profile,
			}
		}

		if (!solutionMatchesPuzzle(solution, board, cages)) {
			profile.totalMs = monotonicMs() - attemptStarted
			profile.rejectReason = 'solver-mismatch'
			return { ok: false, reason: 'solver-mismatch', profile }
		}

		t0 = monotonicMs()
		const calibrated = calibrateBoardToGrade({
			solution,
			cages,
			board,
			removedCells,
			target,
			fillSeed,
		})
		profile.calibrationMs = monotonicMs() - t0
		if (calibrated) {
			profile.logicalSolverCalls += calibrated.logicalSolverCalls
			profile.logicalGradeMs += profile.calibrationMs
		} else {
			profile.logicalSolverCalls += 1
			t0 = monotonicMs()
			const observed = gradeDifficulty({ board, cages }).level
			profile.logicalGradeMs += monotonicMs() - t0
			profile.totalMs = monotonicMs() - attemptStarted
			if (observed === 'unrated') {
				profile.rejectReason = 'rejected-unrated'
				return {
					ok: false,
					reason: 'rejected-unrated',
					observedGrade: observed,
					profile,
				}
			}
			profile.rejectReason = `rejected-wrong-grade:${observed}`
			return {
				ok: false,
				reason: 'rejected-wrong-grade',
				observedGrade: observed,
				profile,
			}
		}

		if (calibrated.grade === 'unrated') {
			profile.totalMs = monotonicMs() - attemptStarted
			profile.rejectReason = 'rejected-unrated'
			return {
				ok: false,
				reason: 'rejected-unrated',
				observedGrade: 'unrated',
				profile,
			}
		}

		if (calibrated.grade !== target) {
			profile.totalMs = monotonicMs() - attemptStarted
			profile.rejectReason = `rejected-wrong-grade:${calibrated.grade}`
			return {
				ok: false,
				reason: 'rejected-wrong-grade',
				observedGrade: calibrated.grade,
				profile,
			}
		}

		if (!solutionMatchesPuzzle(solution, calibrated.board, cages)) {
			profile.totalMs = monotonicMs() - attemptStarted
			profile.rejectReason = 'calibrate-mismatch'
			return { ok: false, reason: 'calibrate-mismatch', profile }
		}

		// Adding solution givens cannot create extra solutions; confirm cheaply.
		t0 = monotonicMs()
		profile.searchSolverCalls += 1
		profile.uniquenessChecks += 1
		const finalCount = countKillerSolutions(
			{ board: calibrated.board, cages },
			2,
			preset.digNodeLimit,
		)
		profile.uniquenessMs += monotonicMs() - t0
		if (finalCount !== 1) {
			profile.totalMs = monotonicMs() - attemptStarted
			profile.rejectReason = 'non-unique'
			return {
				ok: false,
				reason: 'non-unique',
				detail: `after-calibrate:${finalCount}`,
				profile,
			}
		}

		profile.accepted = true
		profile.totalMs = monotonicMs() - attemptStarted
		return {
			ok: true,
			puzzle: {
				seed: baseSeed,
				attempt,
				difficultyPreset: target,
				board: calibrated.board,
				solution,
				cages,
			},
			profile,
		}
	} catch (error) {
		profile.totalMs = monotonicMs() - attemptStarted
		profile.rejectReason = 'error'
		return {
			ok: false,
			reason: 'error',
			detail: error instanceof Error ? error.message : String(error),
			profile,
		}
	}
}

/**
 * Generate a validated unique Killer puzzle whose logical grade matches
 * the requested difficulty. Deterministic for the same seed + difficulty.
 */
export function generateKillerPuzzle(
	options: GenerateKillerPuzzleOptions,
): KillerPuzzle {
	const baseSeed = options.seed >>> 0
	const preset =
		options.preset ?? getCagePreset(options.difficultyPreset)
	const target = preset.id
	const maxAttempts = options.maxAttempts ?? preset.maxAttempts
	const wantProfile = options.profile === true
	const startedMs = monotonicMs()
	const attemptProfiles: GenerationAttemptProfile[] = []

	let lastError = 'unknown failure'

	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		const result = tryCalibratedKillerAttempt({
			baseSeed,
			attempt,
			preset,
		})
		attemptProfiles.push(result.profile)
		if (result.ok) {
			const generationMs = monotonicMs() - startedMs
			const profile = summarizeGenerationProfile(
				baseSeed,
				target,
				attemptProfiles,
				generationMs,
				true,
			)
			if (typeof __DEV__ !== 'undefined' && __DEV__) {
				console.log(
					`[KILLER_GEN] difficulty=${target} seed=${baseSeed} attempt=${attempt} generationMs=${generationMs.toFixed(1)} grade=${target}`,
				)
				if (wantProfile) {
					console.log(formatGenerationProfile(profile))
				}
			}
			return wantProfile
				? { ...result.puzzle, profile }
				: result.puzzle
		}

		lastError =
			result.reason === 'rejected-wrong-grade'
				? `rejected-wrong-grade:${result.observedGrade ?? '?'}`
				: result.reason === 'rejected-unrated'
					? 'rejected-unrated'
					: result.detail
						? `${result.reason}:${result.detail}`
						: result.reason
	}

	const failProfile = summarizeGenerationProfile(
		baseSeed,
		target,
		attemptProfiles,
		monotonicMs() - startedMs,
		false,
	)
	throw new KillerPuzzleGenerationError(
		baseSeed,
		maxAttempts,
		target,
		`Failed to generate graded Killer puzzle target=${target} seed=${baseSeed} after ${maxAttempts} attempts (${lastError})`,
		failProfile,
	)
}
