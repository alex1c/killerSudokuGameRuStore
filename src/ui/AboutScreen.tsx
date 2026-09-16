/**
 * About / privacy foundation screen — local-first, no invented store URLs.
 */

import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
	APP_FULL_NAME,
	APP_PACKAGE,
	APP_VERSION,
} from '../app/constants'
import { DEVELOPER_NAME, DEVELOPER_WEBSITE, PRIVACY_NOTES } from '../app/privacy'
import { colors, spacing } from '../theme'

export interface AboutScreenProps {
	onBack: () => void
}

export function AboutScreen(props: AboutScreenProps) {
	const { onBack } = props
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
				<Text style={styles.title}>О приложении</Text>
				<Text style={styles.appName}>{APP_FULL_NAME}</Text>
				<Text style={styles.meta}>Версия {APP_VERSION}</Text>
				<Text style={styles.meta}>Пакет {APP_PACKAGE}</Text>

				<View style={styles.card}>
					<Text style={styles.cardTitle}>Разработчик</Text>
					<Text style={styles.cardBody}>{DEVELOPER_NAME}</Text>
					<Pressable
						onPress={() => {
							void Linking.openURL(DEVELOPER_WEBSITE)
						}}
						accessibilityRole="link"
						accessibilityLabel="Сайт разработчика"
					>
						<Text style={styles.link}>{DEVELOPER_WEBSITE}</Text>
					</Pressable>
				</View>

				<View style={styles.card}>
					<Text style={styles.cardTitle}>Конфиденциальность</Text>
					{PRIVACY_NOTES.map((line) => (
						<Text key={line} style={styles.cardBody}>
							{line}
						</Text>
					))}
				</View>
			</ScrollView>
		</View>
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
	appName: {
		fontSize: 20,
		fontWeight: '700',
		color: colors.playerText,
	},
	meta: {
		fontSize: 14,
		color: colors.secondaryText,
	},
	card: {
		backgroundColor: colors.boardBackground,
		borderRadius: 14,
		paddingVertical: 14,
		paddingHorizontal: 16,
		borderWidth: 1,
		borderColor: colors.keypadBorder,
		gap: 8,
		marginTop: 8,
	},
	cardTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: colors.primaryText,
	},
	cardBody: {
		fontSize: 14,
		lineHeight: 20,
		color: colors.secondaryText,
	},
	link: {
		fontSize: 15,
		fontWeight: '600',
		color: colors.playerText,
		textDecorationLine: 'underline',
	},
})
