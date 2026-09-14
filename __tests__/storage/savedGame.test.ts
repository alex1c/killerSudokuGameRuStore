/**
 * Storage serialize / restore / corrupt-save / Continue / New Game tests.
 */

import { createEmptyBoard } from '../../src/game/sudoku'
import {
	createGame,
	createGameFromPuzzle,
	gameReducer,
	hasNote,
} from '../../src/gameplay'
import type { KillerCage, KillerPuzzle } from '../../src/game/killer'
import {
	GameSaveRepository,
	MemoryStorageAdapter,
	parseSavedGame,
	restoreGameFromSave,
	serializeSavedGame,
	computeEditableProgress,
} from '../../src/storage'

function makePuzzle(): KillerPuzzle {
	const board = createEmptyBoard()
	const solution = createEmptyBoard()
	for (let i = 0; i < 81; i += 1) {
		const row = Math.floor(i / 9)
		const col = i % 9
		solution[i] = ((row * 3 + Math.floor(row / 3) + col) % 9) + 1
	}
	board[0] = solution[0]!
	const cages: KillerCage[] = Array.from({ length: 81 }, (_, cell) => ({
		id: `c${cell}`,
		sum: solution[cell]!,
		cells: [cell],
	}))
	return {
		seed: 123,
		attempt: 0,
		difficultyPreset: 'medium',
		board,
		solution,
		cages,
	}
}

describe('saved game schema', () => {
	it('roundtrips serialize → parse → restore', () => {
		let state = createGameFromPuzzle(makePuzzle())
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 1 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 4 })
		state = gameReducer(state, { type: 'TOGGLE_NOTES_MODE' })
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 2 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 8 })

		const saved = serializeSavedGame(state, 1_700_000_000_000)
		expect(saved.schemaVersion).toBe(1)
		const raw = JSON.stringify(saved)
		const parsed = parseSavedGame(raw)
		expect(parsed.ok).toBe(true)
		if (!parsed.ok) {
			return
		}
		const restored = restoreGameFromSave(parsed.save)
		expect(restored.puzzle.seed).toBe(state.puzzle.seed)
		expect(restored.puzzle.difficultyPreset).toBe('medium')
		expect(restored.values).toEqual(state.values)
		expect(restored.notes).toEqual(state.notes)
		expect(restored.timerAccumulatedMs).toBe(saved.elapsedMs)
		expect(restored.history).toEqual([])
		expect(restored.selectedCell).toBeNull()
		expect(restored.timerRunningSince).toBeNull()
		expect(hasNote(restored.notes[2]!, 8)).toBe(true)
	})

	it('rejects invalid JSON and unsupported schema safely', () => {
		expect(parseSavedGame('{').ok).toBe(false)
		expect(parseSavedGame('null').ok).toBe(false)
		expect(
			parseSavedGame(
				JSON.stringify({ schemaVersion: 99, status: 'playing' }),
			).ok,
		).toBe(false)
	})

	it('rejects invalid arrays and corrupt cages', () => {
		const state = createGameFromPuzzle(makePuzzle())
		const saved = serializeSavedGame(state)
		saved.values = [1, 2]
		expect(parseSavedGame(JSON.stringify(saved)).ok).toBe(false)

		const savedValues = serializeSavedGame(createGameFromPuzzle(makePuzzle()))
		savedValues.values[1] = 10
		expect(parseSavedGame(JSON.stringify(savedValues)).ok).toBe(false)

		const saved2 = serializeSavedGame(createGameFromPuzzle(makePuzzle()))
		saved2.puzzle.cages = [{ id: 'x', sum: 1, cells: [999] }]
		expect(parseSavedGame(JSON.stringify(saved2)).ok).toBe(false)

		const saved3 = serializeSavedGame(createGameFromPuzzle(makePuzzle()))
		saved3.puzzle.cages[1]!.cells = [0]
		expect(parseSavedGame(JSON.stringify(saved3)).ok).toBe(false)

		const saved4 = serializeSavedGame(createGameFromPuzzle(makePuzzle()))
		saved4.puzzle.cages[0]!.sum += 1
		expect(parseSavedGame(JSON.stringify(saved4)).ok).toBe(false)
	})
})

