/**
 * Development-only Phase 4 QA screen.
 * Not shown in production builds (__DEV__ gate at call sites).
 */

import { useCallback, useState } from 'react'
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
import { asyncStorageAdapter } from '../storage/asyncStorageAdapter'
import { PHASE4_QA_STORAGE_KEY } from '../storage'

export interface Phase4QaScreenProps {
	onBack: () => void
}

type RunKind = 'persistence' | 'generator' | 'all' | null

export function Phase4QaScreen(props: Phase4QaScreenProps) {
	const insets = useSafeAreaInsets()
	const [running, setRunning] = useState<RunKind>(null)
	const [result, setResult] = useState<Phase4QaResult | null>(null)

	const run = useCallback(async (kind: Exclude<RunKind, null>) => {
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
	}, [])

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

			<Text style={styles.title}>Phase 4 QA</Text>
			<Text style={styles.hint}>
				Dev-only. Uses key {PHASE4_QA_STORAGE_KEY} — never user Continue.
			</Text>

			<View style={styles.actions}>
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
					label="Run All"
					disabled={running !== null}
					onPress={() => void run('all')}
				/>
			</View>

			{running !== null ? (
				<View style={styles.busy}>
					<ActivityIndicator color={colors.playerText} />
					<Text style={styles.busyText}>Running {running}…</Text>
				</View>
			) : null}

			{result ? (
				<ScrollView style={styles.results}>
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
							style={item.passed ? styles.okLine : styles.badLine}
						>
							{item.passed ? '✓' : '✗'} {item.name}
							{item.details ? ` — ${item.details}` : ''}
						</Text>
					))}
				</ScrollView>
			) : null}
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
		marginBottom: 16,
	},
	actions: {
		gap: 10,
		marginBottom: 16,
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
		marginBottom: 12,
	},
	busyText: {
		color: colors.secondaryText,
	},
	results: {
		flex: 1,
	},
	verdict: {
		fontSize: 18,
		fontWeight: '700',
		marginBottom: 10,
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
