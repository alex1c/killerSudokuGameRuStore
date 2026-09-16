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
	digGivensIncremental,
	digGivensIncrementalAsync,
	DEFAULT_KILLER_NODE_LIMIT,
	type KillerPuzzleInput,
	type DigUniquenessResult,
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
	generateKillerPuzzleAsync,
	type GenerateKillerPuzzleAsyncOptions,
} from './generateAsync'

export {
	yieldToEventLoop,
	createGenerationCancelToken,
	GenerationCancelledError,
	type GenerationCancelToken,
} from './cooperative'

export { PUZZLE_GENERATOR_VERSION } from './generatorVersion'

export {
	calibrateBoardToGrade,
	difficultyRank,
	buildGivenFillOrder,
	type CalibrateBoardResult,
} from './calibrateGrade'

export {
	createEmptyAttemptProfile,
	summarizeGenerationProfile,
	formatGenerationProfile,
	type GenerationAttemptProfile,
	type GenerationProfile,
} from './generationProfile'
