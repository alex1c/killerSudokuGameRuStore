import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

/**
 * Phase 1 entry screen.
 * Keep App.tsx thin — full game UI arrives in later phases.
 */
export default function App() {
	return (
		<SafeAreaProvider>
			<View style={styles.container}>
				<Text style={styles.title}>Киллер Судоку</Text>
				<Text style={styles.subtitle}>Математическое ядро готово</Text>
				<Text style={styles.phase}>Phase 1</Text>
				<StatusBar style="dark" />
			</View>
		</SafeAreaProvider>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#F7F3E9',
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 24,
	},
	title: {
		fontSize: 32,
		fontWeight: '700',
		color: '#1B4332',
		marginBottom: 12,
		textAlign: 'center',
	},
	subtitle: {
		fontSize: 18,
		color: '#2D6A4F',
		marginBottom: 8,
		textAlign: 'center',
	},
	phase: {
		fontSize: 14,
		color: '#52796F',
		letterSpacing: 1,
		textAlign: 'center',
	},
})
