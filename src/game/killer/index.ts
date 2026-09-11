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
	KillerPuzzleGenerationError,
	type GenerateKillerPuzzleOptions,
	type KillerPuzzle,
} from './generateKillerPuzzle'
