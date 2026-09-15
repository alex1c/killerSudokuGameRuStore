import { generateKillerPuzzle, validateKillerPuzzle } from '../src/game/killer'
import { PLAYABLE_DIFFICULTIES, type Difficulty } from '../src/game/difficulty'
import { gradeDifficulty, solveLogically, type DifficultyLevel, type TechniqueId } from '../src/game/logic'

const PER_PRESET = Number(process.env.KILLER_ANALYZE_PER_PRESET ?? '100')
const levels: DifficultyLevel[] = ['easy', 'medium', 'hard', 'expert', 'unrated']
const techniques: TechniqueId[] = ['naked_single', 'hidden_single', 'cage_single', 'cage_combination', 'cage_candidate_elimination', 'locked_candidate', 'rule_of_45', 'cage_intersection', 'innie_outie']

function percentile(values: number[], fraction: number): number {
	if (!values.length) return 0
	const sorted = values.slice().sort((a, b) => a - b)
	return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))]!
}

function main(): void {
	const started = performance.now()
	const matrix: Record<Difficulty, Record<DifficultyLevel, number>> = Object.fromEntries(PLAYABLE_DIFFICULTIES.map((difficulty) => [difficulty, Object.fromEntries(levels.map((level) => [level, 0]))])) as Record<Difficulty, Record<DifficultyLevel, number>>
	const hardest: Record<string, number> = Object.fromEntries([...techniques, 'stalled'].map((technique) => [technique, 0]))
	const times: number[] = []
	let generated = 0
	let solved = 0
	let stalled = 0

	for (const difficulty of PLAYABLE_DIFFICULTIES) {
		for (let index = 0; index < PER_PRESET; index += 1) {
			const seed = (700000 + difficulty.length * 10000 + index) >>> 0
			const puzzle = generateKillerPuzzle({ seed, difficultyPreset: difficulty })
			const validation = validateKillerPuzzle({ solution: puzzle.solution, cages: puzzle.cages })
			if (!validation.valid) throw new Error(`${difficulty} seed=${seed} failed authoritative validation`)
			const gradingStarted = performance.now()
			const result = solveLogically(puzzle)
			const grade = gradeDifficulty(puzzle)
			times.push(performance.now() - gradingStarted)
			matrix[difficulty][grade.level] += 1
			generated += 1
			if (result.solved) solved += 1
			else { stalled += 1; hardest.stalled = (hardest.stalled ?? 0) + 1 }
			for (const logicalStep of result.steps) {
				hardest[logicalStep.technique] = (hardest[logicalStep.technique] ?? 0) + 1
				for (const placement of logicalStep.placements) if (placement.digit !== puzzle.solution[placement.cell]) throw new Error(`${difficulty} seed=${seed} invalid logical placement`)
			}
			if (result.finalState.values.some((value, cell) => value === 0 && result.finalState.candidates[cell] === 0)) throw new Error(`${difficulty} seed=${seed} empty candidate set`)
		}
	}

	console.log(`generated=${generated} solvedLogically=${solved} stalled=${stalled}`)
	console.log('confusion matrix:')
	console.log('preset | E | M | H | X | unrated')
	for (const difficulty of PLAYABLE_DIFFICULTIES) console.log(`${difficulty} | ${matrix[difficulty].easy} | ${matrix[difficulty].medium} | ${matrix[difficulty].hard} | ${matrix[difficulty].expert} | ${matrix[difficulty].unrated}`)
	console.log('hardest technique distribution:', hardest)
	console.log(`grading performance ms: mean=${(times.reduce((sum, value) => sum + value, 0) / Math.max(1, times.length)).toFixed(2)} median=${percentile(times, 0.5).toFixed(2)} p90=${percentile(times, 0.9).toFixed(2)} max=${percentile(times, 1).toFixed(2)}`)
	console.log(`elapsed=${Math.round(performance.now() - started)}ms perPreset=${PER_PRESET}`)
	if (generated !== PLAYABLE_DIFFICULTIES.length * PER_PRESET) process.exitCode = 1
}

main()
