# Modelo de Datos GDP - Gestión de Propiedades

## Jerarquía Oficial

```
Administrador Plataforma (SuperAdmin)
   │
   ├── Planes y Suscripciones
   └── Usuarios del sistema
         │
         └── Propietario (puede ser persona natural, empresa o inmobiliaria)
               │
               └── Propiedad (Edificio, Conjunto, Casa, Local, Lote, Finca)
                     │
                     └── Unidad (Apto 101, Casa 2, Local 3, Bodega...)
                           │
                           ├── Inquilino (vinculado vía Contrato)
                           │     │
                           │     └── Contrato (Unidad ↔ Inquilino, vigencia, canon, depósito)
                           │           │
                           │           ├── Pagos (mensualidades, mora, comprobantes)
                           │           └── Servicios (agua, luz, gas, internet, admin)
                           │
                           ├── Alertas (vencimiento contrato, mora, mantenimiento, servicios)
                           ├── Mantenimiento (tickets, prioridad, costo, estado)
                           └── Reportes (ocupación, cartera, rentabilidad por unidad/propiedad/propietario)
```

### Regla de oro de escalabilidad
> **Casa individual = Propiedad con 1 Unidad.** 
> No existe caso especial. Así el código que funciona para 1 propietario con 2 casas funciona sin cambios para 500 propietarios con 2000 unidades en 300 propiedades.

Esto permite crecer sin refactorizar:
- **Fase 1:** 1 propietario → 2 propiedades → 2 unidades (2 casas)
- **Fase 2:** 10 propietarios → 15 propiedades → 80 unidades (edificios)
- **Fase 3:** 200 propietarios / inmobiliarias → 600 propiedades → 4.000 unidades
- **Fase N:** Miles, solo se añaden índices y paginación, no se cambia el modelo.

---

## Entidades y Relaciones

### 1. Administrador de Plataforma
- Rol `superadmin` en `usuarios`.
- Controla `planes`, `suscripciones`, `usuarios`, logs y configuración global.
- No está atado a un propietario.

### 2. Planes y Suscripciones
- `planes`: define límites (max_propiedades, max_unidades, max_propietarios gestionados), precio y features.
- `suscripciones`: vincula `usuario (propietario)` → `plan`, con estado (activa/vencida/cancelada) y vigencia.
- Permite monetización SaaS sin tocar el núcleo del dominio.

### 3. Propietario
- Perfil `propietarios` vinculado a `usuarios` (1 a 1).
- Un usuario propietario puede tener N propiedades.
- Una inmobiliaria se modela como **un propietario de tipo `inmobiliaria`** con muchas propiedades. No se necesita tabla extra.

### 4. Propiedad
- Agrupa unidades bajo una misma dirección / escritura.
- Campos clave: `propietario_id`, `tipo` (edificio/conjunto/casa/local/lote), `direccion`, `ciudad`.
- Una propiedad siempre pertenece a un propietario.

### 5. Unidad
- Entidad arrendable mínima.
- `propiedad_id` (FK), `codigo` (101, A-2), `tipo`, `area_m2`, `canon_base`, `estado` (disponible/ocupada/mantenimiento).
- Índices en `propiedad_id` + `estado` para listar disponibles rápido incluso con miles de registros.

### 6. Inquilino
- Perfil `inquilinos` (puede tener `usuario_id` si quiere login, o ser solo contacto).
- No está atado directamente a unidad; la relación es vía `contratos`.

### 7. Contrato
- Tabla puente `contratos`: `unidad_id` + `inquilino_id` + `fecha_inicio` + `fecha_fin` + `canon` + `deposito` + `estado`.
- **Constraint:** solo 1 contrato `activo` por unidad a la vez (validado en app + índice único parcial).
- Historial completo: contratos terminados se conservan para reportes.

### 8. Pagos
- `pagos` pertenece a `contrato_id`.
- `monto`, `fecha_vencimiento`, `fecha_pago`, `metodo`, `estado` (pendiente/pagado/mora/parcial), `comprobante`.
- Base para alertas de mora y reportes de cartera.

### 9. Servicios
- Catálogo `servicios` (agua, luz, gas, internet, administración, extraordinaria).
- `unidad_servicios` o `contrato_servicios` registra costo por periodo y responsable (propietario/inquilino).
- Permite facturación discriminada.

### 10. Alertas
- `alertas`: `usuario_destino_id`, `tipo` (vencimiento_contrato, mora, mantenimiento, pago_proximo), `mensaje`, `referencia_tipo/id`, `leida`, `fecha_vencimiento`.
- Se generan por triggers en la app (cron diario). No bloquean el flujo principal.

### 11. Mantenimiento
- `mantenimiento`: `unidad_id`, `reportado_por`, `tipo` (preventivo/correctivo), `prioridad`, `estado` (pendiente/en_proceso/resuelto), `costo`.

### 12. Reportes
- No es tabla transaccional; son vistas SQL + tabla `reportes_generados` para auditoría (quién generó qué y cuándo).
- Indicadores: ocupación %, morosidad, rentabilidad por propiedad/propietario, tickets abiertos, vencimientos próximos.

---

## Diagrama ER simplificado

```
usuarios 1──1 propietarios 1──N propiedades 1──N unidades
                                      │            │
                                      │            ├──1──N contratos N──1 inquilinos
                                      │            │         │
                                      │            │         └──1──N pagos
                                      │            │         └──1──N servicios
                                      │            └──1──N mantenimiento
                                      │            └──1──N alertas (via usuarios)
planes 1──N suscripciones N──1 usuarios
```

## Escalabilidad sin refactorización

| Mecanismo | Cómo ayuda |
|-----------|------------|
| **FK + índices** en todas las relaciones | Consultas rápidas con 100k filas |
| **Paginación** (`LIMIT/OFFSET`) en listados | No se carga todo en memoria |
| **Estados** (`disponible/ocupada`, `activo/vencido`) | Filtros eficientes sin joins complejos |
| **Casa = Propiedad de 1 unidad** | Cero lógica condicional por tipo |
| **Inmobiliaria = Propietario tipo inmobiliaria** | Cero tabla nueva, solo un campo `tipo` |
| **Suscripciones y planes separados** | Escalar a SaaS sin tocar contratos/pagos |
| **Alertas y reportes desacoplados** | Se pueden mover a jobs/colas después |

## Reglas de negocio clave

1. Una unidad solo tiene un contrato activo a la vez.
2. Un pago siempre pertenece a un contrato (no a unidad suelta).
3. Un propietario ve solo sus propiedades (filtrado por `propietario_id`), el superadmin ve todo.
4. Las alertas se generan automáticamente (vencimiento -30/-7 días, mora +1 día, etc.).
5. El historial nunca se borra (contratos y pagos terminados se archivan, no se eliminan).

## Evolución futura (sin romper el modelo)

- **Multi-inmobiliaria avanzada:** añadir tabla `inmobiliarias` y `propietario_inmobiliaria` (N:N) si se necesita, sin tocar `propiedades`/`unidades`.
- **Contabilidad externa:** añadir `facturas` vinculada a `pagos`.
- **App móvil inquilino:** reutiliza `inquilinos` + `contratos` + `pagos`, solo se añade auth.
