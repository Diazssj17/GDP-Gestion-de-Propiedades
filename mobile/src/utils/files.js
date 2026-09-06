import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

let FileSystem = null;
if (Platform.OS !== 'web') {
  try { FileSystem = require('expo-file-system'); } catch {}
}

export async function assetToBase64(asset) {
  if (Platform.OS === 'web') {
    if (asset.file) {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(asset.file);
      });
      return dataUrl.split(',')[1];
    }
    if (asset.uri && asset.uri.startsWith('data:')) {
      return asset.uri.split(',')[1];
    }
    throw new Error('No se pudo leer el archivo en web');
  }
  return await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
}

export async function pickPhoto() {
  if (Platform.OS === 'web') {
    const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.5 });
    if (res.canceled) return null;
    return res.assets[0];
  }
  const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5 });
  if (res.canceled) return null;
  return res.assets[0];
}
