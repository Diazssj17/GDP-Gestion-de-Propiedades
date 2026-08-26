import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Cambia esta URL por la de tu backend en producción (Render) o local
// Para probar en celular físico usa tu IP local: http://192.168.x.x:5001
export const BASE_URL = 'http://192.168.1.2:5001'; // IP local (celular físico en misma WiFi)
// export const BASE_URL = 'http://10.0.2.2:5001'; // emulador Android
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
  me: () => client.get('/api/me').then(r => r.data),
  login: (email, password) => client.post('/api/login', { email, password }).then(r => r.data),
  logout: () => client.post('/api/logout').then(r => r.data),
  resumen: () => client.get('/api/reportes/resumen').then(r => r.data),
  propiedades: (params = {}) => client.get('/api/propiedades', { params }).then(r => r.data),
  unidades: (params = {}) => client.get('/api/unidades', { params }).then(r => r.data),
  contratos: () => client.get('/api/contratos').then(r => r.data),
  crearContrato: (data) => client.post('/api/contratos', data).then(r => r.data),
  inquilinos: () => client.get('/api/inquilinos').then(r => r.data),
  crearInquilino: (data) => client.post('/api/inquilinos', data).then(r => r.data),
  pagos: (estado) => client.get('/api/pagos', { params: estado ? { estado } : {} }).then(r => r.data),
  crearPago: (data) => client.post('/api/pagos', data).then(r => r.data),
  registrarPago: (id, data) => client.patch(`/api/pagos/${id}`, data).then(r => r.data),
  alertas: () => client.get('/api/alertas').then(r => r.data),
  servicios: () => client.get('/api/servicios').then(r => r.data),
  mantenimientos: (params = {}) => client.get('/api/mantenimientos', { params }).then(r => r.data),
  crearMantenimiento: (data) => client.post('/api/mantenimientos', data).then(r => r.data),
  actualizarMantenimiento: (id, data) => client.patch(`/api/mantenimientos/${id}`, data).then(r => r.data),
  recibos: (params = {}) => client.get('/api/recibos', { params }).then(r => r.data),
  crearRecibo: (data) => client.post('/api/recibos', data).then(r => r.data),
};

export default client;
