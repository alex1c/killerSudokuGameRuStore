/**
 * 9×9 Killer Sudoku board renderer.
 */

import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { BOARD_SIZE } from '../game/sudoku'
import {
	buildCellCageMap,
	getCageBorderFlags,
	getCageSumAnchor,
	getCellAccessibilityLabel,
	getCellNotesMask,
	getCellValue,
	getConflictCells,
	getRelatedCells,
	getSameNumberCells,
	isGivenCell,
	type GameState,
} from '../gameplay'
import { borders, colors } from '../theme'
import { BoardCell } from './BoardCell'
import { computeCellSize } from './boardLayout'

export interface KillerBoardProps {
	state: GameState
	boardSize: number
	onSelectCell: (cell: number) => void
}

export function KillerBoard(props: KillerBoardProps) {
	const { state, boardSize, onSelectCell } = props
	const cellSize = computeCellSize(boardSize)

	const cellToCage = useMemo(
		() => buildCellCageMap(state.puzzle.cages),
		[state.puzzle.cages],
	)

	const sumAnchors = useMemo(() => {
		const map = new Map<number, number>()
		for (const cage of state.puzzle.cages) {
			map.set(getCageSumAnchor(cage), cage.sum)
		}
		return map
	}, [state.puzzle.cages])

	const related = useMemo(() => {
		if (state.selectedCell === null) {
			return new Set<number>()
		}
		return getRelatedCells(state.selectedCell)
	}, [state.selectedCell])

	const sameNumber = useMemo(() => {
		if (state.selectedCell === null) {
			return new Set<number>()
		}
		const value = getCellValue(state, state.selectedCell)
		if (value === 0) {
			return new Set<number>()
		}
		return getSameNumberCells(state, value)
	}, [state])

	const conflicts = useMemo(
		() => getConflictCells(state),
		[state],
	)

	const cells = []
	for (let row = 0; row < BOARD_SIZE; row += 1) {
		for (let col = 0; col < BOARD_SIZE; col += 1) {
			const index = row * BOARD_SIZE + col
			cells.push(
				<BoardCell
					key={index}
					row={row}
					col={col}
					cellSize={cellSize}
					value={getCellValue(state, index)}
					notesMask={getCellNotesMask(state, index)}
					isGiven={isGivenCell(state, index)}
					cageSum={sumAnchors.get(index) ?? null}
					cageBorders={getCageBorderFlags(index, cellToCage)}
					selected={state.selectedCell === index}
					related={related.has(index)}
					sameNumber={sameNumber.has(index)}
					conflict={conflicts.has(index)}
					accessibilityLabel={getCellAccessibilityLabel(
						state,
						index,
					)}
					onPress={() => onSelectCell(index)}
				/>,
			)
		}
	}

	return (
		<View
			style={[
				styles.board,
				{
					width: boardSize,
					height: boardSize,
					borderWidth: borders.outer,
					borderColor: colors.gridThick,
				},
			]}
		>
			{cells}
		</View>
	)
}

const styles = StyleSheet.create({
	board: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		backgroundColor: colors.boardBackground,
		overflow: 'hidden',
	},
})
