/**
 * AsyncStorage-backed adapter for production Continue / autosave.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import type { StorageAdapter } from './index'

export const asyncStorageAdapter: StorageAdapter = {
	getItem: (key) => AsyncStorage.getItem(key),
	setItem: (key, value) => AsyncStorage.setItem(key, value),
	removeItem: (key) => AsyncStorage.removeItem(key),
}
