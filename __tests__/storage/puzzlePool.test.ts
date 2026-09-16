/**
 * Phase 6Q: prepared puzzle pool storage + controller tests.
 */

import {
	ACTIVE_GAME_STORAGE_KEY,
	MemoryStorageAdapter,
	PUZZLE_POOL_STORAGE_KEY,
	appendPreparedPuzzle,
	consumePreparedPuzzle,
	countPrepared,
	createEmptyPuzzlePool,
	createPreparedPuzzle,
	parsePuzzlePool,
	serializePuzzlePool,
	PuzzlePoolRepository,
} from '../../src/storage'
import {
	generateKillerPuzzle,
	generateKillerPuzzleAsync,
	createGenerationCancelToken,
	GenerationCancelledError,
	PUZZLE_GENERATOR_VERSION,
} from '../../src/game/killer'
import { gradeDifficulty } from '../../src/game/logic'
import {
	PuzzlePoolController,
	resetSharedPuzzlePoolControllerForTests,
} from '../../src/pool/puzzlePoolController'
import { runPoolIsolationQa } from '../../src/dev/puzzlePoolQa'

describe('puzzle pool schema', () => {
	it('round-trips a prepared hard puzzle', () => {
		const puzzle = generateKillerPuzzle({
			seed: 50101,
			difficultyPreset: 'hard',
		})
		expect(
			gradeDifficulty({ board: puzzle.board, cages: puzzle.cages })
				.level,
		).toBe('hard')
		const item = createPreparedPuzzle(puzzle, 'hard', 1_700_000_000_000)
		let pool = createEmptyPuzzlePool()
		pool = appendPreparedPuzzle(pool, item)
		expect(countPrepared(pool, 'hard')).toBe(1)

		const raw = serializePuzzlePool(pool)
		const parsed = parsePuzzlePool(raw)
		expect(parsed.ok).toBe(true)
		if (!parsed.ok) {
			return
		}
		expect(parsed.pool.items).toHaveLength(1)
		expect(parsed.pool.items[0]!.seed).toBe(puzzle.seed)
	})

	it('rejects corrupt json and wrong generator version', () => {
		expect(parsePuzzlePool('{').ok).toBe(false)
		expect(parsePuzzlePool('null').ok).toBe(false)

		const puzzle = generateKillerPuzzle({
			seed: 50102,
			difficultyPreset: 'hard',
		})
		const item = createPreparedPuzzle(puzzle, 'hard')
		const pool = {
			...createEmptyPuzzlePool(),
			generatorVersion: PUZZLE_GENERATOR_VERSION + 99,
			items: [
				{
					...item,
					generatorVersion: PUZZLE_GENERATOR_VERSION + 99,
				},
			],
		}
		const parsed = parsePuzzlePool(JSON.stringify(pool))
		expect(parsed.ok).toBe(false)
		if (!parsed.ok) {
			expect(parsed.reason).toBe('generator-version')
		}
	})

	it('consume removes exactly one item and records recent seed', () => {
		const puzzle = generateKillerPuzzle({
			seed: 50103,
			difficultyPreset: 'expert',
		})
		let pool = appendPreparedPuzzle(
			createEmptyPuzzlePool(),
			createPreparedPuzzle(puzzle, 'expert'),
		)
		const once = consumePreparedPuzzle(pool, 'expert')
		expect(once).not.toBeNull()
		expect(once!.item.seed).toBe(puzzle.seed)
		expect(countPrepared(once!.pool, 'expert')).toBe(0)
		expect(once!.pool.recentSeeds).toContain(puzzle.seed)

		const twice = consumePreparedPuzzle(once!.pool, 'expert')
		expect(twice).toBeNull()
	})

	it('blocks duplicate seeds in append', () => {
		const puzzle = generateKillerPuzzle({
			seed: 50104,
			difficultyPreset: 'hard',
		})
		const item = createPreparedPuzzle(puzzle, 'hard')
		let pool = appendPreparedPuzzle(createEmptyPuzzlePool(), item)
		pool = appendPreparedPuzzle(pool, item)
		expect(countPrepared(pool, 'hard')).toBe(1)
	})
})

