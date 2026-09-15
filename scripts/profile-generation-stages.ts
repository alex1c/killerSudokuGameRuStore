/**
 * Quick Phase 6P profile: one Hard + one Expert with stage breakdown.
 * Usage: npx tsx scripts/profile-generation-stages.ts
 */

import {
	generateKillerPuzzle,
	formatGenerationProfile,
} from '../src/game/killer'

for (const difficulty of ['hard', 'expert'] as const) {
	const seed = 900_000 + difficulty.length * 17
	const t0 = performance.now()
	const puzzle = generateKillerPuzzle({
		seed,
		difficultyPreset: difficulty,
		profile: true,
	})
	const wall = performance.now() - t0
	console.log(`\n=== ${difficulty} seed=${seed} wallMs=${wall.toFixed(1)} ===`)
	if (puzzle.profile) {
		console.log(formatGenerationProfile(puzzle.profile))
	}
}
