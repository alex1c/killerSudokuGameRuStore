import type { KillerCage } from '../../src/game/killer'
import {
	getCageSumForCell,
	getNoteGridInsets,
	getNoteGridPosition,
	getVisibleNoteDigits,
} from '../../src/ui/boardCellVisuals'

describe('board cell visual helpers', () => {
	it('does not render note digits for an empty cell without user notes', () => {
		expect(getVisibleNoteDigits(0, 0)).toEqual([])
	})

	it('renders only the user notes in their 3x3 positions', () => {
		expect(getVisibleNoteDigits(0, (1 << 3) | (1 << 7))).toEqual([3, 7])
		expect(getNoteGridPosition(3)).toEqual({ row: 0, col: 2 })
		expect(getNoteGridPosition(7)).toEqual({ row: 2, col: 0 })
	})

	it('reserves the upper area for a cage sum while keeping anchor notes in all slots', () => {
		const cages: KillerCage[] = [{ id: 'anchor', sum: 10, cells: [0, 1] }]
		const notesMask = (1 << 3) | (1 << 6) | (1 << 8) | (1 << 9)
		const regularInsets = getNoteGridInsets(36, false)
		const anchorInsets = getNoteGridInsets(36, getCageSumForCell(0, cages) !== null)

		expect(getCageSumForCell(0, cages)).toBe(10)
		expect(getVisibleNoteDigits(0, notesMask)).toEqual([3, 6, 8, 9])
		expect(anchorInsets.top).toBeGreaterThan(regularInsets.top)
		expect(anchorInsets.bottom).toBeLessThan(regularInsets.bottom)
		expect(anchorInsets.top + anchorInsets.bottom).toBeLessThan(36)
		expect(getCageSumForCell(1, cages)).toBeNull()
	})

	it('renders a cage target only at its anchor cell', () => {
		const cages: KillerCage[] = [{ id: 'pair', sum: 17, cells: [0, 1] }]
		expect(getCageSumForCell(0, cages)).toBe(17)
		expect(getCageSumForCell(1, cages)).toBeNull()
	})
})
