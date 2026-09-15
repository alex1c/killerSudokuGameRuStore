/**
 * Stage timings / call counters for calibrated Killer generation (Phase 6P).
 * Pure data helpers — generation code fills a profile when profiling is on.
 */

export interface GenerationAttemptProfile {
	attempt: number
	solvedBoardMs: number
	cageGenerationMs: number
	initialPuzzleMs: number
	digMs: number
	uniquenessMs: number
	logicalGradeMs: number
	calibrationMs: number
	validationMs: number
	totalMs: number
	searchSolverCalls: number
	logicalSolverCalls: number
	uniquenessChecks: number
	candidateDigAttempts: number
	accepted: boolean
	rejectReason?: string
}

export interface GenerationProfile {
	seed: number
	difficulty: string
	attempts: GenerationAttemptProfile[]
	totalMs: number
	accepted: boolean
	/** Sums across all attempts. */
	totals: {
		searchSolverCalls: number
		logicalSolverCalls: number
		uniquenessChecks: number
		candidateDigAttempts: number
		digMs: number
		logicalGradeMs: number
		calibrationMs: number
		uniquenessMs: number
	}
}

export function createEmptyAttemptProfile(
	attempt: number,
): GenerationAttemptProfile {
	return {
		attempt,
		solvedBoardMs: 0,
		cageGenerationMs: 0,
		initialPuzzleMs: 0,
		digMs: 0,
		uniquenessMs: 0,
		logicalGradeMs: 0,
		calibrationMs: 0,
		validationMs: 0,
		totalMs: 0,
		searchSolverCalls: 0,
		logicalSolverCalls: 0,
		uniquenessChecks: 0,
		candidateDigAttempts: 0,
		accepted: false,
	}
}

export function summarizeGenerationProfile(
	seed: number,
	difficulty: string,
	attempts: GenerationAttemptProfile[],
	totalMs: number,
	accepted: boolean,
): GenerationProfile {
	const totals = {
		searchSolverCalls: 0,
		logicalSolverCalls: 0,
		uniquenessChecks: 0,
		candidateDigAttempts: 0,
		digMs: 0,
		logicalGradeMs: 0,
		calibrationMs: 0,
		uniquenessMs: 0,
	}
	for (const attempt of attempts) {
		totals.searchSolverCalls += attempt.searchSolverCalls
		totals.logicalSolverCalls += attempt.logicalSolverCalls
		totals.uniquenessChecks += attempt.uniquenessChecks
		totals.candidateDigAttempts += attempt.candidateDigAttempts
		totals.digMs += attempt.digMs
		totals.logicalGradeMs += attempt.logicalGradeMs
		totals.calibrationMs += attempt.calibrationMs
		totals.uniquenessMs += attempt.uniquenessMs
	}
	return { seed, difficulty, attempts, totalMs, accepted, totals }
}

/** Format one profile for Metro / console. */
export function formatGenerationProfile(profile: GenerationProfile): string {
	const t = profile.totals
	const lines = [
		`[KILLER_PROFILE] seed=${profile.seed} difficulty=${profile.difficulty} accepted=${profile.accepted} totalMs=${profile.totalMs.toFixed(1)} attempts=${profile.attempts.length}`,
		`  searchSolverCalls=${t.searchSolverCalls} uniquenessChecks=${t.uniquenessChecks} logicalSolverCalls=${t.logicalSolverCalls} digAttempts=${t.candidateDigAttempts}`,
		`  digMs=${t.digMs.toFixed(1)} uniquenessMs=${t.uniquenessMs.toFixed(1)} gradeMs=${t.logicalGradeMs.toFixed(1)} calibrateMs=${t.calibrationMs.toFixed(1)}`,
	]
	for (const attempt of profile.attempts) {
		lines.push(
			`  attempt=${attempt.attempt} ok=${attempt.accepted} total=${attempt.totalMs.toFixed(1)} dig=${attempt.digMs.toFixed(1)} uniq=${attempt.uniquenessMs.toFixed(1)} grade=${attempt.logicalGradeMs.toFixed(1)} cal=${attempt.calibrationMs.toFixed(1)} searchCalls=${attempt.searchSolverCalls} gradeCalls=${attempt.logicalSolverCalls}${attempt.rejectReason ? ` reject=${attempt.rejectReason}` : ''}`,
		)
	}
	return lines.join('\n')
}
