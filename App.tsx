/**
 * App shell: Home → Difficulty → Loading → Game, with Continue restore.
 * Phase 6Q: Hard/Expert prefer prepared pool; background fill only on Home.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	ActivityIndicator,
	Alert,
	AppState,
	type AppStateStatus,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Difficulty } from './src/game/difficulty'
import {
	createGame,
	createGameFromPuzzle,
	type GameState,
} from './src/gameplay'
import { createGameAsync } from './src/gameplay/createGameAsync'
import {
	createGenerationCancelToken,
	type GenerationCancelToken,
} from './src/game/killer/cooperative'
import {
	GameSaveRepository,
	restoreGameFromSave,
	type SavedGameV1,
} from './src/storage'
import { asyncStorageAdapter } from './src/storage/asyncStorageAdapter'
import { getSharedPuzzlePoolController } from './src/pool/puzzlePoolController'
import { colors } from './src/theme'
import { DifficultyScreen } from './src/ui/DifficultyScreen'
import { GameScreen } from './src/ui/GameScreen'
import { HomeScreen } from './src/ui/HomeScreen'
import { Phase4QaScreen } from './src/dev/Phase4QaScreen'

type Route =
	| { name: 'boot' }
	| { name: 'home' }
	| { name: 'difficulty' }
	| {
			name: 'loading'
			difficulty: Difficulty
			seed: number
			visibleStartedAt: number
			fromPool: boolean
	  }
	| { name: 'play'; state: GameState }
	| { name: 'qa' }

function AppRoot() {
	const saveRepository = useMemo(
		() => new GameSaveRepository(asyncStorageAdapter),
		[],
	)
	const poolController = useMemo(
		() => getSharedPuzzlePoolController(asyncStorageAdapter),
		[],
	)
	const [route, setRoute] = useState<Route>({ name: 'boot' })
	const [savedGame, setSavedGame] = useState<SavedGameV1 | null>(null)
	const loadTaskRef = useRef<{ cancel: () => void } | null>(null)
	const loadEpochRef = useRef(0)
	const genCancelRef = useRef<GenerationCancelToken | null>(null)

	useEffect(() => {
		let cancelled = false
		void (async () => {
			const loaded = await saveRepository.load()
			if (cancelled) {
				return
			}
			setSavedGame(loaded.ok ? loaded.save : null)
			setRoute({ name: 'home' })
		})()
		return () => {
			cancelled = true
			if (loadTaskRef.current !== null) {
				loadTaskRef.current.cancel()
			}
			genCancelRef.current?.cancel()
			poolController.pauseFill()
		}
	}, [saveRepository, poolController])

	// Home idle → warm Hard/Expert pool (deferred until UI is interactive).
	useEffect(() => {
		if (route.name !== 'home') {
			poolController.setHomeVisible(false)
			if (route.name === 'play' || route.name === 'loading') {
				poolController.setGameplayActive(true)
			}
			return
		}
		poolController.setGameplayActive(false)
		poolController.setHomeVisible(true)
		const timer = setTimeout(() => {
			void poolController.ensureLoaded().then(() => {
				void poolController.scheduleFill('home-idle')
			})
		}, 600)
		return () => {
			clearTimeout(timer)
		}
	}, [route.name, poolController])

	useEffect(() => {
		const onChange = (next: AppStateStatus) => {
			poolController.setAppActive(next === 'active')
		}
		const sub = AppState.addEventListener('change', onChange)
		return () => {
			sub.remove()
		}
	}, [poolController])

	const refreshSavedCard = useCallback(async () => {
		const loaded = await saveRepository.load()
		setSavedGame(loaded.ok ? loaded.save : null)
	}, [saveRepository])

	const startGeneration = useCallback(
		(difficulty: Difficulty, seed: number) => {
			if (loadTaskRef.current !== null) {
				loadTaskRef.current.cancel()
			}
			genCancelRef.current?.cancel()
			const epoch = ++loadEpochRef.current
			const visibleStartedAt = Date.now()
			const usePool = difficulty === 'hard' || difficulty === 'expert'
			setRoute({
				name: 'loading',
				difficulty,
				seed,
				visibleStartedAt,
				fromPool: usePool,
			})
			poolController.setGameplayActive(true)
			poolController.pauseFill()

			let cancelled = false
			const cancelToken = createGenerationCancelToken()
			genCancelRef.current = cancelToken

			const timer = setTimeout(() => {
				void (async () => {
					try {
						let state: GameState
						let fromPool = false
						let retrievalMs = 0

						if (usePool) {
							const prepared = await poolController.consume(
								difficulty,
							)
							if (
								prepared !== null &&
								!cancelled &&
								epoch === loadEpochRef.current
							) {
								state = createGameFromPuzzle(prepared.puzzle)
								fromPool = true
								retrievalMs = prepared.retrievalMs
							} else {
								// Empty pool fallback — cooperative generate.
								state = await createGameAsync({
									seed,
									difficulty,
									cancelToken,
									digYieldEvery: 3,
								})
							}
						} else {
							// Easy/Medium stay fast sync on-demand.
							state = createGame({ seed, difficulty })
						}

						if (cancelled || epoch !== loadEpochRef.current) {
							return
						}
						await saveRepository.savePlaying(state)
						if (cancelled || epoch !== loadEpochRef.current) {
							return
						}
						if (typeof __DEV__ !== 'undefined' && __DEV__) {
							const userVisibleLoadingMs =
								Date.now() - visibleStartedAt
							console.log(
								`[KILLER_UI] userVisibleLoadingMs=${userVisibleLoadingMs} fromPool=${fromPool} retrievalMs=${retrievalMs.toFixed(1)} difficulty=${difficulty}`,
							)
						}
						setRoute({ name: 'play', state })
					} catch (error) {
						if (cancelled || epoch !== loadEpochRef.current) {
							return
						}
						Alert.alert(
							'Не удалось создать головоломку',
							error instanceof Error
								? error.message
								: String(error),
						)
						void refreshSavedCard().then(() =>
							setRoute({ name: 'home' }),
						)
					} finally {
						if (epoch === loadEpochRef.current) {
							loadTaskRef.current = null
							genCancelRef.current = null
						}
					}
				})()
			}, 32)

			loadTaskRef.current = {
				cancel: () => {
					cancelled = true
					cancelToken.cancel()
					clearTimeout(timer)
				},
			}
		},
		[poolController, refreshSavedCard, saveRepository],
	)

	const requestNewGame = useCallback(() => {
		const go = () => setRoute({ name: 'difficulty' })
		if (savedGame) {
			Alert.alert(
				'Новая игра',
				'Начать новую игру?\n\nТекущая незавершённая игра будет заменена.',
				[
					{ text: 'Отмена', style: 'cancel' },
					{ text: 'Начать новую', style: 'destructive', onPress: go },
				],
			)
			return
		}
		go()
	}, [savedGame])

	if (route.name === 'boot') {
		return <LoadingView message="Загрузка…" />
	}

	if (route.name === 'home') {
		return (
			<HomeScreen
				savedGame={savedGame}
				onContinue={() => {
					if (!savedGame) {
						return
					}
					poolController.setGameplayActive(true)
					poolController.pauseFill()
					const state = restoreGameFromSave(savedGame)
					setRoute({ name: 'play', state })
				}}
				onNewGame={requestNewGame}
				onOpenQa={
					typeof __DEV__ !== 'undefined' && __DEV__
						? () => setRoute({ name: 'qa' })
						: undefined
				}
			/>
		)
	}

	if (route.name === 'qa') {
		if (typeof __DEV__ === 'undefined' || !__DEV__) {
			return (
				<HomeScreen
					savedGame={savedGame}
					onContinue={() => {
						if (!savedGame) {
							return
						}
						setRoute({
							name: 'play',
							state: restoreGameFromSave(savedGame),
						})
					}}
					onNewGame={requestNewGame}
				/>
			)
		}
		return (
			<Phase4QaScreen
				onBack={() => setRoute({ name: 'home' })}
				poolController={poolController}
			/>
		)
	}

	if (route.name === 'difficulty') {
		return (
			<DifficultyScreen
				onBack={() => setRoute({ name: 'home' })}
				onSelect={(difficulty) => {
					const seed =
						(Date.now() ^
							Math.floor(Math.random() * 0xffffffff)) >>>
						0
					startGeneration(difficulty, seed)
				}}
			/>
		)
	}

	if (route.name === 'loading') {
		const message =
			route.difficulty === 'hard' || route.difficulty === 'expert'
				? 'Создаём сложную головоломку…'
				: 'Создаём головоломку…'
		return (
			<LoadingView
				message={message}
				onCancel={() => {
					loadEpochRef.current += 1
					if (loadTaskRef.current !== null) {
						loadTaskRef.current.cancel()
						loadTaskRef.current = null
					}
					genCancelRef.current?.cancel()
					void refreshSavedCard().then(() =>
						setRoute({ name: 'home' }),
					)
				}}
			/>
		)
	}

	return (
		<GameScreen
			initialState={route.state}
			saveRepository={saveRepository}
			onExitToHome={() => {
				void refreshSavedCard().then(() => setRoute({ name: 'home' }))
			}}
			onNewGameFromCompletion={() => {
				void saveRepository.clear()
				setSavedGame(null)
				setRoute({ name: 'difficulty' })
			}}
		/>
	)
}

function LoadingView(props: {
	message: string
	onCancel?: () => void
}) {
	const insets = useSafeAreaInsets()
	return (
		<View
			style={[
				styles.loadingScreen,
				{
					paddingTop: insets.top + 24,
					paddingBottom: insets.bottom + 24,
				},
			]}
		>
			<ActivityIndicator size="large" color={colors.playerText} />
			<Text style={styles.loadingText}>{props.message}</Text>
			{props.onCancel ? (
				<Pressable onPress={props.onCancel} accessibilityRole="button">
					<Text style={styles.cancel}>Отмена</Text>
				</Pressable>
			) : null}
		</View>
	)
}

export default function App() {
	return (
		<SafeAreaProvider>
			<StatusBar style="dark" />
			<AppRoot />
		</SafeAreaProvider>
	)
}

const styles = StyleSheet.create({
	loadingScreen: {
		flex: 1,
		backgroundColor: colors.background,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 16,
	},
	loadingText: {
		fontSize: 18,
		fontWeight: '600',
		color: colors.primaryText,
	},
	cancel: {
		marginTop: 24,
		color: colors.secondaryText,
		fontSize: 16,
		fontWeight: '600',
	},
})
