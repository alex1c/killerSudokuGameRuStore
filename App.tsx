/**
 * App shell: Home, Daily, Learning, Stats, Settings, Onboarding, About, New Game.
 * Product block wiring — no sync generation on Home open.
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
	applyBackupAtomic,
	buildBackup,
	exportBackupToShare,
	pickBackupJsonFile,
} from './src/backup'
import { trackAnalytics } from './src/analytics'
import {
	createEmptyDailyProgress,
	createEmptyLearningProgress,
	createEmptyOnboarding,
	createEmptyStats,
	DailyProgressRepository,
	DEFAULT_SETTINGS,
	GameSaveRepository,
	LearningProgressRepository,
	localDateString,
	markDailyCompleted,
	markLessonInteractiveComplete,
	markLessonViewed,
	markOnboardingCompleted,
	OnboardingRepository,
	recordGameCompleted,
	recordGameStarted,
	restoreGameFromSave,
	SettingsRepository,
	StatsRepository,
	uniqueKey,
	type DailyProgressV1,
	type LearningProgressV1,
	type OnboardingV1,
	type SavedGameV1,
	type SettingsV1,
	type StatsV1,
} from './src/storage'
import { asyncStorageAdapter } from './src/storage/asyncStorageAdapter'
import { getSharedPuzzlePoolController } from './src/pool/puzzlePoolController'
import { createOrLoadDailyPuzzle } from './src/daily'
import { colors } from './src/theme'
import { DifficultyScreen } from './src/ui/DifficultyScreen'
import { GameScreen } from './src/ui/GameScreen'
import { HomeScreen } from './src/ui/HomeScreen'
import { DailyScreen } from './src/ui/DailyScreen'
import { LearningScreen } from './src/ui/LearningScreen'
import { StatsScreen } from './src/ui/StatsScreen'
import { SettingsScreen } from './src/ui/SettingsScreen'
import { OnboardingScreen } from './src/ui/OnboardingScreen'
import { AboutScreen } from './src/ui/AboutScreen'
import { Phase4QaScreen } from './src/dev/Phase4QaScreen'

type PlayMeta =
	| { kind: 'normal'; difficulty: Difficulty; seed: number }
	| {
			kind: 'daily'
			difficulty: Difficulty
			seed: number
			dateStr: string
	  }

type Route =
	| { name: 'boot' }
	| { name: 'onboarding'; manual: boolean }
	| { name: 'home' }
	| { name: 'difficulty' }
	| { name: 'daily' }
	| { name: 'learning' }
	| { name: 'stats' }
	| { name: 'settings' }
	| { name: 'about' }
	| {
			name: 'loading'
			difficulty: Difficulty
			seed: number
			visibleStartedAt: number
			fromPool: boolean
			meta: PlayMeta
	  }
	| { name: 'play'; state: GameState; meta: PlayMeta }
	| { name: 'qa' }

function AppRoot() {
	const saveRepository = useMemo(
		() => new GameSaveRepository(asyncStorageAdapter),
		[],
	)
	const settingsRepository = useMemo(
		() => new SettingsRepository(asyncStorageAdapter),
		[],
	)
	const statsRepository = useMemo(
		() => new StatsRepository(asyncStorageAdapter),
		[],
	)
	const dailyRepository = useMemo(
		() => new DailyProgressRepository(asyncStorageAdapter),
		[],
	)
	const learningRepository = useMemo(
		() => new LearningProgressRepository(asyncStorageAdapter),
		[],
	)
	const onboardingRepository = useMemo(
		() => new OnboardingRepository(asyncStorageAdapter),
		[],
	)
	const poolController = useMemo(
		() => getSharedPuzzlePoolController(asyncStorageAdapter),
		[],
	)

	const [route, setRoute] = useState<Route>({ name: 'boot' })
	const [savedGame, setSavedGame] = useState<SavedGameV1 | null>(null)
	const [settings, setSettings] = useState<SettingsV1>(DEFAULT_SETTINGS)
	const [stats, setStats] = useState<StatsV1>(createEmptyStats())
	const [dailyProgress, setDailyProgress] = useState<DailyProgressV1>(
		createEmptyDailyProgress(),
	)
	const [learningProgress, setLearningProgress] =
		useState<LearningProgressV1>(createEmptyLearningProgress())
	const [onboarding, setOnboarding] = useState<OnboardingV1>(
		createEmptyOnboarding(),
	)
	const loadTaskRef = useRef<{ cancel: () => void } | null>(null)
	const loadEpochRef = useRef(0)
	const genCancelRef = useRef<GenerationCancelToken | null>(null)
	const startedKeysRef = useRef(new Set<string>())

	useEffect(() => {
		let cancelled = false
		void (async () => {
			const [
				loaded,
				nextSettings,
				nextStats,
				nextDaily,
				nextLearning,
				nextOnboarding,
			] = await Promise.all([
				saveRepository.load(),
				settingsRepository.load(),
				statsRepository.load(),
				dailyRepository.load(),
				learningRepository.load(),
				onboardingRepository.load(),
			])
			if (cancelled) {
				return
			}
			setSavedGame(loaded.ok ? loaded.save : null)
			setSettings(nextSettings)
			setStats(nextStats)
			setDailyProgress(nextDaily)
			setLearningProgress(nextLearning)
			setOnboarding(nextOnboarding)
			if (!nextOnboarding.completed) {
				setRoute({ name: 'onboarding', manual: false })
			} else {
				setRoute({ name: 'home' })
			}
		})()
		return () => {
			cancelled = true
			if (loadTaskRef.current !== null) {
				loadTaskRef.current.cancel()
			}
			genCancelRef.current?.cancel()
			poolController.pauseFill()
		}
	}, [
		saveRepository,
		settingsRepository,
		statsRepository,
		dailyRepository,
		learningRepository,
		onboardingRepository,
		poolController,
	])

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

	const refreshDaily = useCallback(async () => {
		setDailyProgress(await dailyRepository.load())
	}, [dailyRepository])

	const refreshStats = useCallback(async () => {
		setStats(await statsRepository.load())
	}, [statsRepository])

	const reloadAllUserData = useCallback(async () => {
		const [
			loaded,
			nextSettings,
			nextStats,
			nextDaily,
			nextLearning,
			nextOnboarding,
		] = await Promise.all([
			saveRepository.load(),
			settingsRepository.load(),
			statsRepository.load(),
			dailyRepository.load(),
			learningRepository.load(),
			onboardingRepository.load(),
		])
		setSavedGame(loaded.ok ? loaded.save : null)
		setSettings(nextSettings)
		setStats(nextStats)
		setDailyProgress(nextDaily)
		setLearningProgress(nextLearning)
		setOnboarding(nextOnboarding)
	}, [
		saveRepository,
		settingsRepository,
		statsRepository,
		dailyRepository,
		learningRepository,
		onboardingRepository,
	])

	const handleExportBackup = useCallback(() => {
		void (async () => {
			const backup = buildBackup({
				settings,
				stats,
				daily: dailyProgress,
				learning: learningProgress,
				activeGame: savedGame,
				onboarding,
			})
			const result = await exportBackupToShare(backup)
			if (result.ok) {
				trackAnalytics('backup_created')
				Alert.alert('Готово', 'Резервная копия создана.')
			} else {
				Alert.alert(
					'Не удалось создать копию',
					result.reason || 'Неизвестная ошибка',
				)
			}
		})()
	}, [
		settings,
		stats,
		dailyProgress,
		learningProgress,
		savedGame,
		onboarding,
	])

	const handleImportBackup = useCallback(() => {
		void (async () => {
			const picked = await pickBackupJsonFile()
			if (!picked.ok) {
				if (!picked.cancelled) {
					Alert.alert(
						'Не удалось открыть файл',
						picked.reason || 'Неизвестная ошибка',
					)
				}
				return
			}
			Alert.alert(
				'Восстановить данные?',
				'Текущие данные приложения будут заменены данными из резервной копии.',
				[
					{ text: 'Отмена', style: 'cancel' },
					{
						text: 'Восстановить',
						style: 'destructive',
						onPress: () => {
							void (async () => {
								const result = await applyBackupAtomic(
									picked.raw,
									{
										saveSettings: (next) =>
											settingsRepository.save(next),
										saveStats: (next) =>
											statsRepository.save(next),
										saveDaily: (next) =>
											dailyRepository.save(next),
										saveLearning: (next) =>
											learningRepository.save(next),
										saveActiveGame: (next) =>
											saveRepository.saveDocument(next),
										saveOnboarding: (next) =>
											onboardingRepository.save(next),
									},
								)
								if (!result.ok) {
									Alert.alert(
										'Копия не принята',
										'Файл повреждён или имеет неверный формат. Текущие данные не изменены.',
									)
									return
								}
								trackAnalytics('backup_restored')
								await reloadAllUserData()
								Alert.alert(
									'Восстановлено',
									'Данные успешно восстановлены.',
								)
								setRoute({ name: 'home' })
							})()
						},
					},
				],
			)
		})()
	}, [
		settingsRepository,
		statsRepository,
		dailyRepository,
		learningRepository,
		saveRepository,
		onboardingRepository,
		reloadAllUserData,
	])

	const startPlay = useCallback(
		(meta: PlayMeta) => {
			if (loadTaskRef.current !== null) {
				loadTaskRef.current.cancel()
			}
			genCancelRef.current?.cancel()
			const epoch = ++loadEpochRef.current
			const visibleStartedAt = Date.now()
			const { difficulty, seed } = meta
			const usePool =
				meta.kind === 'normal' &&
				(difficulty === 'hard' || difficulty === 'expert')
			setRoute({
				name: 'loading',
				difficulty,
				seed,
				visibleStartedAt,
				fromPool: usePool,
				meta,
			})
			poolController.setGameplayActive(true)
			poolController.pauseFill()
			trackAnalytics(
				meta.kind === 'daily' ? 'daily_started' : 'game_started',
				{ difficulty },
			)

			let cancelled = false
			const cancelToken = createGenerationCancelToken()
			genCancelRef.current = cancelToken

			const timer = setTimeout(() => {
				void (async () => {
					try {
						let state: GameState
						let fromPool = false
						let retrievalMs = 0

						if (meta.kind === 'daily') {
							const puzzle = await createOrLoadDailyPuzzle(
								meta.dateStr,
								difficulty,
								dailyRepository,
							)
							state = createGameFromPuzzle(puzzle)
							setDailyProgress(await dailyRepository.load())
						} else if (usePool) {
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
								state = await createGameAsync({
									seed,
									difficulty,
									cancelToken,
									digYieldEvery: 3,
								})
							}
						} else {
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
							console.log(
								`[KILLER_UI] userVisibleLoadingMs=${Date.now() - visibleStartedAt} fromPool=${fromPool} retrievalMs=${retrievalMs.toFixed(1)} difficulty=${difficulty} kind=${meta.kind}`,
							)
						}
						setRoute({ name: 'play', state, meta })
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
		[
			dailyRepository,
			poolController,
			refreshSavedCard,
			saveRepository,
		],
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

	const todayStr = localDateString(new Date())

	if (route.name === 'boot') {
		return <LoadingView message="Загрузка…" />
	}

	if (route.name === 'onboarding') {
		return (
			<OnboardingScreen
				manualReview={route.manual}
				onClose={() => setRoute({ name: 'settings' })}
				onComplete={() => {
					void onboardingRepository
						.update((current) =>
							markOnboardingCompleted(current),
						)
						.then((next) => {
							setOnboarding(next)
							trackAnalytics('onboarding_completed')
							setRoute({ name: 'home' })
						})
				}}
			/>
		)
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
					setRoute({
						name: 'play',
						state,
						meta: {
							kind: 'normal',
							difficulty: savedGame.difficulty,
							seed: savedGame.seed,
						},
					})
				}}
				onNewGame={requestNewGame}
				onOpenDaily={() => setRoute({ name: 'daily' })}
				onOpenLearning={() => setRoute({ name: 'learning' })}
				onOpenStats={() => {
					void refreshStats().then(() =>
						setRoute({ name: 'stats' }),
					)
				}}
				onOpenSettings={() => setRoute({ name: 'settings' })}
				onOpenQa={
					typeof __DEV__ !== 'undefined' && __DEV__
						? () => setRoute({ name: 'qa' })
						: undefined
				}
			/>
		)
	}

	if (route.name === 'daily') {
		return (
			<DailyScreen
				progress={dailyProgress}
				todayStr={todayStr}
				onBack={() => setRoute({ name: 'home' })}
				onRefreshProgress={() => {
					void refreshDaily()
				}}
				onPlay={(difficulty) => {
					const seed = 0 // resolved inside createOrLoadDailyPuzzle
					startPlay({
						kind: 'daily',
						difficulty,
						seed,
						dateStr: todayStr,
					})
				}}
			/>
		)
	}

	if (route.name === 'learning') {
		return (
			<LearningScreen
				progress={learningProgress}
				onBack={() => setRoute({ name: 'home' })}
				onViewLesson={(lessonId) => {
					void learningRepository
						.update((current) =>
							markLessonViewed(current, lessonId),
						)
						.then(setLearningProgress)
				}}
				onCompleteInteractive={(lessonId) => {
					void learningRepository
						.update((current) =>
							markLessonInteractiveComplete(current, lessonId),
						)
						.then((next) => {
							setLearningProgress(next)
							trackAnalytics('lesson_completed', { lessonId })
						})
				}}
			/>
		)
	}

	if (route.name === 'stats') {
		return (
			<StatsScreen
				stats={stats}
				onBack={() => setRoute({ name: 'home' })}
			/>
		)
	}

	if (route.name === 'about') {
		return (
			<AboutScreen onBack={() => setRoute({ name: 'settings' })} />
		)
	}

	if (route.name === 'settings') {
		return (
			<SettingsScreen
				settings={settings}
				onBack={() => setRoute({ name: 'home' })}
				onChange={(partial) => {
					void settingsRepository
						.update((current) => ({ ...current, ...partial }))
						.then(setSettings)
				}}
				onExportBackup={handleExportBackup}
				onImportBackup={handleImportBackup}
				onOpenOnboarding={() =>
					setRoute({ name: 'onboarding', manual: true })
				}
				onOpenLearning={() => setRoute({ name: 'learning' })}
				onOpenAbout={() => setRoute({ name: 'about' })}
			/>
		)
	}

	if (route.name === 'qa') {
		if (typeof __DEV__ === 'undefined' || !__DEV__) {
			return (
				<HomeScreen
					savedGame={savedGame}
					onContinue={() => undefined}
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
					trackAnalytics('difficulty_selected', { difficulty })
					const seed =
						(Date.now() ^
							Math.floor(Math.random() * 0xffffffff)) >>>
						0
					startPlay({ kind: 'normal', difficulty, seed })
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
						setRoute(
							route.meta.kind === 'daily'
								? { name: 'daily' }
								: { name: 'home' },
						),
					)
				}}
			/>
		)
	}

	const playMeta = route.meta
	return (
		<GameScreen
			initialState={route.state}
			saveRepository={saveRepository}
			settings={settings}
			onExitToHome={() => {
				void refreshSavedCard().then(() => setRoute({ name: 'home' }))
			}}
			onNewGameFromCompletion={() => {
				void saveRepository.clear()
				setSavedGame(null)
				if (playMeta.kind === 'daily') {
					setRoute({ name: 'daily' })
				} else {
					setRoute({ name: 'difficulty' })
				}
			}}
			onMeaningfulAction={() => {
				const key = uniqueKey(
					playMeta.difficulty,
					route.state.puzzle.seed,
				)
				if (startedKeysRef.current.has(key)) {
					return
				}
				startedKeysRef.current.add(key)
				void statsRepository
					.update((current) =>
						recordGameStarted(current, playMeta.difficulty),
					)
					.then(setStats)
			}}
			onCompleted={(elapsedMs) => {
				const seed = route.state.puzzle.seed
				const difficulty = playMeta.difficulty
				const key = uniqueKey(difficulty, seed)
				void (async () => {
					const nextStats = await statsRepository.update(
						(current) => {
							const already = current.uniqueSolvedSeeds.includes(
								key,
							)
							return recordGameCompleted(current, {
								difficulty,
								seed,
								elapsedMs,
								isReplayUnique: !already,
							})
						},
					)
					setStats(nextStats)
					trackAnalytics(
						playMeta.kind === 'daily'
							? 'daily_completed'
							: 'game_completed',
						{ difficulty },
					)
					if (playMeta.kind === 'daily') {
						const nextDaily = await dailyRepository.update(
							(current) =>
								markDailyCompleted(
									current,
									playMeta.dateStr,
									difficulty,
								),
						)
						setDailyProgress(nextDaily)
						await statsRepository.update((current) => ({
							...current,
							currentDailyStreak: nextDaily.currentStreak,
							bestDailyStreak: nextDaily.bestStreak,
						}))
						setStats(await statsRepository.load())
					}
				})()
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
				<Pressable
					onPress={props.onCancel}
					accessibilityRole="button"
					accessibilityLabel="Отмена"
					style={styles.cancelButton}
				>
					<Text style={styles.cancelText}>Отмена</Text>
				</Pressable>
			) : null}
			<StatusBar style="dark" />
		</View>
	)
}

export default function App() {
	return (
		<SafeAreaProvider>
			<AppRoot />
			<StatusBar style="dark" />
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
		paddingHorizontal: 24,
	},
	loadingText: {
		fontSize: 16,
		fontWeight: '600',
		color: colors.primaryText,
		textAlign: 'center',
	},
	cancelButton: {
		marginTop: 8,
		paddingVertical: 10,
		paddingHorizontal: 18,
	},
	cancelText: {
		fontSize: 15,
		fontWeight: '600',
		color: colors.secondaryText,
	},
})
