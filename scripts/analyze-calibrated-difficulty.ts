/**
 * Phase 6 calibrated difficulty analysis.
 *
 * Generates N accepted puzzles per target grade and reports yield,
 * attempts, timing, givens, and hardest-technique distribution.
 *
 * Usage: npm run analyze:calibrated-difficulty
 */

import {
	tryCalibratedKillerAttempt,
	validateKillerPuzzle,
	countKillerSolutions,
	type KillerPuzzle,
} from '../src/game/killer'
import {
	PLAYABLE_DIFFICULTIES,
	CAGE_PRESETS,
	type Difficulty,
} from '../src/game/difficulty'
import { gradeDifficulty, type TechniqueId } from '../src/game/logic'

const ACCEPTED_TARGET = Number(
	process.env.KILLER_CALIBRATED_ACCEPTED ?? '100',
)

const TECHNIQUES: TechniqueId[] = [
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

interface TargetStats {
	target: Difficulty
	candidates: number
	accepted: number
	rejectedWrongGrade: number
	rejectedUnrated: number
	otherRejects: number
	attemptsToAccept: number[]
	timesMs: number[]
	givens: number[]
	cageOnly: number
	hardest: Record<string, number>
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

function emptyHardest(): Record<string, number> {
	const hardest: Record<string, number> = { none: 0 }
	for (const technique of TECHNIQUES) {
		hardest[technique] = 0
	}
	return hardest
}

function acceptPuzzle(
	stats: TargetStats,
	puzzle: KillerPuzzle,
	presetDigLimit: number,
	elapsedMs: number,
	attemptsUsed: number,
): void {
	const validation = validateKillerPuzzle({
		solution: puzzle.solution,
		cages: puzzle.cages,
	})
	if (!validation.valid) {
		throw new Error(`invalid accepted puzzle seed=${puzzle.seed}`)
	}
	const unique = countKillerSolutions(
		{ board: puzzle.board, cages: puzzle.cages },
		2,
		presetDigLimit * 2,
	)
	if (unique !== 1) {
		throw new Error(`non-unique accepted seed=${puzzle.seed}`)
	}
	const grade = gradeDifficulty({
		board: puzzle.board,
		cages: puzzle.cages,
	})
	if (grade.level !== stats.target) {
		throw new Error(
			`grade mismatch seed=${puzzle.seed} expected=${stats.target} got=${grade.level}`,
		)
	}

	stats.accepted += 1
	stats.attemptsToAccept.push(attemptsUsed)
	stats.timesMs.push(elapsedMs)
	const givenCount = puzzle.board.filter((value) => value !== 0).length
	stats.givens.push(givenCount)
	if (givenCount === 0) {
		stats.cageOnly += 1
	}
	const hardestKey = grade.hardestTechnique ?? 'none'
	stats.hardest[hardestKey] = (stats.hardest[hardestKey] ?? 0) + 1
}

function analyzeTarget(target: Difficulty): TargetStats {
	const preset = CAGE_PRESETS[target]
	const maxAttempts = preset.maxAttempts
	const stats: TargetStats = {
		target,
		candidates: 0,
		accepted: 0,
		rejectedWrongGrade: 0,
		rejectedUnrated: 0,
		otherRejects: 0,
		attemptsToAccept: [],
		timesMs: [],
		givens: [],
		cageOnly: 0,
		hardest: emptyHardest(),
	}

	let seedIndex = 0
	while (stats.accepted < ACCEPTED_TARGET) {
		const baseSeed =
			(1_200_000 + target.length * 50_000 + seedIndex) >>> 0
		seedIndex += 1

		const t0 = performance.now()
		let acceptedThisSeed = false
		for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
			stats.candidates += 1
			const result = tryCalibratedKillerAttempt({
				baseSeed,
				attempt,
				preset,
			})
			if (result.ok) {
				acceptPuzzle(
					stats,
					result.puzzle,
					preset.digNodeLimit,
					performance.now() - t0,
					attempt + 1,
				)
				acceptedThisSeed = true
				break
			}
			if (result.reason === 'rejected-wrong-grade') {
				stats.rejectedWrongGrade += 1
			} else if (result.reason === 'rejected-unrated') {
				stats.rejectedUnrated += 1
			} else {
				stats.otherRejects += 1
			}
		}

		if (!acceptedThisSeed) {
			stats.timesMs.push(performance.now() - t0)
		}

		if (seedIndex > ACCEPTED_TARGET * 40) {
			break
		}
	}

	return stats
}

function printTarget(stats: TargetStats): void {
	const attempts = stats.attemptsToAccept.slice().sort((a, b) => a - b)
	const times = stats.timesMs.slice().sort((a, b) => a - b)
	const givens = stats.givens
	const avgGivens =
		givens.reduce((sum, value) => sum + value, 0) /
		Math.max(1, givens.length)
	const acceptance =
		stats.candidates === 0
			? 0
			: (stats.accepted / stats.candidates) * 100
	const cageOnlyPct =
		stats.accepted === 0
			? 0
			: (stats.cageOnly / stats.accepted) * 100

	console.log(`\n=== ${stats.target.toUpperCase()} ===`)
	console.log(
		`accepted=${stats.accepted} candidates=${stats.candidates} acceptance=${acceptance.toFixed(1)}%`,
	)
	console.log(
		`rejectedWrongGrade=${stats.rejectedWrongGrade} rejectedUnrated=${stats.rejectedUnrated} otherRejects=${stats.otherRejects}`,
	)
	console.log(
		`attempts median=${percentile(attempts, 50).toFixed(0)} p90=${percentile(attempts, 90).toFixed(0)} max=${percentile(attempts, 100).toFixed(0)}`,
	)
	console.log(
		`timeMs median=${percentile(times, 50).toFixed(0)} p90=${percentile(times, 90).toFixed(0)} max=${percentile(times, 100).toFixed(0)}`,
	)
	console.log(
		`avgGivens=${avgGivens.toFixed(1)} cageOnly%=${cageOnlyPct.toFixed(0)}`,
	)
	console.log('hardestTechnique:', stats.hardest)
}

function main(): void {
	const started = performance.now()
	console.log(
		`analyze:calibrated-difficulty acceptedTarget=${ACCEPTED_TARGET}`,
	)

	const all: TargetStats[] = []
	for (const target of PLAYABLE_DIFFICULTIES) {
		const stats = analyzeTarget(target)
		all.push(stats)
		printTarget(stats)
		if (stats.accepted < ACCEPTED_TARGET) {
			console.error(
				`INCOMPLETE ${target}: only ${stats.accepted}/${ACCEPTED_TARGET}`,
			)
			process.exitCode = 1
		}
	}

	console.log('\n=== SUMMARY TABLE ===')
	console.log(
		'Target | Accepted | Candidates | Acceptance | Median attempts | P90 attempts',
	)
	for (const stats of all) {
		const attempts = stats.attemptsToAccept
			.slice()
			.sort((a, b) => a - b)
		const acceptance =
			stats.candidates === 0
				? 0
				: (stats.accepted / stats.candidates) * 100
		console.log(
			`${stats.target} | ${stats.accepted} | ${stats.candidates} | ${acceptance.toFixed(1)}% | ${percentile(attempts, 50).toFixed(0)} | ${percentile(attempts, 90).toFixed(0)}`,
		)
	}

	console.log(`\nelapsed=${Math.round(performance.now() - started)}ms`)
}

main()