describe('puzzle pool repository', () => {
	it('loads empty pool and persists updates; ignores corrupt', async () => {
		const adapter = new MemoryStorageAdapter()
		const repo = new PuzzlePoolRepository(adapter)
		const empty = await repo.load()
		expect(empty.items).toHaveLength(0)

		const puzzle = generateKillerPuzzle({
			seed: 50201,
			difficultyPreset: 'hard',
		})
		const next = appendPreparedPuzzle(
			empty,
			createPreparedPuzzle(puzzle, 'hard'),
		)
		await repo.save(next)
		const loaded = await repo.load()
		expect(countPrepared(loaded, 'hard')).toBe(1)

		await adapter.setItem(PUZZLE_POOL_STORAGE_KEY, '{not-json')
		const recovered = await repo.load()
		expect(recovered.items).toHaveLength(0)
	})

	it('does not touch active game key', async () => {
		const adapter = new MemoryStorageAdapter()
		await adapter.setItem(ACTIVE_GAME_STORAGE_KEY, 'keep-me')
		const repo = new PuzzlePoolRepository(adapter)
		await repo.save(createEmptyPuzzlePool())
		expect(await adapter.getItem(ACTIVE_GAME_STORAGE_KEY)).toBe('keep-me')
		const isolation = await runPoolIsolationQa(adapter)
		expect(isolation.passed).toBe(true)
	})
})

describe('cooperative generation', () => {
	it('matches sync generator for the same seed and can cancel', async () => {
		const seed = 50301
		const sync = generateKillerPuzzle({
			seed,
			difficultyPreset: 'hard',
		})
		const asyncPuzzle = await generateKillerPuzzleAsync({
			seed,
			difficultyPreset: 'hard',
			digYieldEvery: 2,
		})
		expect(asyncPuzzle.board).toEqual(sync.board)
		expect(asyncPuzzle.cages).toEqual(sync.cages)

		const token = createGenerationCancelToken()
		token.cancel()
		await expect(
			generateKillerPuzzleAsync({
				seed: 50302,
				difficultyPreset: 'hard',
				cancelToken: token,
			}),
		).rejects.toBeInstanceOf(GenerationCancelledError)
	}, 120_000)
})

describe('puzzle pool controller', () => {
	beforeEach(() => {
		resetSharedPuzzlePoolControllerForTests()
	})

	afterEach(() => {
		resetSharedPuzzlePoolControllerForTests()
	})

	it('consumes prepared hard without duplicate and pauses on gameplay', async () => {
		const adapter = new MemoryStorageAdapter()
		const puzzle = generateKillerPuzzle({
			seed: 50401,
			difficultyPreset: 'hard',
		})
		await adapter.setItem(
			PUZZLE_POOL_STORAGE_KEY,
			serializePuzzlePool(
				appendPreparedPuzzle(
					createEmptyPuzzlePool(),
					createPreparedPuzzle(puzzle, 'hard'),
				),
			),
		)
		const fresh = new PuzzlePoolController(adapter)
		const taken = await fresh.consume('hard')
		expect(taken).not.toBeNull()
		expect(taken!.retrievalMs).toBeLessThan(50)
		expect(taken!.puzzle.seed).toBe(puzzle.seed)

		const again = await fresh.consume('hard')
		expect(again).toBeNull()

		fresh.setGameplayActive(true)
		await fresh.scheduleFill('should-not-run')
		expect(fresh.getSnapshot().mode === 'filling').toBe(false)
	}, 60_000)

	it('refill targets hard/expert only and recovers after restart', async () => {
		const adapter = new MemoryStorageAdapter()
		const controller = new PuzzlePoolController(adapter)
		controller.setAppActive(true)
		controller.setGameplayActive(false)
		controller.setHomeVisible(true)
		await controller.clearPool()
		await controller.fillToTargets()
		const snap = controller.getSnapshot()
		expect(snap.hard).toBe(snap.hardTarget)
		expect(snap.expert).toBe(snap.expertTarget)

		const restarted = new PuzzlePoolController(adapter)
		await restarted.ensureLoaded()
		const again = restarted.getSnapshot()
		expect(again.hard).toBe(snap.hardTarget)
		expect(again.expert).toBe(snap.expertTarget)

		controller.pauseFill()
	}, 300_000)
})
