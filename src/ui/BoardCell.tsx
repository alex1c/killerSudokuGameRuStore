/**
 * Single board cell: digit / notes, cage sum, highlights, cage borders.
 */

import { memo, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { CageBorderFlags } from '../gameplay'
import { notesToDigits } from '../gameplay'
import { borders, colors, typography } from '../theme'

export interface BoardCellProps {
	row: number
	col: number
	cellSize: number
	value: number
	notesMask: number
	isGiven: boolean
	cageSum: number | null
	cageBorders: CageBorderFlags
	selected: boolean
	related: boolean
	sameNumber: boolean
	conflict: boolean
	/** Smart Hint highlight (secondary to conflict/selected). */
	hintHighlight?: boolean
	hintTarget?: boolean
	accessibilityLabel: string
	onPress: () => void
}

function BoardCellComponent(props: BoardCellProps) {
	const {
		row,
		col,
		cellSize,
		value,
		notesMask,
		isGiven,
		cageSum,
		cageBorders,
		selected,
		related,
		sameNumber,
		conflict,
		hintHighlight = false,
		hintTarget = false,
		accessibilityLabel,
		onPress,
	} = props

	const backgroundColor = useMemo(() => {
		if (conflict) {
			return colors.conflict
		}
		if (selected) {
			return colors.selected
		}
		if (hintTarget) {
			return colors.toolbarActive
		}
		if (hintHighlight) {
			return colors.related
		}
		if (sameNumber) {
			return colors.sameNumber
		}
		if (related) {
			return colors.related
		}
		return colors.boardBackground
	}, [conflict, selected, sameNumber, related, hintHighlight, hintTarget])

	const digitSize = Math.round(cellSize * typography.digitSizeRatio)
	const sumSize = Math.max(
		9,
		Math.round(cellSize * typography.sumSizeRatio),
	)
	const noteSize = Math.max(
		9,
		Math.round(cellSize * Math.max(typography.noteSizeRatio, 0.18)),
	)
	const noteDigits = value === 0 ? notesToDigits(notesMask) : []

	const borderTopWidth =
		row % 3 === 0 ? borders.gridThick : borders.gridThin
	const borderLeftWidth =
		col % 3 === 0 ? borders.gridThick : borders.gridThin
	const borderRightWidth =
		col === 8
			? borders.gridThick
			: col % 3 === 2
				? borders.gridThick
				: 0
	const borderBottomWidth =
		row === 8
			? borders.gridThick
			: row % 3 === 2
				? borders.gridThick
				: 0

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			style={[
				styles.cell,
				{
					width: cellSize,
					height: cellSize,
					backgroundColor,
					borderTopWidth,
					borderLeftWidth,
					borderRightWidth,
					borderBottomWidth,
					borderColor: colors.gridThick,
					borderTopColor:
						row % 3 === 0 ? colors.gridThick : colors.gridThin,
					borderLeftColor:
						col % 3 === 0 ? colors.gridThick : colors.gridThin,
					borderRightColor: colors.gridThick,
					borderBottomColor: colors.gridThick,
				},
			]}
		>
			<View
				pointerEvents="none"
				style={[
					styles.cageInset,
					{
						borderTopWidth: cageBorders.top ? borders.cageInset : 0,
						borderRightWidth: cageBorders.right
							? borders.cageInset
							: 0,
						borderBottomWidth: cageBorders.bottom
							? borders.cageInset
							: 0,
						borderLeftWidth: cageBorders.left
							? borders.cageInset
							: 0,
						borderColor: colors.cageBorder,
					},
				]}
			/>
			{cageSum !== null ? (
				<Text
					style={[
						styles.sum,
						{ fontSize: sumSize, lineHeight: sumSize + 1 },
					]}
					numberOfLines={1}
				>
					{cageSum}
				</Text>
			) : null}
			{value !== 0 ? (
				<Text
					style={[
						styles.digit,
						{
							fontSize: digitSize,
							color: conflict
								? colors.conflictText
								: isGiven
									? colors.givenText
									: colors.playerText,
							fontWeight: isGiven ? '700' : '500',
						},
					]}
				>
					{value}
				</Text>
			) : (
				<View style={styles.notesGrid} pointerEvents="none">
					{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
						<Text
							key={digit}
							style={[
								styles.note,
								{
									fontSize: noteSize,
									lineHeight: noteSize + 1,
									// Leave top-left clearer when a cage sum is present.
									opacity:
										cageSum !== null && digit === 1
											? 0.75
											: 1,
									color: noteDigits.includes(
										digit as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
									)
										? colors.noteText
										: 'transparent',
								},
							]}
						>
							{digit}
						</Text>
					))}
				</View>
			)}
		</Pressable>
	)
}

export const BoardCell = memo(BoardCellComponent)

const styles = StyleSheet.create({
	cell: {
		alignItems: 'center',
		justifyContent: 'center',
		overflow: 'hidden',
	},
	cageInset: {
		...StyleSheet.absoluteFill,
		margin: 2,
		borderRadius: 2,
	},
	sum: {
		position: 'absolute',
		top: 1,
		left: 3,
		color: colors.secondaryText,
		fontWeight: '600',
		zIndex: 2,
	},
	digit: {
		textAlign: 'center',
		zIndex: 1,
	},
	notesGrid: {
		...StyleSheet.absoluteFill,
		marginTop: 10,
		marginHorizontal: 2,
		marginBottom: 2,
		flexDirection: 'row',
		flexWrap: 'wrap',
	},
	note: {
		width: '33.333%',
		textAlign: 'center',
		fontWeight: '500',
	},
})
