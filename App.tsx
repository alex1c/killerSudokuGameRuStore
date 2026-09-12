/**
 * App shell: Home → Difficulty → Loading → Game, with Continue restore.
 * First launch never generates a puzzle.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	ActivityIndicator,
	Alert,
	InteractionManager,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Difficulty } from './src/game/difficulty'
import { createGame, type GameState } from './src/gameplay'
import {
	GameSaveRepository,
	restoreGameFromSave,
	type SavedGameV1,
} from './src/storage'
import { asyncStorageAdapter } from './src/storage/asyncStorageAdapter'
import { colors } from './src/theme'
import { DifficultyScreen } from './src/ui/DifficultyScreen'
import { GameScreen } from './src/ui/GameScreen'
import { HomeScreen } from './src/ui/HomeScreen'

type Route =
	| { name: 'boot' }
	| { name: 'home' }
	| { name: 'difficulty' }
	| { name: 'loading'; difficulty: Difficulty; seed: number }
	| { name: 'play'; state: GameState }

function AppRoot() {
	const saveRepository = useMemo(
		() => new GameSaveRepository(asyncStorageAdapter),
		[],
	)
	const [route, setRoute] = useState<Route>({ name: 'boot' })
	const [savedGame, setSavedGame] = useState<SavedGameV1 | null>(null)
	const loadTaskRef = useRef<{ cancel: () => void } | null>(null)
	const loadEpochRef = useRef(0)

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
		}
	}, [saveRepository])

	const refreshSavedCard = useCallback(async () => {
		const loaded = await saveRepository.load()
		setSavedGame(loaded.ok ? loaded.save : null)
	}, [saveRepository])

	const startGeneration = useCallback(
		(difficulty: Difficulty, seed: number) => {
			if (loadTaskRef.current !== null) {
				loadTaskRef.current.cancel()
			}
			const epoch = ++loadEpochRef.current
			setRoute({ name: 'loading', difficulty, seed })
			loadTaskRef.current = InteractionManager.runAfterInteractions(() => {
				void (async () => {
					try {
						const state = createGame({ seed, difficulty })
						if (epoch !== loadEpochRef.current) {
							return
						}
						// Persist before entering play so force-stop still has Continue.
						await saveRepository.savePlaying(state)
						if (epoch !== loadEpochRef.current) {
							return
						}
						setRoute({ name: 'play', state })
					} catch (error) {
						if (epoch !== loadEpochRef.current) {
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
						}
					}
				})()
			})
		},
		[refreshSavedCard, saveRepository],
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
					const state = restoreGameFromSave(savedGame)
					setRoute({ name: 'play', state })
				}}
				onNewGame={requestNewGame}
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
		return (
			<LoadingView
				message="Создаём головоломку…"
				onCancel={() => {
					loadEpochRef.current += 1
					if (loadTaskRef.current !== null) {
						loadTaskRef.current.cancel()
						loadTaskRef.current = null
					}
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
