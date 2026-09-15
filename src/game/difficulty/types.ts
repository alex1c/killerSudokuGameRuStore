/**
 * Difficulty generation profiles for Phase 6.
 *
 * Presets shape cage layouts and dig depth so gradeDifficulty() can accept
 * the requested human grade. Thresholds themselves are owned by the grader.
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
 * Cage-generation + dig knobs used by the calibrated puzzle generator.
 * Profiles are tuned for yield into gradeDifficulty — not a second grader.
 */
export interface CageGenerationPreset {
	id: Difficulty
	minSize: number
	maxSize: number
	/** Relative weights for sizes minSize..maxSize. */
	sizeWeights: number[]
	/**
	 * Bounded proposal attempts (each attempt = cages + dig + grade calibrate).
	 * Includes wrong-grade / unrated rejects.
	 */
	maxAttempts: number
	allowSingletons: boolean
	/**
	 * Dig until this many empty cells (while uniqueness holds).
	 * Deeper digs produce harder logical grades; givens may be re-added
	 * afterward to land exactly on the requested grade.
	 */
	maxEmptyCells: number
	/** Node budget for cage-only uniqueness probe. */
	cageOnlyNodeLimit: number
	/** Node budget for each dig uniqueness check. */
	digNodeLimit: number
}

/**
 * Default medium proposal profile — larger cages / deeper dig, then
 * calibrate downward with givens until gradeDifficulty === medium.
 */
export const DEFAULT_CAGE_PRESET: CageGenerationPreset = {
	id: 'medium',
	minSize: 2,
	maxSize: 5,
	sizeWeights: [40, 35, 18, 7],
	maxAttempts: 30,
	allowSingletons: false,
	maxEmptyCells: 70,
	cageOnlyNodeLimit: 80_000,
	digNodeLimit: 28_000,
}

/**
 * Proposal profiles tuned so grade-filtered acceptance is frequent enough
 * for mobile (see Phase 6 acceptance-rate targets).
 */
export const CAGE_PRESETS: Record<Difficulty, CageGenerationPreset> = {
	easy: {
		id: 'easy',
		minSize: 2,
		maxSize: 3,
		sizeWeights: [75, 25],
		maxAttempts: 25,
		allowSingletons: false,
		// Dig far enough that some candidates overshoot; re-add givens to Easy.
		maxEmptyCells: 55,
		cageOnlyNodeLimit: 40_000,
		digNodeLimit: 16_000,
	},
	medium: DEFAULT_CAGE_PRESET,
	hard: {
		id: 'hard',
		minSize: 2,
		maxSize: 5,
		sizeWeights: [25, 30, 30, 15],
		maxAttempts: 40,
		allowSingletons: false,
		maxEmptyCells: 76,
		cageOnlyNodeLimit: 100_000,
		digNodeLimit: 35_000,
	},
	expert: {
		id: 'expert',
		minSize: 2,
		maxSize: 5,
		sizeWeights: [25, 30, 30, 15],
		maxAttempts: 40,
		allowSingletons: false,
		maxEmptyCells: 78,
		cageOnlyNodeLimit: 100_000,
		digNodeLimit: 35_000,
	},
}

export function getCagePreset(difficulty?: Difficulty): CageGenerationPreset {
	if (!difficulty) {
		return DEFAULT_CAGE_PRESET
	}
	return CAGE_PRESETS[difficulty]
}
