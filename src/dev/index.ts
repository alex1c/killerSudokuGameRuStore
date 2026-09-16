/**
 * Development-only Phase 4 QA exports.
 */

export {
	PHASE4_QA_PERSISTENCE_SEED_LABEL,
	PHASE4_QA_ELAPSED_MS,
	buildPhase4QaBaselineGame,
	runPhase4PersistenceQa,
	runPhase4GeneratorQa,
	runPhase4Qa,
	logPhase4QaSummary,
} from './phase4Qa'
export type {
	Phase4QaCheck,
	Phase4QaResult,
	Phase4QaOptions,
	Phase4QaGeneratorPresetSummary,
} from './phase4Qa'
export {
	runGeneratorPerfQa,
	logGeneratorPerfQaSummary,
	GENERATOR_PERF_RUNS,
} from './generatorPerfQa'
export type {
	GeneratorPerfQaResult,
	GeneratorPerfQaOptions,
	GeneratorPerfPresetSummary,
	GeneratorPerfRunRow,
} from './generatorPerfQa'
export {
	runPuzzlePoolQa,
	runPoolIsolationQa,
	runPoolHeartbeatWhileFill,
} from './puzzlePoolQa'
export type { PoolQaResult } from './puzzlePoolQa'
export { Phase4QaScreen } from './Phase4QaScreen'
