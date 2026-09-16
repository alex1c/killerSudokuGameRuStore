/**
 * Development-only Phase 4 / 6Q QA screen.
 * Not shown in production builds (__DEV__ gate at call sites).
 */

import { useCallback, useEffect, useState } from 'react'
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing } from '../theme'
import {
	runPhase4GeneratorQa,
	runPhase4PersistenceQa,
	runPhase4Qa,
	type Phase4QaResult,
} from './phase4Qa'
import {
	runGeneratorPerfQa,
	type GeneratorPerfQaResult,
} from './generatorPerfQa'
import {
	runPuzzlePoolQa,
	type PoolQaResult,
} from './puzzlePoolQa'
import type {
	PuzzlePoolController,
	PuzzlePoolSnapshot,
} from '../pool/puzzlePoolController'
import { asyncStorageAdapter } from '../storage/asyncStorageAdapter'
import { PHASE4_QA_STORAGE_KEY } from '../storage'

export interface Phase4QaScreenProps {
	onBack: () => void
	poolController?: PuzzlePoolController
}

type RunKind =
	| 'persistence'
	| 'generator'
	| 'perf'
	| 'pool'
	| 'all'
	| null

export function Phase4QaScreen(props: Phase4QaScreenProps) {
	const insets = useSafeAreaInsets()
	const [running, setRunning] = useState<RunKind>(null)
	const [result, setResult] = useState<
		Phase4QaResult | GeneratorPerfQaResult | PoolQaResult | null
	>(null)
	const [poolSnap, setPoolSnap] = useState<PuzzlePoolSnapshot | null>(null)
	const [poolLog, setPoolLog] = useState<string>('')

	useEffect(() => {
		const controller = props.poolController
		if (!controller) {
			return
		}
		void controller.ensureLoaded().then(() => {
			setPoolSnap(controller.getSnapshot())
		})
		return controller.subscribe((snap) => {
			setPoolSnap(snap)
		})
	}, [props.poolController])

	const run = useCallback(
		async (kind: Exclude<RunKind, null>) => {
			setRunning(kind)
			setResult(null)
			try {
				const options = {
					adapter: asyncStorageAdapter,
					storageKey: PHASE4_QA_STORAGE_KEY,
				}
				const next =
					kind === 'persistence'
						? await runPhase4PersistenceQa(options)
						: kind === 'generator'
							? await runPhase4GeneratorQa(options)
							: kind === 'perf'
								? await runGeneratorPerfQa()
								: kind === 'pool'
									? props.poolController
										? await runPuzzlePoolQa(
												props.poolController,
											)
										: {
												passed: false,
												checks: [
													{
														name: 'pool controller',
														passed: false,
														details: 'missing',
													},
												],
											}
									: await runPhase4Qa(options)
				setResult(next)
			} catch (error) {
				setResult({
					passed: false,
					checks: [
						{
							name: 'runner crash',
							passed: false,
							details:
								error instanceof Error
									? error.message
									: String(error),
						},
					],
				})
			} finally {
				setRunning(null)
			}
		},
		[props.poolController],
	)

	const withPool = async (
		label: string,
		action: (controller: PuzzlePoolController) => Promise<void>,
	) => {
		if (!props.poolController) {
			setPoolLog('No pool controller')
			return
		}
		setRunning('pool')
		try {
			const t0 = performance.now()
			await action(props.poolController)
			const ms = performance.now() - t0
			setPoolSnap(props.poolController.getSnapshot())
			setPoolLog(`${label} — ${ms.toFixed(0)} ms`)
		} catch (error) {
			setPoolLog(
				`${label} failed: ${error instanceof Error ? error.message : String(error)}`,
			)
		} finally {
			setRunning(null)
		}
	}

	return (
		<View
			style={[
				styles.screen,
				{
					paddingTop: insets.top + 12,
					paddingBottom: insets.bottom + 12,
				},
			]}
		>
			<Pressable
				onPress={props.onBack}
				accessibilityRole="button"
				accessibilityLabel="Назад"
				hitSlop={8}
			>
				<Text style={styles.back}>← Назад</Text>
			</Pressable>

			<Text style={styles.title}>Phase 4 / 6Q QA</Text>
			<Text style={styles.hint}>
				Dev-only. Active save key {PHASE4_QA_STORAGE_KEY} for
				persistence tests — pool uses killerSudoku.puzzlePool.v1.
			</Text>

			{poolSnap ? (
				<View style={styles.poolBox}>
					<Text style={styles.poolTitle}>Prepared puzzles</Text>
					<Text style={styles.poolLine}>
						Hard {poolSnap.hard}/{poolSnap.hardTarget} · Expert{' '}
						{poolSnap.expert}/{poolSnap.expertTarget} · mode=
						{poolSnap.mode}
					</Text>
					{poolLog ? (
						<Text style={styles.poolLog}>{poolLog}</Text>
					) : null}
				</View>
			) : null}

			<ScrollView style={styles.scroll} contentContainerStyle={styles.actions}>
				<QaButton
					label="Run Persistence QA"
					disabled={running !== null}
					onPress={() => void run('persistence')}
				/>
				<QaButton
					label="Run Generator QA"
					disabled={running !== null}
					onPress={() => void run('generator')}
				/>
				<QaButton
					label="Run Generator Perf QA"
					disabled={running !== null}
					onPress={() => void run('perf')}
				/>
				<QaButton
					label="Run Puzzle Pool QA"
					disabled={running !== null || !props.poolController}
					onPress={() => void run('pool')}
				/>
				<QaButton
					label="Clear Pool"
					disabled={running !== null || !props.poolController}
					onPress={() =>
						void withPool('Clear Pool', (c) => c.clearPool())
					}
				/>
				<QaButton
					label="Fill Pool"
					disabled={running !== null || !props.poolController}
					onPress={() =>
						void withPool('Fill Pool', async (c) => {
							c.setHomeVisible(true)
							c.setGameplayActive(false)
							c.setAppActive(true)
							await c.fillToTargets()
						})
					}
				/>
				<QaButton
					label="Consume Hard"
					disabled={running !== null || !props.poolController}
					onPress={() =>
						void withPool('Consume Hard', async (c) => {
							const item = await c.consume('hard')
							setPoolLog(
								item
									? `Hard retrievalMs=${item.retrievalMs.toFixed(1)} seed=${item.puzzle.seed}`
									: 'Hard pool empty',
							)
						})
					}
				/>
				<QaButton
					label="Consume Expert"
					disabled={running !== null || !props.poolController}
					onPress={() =>
						void withPool('Consume Expert', async (c) => {
							const item = await c.consume('expert')
							setPoolLog(
								item
									? `Expert retrievalMs=${item.retrievalMs.toFixed(1)} seed=${item.puzzle.seed}`
									: 'Expert pool empty',
							)
						})
					}
				/>
				<QaButton
					label="Run All"
					disabled={running !== null}
					onPress={() => void run('all')}
				/>

				{running !== null ? (
					<View style={styles.busy}>
						<ActivityIndicator color={colors.playerText} />
						<Text style={styles.busyText}>Running {running}…</Text>
					</View>
				) : null}

				{result ? (
					<View>
						<Text
							style={[
								styles.verdict,
								result.passed ? styles.pass : styles.fail,
							]}
						>
							RESULT: {result.passed ? 'PASS' : 'FAIL'}
						</Text>
						{result.checks.map((item) => (
							<Text
								key={item.name}
								style={
									item.passed ? styles.okLine : styles.badLine
								}
							>
								{item.passed ? '✓' : '✗'} {item.name}
								{item.details ? ` — ${item.details}` : ''}
							</Text>
						))}
					</View>
				) : null}
			</ScrollView>
		</View>
	)
}

