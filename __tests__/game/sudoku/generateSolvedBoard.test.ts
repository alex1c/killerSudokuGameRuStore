import {
	BOARD_SIZE,
	BOX_SIZE,
	generateSolvedBoard,
	isSolvedSudoku,
} from '../../../src/game/sudoku'

function unitHasAllDigits(
	getValue: (k: number) => number,
): boolean {
	const seen = new Set<number>()
	for (let k = 0; k < BOARD_SIZE; k += 1) {
		seen.add(getValue(k))
	}
	return seen.size === 9
}

describe('generateSolvedBoard', () => {
	it('produces a valid complete Sudoku', () => {
		const board = generateSolvedBoard(12345)
		expect(board).toHaveLength(81)
		expect(isSolvedSudoku(board)).toBe(true)

		for (let unit = 0; unit < BOARD_SIZE; unit += 1) {
			expect(
				unitHasAllDigits((k) => board[unit * BOARD_SIZE + k]!),
			).toBe(true)
			expect(
				unitHasAllDigits((k) => board[k * BOARD_SIZE + unit]!),
			).toBe(true)

			const boxRow = Math.floor(unit / BOX_SIZE) * BOX_SIZE
			const boxCol = (unit % BOX_SIZE) * BOX_SIZE
			expect(
				unitHasAllDigits((k) => {
					const r = boxRow + Math.floor(k / BOX_SIZE)
					const c = boxCol + (k % BOX_SIZE)
					return board[r * BOARD_SIZE + c]!
				}),
			).toBe(true)
		}
	})

	it('is deterministic for the same seed', () => {
		expect(generateSolvedBoard(42)).toEqual(generateSolvedBoard(42))
	})

	it('usually differs across seeds', () => {
		const a = generateSolvedBoard(1)
		const b = generateSolvedBoard(2)
		const c = generateSolvedBoard(3)
		const unique = new Set([a.join(','), b.join(','), c.join(',')])
		expect(unique.size).toBeGreaterThan(1)
	})
})
