import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

let secureStore = null;
if (!isWeb) {
  secureStore = require('expo-secure-store');
}

const storage = {
  async getItem(key) {
    if (isWeb) {
      try { return localStorage.getItem(key); } catch { return null; }
    }
    try { return await secureStore.getItemAsync(key); } catch { return null; }
  },
  async setItem(key, value) {
    if (isWeb) {
      try { localStorage.setItem(key, value); } catch {}
      return;
    }
    try { await secureStore.setItemAsync(key, value); } catch {}
  },
  async removeItem(key) {
    if (isWeb) {
      try { localStorage.removeItem(key); } catch {}
      return;
    }
    try { await secureStore.deleteItemAsync(key); } catch {}
  },
};

export default storage;
