// Datos mock para desarrollo sin backend (útil para Expo Go sin correr Flask)
export const mockResumen = {
  total_propiedades: 2,
  total_unidades: 5,
  ocupadas: 3,
  disponibles: 2,
  ocupacion_pct: 60,
  contratos_activos: 3,
  pagos_mora: 1,
  pagos_pendientes: 2,
  mantenimiento_pendiente: 1,
};
export const mockPropiedades = [
  { id: 1, nombre: 'Casa Centro', tipo: 'casa', direccion: 'Calle 10 # 5-20', ciudad: 'Villavicencio', num_unidades: 1 },
  { id: 2, nombre: 'Edificio Torres', tipo: 'edificio', direccion: 'Cra 30 # 40-15', ciudad: 'Villavicencio', num_unidades: 4 },
];
export const mockUnidades = [
  { id: 1, propiedad_id: 1, codigo: 'UNICA', nombre: 'Casa Principal', canon_base: 900000, estado: 'ocupada' },
  { id: 2, propiedad_id: 2, codigo: '101', nombre: 'Apto 101', canon_base: 1200000, estado: 'disponible' },
  { id: 3, propiedad_id: 2, codigo: '102', nombre: 'Apto 102', canon_base: 1100000, estado: 'ocupada' },
];
