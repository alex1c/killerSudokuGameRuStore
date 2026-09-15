/**
 * Development-only Generator Performance QA (Phase 6P).
 *
 * Times calibrated generateKillerPuzzle on the real JS engine (Hermes on
 * Android). Metro bundling / navigation are excluded — the timer wraps only
 * the generation call.
 */

import {
	PLAYABLE_DIFFICULTIES,
	type Difficulty,
} from '../game/difficulty'
import {
	countKillerSolutions,
	formatGenerationProfile,
	generateKillerPuzzle,
	validateKillerPuzzle,
	type GenerationProfile,
} from '../game/killer'
import { gradeDifficulty } from '../game/logic'
import { hashSeedLabel } from '../gameplay'
import type { Phase4QaCheck, Phase4QaResult } from './phase4Qa'

/** Default run counts: Easy×3 Medium×3 Hard×5 Expert×5. */
export const GENERATOR_PERF_RUNS: Record<Difficulty, number> = {
	easy: 3,
	medium: 3,
	hard: 5,
	expert: 5,
}

export interface GeneratorPerfRunRow {
	difficulty: Difficulty
	seed: number
	generationMs: number
	attempt: number
	grade: string
	givens: number
	profile?: GenerationProfile
}

export interface GeneratorPerfPresetSummary {
	difficulty: Difficulty
	runs: number
	medianMs: number
	p90Ms: number
	maxMs: number
	medianAttempts: number
	avgGivens: number
	avgSearchSolverCalls: number
	avgLogicalSolverCalls: number
	avgDigMs: number
	avgUniquenessMs: number
	avgGradeMs: number
}

export interface GeneratorPerfQaResult extends Phase4QaResult {
	rows: GeneratorPerfRunRow[]
	summaries: GeneratorPerfPresetSummary[]
}

export interface GeneratorPerfQaOptions {
	runsPerDifficulty?: Partial<Record<Difficulty, number>>
	/** Yield to the event loop between runs (keeps Metro UI responsive). */
	yieldBetweenRuns?: boolean
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

function check(
	name: string,
	passed: boolean,
	details?: string,
): Phase4QaCheck {
	return details === undefined ? { name, passed } : { name, passed, details }
}

function yieldTick(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0)
	})
}

/**
 * Run calibrated generation benchmarks with stage profiles.
 * Timer starts immediately before generateKillerPuzzle and ends after return.
 */
