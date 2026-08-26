# GDP Mobile — App Móvil (Expo + React Native)

App para **GDP - Gestión de Propiedades** conectada al backend Flask (`app.py` / `database.py` v2).

## Stack
- Expo ~52 + React Native 0.76
- React Navigation (bottom-tabs + native-stack)
- Axios → `BASE_URL` en `src/api/client.js`
- SecureStore para token

## Estructura
```
mobile/
├── App.js
├── app.json
├── package.json
├── src/
│   ├── api/client.js      # BASE_URL = 10.0.2.2:5001 (emulador) / tu IP / Render
│   ├── api/mock.js        # datos mock si el backend no está corriendo
│   ├── navigation/AppNavigator.js
│   ├── components/Card.js
│   └── screens/
│       ├── DashboardScreen.js   # resumen ocupación/cartera (GET /api/reportes/resumen)
│       ├── PropiedadesScreen.js # lista propiedades → navega a unidades
│       ├── UnidadesScreen.js    # filtra por propiedad_id / estado
│       ├── ContratosScreen.js   # lista contratos (unidad ↔ inquilino)
│       ├── PagosScreen.js       # filtros pendiente/mora/pagado
│       ├── ServiciosScreen.js   # recibos + distribución compartida §12
│       └── MantenimientoScreen.js
```

## Flujo del modelo v2 (docs/modelo.md)
**Usuario → Propietario → Propiedad → Unidad → Contrato → Inquilino → Pagos/Servicios → Alertas/Mantenimiento**

- Casa = Propiedad con 1 Unidad `UNICA` (sin lógica especial)
- Servicios compartidos: `recibos` + `distribucion_servicios` (partes_iguales/porcentaje/consumo)
- 1 contrato activo por unidad (validado en backend)

## Correr
```bash
cd mobile
npm install
# 1) Levanta el backend en otra terminal:
#    python app.py  (puerto 5001, ver app.py:1)
# 2) Expo:
npm start
#  - Escanea QR con Expo Go (celular en misma WiFi) o emulador
#  - Si usas celular físico cambia BASE_URL en src/api/client.js a http://TU_IP:5001
```

## Producción
- Cambia `BASE_URL` a `https://tu-app.onrender.com`
- `eas build` para APK/IPA

## Próximos pasos
- Auth real (login → SecureStore)
- Formularios: crear propiedad/unidad/contrato/pago/recibo con cámara (expo-image-picker)
- Push notifications para alertas (notificaciones tabla)
- Offline con SQLite local (expo-sqlite)
