/**
 * Phase 2 main game screen: header, Killer board, keypad.
 */

import {
	useEffect,
	useMemo,
	useState,
	type Dispatch,
	type SetStateAction,
} from 'react'
import {
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
	createGame,
	gameReducer,
	isBoardComplete,
	isBoardValid,
	PHASE2_DEMO_SEED_LABEL,
	type GameAction,
	type GameState,
} from '../gameplay'
import { colors, spacing, typography } from '../theme'
import { computeBoardSize } from './boardLayout'
import { KillerBoard } from './KillerBoard'
import { NumberKeypad } from './NumberKeypad'
import type { Digit } from '../game/sudoku'

/**
 * Single-screen Phase 2 gameplay shell.
 * Uses a fixed demo seed so Cursor and Codex share the same board.
 */
export function GameScreen() {
	const insets = useSafeAreaInsets()
	const [state, setState] = useState<GameState | null>(null)

	useEffect(() => {
		const timer = setTimeout(() => {
			setState(createGame({ seedLabel: PHASE2_DEMO_SEED_LABEL }))
		}, 0)
		return () => clearTimeout(timer)
	}, [])

	if (state === null) {
		return (
			<View
				style={[
					styles.screen,
					{
						paddingTop: insets.top + 8,
						paddingBottom: insets.bottom,
					},
				]}
			>
				<Text style={styles.loading}>Загрузка головоломки…</Text>
			</View>
		)
	}

	return <LoadedGameScreen state={state} setState={setState} />
}

interface LoadedGameScreenProps {
	state: GameState
	setState: Dispatch<SetStateAction<GameState | null>>
}

function LoadedGameScreen({ state, setState }: LoadedGameScreenProps) {
	const insets = useSafeAreaInsets()
	const { width } = useWindowDimensions()
	const boardSize = useMemo(() => computeBoardSize(width), [width])
	const complete = isBoardComplete(state)
	const valid = isBoardValid(state)

	const dispatch = (action: GameAction): void => {
		setState((current) =>
			current === null ? current : gameReducer(current, action),
		)
	}

	return (
		<View
			style={[
				styles.screen,
				{
					paddingTop: insets.top + 8,
					paddingBottom: 0,
				},
			]}
		>
			<View style={styles.header}>
				<Text style={styles.title}>Киллер Судоку</Text>
				{/* Timer placeholder — real timer arrives in a later phase. */}
				<Text style={styles.timer}>00:00</Text>
			</View>

			<View style={styles.boardWrap}>
				<KillerBoard
					state={state}
					boardSize={boardSize}
					onSelectCell={(cell) =>
						dispatch({ type: 'SELECT_CELL', cell })
					}
				/>
			</View>

			{complete && valid ? (
				<Text style={styles.solved}>Решено</Text>
			) : (
				<View style={styles.solvedSpacer} />
			)}

			<NumberKeypad
				onDigit={(digit: Digit) =>
					dispatch({ type: 'INPUT_DIGIT', digit })
				}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: colors.background,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: spacing.screenPadding,
		marginBottom: spacing.headerGap,
	},
	title: {
		fontSize: typography.titleSize,
		fontWeight: '700',
		color: colors.headerText,
	},
	timer: {
		fontSize: typography.timerSize,
		fontWeight: '500',
		color: colors.secondaryText,
		fontVariant: ['tabular-nums'],
	},
	boardWrap: {
		alignItems: 'center',
		justifyContent: 'center',
		flexGrow: 1,
	},
	solved: {
		textAlign: 'center',
		color: colors.solvedBanner,
		fontWeight: '700',
		marginBottom: 8,
		fontSize: 16,
	},
	solvedSpacer: {
		height: 28,
	},
	loading: {
		flex: 1,
		textAlign: 'center',
		textAlignVertical: 'center',
		color: colors.primaryText,
		fontSize: 18,
		fontWeight: '600',
	},
})
