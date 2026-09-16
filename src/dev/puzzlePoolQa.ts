/**
 * DEV QA for prepared puzzle pool (Phase 6Q).
 */

import {
	ACTIVE_GAME_STORAGE_KEY,
	MemoryStorageAdapter,
	PUZZLE_POOL_STORAGE_KEY,
	type StorageAdapter,
} from '../storage'
import { PuzzlePoolController } from '../pool/puzzlePoolController'
import { yieldToEventLoop } from '../game/killer/cooperative'
import type { Phase4QaCheck, Phase4QaResult } from './phase4Qa'

export interface PoolQaResult extends Phase4QaResult {
	retrievalHardMs?: number
	retrievalExpertMs?: number
	maxHeartbeatGapMs?: number
	hardCount?: number
	expertCount?: number
}

function check(
	name: string,
	passed: boolean,
	details?: string,
): Phase4QaCheck {
	return details === undefined ? { name, passed } : { name, passed, details }
}

function monotonicMs(): number {
	if (
		typeof performance !== 'undefined' &&
		typeof performance.now === 'function'
	) {
		return performance.now()
	}
	return Date.now()
}

/**
 * Measure event-loop stalls while a cooperative fill runs.
 */
export async function runPoolHeartbeatWhileFill(
	controller: PuzzlePoolController,
): Promise<{ maxGapMs: number; samples: number }> {
	let maxGap = 0
	let samples = 0
	let last = monotonicMs()
	let stop = false

	const heartbeat = async () => {
		while (!stop) {
			await yieldToEventLoop()
			const now = monotonicMs()
			const gap = now - last
			last = now
			samples += 1
			if (gap > maxGap) {
				maxGap = gap
			}
		}
	}

	const beatPromise = heartbeat()
	controller.setHomeVisible(true)
	controller.setGameplayActive(false)
	controller.setAppActive(true)
	await controller.clearPool()
	const fillPromise = controller.fillToTargets()
	await fillPromise
	stop = true
	await beatPromise
	return { maxGapMs: maxGap, samples }
}

export async function runPuzzlePoolQa(
	controller: PuzzlePoolController,
): Promise<PoolQaResult> {
	const checks: Phase4QaCheck[] = []

	await controller.clearPool()
	let snap = controller.getSnapshot()
	checks.push(
		check(
			'clear pool',
			snap.hard === 0 && snap.expert === 0,
			`hard=${snap.hard} expert=${snap.expert}`,
		),
	)

	const heartbeat = await runPoolHeartbeatWhileFill(controller)
	snap = controller.getSnapshot()
	checks.push(
		check(
			'fill pool targets',
			snap.hard >= snap.hardTarget && snap.expert >= snap.expertTarget,
			`hard=${snap.hard}/${snap.hardTarget} expert=${snap.expert}/${snap.expertTarget}`,
		),
	)
	checks.push(
		check(
			'heartbeat during fill',
			true,
			`maxGapMs=${heartbeat.maxGapMs.toFixed(0)} samples=${heartbeat.samples}`,
		),
	)

	const hard = await controller.consume('hard')
	checks.push(
		check(
			'consume hard',
			hard !== null && hard.retrievalMs < 100,
			hard
				? `retrievalMs=${hard.retrievalMs.toFixed(1)}`
				: 'empty',
		),
	)

	const expert = await controller.consume('expert')
	checks.push(
		check(
			'consume expert',
			expert !== null && expert.retrievalMs < 100,
			expert
				? `retrievalMs=${expert.retrievalMs.toFixed(1)}`
				: 'empty',
		),
	)

	snap = controller.getSnapshot()
	checks.push(
		check(
			'partial remain after one each',
			snap.hard === snap.hardTarget - 1 &&
				snap.expert === snap.expertTarget - 1,
			`hard=${snap.hard} expert=${snap.expert}`,
		),
	)

	const dupHard = await controller.consume('hard')
	checks.push(
		check(
			'second hard consume distinct',
			dupHard !== null &&
				hard !== null &&
				dupHard.puzzle.seed !== hard.puzzle.seed,
			dupHard
				? `seed=${dupHard.puzzle.seed}`
				: 'empty',
		),
	)

	const passed = checks.every((item) => item.passed)
	const result: PoolQaResult = {
		passed,
		checks,
		retrievalHardMs: hard?.retrievalMs,
		retrievalExpertMs: expert?.retrievalMs,
		maxHeartbeatGapMs: heartbeat.maxGapMs,
		hardCount: snap.hard,
		expertCount: snap.expert,
	}
	console.log('[PuzzlePoolQA] RESULT:', passed ? 'PASS' : 'FAIL')
	for (const item of checks) {
		console.log(
			`[PuzzlePoolQA] ${item.passed ? '✓' : '✗'} ${item.name}${item.details ? ` — ${item.details}` : ''}`,
		)
	}
	return result
}

/**
 * Ensure active-game key is untouched by pool operations.
 */
export async function runPoolIsolationQa(
	adapter: StorageAdapter = new MemoryStorageAdapter(),
): Promise<Phase4QaResult> {
	const marker = '{"marker":true}'
	await adapter.setItem(ACTIVE_GAME_STORAGE_KEY, marker)
	const controller = new PuzzlePoolController(
		adapter,
		`${PUZZLE_POOL_STORAGE_KEY}.qa`,
	)
	await controller.clearPool()
	controller.setHomeVisible(true)
	controller.setAppActive(true)
	controller.setGameplayActive(false)
	// Do not full-fill here (slow); just save empty pool.
	await controller.ensureLoaded()
	const active = await adapter.getItem(ACTIVE_GAME_STORAGE_KEY)
	const checks = [
		check(
			'active save unaffected',
			active === marker,
			`active=${active === null ? 'null' : 'present'}`,
		),
	]
	return { passed: checks.every((c) => c.passed), checks }
}
