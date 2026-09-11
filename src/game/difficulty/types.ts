/**
 * Difficulty foundation only.
 * Presets tune cage-size preferences; they are NOT a human difficulty grader.
 */

export type Difficulty =
	| 'easy'
	| 'medium'
	| 'hard'
	| 'expert'
	| 'master'

/**
 * Cage-generation knobs used by the Phase 1 generator.
 * Weights influence size selection; they do not claim human difficulty.
 */
export interface CageGenerationPreset {
	/** Human-readable preset id (maps loosely to Difficulty). */
	id: Difficulty
	/** Minimum cage size (default game uses >= 2). */
	minSize: number
	/** Maximum cage size. */
	maxSize: number
	/**
	 * Relative weights for sizes minSize..maxSize.
	 * Index 0 corresponds to minSize.
	 */
	sizeWeights: number[]
	/** Maximum attempts to build a unique puzzle for one outer seed. */
	maxAttempts: number
	/** Allow single-cell cages (tutorial / special easy only). */
	allowSingletons: boolean
}

/**
 * Default Phase 1 preset: mostly pairs/triples, rare larger cages.
 * Not a final human difficulty classifier.
 */
export const DEFAULT_CAGE_PRESET: CageGenerationPreset = {
	id: 'medium',
	minSize: 2,
	maxSize: 4,
	// Heavy pair bias improves cage-only uniqueness for Phase 1.
	sizeWeights: [70, 25, 5],
	maxAttempts: 60,
	allowSingletons: false,
}

/**
 * Named presets for future difficulty wiring.
 * Values are architectural placeholders, not graded difficulties.
 */
export const CAGE_PRESETS: Record<Difficulty, CageGenerationPreset> = {
	easy: {
		id: 'easy',
		minSize: 2,
		maxSize: 4,
		sizeWeights: [55, 35, 10],
		maxAttempts: 40,
		allowSingletons: false,
	},
	medium: DEFAULT_CAGE_PRESET,
	hard: {
		id: 'hard',
		minSize: 2,
		maxSize: 5,
		sizeWeights: [35, 35, 20, 10],
		maxAttempts: 50,
		allowSingletons: false,
	},
	expert: {
		id: 'expert',
		minSize: 2,
		maxSize: 5,
		sizeWeights: [25, 35, 25, 15],
		maxAttempts: 60,
		allowSingletons: false,
	},
	master: {
		id: 'master',
		minSize: 2,
		maxSize: 5,
		sizeWeights: [20, 30, 30, 20],
		maxAttempts: 80,
		allowSingletons: false,
	},
}

/**
 * Resolve a difficulty label into a cage-generation preset.
 */
export function getCagePreset(difficulty?: Difficulty): CageGenerationPreset {
	if (!difficulty) {
		return DEFAULT_CAGE_PRESET
	}
	return CAGE_PRESETS[difficulty]
}
