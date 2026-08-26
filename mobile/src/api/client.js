import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Cambia esta URL por la de tu backend en producción (Render) o local
// Para probar en celular físico usa tu IP local: http://192.168.x.x:5001
export const BASE_URL = 'http://10.0.2.2:5001'; // 10.0.2.2 = localhost para emulador Android
// export const BASE_URL = 'https://gdp-gestion-propiedades.onrender.com';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('gdp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const api = {
  health: () => client.get('/api/health').then(r => r.data),
  resumen: () => client.get('/api/reportes/resumen').then(r => r.data),
  propiedades: (params = {}) => client.get('/api/propiedades', { params }).then(r => r.data),
  unidades: (params = {}) => client.get('/api/unidades', { params }).then(r => r.data),
  contratos: () => client.get('/api/contratos').then(r => r.data),
  pagos: (estado) => client.get('/api/pagos', { params: estado ? { estado } : {} }).then(r => r.data),
  alertas: () => client.get('/api/alertas').then(r => r.data),
  // Crear contrato - valida 1 activo por unidad en backend (app.py:contratos)
  crearContrato: (data) => client.post('/api/contratos', data).then(r => r.data),
};

export default client;