describe('GameSaveRepository autosave', () => {
	it('persists value, notes, erase, and undo mutations', async () => {
		const adapter = new MemoryStorageAdapter()
		const repo = new GameSaveRepository(adapter)
		let state = createGameFromPuzzle(makePuzzle())

		state = gameReducer(state, { type: 'SELECT_CELL', cell: 1 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 7 })
		await repo.savePlaying(state)
		await repo.flush()
		let loaded = await repo.load()
		expect(loaded.ok && loaded.save.values[1]).toBe(7)

		state = gameReducer(state, { type: 'TOGGLE_NOTES_MODE' })
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 2 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 3 })
		await repo.savePlaying(state)
		await repo.flush()
		loaded = await repo.load()
		expect(loaded.ok && hasNote(loaded.save.notes[2]!, 3)).toBe(true)

		state = gameReducer(state, { type: 'TOGGLE_NOTES_MODE' })
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 1 })
		state = gameReducer(state, { type: 'ERASE' })
		await repo.savePlaying(state)
		await repo.flush()
		loaded = await repo.load()
		expect(loaded.ok && loaded.save.values[1]).toBe(0)

		state = gameReducer(state, { type: 'UNDO' })
		await repo.savePlaying(state)
		await repo.flush()
		loaded = await repo.load()
		expect(loaded.ok && loaded.save.values[1]).toBe(7)
	})

	it('persists timer pause snapshot (background-style)', async () => {
		const adapter = new MemoryStorageAdapter()
		const repo = new GameSaveRepository(adapter)
		let state = createGameFromPuzzle(makePuzzle())
		state = gameReducer(state, { type: 'TIMER_RESUME', now: 1000 })
		state = gameReducer(state, { type: 'TIMER_PAUSE', now: 6000 })
		await repo.savePlaying(state, 6000)
		await repo.flush()
		const loaded = await repo.load()
		expect(loaded.ok).toBe(true)
		if (loaded.ok) {
			expect(loaded.save.elapsedMs).toBe(5000)
		}
	})

	it('clears active save after completion', async () => {
		const adapter = new MemoryStorageAdapter()
		const repo = new GameSaveRepository(adapter)
		let state = createGameFromPuzzle(makePuzzle())
		await repo.savePlaying(state)
		await repo.flush()

		state = {
			...state,
			status: 'completed',
			timerRunningSince: null,
		}
		await repo.savePlaying(state)
		await repo.flush()
		const loaded = await repo.load()
		expect(loaded.ok).toBe(false)
	})

	it('ignores corrupt storage payloads without throwing', async () => {
		const adapter = new MemoryStorageAdapter()
		await adapter.setItem('killerSudoku.activeGame.v1', '{not-json')
		const repo = new GameSaveRepository(adapter)
		const loaded = await repo.load()
		expect(loaded.ok).toBe(false)
		const again = await adapter.getItem('killerSudoku.activeGame.v1')
		expect(again).toBeNull()
	})

	it('latest write wins when queued', async () => {
		const adapter = new MemoryStorageAdapter()
		const repo = new GameSaveRepository(adapter)
		let a = createGameFromPuzzle(makePuzzle())
		a = gameReducer(a, { type: 'SELECT_CELL', cell: 1 })
		a = gameReducer(a, { type: 'INPUT_DIGIT', digit: 1 })
		let b = createGameFromPuzzle(makePuzzle())
		b = gameReducer(b, { type: 'SELECT_CELL', cell: 1 })
		b = gameReducer(b, { type: 'INPUT_DIGIT', digit: 9 })

		void repo.savePlaying(a)
		await repo.savePlaying(b)
		await repo.flush()
		const loaded = await repo.load()
		expect(loaded.ok).toBe(true)
		if (loaded.ok) {
			expect(loaded.save.values[1]).toBe(9)
		}
	})
})

describe('Continue restore', () => {
	it('restores puzzle, values, notes, difficulty, elapsed; resets history', () => {
		let state = createGameFromPuzzle(makePuzzle())
		state = gameReducer(state, { type: 'TIMER_RESUME', now: 0 })
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 1 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 4 })
		state = gameReducer(state, { type: 'TOGGLE_NOTES_MODE' })
		state = gameReducer(state, { type: 'SELECT_CELL', cell: 3 })
		state = gameReducer(state, { type: 'INPUT_DIGIT', digit: 9 })
		state = gameReducer(state, { type: 'TIMER_PAUSE', now: 12_000 })

		const saved = serializeSavedGame(state, 12_000)
		const restored = restoreGameFromSave(saved)

		expect(restored.puzzle.board).toEqual(state.puzzle.board)
		expect(restored.puzzle.cages).toEqual(state.puzzle.cages)
		expect(restored.puzzle.seed).toBe(123)
		expect(restored.values).toEqual(state.values)
		expect(restored.notes).toEqual(state.notes)
		expect(restored.puzzle.difficultyPreset).toBe('medium')
		expect(restored.timerAccumulatedMs).toBe(12_000)
		expect(restored.history).toEqual([])
		expect(restored.selectedCell).toBeNull()
	})
})

describe('New Game replacement', () => {
	it('replaces old save with a new difficulty/seed and resets progress', async () => {
		const adapter = new MemoryStorageAdapter()
		const repo = new GameSaveRepository(adapter)

		let oldGame = createGameFromPuzzle(makePuzzle())
		oldGame = gameReducer(oldGame, { type: 'SELECT_CELL', cell: 1 })
		oldGame = gameReducer(oldGame, { type: 'INPUT_DIGIT', digit: 2 })
		await repo.savePlaying(oldGame)
		await repo.flush()

		const fresh = createGame({ seed: 999, difficulty: 'hard' })
		expect(fresh.puzzle.difficultyPreset).toBe('hard')
		expect(fresh.puzzle.seed).toBe(999)
		expect(fresh.values.every((v, i) => v === fresh.puzzle.board[i])).toBe(
			true,
		)
		expect(fresh.history).toEqual([])

		await repo.savePlaying(fresh)
		await repo.flush()
		const loaded = await repo.load()
		expect(loaded.ok).toBe(true)
		if (loaded.ok) {
			expect(loaded.save.seed).toBe(999)
			expect(loaded.save.difficulty).toBe('hard')
			expect(loaded.save.values[1]).toBe(fresh.puzzle.board[1])
		}
	})
})

describe('progress helper', () => {
	it('ignores givens when computing editable progress', () => {
		const board = createEmptyBoard()
		board[0] = 5
		const values = createEmptyBoard()
		values[0] = 5
		values[1] = 3
		expect(computeEditableProgress(board, values)).toBeCloseTo(1 / 80)
	})
})
