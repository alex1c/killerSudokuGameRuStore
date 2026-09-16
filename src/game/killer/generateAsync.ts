/**
 * Cooperative (async) calibrated Killer generation for background pool fill.
 * Math matches generateKillerPuzzle; yields between dig probes and attempts.
 */

import { createSeededRandom, shuffledCopy } from '../../utils/seededRandom'
import {
	getCagePreset,
	type Difficulty,
	type CageGenerationPreset,
} from '../difficulty'
import { gradeDifficulty } from '../logic'
import { generateSolvedBoard } from '../sudoku/generateSolvedBoard'
import { BOARD_CELLS, type SudokuBoard } from '../sudoku/types'
import { calibrateBoardToGrade, difficultyRank } from './calibrateGrade'
import { generateKillerCages } from './cageGenerator'
import type { KillerCage } from './cages'
import {
	GenerationCancelledError,
	yieldToEventLoop,
	type GenerationCancelToken,
} from './cooperative'
import {
	createEmptyAttemptProfile,
	summarizeGenerationProfile,
	type GenerationAttemptProfile,
} from './generationProfile'
import {
	KillerPuzzleGenerationError,
	type GenerateKillerPuzzleOptions,
	type KillerPuzzle,
} from './generateKillerPuzzle'
import {
	countKillerSolutions,
	digGivensIncrementalAsync,
} from './solver'
import { validateKillerPuzzle } from './validator'
import { isValidSudoku } from '../sudoku/validation'

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

function buildDigShouldStop(
	cages: readonly KillerCage[],
	preset: CageGenerationPreset,
	target: Difficulty,
): (board: SudokuBoard, emptyCount: number) => boolean {
	const targetRank = difficultyRank(target)
	const minEmptyBeforeGrade =
		target === 'easy'
			? Math.max(40, preset.maxEmptyCells - 8)
			: target === 'medium'
				? 52
				: target === 'hard'
					? 58
					: 62
	let lastGradeEmpty = -1
	return (board, emptyCount) => {
		if (emptyCount < minEmptyBeforeGrade) {
			return false
		}
		if (lastGradeEmpty >= 0 && emptyCount - lastGradeEmpty < 4) {
			return false
		}
		lastGradeEmpty = emptyCount
		const grade = gradeDifficulty({ board, cages })
		const rank = difficultyRank(grade.level)
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
	}
}

export interface GenerateKillerPuzzleAsyncOptions
	extends GenerateKillerPuzzleOptions {
	cancelToken?: GenerationCancelToken
	/** Dig uniqueness probes between yields (default 3). */
	digYieldEvery?: number
}

/**
 * Same acceptance rules as generateKillerPuzzle, with cooperative yields.
 */
export async function generateKillerPuzzleAsync(
	options: GenerateKillerPuzzleAsyncOptions,
): Promise<KillerPuzzle> {
	const baseSeed = options.seed >>> 0
	const preset =
		options.preset ?? getCagePreset(options.difficultyPreset)
	const target = preset.id
	const maxAttempts = options.maxAttempts ?? preset.maxAttempts
	const cancelToken = options.cancelToken
	const digYieldEvery = options.digYieldEvery ?? 3
	const attemptProfiles: GenerationAttemptProfile[] = []
	const startedMs =
		typeof performance !== 'undefined' && performance.now
			? performance.now()
			: Date.now()

	let lastError = 'unknown failure'

	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		if (cancelToken?.cancelled) {
			throw new GenerationCancelledError()
		}

		const result = await tryCalibratedKillerAttemptAsync({
			baseSeed,
			attempt,
			preset,
			cancelToken,
			digYieldEvery,
		})
		attemptProfiles.push(result.profile)

		if (result.ok) {
			if (typeof __DEV__ !== 'undefined' && __DEV__) {
				const generationMs =
					(typeof performance !== 'undefined' && performance.now
						? performance.now()
						: Date.now()) - startedMs
				console.log(
					`[KILLER_GEN_ASYNC] difficulty=${target} seed=${baseSeed} attempt=${attempt} generationMs=${generationMs.toFixed(1)}`,
				)
			}
			return result.puzzle
		}

		lastError =
			result.reason === 'rejected-wrong-grade'
				? `rejected-wrong-grade:${result.observedGrade ?? '?'}`
				: result.reason === 'rejected-unrated'
					? 'rejected-unrated'
					: result.detail
						? `${result.reason}:${result.detail}`
						: result.reason

		await yieldToEventLoop()
	}

	throw new KillerPuzzleGenerationError(
		baseSeed,
		maxAttempts,
		target,
		`Failed to generate graded Killer puzzle target=${target} seed=${baseSeed} after ${maxAttempts} attempts (${lastError})`,
		summarizeGenerationProfile(
			baseSeed,
			target,
			attemptProfiles,
			(typeof performance !== 'undefined' && performance.now
				? performance.now()
				: Date.now()) - startedMs,
			false,
		),
	)
}

async function tryCalibratedKillerAttemptAsync(options: {
	baseSeed: number
	attempt: number
	preset: CageGenerationPreset
	cancelToken?: GenerationCancelToken
	digYieldEvery: number
}): Promise<
	| { ok: true; puzzle: KillerPuzzle; profile: GenerationAttemptProfile }
	| {
			ok: false
			reason: string
			detail?: string
			observedGrade?: string
			profile: GenerationAttemptProfile
	  }