function QaButton(props: {
	label: string
	disabled: boolean
	onPress: () => void
}) {
	return (
		<Pressable
			onPress={props.onPress}
			disabled={props.disabled}
			accessibilityRole="button"
			style={({ pressed }) => [
				styles.button,
				pressed ? styles.pressed : null,
				props.disabled ? styles.disabled : null,
			]}
		>
			<Text style={styles.buttonText}>{props.label}</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: colors.background,
		paddingHorizontal: spacing.screenPadding,
	},
	scroll: {
		flex: 1,
	},
	back: {
		color: colors.secondaryText,
		fontSize: 16,
		fontWeight: '600',
		marginBottom: 8,
	},
	title: {
		fontSize: 24,
		fontWeight: '700',
		color: colors.primaryText,
		marginBottom: 6,
	},
	hint: {
		fontSize: 12,
		color: colors.secondaryText,
		marginBottom: 12,
	},
	poolBox: {
		borderWidth: 1,
		borderColor: colors.keypadBorder,
		borderRadius: 10,
		padding: 10,
		marginBottom: 12,
		backgroundColor: colors.boardBackground,
	},
	poolTitle: {
		fontWeight: '700',
		color: colors.primaryText,
		marginBottom: 4,
	},
	poolLine: {
		color: colors.secondaryText,
		fontSize: 13,
	},
	poolLog: {
		marginTop: 6,
		color: colors.playerText,
		fontSize: 12,
	},
	actions: {
		gap: 10,
		paddingBottom: 24,
	},
	button: {
		backgroundColor: colors.boardBackground,
		borderWidth: 1,
		borderColor: colors.keypadBorder,
		borderRadius: 10,
		paddingVertical: 12,
		paddingHorizontal: 14,
	},
	buttonText: {
		fontSize: 16,
		fontWeight: '600',
		color: colors.primaryText,
		textAlign: 'center',
	},
	pressed: {
		opacity: 0.85,
	},
	disabled: {
		opacity: 0.5,
	},
	busy: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		marginVertical: 8,
	},
	busyText: {
		color: colors.secondaryText,
	},
	verdict: {
		fontSize: 18,
		fontWeight: '700',
		marginBottom: 10,
		marginTop: 8,
	},
	pass: {
		color: colors.playerText,
	},
	fail: {
		color: '#B00020',
	},
	okLine: {
		fontSize: 13,
		color: colors.primaryText,
		marginBottom: 4,
	},
	badLine: {
		fontSize: 13,
		color: '#B00020',
		marginBottom: 4,
	},
})
