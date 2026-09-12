/**
 * Playable game screen — receives an already-created GameState from the app shell.
 */

import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import {
	AppState,
	Pressable,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
	type AppStateStatus,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Digit } from '../game/sudoku'
import { DIFFICULTY_LABELS } from '../game/difficulty'
import {
	countDigitOccurrences,
	formatElapsed,
	gameReducer,
	getElapsedMs,
	type GameAction,
	type GameState,
} from '../gameplay'
import type { GameSaveRepository } from '../storage'
import { colors, spacing, typography } from '../theme'
import { computeBoardSize } from './boardLayout'
import { CompletionOverlay } from './CompletionOverlay'
import { GameToolbar } from './GameToolbar'
import { KillerBoard } from './KillerBoard'
import { NumberKeypad } from './NumberKeypad'

export interface GameScreenProps {
	initialState: GameState
	saveRepository: GameSaveRepository
	onExitToHome: () => void
	onNewGameFromCompletion: () => void
}

const TIMER_AUTOSAVE_MS = 30_000

export function GameScreen(props: GameScreenProps) {
	const {
		initialState,
		saveRepository,
		onExitToHome,
		onNewGameFromCompletion,
	} = props
	const insets = useSafeAreaInsets()
	const { width } = useWindowDimensions()
	const boardSize = useMemo(() => computeBoardSize(width), [width])
	const [state, setState] = useState<GameState>(initialState)
	const [now, setNow] = useState(() => Date.now())
	const stateRef = useRef(state)

	useEffect(() => {
		// Keep a latest snapshot for interval autosave without reading refs in render.
		stateRef.current = state
	}, [state])

	const persist = useCallback(
		(next: GameState, stamp: number = Date.now()) => {
			if (next.status === 'completed') {
				void saveRepository.clear()
				return
			}
			void saveRepository.savePlaying(next, stamp)
		},
		[saveRepository],
	)

	const dispatch = useCallback(
		(action: GameAction): void => {
			setState((current) => {
				const next = gameReducer(current, action)
				const shouldPersist =
					action.type === 'INPUT_DIGIT' ||
					action.type === 'ERASE' ||
					action.type === 'UNDO' ||
					action.type === 'REPLAY' ||
					action.type === 'TIMER_PAUSE' ||
					action.type === 'COMPLETE' ||
					action.type === 'DEV_FILL_SOLUTION'
				if (shouldPersist || next.status === 'completed') {
					persist(next)
				}
				return next
			})
		},
		[persist],
	)

	useEffect(() => {
		const stamp = Date.now()
		const id = setTimeout(() => {
			dispatch({ type: 'TIMER_RESUME', now: stamp })
		}, 0)
		return () => clearTimeout(id)
	}, [dispatch, initialState.puzzle.seed])

	useEffect(() => {
		if (state.status !== 'playing' || state.timerRunningSince === null) {
			return
		}
		const id = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(id)
	}, [state.status, state.timerRunningSince])

	useEffect(() => {
		if (state.status !== 'playing') {
			return
		}
		const id = setInterval(() => {
			persist(stateRef.current, Date.now())
		}, TIMER_AUTOSAVE_MS)
		return () => clearInterval(id)
	}, [persist, state.status, state.puzzle.seed])

	useEffect(() => {
		const onChange = (next: AppStateStatus) => {
			const stamp = Date.now()
			if (next === 'active') {
				dispatch({ type: 'TIMER_RESUME', now: stamp })
			} else {
				dispatch({ type: 'TIMER_PAUSE', now: stamp })
			}
		}
		const sub = AppState.addEventListener('change', onChange)
		return () => sub.remove()
	}, [dispatch])

	const elapsedMs = getElapsedMs(
		state.timerAccumulatedMs,
		state.timerRunningSince,
		now,
	)
	const elapsedLabel = formatElapsed(elapsedMs)
	const difficultyLabel =
		DIFFICULTY_LABELS[state.puzzle.difficultyPreset]

	const digitCounts = useMemo(
		() => countDigitOccurrences(state),
		[state],
	)
	const dimmedDigits = useMemo(() => {
		const set = new Set<number>()
		for (let digit = 1; digit <= 9; digit += 1) {
			if ((digitCounts[digit] ?? 0) >= 9) {
				set.add(digit)
			}
		}
		return set
	}, [digitCounts])

	const gameplayLocked = state.status === 'completed'

	return (
		<View
			style={[
				styles.screen,
				{
					paddingTop: insets.top + 4,
					paddingBottom: Math.max(insets.bottom, 6),
				},
			]}
		>
			<View style={styles.header}>
				<Pressable
					onPress={onExitToHome}
					accessibilityRole="button"
					accessibilityLabel="На главную"
					hitSlop={8}
				>
					<Text style={styles.homeLink}>←</Text>
				</Pressable>
				<View style={styles.headerCenter}>
					<Text style={styles.title}>Киллер Судоку</Text>
					<Text style={styles.difficulty}>{difficultyLabel}</Text>
				</View>
				<Text
					style={styles.timer}
					accessibilityLabel={`Время ${elapsedLabel}`}
				>
					{elapsedLabel}
				</Text>
			</View>

			<View style={styles.boardWrap}>
				<KillerBoard
					state={state}
					boardSize={boardSize}
					onSelectCell={(cell) => {
						if (!gameplayLocked) {
							dispatch({ type: 'SELECT_CELL', cell })
						}
					}}
				/>
			</View>

			{typeof __DEV__ !== 'undefined' && __DEV__ ? (
				<Pressable
					onPress={() => dispatch({ type: 'DEV_FILL_SOLUTION' })}
					accessibilityRole="button"
					accessibilityLabel="Заполнить решение для проверки"
					style={styles.devButton}
				>
					<Text style={styles.devButtonText}>DEV: заполнить</Text>
				</Pressable>
			) : (
				<View style={styles.devSpacer} />
			)}

			<GameToolbar
				notesMode={state.notesMode}
				canUndo={state.history.length > 0}
				disabled={gameplayLocked}
				onUndo={() => dispatch({ type: 'UNDO' })}
				onToggleNotes={() => dispatch({ type: 'TOGGLE_NOTES_MODE' })}
				onErase={() => dispatch({ type: 'ERASE' })}
			/>

			<NumberKeypad
				disabled={gameplayLocked}
				dimmedDigits={dimmedDigits}
				onDigit={(digit: Digit) =>
					dispatch({ type: 'INPUT_DIGIT', digit })
				}
			/>

			<CompletionOverlay
				visible={state.status === 'completed'}
				elapsedLabel={formatElapsed(state.timerAccumulatedMs)}
				onNewGame={onNewGameFromCompletion}
				onReplay={() => {
					dispatch({ type: 'REPLAY' })
					dispatch({ type: 'TIMER_RESUME', now: Date.now() })
				}}
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
		minHeight: 40,
	},
	homeLink: {
		fontSize: 22,
		color: colors.secondaryText,
		width: 28,
	},
	headerCenter: {
		flex: 1,
		alignItems: 'center',
	},
	title: {
		fontSize: typography.titleSize,
		fontWeight: '700',
		color: colors.headerText,
	},
	difficulty: {
		fontSize: 12,
		color: colors.secondaryText,
		marginTop: 1,
	},
	timer: {
		fontSize: typography.timerSize,
		fontWeight: '500',
		color: colors.secondaryText,
		fontVariant: ['tabular-nums'],
		minWidth: 52,
		textAlign: 'right',
	},
	boardWrap: {
		alignItems: 'center',
		justifyContent: 'center',
		flexGrow: 1,
	},
	devButton: {
		alignSelf: 'center',
		marginBottom: 4,
		paddingHorizontal: 8,
		paddingVertical: 2,
	},
	devButtonText: {
		fontSize: 11,
		color: colors.secondaryText,
	},
	devSpacer: {
		height: 4,
	},
})
