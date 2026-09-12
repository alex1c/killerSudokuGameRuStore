/**
 * Difficulty foundation for Phase 4.
 * Presets change generation shape — they are NOT a proven human difficulty grader.
 */

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'

/** UI-facing difficulties (Master reserved for a future grader phase). */
export const PLAYABLE_DIFFICULTIES: readonly Difficulty[] = [
	'easy',
	'medium',
	'hard',
	'expert',
] as const

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
	easy: 'Легко',
	medium: 'Средне',
	hard: 'Сложно',
	expert: 'Эксперт',
}

/**
 * Cage-generation + dig knobs used by the puzzle generator.
 * These tune layout/givens — they do not claim human-rated difficulty.
 */
export interface CageGenerationPreset {
	id: Difficulty
	minSize: number
	maxSize: number
	/** Relative weights for sizes minSize..maxSize. */
	sizeWeights: number[]
	maxAttempts: number
	allowSingletons: boolean
	/**
	 * Stop digging once this many empty cells are reached.
	 * Higher = fewer givens (usually harder / slower dig).
	 */
	maxEmptyCells: number
	/** Node budget for cage-only uniqueness probe. */
	cageOnlyNodeLimit: number
	/** Node budget for each dig uniqueness check. */
	digNodeLimit: number
}

/**
 * Default medium profile — pair-biased cages, moderate dig depth.
 */
export const DEFAULT_CAGE_PRESET: CageGenerationPreset = {
	id: 'medium',
	minSize: 2,
	maxSize: 4,
	sizeWeights: [70, 25, 5],
	maxAttempts: 40,
	allowSingletons: false,
	maxEmptyCells: 62,
	cageOnlyNodeLimit: 40_000,
	digNodeLimit: 18_000,
}

/**
 * Named generation profiles. Not a human difficulty grader.
 */
export const CAGE_PRESETS: Record<Difficulty, CageGenerationPreset> = {
	easy: {
		id: 'easy',
		minSize: 2,
		maxSize: 3,
		sizeWeights: [75, 25],
		maxAttempts: 35,
		allowSingletons: false,
		maxEmptyCells: 48,
		cageOnlyNodeLimit: 30_000,
		digNodeLimit: 12_000,
	},
	medium: DEFAULT_CAGE_PRESET,
	hard: {
		id: 'hard',
		minSize: 2,
		maxSize: 5,
		sizeWeights: [40, 35, 18, 7],
		maxAttempts: 45,
		allowSingletons: false,
		maxEmptyCells: 68,
		cageOnlyNodeLimit: 50_000,
		digNodeLimit: 22_000,
	},
	expert: {
		id: 'expert',
		minSize: 2,
		maxSize: 5,
		sizeWeights: [30, 35, 25, 10],
		maxAttempts: 50,
		allowSingletons: false,
		maxEmptyCells: 74,
		cageOnlyNodeLimit: 60_000,
		digNodeLimit: 25_000,
	},
}

export function getCagePreset(difficulty?: Difficulty): CageGenerationPreset {
	if (!difficulty) {
		return DEFAULT_CAGE_PRESET
	}
	return CAGE_PRESETS[difficulty]
}
