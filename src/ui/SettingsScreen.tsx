/**
 * Settings screen — toggles + error-checking segmented control for SettingsV1.
 * Sound/haptic persist but may be no-ops until platform hooks land.
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { ErrorCheckingMode, SettingsV1 } from '../settings/types'
import { colors, spacing } from '../theme'

export interface SettingsScreenProps {
	settings: SettingsV1
	onChange: (partial: Partial<Omit<SettingsV1, 'schemaVersion'>>) => void
	onBack: () => void
}

const ERROR_CHECKING_OPTIONS: readonly {
	value: ErrorCheckingMode
	label: string
}[] = [
	{ value: 'immediate', label: 'Сразу' },
	{ value: 'on_complete', label: 'При завершении' },
	{ value: 'off', label: 'Не проверять' },
]

export function SettingsScreen(props: SettingsScreenProps) {
	const { settings, onChange, onBack } = props
	const insets = useSafeAreaInsets()

	return (
		<View
			style={[
				styles.screen,
				{
					paddingTop: insets.top + 16,
					paddingBottom: insets.bottom + 16,
				},
			]}
		>
			<Pressable
				onPress={onBack}
				accessibilityRole="button"
				accessibilityLabel="Назад"
				hitSlop={8}
				style={styles.back}
			>
				<Text style={styles.backText}>← Назад</Text>
			</Pressable>

			<ScrollView
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
			>
				<Text style={styles.title}>Настройки</Text>

				<View style={styles.card}>
					<Text style={styles.groupTitle}>Проверка ошибок</Text>
					<Text style={styles.groupHint}>
						Сравнение с решением. Конфликты правил Судоку и областей
						видны всегда.
					</Text>
					<View style={styles.segmentRow}>
						{ERROR_CHECKING_OPTIONS.map((option) => {
							const selected =
								settings.errorChecking === option.value
							return (
								<Pressable
									key={option.value}
									onPress={() =>
										onChange({ errorChecking: option.value })
									}
									accessibilityRole="button"
									accessibilityState={{ selected }}
									accessibilityLabel={option.label}
									style={({ pressed }) => [
										styles.segment,
										selected ? styles.segmentSelected : null,
										pressed ? styles.pressed : null,
									]}
								>
									<Text
										style={[
											styles.segmentText,
											selected
												? styles.segmentTextSelected
												: null,
										]}
									>
										{option.label}
									</Text>
								</Pressable>
							)
						})}
					</View>
				</View>

				<ToggleRow
					label="Подсветка одинаковых цифр"
					value={settings.highlightSameNumbers}
					onToggle={() =>
						onChange({
							highlightSameNumbers: !settings.highlightSameNumbers,
						})
					}
				/>
				<ToggleRow
					label="Подсветка строки / столбца / блока"
					value={settings.highlightRelated}
					onToggle={() =>
						onChange({
							highlightRelated: !settings.highlightRelated,
						})
					}
				/>
				<ToggleRow
					label="Автоочистка заметок"
					value={settings.autoClearNotes}
					onToggle={() =>
						onChange({
							autoClearNotes: !settings.autoClearNotes,
						})
					}
				/>
				<ToggleRow
					label="Показывать таймер"
					value={settings.showTimer}
					onToggle={() =>
						onChange({ showTimer: !settings.showTimer })
					}
				/>
				<ToggleRow
					label="Звук"
					subtitle="Сохраняется; может быть без эффекта до подключения платформы."
					value={settings.soundEnabled}
					onToggle={() =>
						onChange({ soundEnabled: !settings.soundEnabled })
					}
				/>
				<ToggleRow
					label="Вибрация"
					subtitle="Сохраняется; может быть без эффекта до подключения платформы."
					value={settings.hapticEnabled}
					onToggle={() =>
						onChange({ hapticEnabled: !settings.hapticEnabled })
					}
				/>
			</ScrollView>
		</View>
	)
}

function ToggleRow(props: {
	label: string
	subtitle?: string
	value: boolean
	onToggle: () => void
}) {
	const { label, subtitle, value, onToggle } = props
	return (
		<Pressable
			onPress={onToggle}
			accessibilityRole="switch"
			accessibilityState={{ checked: value }}
			accessibilityLabel={label}
			style={({ pressed }) => [
				styles.toggleCard,
				pressed ? styles.pressed : null,
			]}
		>
			<View style={styles.toggleCopy}>
				<Text style={styles.toggleLabel}>{label}</Text>
				{subtitle ? (
					<Text style={styles.toggleSubtitle}>{subtitle}</Text>
				) : null}
			</View>
			<View
				style={[
					styles.switchTrack,
					value ? styles.switchTrackOn : null,
				]}
			>
				<View
					style={[
						styles.switchThumb,
						value ? styles.switchThumbOn : null,
					]}
				/>
			</View>
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
		alignSelf: 'flex-start',
		marginBottom: 12,
	},
	backText: {
		color: colors.secondaryText,
		fontSize: 16,
		fontWeight: '600',
	},
	content: {
		paddingBottom: 28,
		gap: 12,
	},
	title: {
		fontSize: 28,
		fontWeight: '700',
		color: colors.primaryText,
		marginBottom: 4,
	},
	card: {
		backgroundColor: colors.boardBackground,
		borderRadius: 14,
		paddingVertical: 14,
		paddingHorizontal: 14,
		borderWidth: 1,
		borderColor: colors.keypadBorder,
		gap: 10,
	},
	groupTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: colors.primaryText,
	},
	groupHint: {
		fontSize: 13,
		lineHeight: 18,
		color: colors.secondaryText,
	},
	segmentRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	segment: {
		flexGrow: 1,
		minWidth: '28%',
		paddingVertical: 10,
		paddingHorizontal: 8,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: colors.keypadBorder,
		backgroundColor: colors.keypadBackground,
		alignItems: 'center',
	},
	segmentSelected: {
		backgroundColor: colors.playerText,
		borderColor: colors.playerText,
	},
	segmentText: {
		fontSize: 13,
		fontWeight: '600',
		color: colors.primaryText,
		textAlign: 'center',
	},
	segmentTextSelected: {
		color: '#FFFFFF',
	},
	toggleCard: {
		backgroundColor: colors.boardBackground,
		borderRadius: 14,
		paddingVertical: 16,
		paddingHorizontal: 16,
		borderWidth: 1,
		borderColor: colors.keypadBorder,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	toggleCopy: {
		flex: 1,
		gap: 4,
	},
	toggleLabel: {
		fontSize: 16,
		fontWeight: '700',
		color: colors.primaryText,
	},
	toggleSubtitle: {
		fontSize: 12,
		lineHeight: 16,
		color: colors.secondaryText,
	},
	switchTrack: {
		width: 48,
		height: 28,
		borderRadius: 14,
		backgroundColor: colors.keypadBorder,
		justifyContent: 'center',
		paddingHorizontal: 3,
	},
	switchTrackOn: {
		backgroundColor: colors.toolbarActive,
	},
	switchThumb: {
		width: 22,
		height: 22,
		borderRadius: 11,
		backgroundColor: '#FFFFFF',
		alignSelf: 'flex-start',
	},
	switchThumbOn: {
		alignSelf: 'flex-end',
	},
	pressed: {
		opacity: 0.88,
	},
})
