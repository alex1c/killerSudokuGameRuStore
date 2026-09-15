export type { KillerCage, CageTopologyError } from './cages'
export {
	isOrthogonallyConnected,
	validateCageTopology,
	validateCagesAgainstSolution,
} from './cages'

export {
	getCageCombinations,
	hasCageCombination,
	hasCageCombinationMask,
	cageSumBounds,
	digitsToMask,
} from './combinations'

export {
	generateKillerCages,
	type GenerateKillerCagesOptions,
} from './cageGenerator'

export {
	validateKillerPuzzle,
	type KillerValidationResult,
	type KillerValidationError,
	type ValidateKillerPuzzleInput,
} from './validator'

export {
	solveKillerSudoku,
	countKillerSolutions,
	hasUniqueKillerSolution,
	DEFAULT_KILLER_NODE_LIMIT,
	type KillerPuzzleInput,
} from './solver'

export {
	generateKillerPuzzle,
	tryCalibratedKillerAttempt,
	KillerPuzzleGenerationError,
	digGivensWithOrder,
	type GenerateKillerPuzzleOptions,
	type KillerPuzzle,
	type DigGivensResult,
	type CalibratedAttemptResult,
} from './generateKillerPuzzle'

export {
	calibrateBoardToGrade,
	difficultyRank,
	buildGivenFillOrder,
	type CalibrateBoardResult,
} from './calibrateGrade'
