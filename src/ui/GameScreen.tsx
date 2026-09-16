/**
 * Playable game screen — receives an already-created GameState from the app shell.
 * Smart Hint uses LogicalStep only (no solution leak).
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
import type { SettingsV1 } from '../settings'
import {
	advanceHintSession,
	createHintSession,
	placementFromHint,
	presentHint,
	type FormattedHint,
	type HintSession,
} from '../hints'
import { colors, spacing, typography } from '../theme'
import { computeBoardSize } from './boardLayout'
import { CompletionOverlay } from './CompletionOverlay'
import { GameToolbar } from './GameToolbar'
import { KillerBoard } from './KillerBoard'
import { NumberKeypad } from './NumberKeypad'

export interface GameScreenProps {
	initialState: GameState
	saveRepository: GameSaveRepository
	settings: SettingsV1
	onExitToHome: () => void
	onNewGameFromCompletion: () => void
	/** First meaningful player action (digit/erase) — for stats.started. */
	onMeaningfulAction?: () => void
	/** Fired once when the puzzle completes. */
	onCompleted?: (elapsedMs: number) => void
}

const TIMER_AUTOSAVE_MS = 30_000

export function GameScreen(props: GameScreenProps) {
	const {
		initialState,
		saveRepository,
		settings,
		onExitToHome,
		onNewGameFromCompletion,
		onMeaningfulAction,
		onCompleted,
	} = props
	const insets = useSafeAreaInsets()
	const { width } = useWindowDimensions()
	const boardSize = useMemo(() => computeBoardSize(width), [width])
	const [state, setState] = useState<GameState>(initialState)
	const [now, setNow] = useState(() => Date.now())
	const [hintSession, setHintSession] = useState<HintSession | null>(null)
	const [hintView, setHintView] = useState<FormattedHint | null>(null)
	const stateRef = useRef(state)
	const meaningfulRef = useRef(false)
	const completedNotified = useRef(false)

	useEffect(() => {
		stateRef.current = state
	}, [state])

	useEffect(() => {
		if (
			state.status === 'completed' &&
			!completedNotified.current
		) {
			completedNotified.current = true
			onCompleted?.(state.timerAccumulatedMs)
		}
	}, [state.status, state.timerAccumulatedMs, onCompleted])

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

	const gameplayOptions = useMemo(
		() => ({ autoClearNotes: settings.autoClearNotes }),
		[settings.autoClearNotes],
	)

	const dispatch = useCallback(
		(action: GameAction): void => {
			if (
				!meaningfulRef.current &&
				(action.type === 'INPUT_DIGIT' || action.type === 'ERASE')
			) {
				meaningfulRef.current = true
				onMeaningfulAction?.()
			}
			setState((current) => {
				const next = gameReducer(current, action, gameplayOptions)
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
			// Board changed — dismiss active hint to avoid stale highlights.
			if (
				action.type === 'INPUT_DIGIT' ||
				action.type === 'ERASE' ||
				action.type === 'UNDO' ||
				action.type === 'REPLAY'
			) {
				setHintSession(null)
				setHintView(null)
			}
		},
		[gameplayOptions, onMeaningfulAction, persist],
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

	const hintHighlightCells = useMemo(() => {
		if (!hintView) {
			return undefined
		}
		return new Set(hintView.highlightCells)
	}, [hintView])

	const hintTargetCells = useMemo(() => {
		if (!hintView) {
			return undefined
		}
		return new Set(hintView.targetCells)
	}, [hintView])

	const handleHintPress = () => {
		if (gameplayLocked) {
			return
		}
		if (hintSession === null) {
			const session = createHintSession(state)
			setHintSession(session)
			setHintView(presentHint(session))
			return
		}
		const next = advanceHintSession(hintSession)
		setHintSession(next)
		setHintView(presentHint(next))
	}

	const handleApplyHint = () => {
		if (!hintSession?.step) {
			return
		}
		const placement = placementFromHint(hintSession.step)
		if (!placement) {
			setHintSession(null)
			setHintView(null)
			return
		}
		dispatch({ type: 'SELECT_CELL', cell: placement.cell })
		dispatch({ type: 'INPUT_DIGIT', digit: placement.digit })
		setHintSession(null)
		setHintView(null)
	}

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
					{settings.showTimer ? elapsedLabel : ' '}
				</Text>
			</View>

			<View style={styles.boardWrap}>
				<KillerBoard
					state={state}
					boardSize={boardSize}
					highlightRelated={settings.highlightRelated}
					highlightSameNumbers={settings.highlightSameNumbers}
					checkAgainstSolution={
						settings.errorChecking === 'immediate'
					}
					hintHighlightCells={hintHighlightCells}
					hintTargetCells={hintTargetCells}
					onSelectCell={(cell) => {
						if (!gameplayLocked) {
							dispatch({ type: 'SELECT_CELL', cell })
						}
					}}
				/>
			</View>

			{hintView ? (
				<View style={styles.hintCard}>
					<Text style={styles.hintTitle}>{hintView.title}</Text>
					<Text style={styles.hintBody}>{hintView.body}</Text>
					<View style={styles.hintActions}>
						{hintView.canAdvance ? (
							<Pressable
								onPress={handleHintPress}
								accessibilityRole="button"
							>
								<Text style={styles.hintAction}>Далее</Text>
							</Pressable>
						) : null}
						{hintView.canApply ? (
							<Pressable
								onPress={handleApplyHint}
								accessibilityRole="button"
							>
								<Text style={styles.hintAction}>
									Показать ход
								</Text>
							</Pressable>
						) : null}
						<Pressable
							onPress={() => {
								setHintSession(null)
								setHintView(null)
							}}
							accessibilityRole="button"
						>
							<Text style={styles.hintDismiss}>Закрыть</Text>
						</Pressable>
					</View>
				</View>
			) : typeof __DEV__ !== 'undefined' && __DEV__ ? (
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
				hintActive={hintSession !== null}
				onUndo={() => dispatch({ type: 'UNDO' })}
				onToggleNotes={() => dispatch({ type: 'TOGGLE_NOTES_MODE' })}
				onErase={() => dispatch({ type: 'ERASE' })}
				onHint={handleHintPress}
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
					completedNotified.current = false
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
	hintCard: {
		marginHorizontal: spacing.screenPadding,
		marginBottom: 6,
		padding: 10,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: colors.keypadBorder,
		backgroundColor: colors.boardBackground,
	},
	hintTitle: {
		fontWeight: '700',
		color: colors.primaryText,
		marginBottom: 4,
	},
	hintBody: {
		color: colors.secondaryText,
		fontSize: 13,
		lineHeight: 18,
	},
	hintActions: {
		flexDirection: 'row',
		gap: 16,
		marginTop: 8,
	},
	hintAction: {
		color: colors.playerText,
		fontWeight: '700',
		fontSize: 14,
	},
	hintDismiss: {
		color: colors.secondaryText,
		fontWeight: '600',
		fontSize: 14,
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