export async function runGeneratorPerfQa(
	options: GeneratorPerfQaOptions = {},
): Promise<GeneratorPerfQaResult> {
	const yieldBetween = options.yieldBetweenRuns !== false
	const checks: Phase4QaCheck[] = []
	const rows: GeneratorPerfRunRow[] = []
	const summaries: GeneratorPerfPresetSummary[] = []

	for (const difficulty of PLAYABLE_DIFFICULTIES) {
		const runs =
			options.runsPerDifficulty?.[difficulty] ??
			GENERATOR_PERF_RUNS[difficulty]
		const times: number[] = []
		const attempts: number[] = []
		const givensList: number[] = []
		let searchSum = 0
		let logicalSum = 0
		let digSum = 0
		let uniqSum = 0
		let gradeSum = 0

		for (let i = 0; i < runs; i += 1) {
			const seed = hashSeedLabel(
				`gen-perf-qa-${difficulty}-${i}`,
			)
			const t0 = monotonicMs()
			let puzzle
			try {
				puzzle = generateKillerPuzzle({
					seed,
					difficultyPreset: difficulty,
					profile: true,
				})
			} catch (error) {
				checks.push(
					check(
						`perf ${difficulty}#${i}`,
						false,
						error instanceof Error
							? error.message
							: String(error),
					),
				)
				if (yieldBetween) {
					await yieldTick()
				}
				continue
			}
			const generationMs = monotonicMs() - t0

			const grade = gradeDifficulty({
				board: puzzle.board,
				cages: puzzle.cages,
			})
			const validation = validateKillerPuzzle({
				solution: puzzle.solution,
				cages: puzzle.cages,
			})
			const solutions = countKillerSolutions(
				{ board: puzzle.board, cages: puzzle.cages },
				2,
				80_000,
			)
			const givens = puzzle.board.filter((v) => v !== 0).length
			const gradeOk = grade.level === difficulty
			const ok =
				validation.valid &&
				solutions === 1 &&
				gradeOk &&
				grade.solvedLogically

			times.push(generationMs)
			attempts.push(puzzle.attempt)
			givensList.push(givens)
			if (puzzle.profile) {
				searchSum += puzzle.profile.totals.searchSolverCalls
				logicalSum += puzzle.profile.totals.logicalSolverCalls
				digSum += puzzle.profile.totals.digMs
				uniqSum += puzzle.profile.totals.uniquenessMs
				gradeSum += puzzle.profile.totals.logicalGradeMs
			}

			rows.push({
				difficulty,
				seed,
				generationMs,
				attempt: puzzle.attempt,
				grade: grade.level,
				givens,
				profile: puzzle.profile,
			})

			checks.push(
				check(
					`perf ${difficulty}#${i}`,
					ok,
					`ms=${generationMs.toFixed(0)} grade=${grade.level} givens=${givens} attempt=${puzzle.attempt} digMs=${puzzle.profile?.totals.digMs.toFixed(0) ?? '?'} uniqMs=${puzzle.profile?.totals.uniquenessMs.toFixed(0) ?? '?'} gradeMs=${puzzle.profile?.totals.logicalGradeMs.toFixed(0) ?? '?'} searchCalls=${puzzle.profile?.totals.searchSolverCalls ?? '?'}`,
				),
			)

			if (
				typeof __DEV__ !== 'undefined' &&
				__DEV__ &&
				puzzle.profile
			) {
				console.log(formatGenerationProfile(puzzle.profile))
			}

			if (yieldBetween) {
				await yieldTick()
			}
		}

		times.sort((a, b) => a - b)
		attempts.sort((a, b) => a - b)
		const n = times.length || 1
		summaries.push({
			difficulty,
			runs: times.length,
			medianMs: percentile(times, 50),
			p90Ms: percentile(times, 90),
			maxMs: times[times.length - 1] ?? 0,
			medianAttempts: percentile(attempts, 50),
			avgGivens:
				givensList.reduce((a, b) => a + b, 0) /
				(givensList.length || 1),
			avgSearchSolverCalls: searchSum / n,
			avgLogicalSolverCalls: logicalSum / n,
			avgDigMs: digSum / n,
			avgUniquenessMs: uniqSum / n,
			avgGradeMs: gradeSum / n,
		})
	}

	for (const summary of summaries) {
		checks.push(
			check(
				`perf summary ${summary.difficulty}`,
				true,
				`n=${summary.runs} median=${summary.medianMs.toFixed(0)} p90=${summary.p90Ms.toFixed(0)} max=${summary.maxMs.toFixed(0)} dig=${summary.avgDigMs.toFixed(0)} uniq=${summary.avgUniquenessMs.toFixed(0)} grade=${summary.avgGradeMs.toFixed(0)} searchCalls=${summary.avgSearchSolverCalls.toFixed(0)} givens=${summary.avgGivens.toFixed(1)}`,
			),
		)
	}

	const passed = checks.every((item) => item.passed)
	const result: GeneratorPerfQaResult = {
		passed,
		checks,
		rows,
		summaries,
	}
	logGeneratorPerfQaSummary(result)
	return result
}

export function logGeneratorPerfQaSummary(
	result: GeneratorPerfQaResult,
): void {
	console.log(
		'[GeneratorPerfQA] RESULT:',
		result.passed ? 'PASS' : 'FAIL',
	)
	console.log(
		'[GeneratorPerfQA] Timer wraps generateKillerPuzzle only (Metro excluded).',
	)
	for (const item of result.checks) {
		const mark = item.passed ? '✓' : '✗'
		const details = item.details ? ` — ${item.details}` : ''
		console.log(`[GeneratorPerfQA] ${mark} ${item.name}${details}`)
	}
}
