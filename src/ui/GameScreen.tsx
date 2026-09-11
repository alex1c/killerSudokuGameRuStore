/**
 * Phase 3 game screen: deferred load, timer, notes/undo/erase, completion.
 */

import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type Dispatch,
	type SetStateAction,
} from 'react'
import {
	Alert,
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
import {
	countDigitOccurrences,
	createGame,
	formatElapsed,
	gameReducer,
	getElapsedMs,
	hasPlayerProgress,
	type GameAction,
	type GameState,
} from '../gameplay'
import { colors, spacing, typography } from '../theme'
import { computeBoardSize } from './boardLayout'
import { CompletionOverlay } from './CompletionOverlay'
import { GameToolbar } from './GameToolbar'
import { KillerBoard } from './KillerBoard'
import { NumberKeypad } from './NumberKeypad'

/**
 * Root screen keeps deferred generation so the first UI commit is never blocked.
 */
export function GameScreen() {
	const insets = useSafeAreaInsets()
	const [state, setState] = useState<GameState | null>(null)
	const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const queueGameLoad = useCallback((seed?: number) => {
		if (loadTimerRef.current !== null) {
			clearTimeout(loadTimerRef.current)
		}
		// Clear the board first so the loading screen can paint before generation.
		setState(null)
		loadTimerRef.current = setTimeout(() => {
			setState(createGame(seed !== undefined ? { seed } : {}))
			loadTimerRef.current = null
		}, 0)
	}, [])

	useEffect(() => {
		// Schedule after first paint — never generate synchronously in render/effect body.
		loadTimerRef.current = setTimeout(() => {
			setState(createGame())
			loadTimerRef.current = null
		}, 0)
		return () => {
			if (loadTimerRef.current !== null) {
				clearTimeout(loadTimerRef.current)
			}
		}
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

	return (
		<LoadedGameScreen
			state={state}
			setState={setState}
			onRequestNewGame={(seed) => {
				queueGameLoad(seed)
			}}
		/>
	)
}

interface LoadedGameScreenProps {
	state: GameState
	setState: Dispatch<SetStateAction<GameState | null>>
	onRequestNewGame: (seed?: number) => void
}

function LoadedGameScreen({
	state,
	setState,
	onRequestNewGame,
}: LoadedGameScreenProps) {
	const insets = useSafeAreaInsets()
	const { width } = useWindowDimensions()
	const boardSize = useMemo(() => computeBoardSize(width), [width])
	const [now, setNow] = useState(() => Date.now())

	const dispatch = useCallback(
		(action: GameAction): void => {
			setState((current) =>
				current === null ? current : gameReducer(current, action),
			)
		},
		[setState],
	)

	// Start the timer only once the playable board is mounted (loading excluded).
	useEffect(() => {
		const stamp = Date.now()
		const id = setTimeout(() => {
			dispatch({ type: 'TIMER_RESUME', now: stamp })
		}, 0)
		return () => clearTimeout(id)
	}, [dispatch, state.puzzle.seed])

	// Re-render the clock label once per second without drifting accumulated time.
	useEffect(() => {
		if (state.status !== 'playing' || state.timerRunningSince === null) {
			return
		}
		const id = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(id)
	}, [state.status, state.timerRunningSince])

	// Pause / resume on AppState background transitions.
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

	const confirmNewGame = () => {
		if (hasPlayerProgress(state) && state.status === 'playing') {
			Alert.alert(
				'Новая игра',
				'Начать новую игру? Текущий прогресс будет потерян.',
				[
					{ text: 'Отмена', style: 'cancel' },
					{
						text: 'Начать',
						style: 'destructive',
						onPress: () => onRequestNewGame(),
					},
				],
			)
			return
		}
		onRequestNewGame()
	}

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
				<Text style={styles.title}>Киллер Судоку</Text>
				<View style={styles.headerRight}>
					<Text
						style={styles.timer}
						accessibilityLabel={`Время ${elapsedLabel}`}
					>
						{elapsedLabel}
					</Text>
					<Pressable
						onPress={confirmNewGame}
						accessibilityRole="button"
						accessibilityLabel="Новая игра"
						hitSlop={8}
						style={styles.newButton}
					>
						<Text style={styles.newButtonText}>Новая</Text>
					</Pressable>
				</View>
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
				onNewGame={() => onRequestNewGame()}
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
		minHeight: 36,
	},
	title: {
		fontSize: typography.titleSize,
		fontWeight: '700',
		color: colors.headerText,
	},
	headerRight: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	timer: {
		fontSize: typography.timerSize,
		fontWeight: '500',
		color: colors.secondaryText,
		fontVariant: ['tabular-nums'],
	},
	newButton: {
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 8,
		backgroundColor: colors.toolbarBackground,
		borderWidth: 1,
		borderColor: colors.keypadBorder,
	},
	newButtonText: {
		color: colors.primaryText,
		fontWeight: '600',
		fontSize: 13,
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
	loading: {
		flex: 1,
		textAlign: 'center',
		textAlignVertical: 'center',
		color: colors.primaryText,
		fontSize: 18,
		fontWeight: '600',
	},
})
