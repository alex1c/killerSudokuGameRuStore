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
	Alert,
	AppState,
	BackHandler,
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
	isBoardComplete,
	isPuzzleSolved,
	type GameAction,
	type GameState,
} from '../gameplay'
import type { GameSaveRepository } from '../storage'
import type { SettingsV1 } from '../settings'
import { playHaptic, playSound } from '../feedback'
import { trackAnalytics } from '../analytics'
import {
	advanceHintSession,
	createHintSession,
	placementFromHint,
	presentHint,
	type FormattedHint,
	type HintSession,
} from '../hints'
import { colors, spacing, typography } from '../theme'
import { AdBanner, isGameScreenBannerAllowed } from '../ads'
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
	onCompleted?: (info: {
		elapsedMs: number
		hintsUsed: number
	}) => void
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
	/** Available width inside screen padding — KillerBoard also measures onLayout. */
	const boardAvailableWidth = useMemo(
		() => Math.max(0, width - spacing.screenPadding * 2),
		[width],
	)
	const showGameBanner = isGameScreenBannerAllowed()
	/** Stable banner element — not recreated when gameplay state changes. */
	const gameBanner = useMemo(
		() => (showGameBanner ? <AdBanner placement="game" /> : null),
		[showGameBanner],
	)
	const [state, setState] = useState<GameState>(initialState)
	const [now, setNow] = useState(() => Date.now())
	const [hintSession, setHintSession] = useState<HintSession | null>(null)
	const [hintView, setHintView] = useState<FormattedHint | null>(null)
	/** on_complete: highlight solution mismatches after a full-board check. */
	const [revealMismatches, setRevealMismatches] = useState(false)

	useEffect(() => {
		const subscription = BackHandler.addEventListener(
			'hardwareBackPress',
			() => {
				if (hintView) {
					setHintSession(null)
					setHintView(null)
					return true
				}
				onExitToHome()
				return true
			},
		)
		return () => subscription.remove()
	}, [hintView, onExitToHome])
	const stateRef = useRef(state)
	const meaningfulRef = useRef(false)
	const completedNotified = useRef(false)
	const onCompleteWarned = useRef(false)
	const hintsUsedRef = useRef(0)

	useEffect(() => {
		stateRef.current = state
	}, [state])

	useEffect(() => {
		if (
			state.status === 'completed' &&
			!completedNotified.current
		) {
			completedNotified.current = true
			void playHaptic(settings.hapticEnabled, 'success')
			void playSound(settings.soundEnabled, 'completion')
			onCompleted?.({
				elapsedMs: state.timerAccumulatedMs,
				hintsUsed: hintsUsedRef.current,
			})
		}
	}, [
		state.status,
		state.timerAccumulatedMs,
		onCompleted,
		settings.hapticEnabled,
		settings.soundEnabled,
	])

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

			const current = stateRef.current
			const next = gameReducer(current, action, gameplayOptions)
			stateRef.current = next
			setState(next)

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

			if (
				action.type === 'INPUT_DIGIT' ||
				action.type === 'ERASE' ||
				action.type === 'UNDO' ||
				action.type === 'REPLAY'
			) {
				setHintSession(null)
				setHintView(null)
			}
			if (action.type === 'REPLAY') {
				onCompleteWarned.current = false
				setRevealMismatches(false)
			}

			let playError = false
			let playInput = false

			if (
				action.type === 'INPUT_DIGIT' &&
				!next.notesMode &&
				next.selectedCell !== null
			) {
				const cell = next.selectedCell
				const value = next.values[cell] ?? 0
				const expected = next.puzzle.solution[cell] ?? 0
				const isMismatch = value !== 0 && value !== expected
				if (settings.errorChecking === 'immediate' && isMismatch) {
					playError = true
				} else {
					playInput = true
				}
			}

			if (
				settings.errorChecking === 'on_complete' &&
				(action.type === 'INPUT_DIGIT' ||
					action.type === 'ERASE' ||
					action.type === 'UNDO')
			) {
				if (
					isBoardComplete(next) &&
					!isPuzzleSolved(next) &&
					!onCompleteWarned.current
				) {
					onCompleteWarned.current = true
					setRevealMismatches(true)
					playError = true
					Alert.alert(
						'Есть ошибки',
						'Есть ошибки. Проверьте заполненные клетки.',
					)
				} else if (!isBoardComplete(next)) {
					onCompleteWarned.current = false
					setRevealMismatches(false)
				}
			}

			if (playError) {
				void playHaptic(settings.hapticEnabled, 'error')
				void playSound(settings.soundEnabled, 'error')
			} else if (playInput) {
				void playHaptic(settings.hapticEnabled, 'light')
				void playSound(settings.soundEnabled, 'input')
			}
		},
		[
			gameplayOptions,
			onMeaningfulAction,
			persist,
			settings.errorChecking,
			settings.hapticEnabled,
			settings.soundEnabled,
		],
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

	const checkAgainstSolution =
		settings.errorChecking === 'immediate' ||
		(settings.errorChecking === 'on_complete' && revealMismatches)

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
		void playHaptic(settings.hapticEnabled, 'selection')
		if (hintSession === null) {
			const session = createHintSession(state)
			setHintSession(session)
			setHintView(presentHint(session))
			hintsUsedRef.current += 1
			trackAnalytics('hint_opened', {
				difficulty: state.puzzle.difficultyPreset,
			})
			return
		}
		const next = advanceHintSession(hintSession)
		setHintSession(next)
		const view = presentHint(next)
		setHintView(view)
		if (view.level >= 3 && next.step) {
			trackAnalytics('hint_revealed', {
				difficulty: state.puzzle.difficultyPreset,
				technique: next.step.technique,
				level: view.level,
			})
		}
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
		void playHaptic(settings.hapticEnabled, 'selection')
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
					boardSize={boardAvailableWidth}
					highlightRelated={settings.highlightRelated}
					highlightSameNumbers={settings.highlightSameNumbers}
					checkAgainstSolution={checkAgainstSolution}
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
								accessibilityLabel="Следующий уровень подсказки"
							>
								<Text style={styles.hintAction}>Далее</Text>
							</Pressable>
						) : null}
						{hintView.canApply ? (
							<Pressable
								onPress={handleApplyHint}
								accessibilityRole="button"
								accessibilityLabel="Показать ход"
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
							accessibilityLabel="Закрыть подсказку"
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

			<NumberKeypad
				disabled={gameplayLocked}
				dimmedDigits={dimmedDigits}
				onDigit={(digit: Digit) =>
					dispatch({ type: 'INPUT_DIGIT', digit })
				}
			/>

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

			{/* Leftover space keeps the board priority; banner sits above safe area. */}
			<View style={styles.flexSpacer} />
			<View style={styles.gameBannerSlot}>{gameBanner}</View>

			<CompletionOverlay
				visible={state.status === 'completed'}
				elapsedLabel={formatElapsed(state.timerAccumulatedMs)}
				onNewGame={onNewGameFromCompletion}
				onReplay={() => {
					completedNotified.current = false
					hintsUsedRef.current = 0
					trackAnalytics('game_started', {
						difficulty: state.puzzle.difficultyPreset,
						source: 'replay',
					})
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
		paddingVertical: spacing.headerGap,
		gap: 8,
	},
	homeLink: {
		fontSize: 22,
		fontWeight: '700',
		color: colors.secondaryText,
		minWidth: 28,
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
		fontSize: 13,
		color: colors.secondaryText,
		fontWeight: '600',
	},
	timer: {
		fontSize: typography.timerSize,
		fontWeight: '600',
		color: colors.primaryText,
		minWidth: 52,
		textAlign: 'right',
	},
	boardWrap: {
		width: '100%',
		paddingHorizontal: spacing.screenPadding,
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 4,
	},
	flexSpacer: {
		flexGrow: 1,
		flexShrink: 1,
		minHeight: 0,
	},
	gameBannerSlot: {
		width: '100%',
		minHeight: 0,
		justifyContent: 'flex-end',
	},
	hintCard: {
		marginHorizontal: spacing.screenPadding,
		marginBottom: 6,
		padding: 12,
		borderRadius: 12,
		backgroundColor: colors.boardBackground,
		borderWidth: 1,
		borderColor: colors.keypadBorder,
		gap: 6,
	},
	hintTitle: {
		fontSize: 14,
		fontWeight: '700',
		color: colors.playerText,
	},
	hintBody: {
		fontSize: 13,
		lineHeight: 18,
		color: colors.primaryText,
	},
	hintActions: {
		flexDirection: 'row',
		gap: 16,
		marginTop: 4,
	},
	hintAction: {
		fontSize: 14,
		fontWeight: '700',
		color: colors.playerText,
	},
	hintDismiss: {
		fontSize: 14,
		fontWeight: '600',
		color: colors.secondaryText,
	},
	devButton: {
		alignSelf: 'center',
		paddingVertical: 4,
		paddingHorizontal: 10,
		marginBottom: 4,
	},
	devButtonText: {
		fontSize: 11,
		color: colors.secondaryText,
	},
	devSpacer: {
		height: 8,
	},
})