> {
	const { baseSeed, attempt, preset, cancelToken, digYieldEvery } = options
	const target = preset.id
	const boardSeed = (baseSeed + attempt * 0x9e3779b9) >>> 0
	const cageSeed = (baseSeed ^ (attempt * 0x85ebca6b)) >>> 0
	const digSeed = (baseSeed + attempt * 0xc2b2ae35) >>> 0
	const fillSeed = (baseSeed ^ (attempt * 0x27d4eb2d)) >>> 0
	const profile = createEmptyAttemptProfile(attempt)
	const now = () =>
		typeof performance !== 'undefined' && performance.now
			? performance.now()
			: Date.now()
	const attemptStarted = now()

	const throwIfCancelled = () => {
		if (cancelToken?.cancelled) {
			throw new GenerationCancelledError()
		}
	}

	try {
		throwIfCancelled()
		const solution = generateSolvedBoard(boardSeed)
		await yieldToEventLoop()
		throwIfCancelled()

		const cages = generateKillerCages(solution, cageSeed, { preset })
		const validation = validateKillerPuzzle({ solution, cages })
		if (!validation.valid) {
			profile.totalMs = now() - attemptStarted
			profile.rejectReason = 'validation'
			return {
				ok: false,
				reason: 'validation',
				detail: validation.errors.map((e) => e.code).join(','),
				profile,
			}
		}

		await yieldToEventLoop()
		throwIfCancelled()

		const rng = createSeededRandom(digSeed >>> 0)
		const order = shuffledCopy(
			Array.from({ length: BOARD_CELLS }, (_, index) => index),
			rng,
		)
		const dug = await digGivensIncrementalAsync(
			solution,
			cages,
			order,
			preset.maxEmptyCells,
			preset.digNodeLimit,
			buildDigShouldStop(cages, preset, target),
			{
				yieldEvery: digYieldEvery,
				onYield: async () => {
					throwIfCancelled()
					await yieldToEventLoop()
				},
				isCancelled: () => cancelToken?.cancelled === true,
			},
		)
		profile.candidateDigAttempts = dug.candidateDigAttempts
		profile.uniquenessChecks = dug.uniquenessChecks
		profile.searchSolverCalls += dug.uniquenessChecks

		if (cancelToken?.cancelled) {
			throw new GenerationCancelledError()
		}

		await yieldToEventLoop()
		throwIfCancelled()

		profile.searchSolverCalls += 1
		profile.uniquenessChecks += 1
		const solutionCount = countKillerSolutions(
			{ board: dug.board, cages },
			2,
			preset.digNodeLimit,
		)
		if (solutionCount !== 1) {
			profile.totalMs = now() - attemptStarted
			profile.rejectReason = 'non-unique'
			return {
				ok: false,
				reason: 'non-unique',
				detail: String(solutionCount),
				profile,
			}
		}

		if (!solutionMatchesPuzzle(solution, dug.board, cages)) {
			profile.totalMs = now() - attemptStarted
			profile.rejectReason = 'solver-mismatch'
			return { ok: false, reason: 'solver-mismatch', profile }
		}

		await yieldToEventLoop()
		throwIfCancelled()

		const calibrated = calibrateBoardToGrade({
			solution,
			cages,
			board: dug.board,
			removedCells: dug.removedCells,
			target,
			fillSeed,
		})
		if (calibrated) {
			profile.logicalSolverCalls += calibrated.logicalSolverCalls
		}

		if (calibrated === null) {
			profile.logicalSolverCalls += 1
			const observed = gradeDifficulty({
				board: dug.board,
				cages,
			}).level
			profile.totalMs = now() - attemptStarted
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

		if (calibrated.grade !== target) {
			profile.totalMs = now() - attemptStarted
			profile.rejectReason = `rejected-wrong-grade:${calibrated.grade}`
			return {
				ok: false,
				reason: 'rejected-wrong-grade',
				observedGrade: calibrated.grade,
				profile,
			}
		}

		if (!solutionMatchesPuzzle(solution, calibrated.board, cages)) {
			profile.totalMs = now() - attemptStarted
			profile.rejectReason = 'calibrate-mismatch'
			return { ok: false, reason: 'calibrate-mismatch', profile }
		}

		await yieldToEventLoop()
		throwIfCancelled()

		profile.searchSolverCalls += 1
		profile.uniquenessChecks += 1
		const finalCount = countKillerSolutions(
			{ board: calibrated.board, cages },
			2,
			preset.digNodeLimit,
		)
		if (finalCount !== 1) {
			profile.totalMs = now() - attemptStarted
			profile.rejectReason = 'non-unique'
			return {
				ok: false,
				reason: 'non-unique',
				detail: `after-calibrate:${finalCount}`,
				profile,
			}
		}

		profile.accepted = true
		profile.totalMs = now() - attemptStarted
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
		if (error instanceof GenerationCancelledError) {
			throw error
		}
		profile.totalMs = now() - attemptStarted
		profile.rejectReason = 'error'
		return {
			ok: false,
			reason: 'error',
			detail: error instanceof Error ? error.message : String(error),
			profile,
		}
	}
}
