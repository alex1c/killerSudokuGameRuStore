import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GameScreen } from './src/ui/GameScreen'

/**
 * Application entry composition.
 * Keep App.tsx thin: providers + root screen only.
 */
export default function App() {
	return (
		<SafeAreaProvider>
			<StatusBar style="dark" />
			<GameScreen />
		</SafeAreaProvider>
	)
}
