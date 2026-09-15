import { findNextLogicalStep, solveLogically, WEIGHTS } from './logicalSolver'
import type { DifficultyGrade, LogicalPuzzle, TechniqueId } from './types'

export function gradeDifficulty(puzzle: LogicalPuzzle): DifficultyGrade {
	const result = solveLogically(puzzle)
	const techniqueCounts: Partial<Record<TechniqueId, number>> = {}
	let score = 0
	let hardestTechnique: TechniqueId | null = null
	for (const logicalStep of result.steps) {
		techniqueCounts[logicalStep.technique] = (techniqueCounts[logicalStep.technique] ?? 0) + 1
		score += logicalStep.difficultyWeight
		if (!hardestTechnique || WEIGHTS[logicalStep.technique] > WEIGHTS[hardestTechnique]) hardestTechnique = logicalStep.technique
	}
	if (!result.solved) return { level: 'unrated', score, hardestTechnique, stepCount: result.steps.length, techniqueCounts, solvedLogically: false }
	const advanced = (techniqueCounts.locked_candidate ?? 0) + (techniqueCounts.rule_of_45 ?? 0) + (techniqueCounts.cage_intersection ?? 0) + (techniqueCounts.innie_outie ?? 0)
	let level: DifficultyGrade['level'] = 'easy'
	if ((hardestTechnique && WEIGHTS[hardestTechnique] >= 8) || advanced >= 4) level = 'expert'
	else if ((hardestTechnique && WEIGHTS[hardestTechnique] >= 6) || advanced >= 2) level = 'hard'
	else if ((hardestTechnique && WEIGHTS[hardestTechnique] >= 4) || score >= 90) level = 'medium'
	return { level, score, hardestTechnique, stepCount: result.steps.length, techniqueCounts, solvedLogically: true }
}

export { findNextLogicalStep }
