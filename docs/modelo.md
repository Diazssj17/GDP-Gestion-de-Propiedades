# Modelo de Datos GDP — Gestión y Automatización de Propiedades

## 1. Descripción del proyecto

GDP es una plataforma de gestión y automatización de propiedades en arriendo.

Su objetivo principal es permitir que un propietario, administrador o inmobiliaria pueda gestionar desde un solo lugar:

* Propiedades.
* Unidades.
* Inquilinos.
* Contratos.
* Cánones de arrendamiento.
* Pagos.
* Recibos de servicios públicos.
* Servicios compartidos.
* Alertas y recordatorios.
* Mantenimientos.
* Documentos.
* Reportes.

La aplicación debe funcionar tanto para una persona que tiene una sola casa en arriendo como para una inmobiliaria que administra miles de unidades.

El modelo se diseña desde el comienzo para que el crecimiento de la cantidad de usuarios y propiedades **no obligue a cambiar la estructura principal del sistema**.

---

# 2. Principio principal del modelo

La estructura central será:

**Usuario → Propietario → Propiedad → Unidad → Contrato → Inquilino → Pagos y Servicios**

Alrededor de esta estructura funcionarán:

**Alertas + Mantenimiento + Documentos + Reportes**

Y por encima estará:

**Administrador de la plataforma → Usuarios + Planes + Suscripciones**

---

# 3. Regla principal de escalabilidad

## Casa individual = Propiedad con 1 Unidad

No se creará una lógica especial para las casas.

Por ejemplo:

**Casa de Juan**

* Propiedad: Casa Juan
* Unidad: Casa Principal

Una propiedad más compleja:

**Edificio Torres**

* Propiedad: Edificio Torres
* Unidad: Apartamento 101
* Unidad: Apartamento 102
* Unidad: Apartamento 201
* Unidad: Apartamento 202

De esta manera, el sistema siempre trabaja con unidades arrendables.

Esto permite utilizar exactamente la misma lógica para:

* Una casa.
* Un apartamento.
* Un edificio.
* Un conjunto.
* Una bodega.
* Un local.
* Una oficina.
* Una finca.
* Una propiedad con múltiples unidades.

---

# 4. Jerarquía general

```text
ADMINISTRADOR DE PLATAFORMA
        │
        ├── Usuarios
        ├── Planes
        ├── Suscripciones
        └── Configuración
                │
                ↓
             USUARIO
                │
                ↓
           PROPIETARIO
                │
                ├── Propiedad
                │     ├── Unidad
                │     │     ├── Contrato
                │     │     │     ├── Inquilino
                │     │     │     ├── Pagos
                │     │     │     └── Servicios
                │     │     │
                │     │     ├── Mantenimiento
                │     │     └── Alertas
                │     │
                │     └── Servicios compartidos
                │
                └── Reportes
```

---

# 5. Usuarios

La plataforma tendrá tres perfiles principales.

## 5.1 Administrador de plataforma

Es el administrador general de GDP.

Puede:

* Gestionar usuarios.
* Ver propietarios.
* Ver propiedades.
* Administrar planes.
* Administrar suscripciones.
* Gestionar descuentos.
* Consultar estadísticas generales.
* Administrar configuraciones.
* Revisar actividad y registros del sistema.

El SuperAdmin no pertenece a ningún propietario.

---

## 5.2 Propietario / Administrador

Es el usuario principal del sistema.

Puede ser:

* Persona natural.
* Empresa.
* Inmobiliaria.

No es necesario crear una estructura diferente para una inmobiliaria inicialmente.

Se manejará mediante:

```text
propietarios.tipo
```

Valores:

```text
persona
empresa
inmobiliaria
```

El propietario podrá administrar sus propiedades, unidades, contratos, inquilinos, pagos, servicios y mantenimientos.

---

## 5.3 Inquilino

El inquilino podrá existir inicialmente como un contacto dentro del sistema.

Posteriormente podrá tener una cuenta propia para ingresar a la aplicación.

Esto permite comenzar sin obligar a todos los inquilinos a registrarse.

Cuando se habilite el acceso del inquilino:

```text
inquilino → usuario
```

El modelo no necesita ser modificado.

---

# 6. Propiedades

La propiedad representa el inmueble principal.

Tipos:

```text
Edificio
Conjunto
Casa
Apartamento
Local
Oficina
Bodega
Lote
Finca
Otro
```

Información principal:

* ID.
* Propietario.
* Nombre.
* Tipo.
* Dirección.
* Ciudad.
* Barrio.
* Descripción.
* Estado.
* Fotografías.
* Información adicional.

Ejemplo:

```text
Propiedad:
Casa San Luis

Tipo:
Casa

Dirección:
Carrera XX # XX-XX

Propietario:
Juan Pérez
```

---

# 7. Unidades

La unidad es la **unidad mínima que puede ser arrendada**.

Ejemplos:

```text
Apartamento 101
Apartamento 202
Local 3
Bodega A
Casa principal
Casa 2
Oficina 501
```

Campos:

* ID.
* Propiedad.
* Código.
* Nombre.
* Tipo.
* Área.
* Canon base.
* Estado.
* Características.

Estados:

```text
Disponible
Ocupada
En mantenimiento
Inactiva
```

Una propiedad puede tener una o muchas unidades.

```text
Casa
└── 1 unidad

Edificio
├── Unidad 101
├── Unidad 102
├── Unidad 201
└── Unidad 202
```

---

# 8. Inquilinos

El inquilino representa a la persona o empresa que ocupa una unidad.

Información:

* Nombre.
* Documento.
* Teléfono.
* Correo.
* Contacto de emergencia.
* Información adicional.
* Usuario asociado, si tiene acceso a la aplicación.

El inquilino **no se relaciona directamente con la unidad**.

La relación se realiza mediante el contrato.

Esto permite mantener el historial.

---

# 9. Contratos

El contrato es el vínculo entre:

**Unidad ↔ Inquilino**

Información:

* ID.
* Unidad.
* Inquilino.
* Fecha de inicio.
* Fecha de finalización.
* Canon.
* Día límite de pago.
* Depósito.
* Incremento.
* Estado.
* Documento del contrato.

Estados:

```text
Pendiente
Activo
Próximo a vencer
Finalizado
Cancelado
```

## Regla

Una unidad solamente puede tener **un contrato activo simultáneamente**.

Los contratos anteriores no se eliminan.

Se conservan para:

* Historial.
* Reportes.
* Consultas.
* Auditoría.

---

# 10. Pagos de arriendo

Los pagos estarán relacionados directamente con el contrato.

```text
Contrato
    │
    ├── Enero
    ├── Febrero
    ├── Marzo
    └── Abril
```

Cada pago tendrá:

* Contrato.
* Periodo.
* Valor.
* Fecha de vencimiento.
* Fecha de pago.
* Estado.
* Método de pago.
* Comprobante.
* Observaciones.

Estados:

```text
Pendiente
Pagado
Parcial
En mora
```

El sistema podrá detectar automáticamente pagos vencidos.

---

# 11. Servicios públicos

GDP tendrá inicialmente como prioridad los tres servicios principales:

1. Agua.
2. Energía.
3. Gas.

Posteriormente podrán agregarse:

* Internet.
* Administración.
* Aseo.
* Otros servicios.

Cada servicio tendrá:

* Propiedad.
* Unidad, cuando corresponda.
* Empresa prestadora.
* Número de cuenta.
* Periodo.
* Valor.
* Fecha de vencimiento.
* Estado.
* Recibo adjunto.

---

# 12. Servicios compartidos

Esta será una función especialmente importante de GDP.

Existen propiedades donde varias unidades comparten un mismo recibo.

Ejemplo:

```text
PROPIEDAD
Casa dividida en 3 apartamentos

RECIBO DE AGUA
Total: $300.000

        ↓

Apartamento 1 → $100.000
Apartamento 2 → $100.000
Apartamento 3 → $100.000
```

GDP permitirá definir cómo distribuir el recibo.

Métodos:

```text
Partes iguales
Porcentaje
Consumo
Valor fijo
Manual
```

Esto permitirá administrar correctamente propiedades con:

* Un solo contador.
* Varios apartamentos.
* Varios inquilinos.
* Un único recibo.

---

# 13. Alertas automáticas

Uno de los objetivos principales de GDP es evitar que el propietario tenga que recordar manualmente sus obligaciones.

El sistema generará alertas para:

### Arriendos

* Próximo pago.
* Pago vencido.
* Pago parcial.

### Servicios

* Recibo próximo a vencer.
* Recibo vencido.
* Servicio pendiente.

### Contratos

* Contrato próximo a vencer.
* Contrato finalizado.

### Mantenimiento

* Nueva solicitud.
* Mantenimiento pendiente.
* Mantenimiento finalizado.

Ejemplos:

```text
"El arriendo de la Unidad 101 vence en 3 días."

"El recibo de energía vence mañana."

"El contrato de la Unidad 202 vence en 30 días."

"Hay un mantenimiento pendiente en la Unidad 301."
```

Las alertas serán generadas automáticamente mediante procesos programados.

---

# 14. Mantenimiento

El mantenimiento permitirá administrar problemas y reparaciones de las propiedades.

Un ticket puede ser creado por:

* Propietario.
* Administrador.
* Inquilino.

Información:

* Propiedad.
* Unidad.
* Usuario que reporta.
* Descripción.
* Fotografías.
* Tipo.
* Prioridad.
* Responsable.
* Costo.
* Fecha.
* Estado.

Tipos:

```text
Preventivo
Correctivo
```

Estados:

```text
Reportado
Pendiente
En revisión
En proceso
Resuelto
Cancelado
```

---

# 15. Documentos

GDP permitirá centralizar los documentos relacionados con la administración.

Ejemplos:

* Contratos.
* Comprobantes de pago.
* Recibos de servicios.
* Documentos de propiedad.
* Documentos de inquilinos.
* Soportes de mantenimiento.

Cada documento estará relacionado con la entidad correspondiente.

---

# 16. Reportes

Los reportes serán principalmente generados a partir de la información existente.

No será necesario almacenar cada indicador como una tabla independiente.

Se podrán generar:

### Reportes de propiedades

* Propiedades totales.
* Unidades totales.
* Unidades ocupadas.
* Unidades disponibles.
* Porcentaje de ocupación.

### Reportes financieros

* Ingresos.
* Pagos pendientes.
* Pagos en mora.
* Cartera.
* Ingresos por propiedad.
* Ingresos por unidad.

### Reportes de servicios

* Recibos pendientes.
* Recibos vencidos.
* Valor de servicios.
* Servicios compartidos.

### Reportes de mantenimiento

* Tickets abiertos.
* Tickets cerrados.
* Costos.
* Mantenimientos por propiedad.

---

# 17. Planes y suscripciones

GDP funcionará como una plataforma SaaS.

Los planes estarán separados de la lógica de propiedades y contratos.

Ejemplo:

```text
PLAN GRATIS
PLAN BÁSICO
PLAN PROFESIONAL
PLAN INMOBILIARIA
```

Cada plan podrá definir:

* Precio.
* Máximo de propiedades.
* Máximo de unidades.
* Número de usuarios.
* Funciones disponibles.
* Almacenamiento.
* Reportes.
* Automatizaciones.

---

# 18. Descuentos y promociones

El precio normal del plan estará separado de los descuentos.

Ejemplo:

```text
Plan Profesional
Precio normal: $X

Descuento:
20%

Precio final:
$X - 20%
```

Esto permitirá implementar:

* Promociones.
* Descuentos temporales.
* Códigos promocionales.
* Ofertas para nuevos usuarios.
* Planes especiales.

Sin modificar el precio base del plan.

---

# 19. Base de datos principal

Las tablas principales serán:

```text
usuarios
roles
propietarios

planes
suscripciones
descuentos

propiedades
unidades

inquilinos
contratos

pagos

servicios
recibos
distribucion_servicios

mantenimientos

documentos
notificaciones

reportes_generados
logs
configuracion
```

---

# 20. Relaciones principales

```text
USUARIO
   │
   └── 1:1 PROPIETARIO
             │
             └── 1:N PROPIEDADES
                       │
                       └── 1:N UNIDADES
                                  │
                                  └── 1:N CONTRATOS
                                             │
                                             ├── N:1 INQUILINO
                                             │
                                             └── 1:N PAGOS

PROPIEDAD
   │
   ├── 1:N SERVICIOS
   │        │
   │        └── 1:N RECIBOS
   │                 │
   │                 └── 1:N DISTRIBUCIÓN
   │
   ├── 1:N MANTENIMIENTOS
   │
   └── 1:N DOCUMENTOS

USUARIO
   │
   └── 1:N NOTIFICACIONES

PLAN
   │
   └── 1:N SUSCRIPCIONES
             │
             └── N:1 USUARIO
```

---

# 21. Flujo principal de GDP

```text
REGISTRO
   ↓
CREAR PERFIL
   ↓
REGISTRAR PROPIEDAD
   ↓
CREAR UNIDAD
   ↓
REGISTRAR INQUILINO
   ↓
CREAR CONTRATO
   ↓
CONFIGURAR CANON
   ↓
CONFIGURAR SERVICIOS
   ↓
CONFIGURAR SERVICIOS COMPARTIDOS
   ↓
GENERAR PAGOS
   ↓
ACTIVAR ALERTAS
   ↓
GESTIONAR PAGOS Y RECIBOS
   ↓
GESTIONAR MANTENIMIENTOS
   ↓
CONSULTAR REPORTES
```

---

# 22. Arquitectura funcional

El sistema se puede dividir en módulos:

```text
GDP
│
├── Autenticación
│
├── Usuarios
│
├── Propiedades
│
├── Unidades
│
├── Inquilinos
│
├── Contratos
│
├── Pagos
│
├── Servicios
│     ├── Agua
│     ├── Energía
│     ├── Gas
│     └── Compartidos
│
├── Alertas
│
├── Mantenimiento
│
├── Documentos
│
├── Reportes
│
└── Suscripciones
      ├── Planes
      └── Descuentos
```

---

# 23. Escalabilidad

El sistema debe poder pasar de:

### Fase 1

```text
1 propietario
2 casas
2 unidades
2 inquilinos
```

a:

### Fase 2

```text
10 propietarios
15 propiedades
80 unidades
```

a:

### Fase 3

```text
200 propietarios / inmobiliarias
600 propiedades
4.000 unidades
```

y posteriormente a miles de usuarios y unidades.

Para esto se utilizarán:

* Claves foráneas.
* Índices.
* Paginación.
* Consultas optimizadas.
* Separación de módulos.
* Procesos automáticos para alertas.
* Historial de información.
* Arquitectura preparada para colas y procesos en segundo plano.

La estructura principal no deberá cambiar cuando aumente la cantidad de registros.

---

# 24. Reglas de negocio fundamentales

1. Una propiedad pertenece a un solo propietario.

2. Una propiedad puede tener una o muchas unidades.

3. Una casa individual se representa como una propiedad con una unidad.

4. Una unidad es la unidad mínima arrendable.

5. Una unidad solo puede tener un contrato activo al mismo tiempo.

6. Un inquilino se relaciona con una unidad mediante un contrato.

7. Un pago siempre pertenece a un contrato.

8. Los contratos terminados no se eliminan.

9. Los pagos históricos no se eliminan.

10. Un propietario solamente puede consultar sus propios datos.

11. El SuperAdmin puede consultar la información global de la plataforma.

12. Los servicios pueden pertenecer a una propiedad o a una unidad, dependiendo de cómo estén configurados.

13. Un recibo puede distribuirse entre varias unidades.

14. Las alertas se generan automáticamente.

15. Los descuentos se administran independientemente del precio base de los planes.

---

# 25. Evolución futura

El modelo queda preparado para incorporar posteriormente:

* Aplicación exclusiva para inquilinos.
* Pagos en línea.
* Firma digital de contratos.
* Integración bancaria.
* Facturación electrónica.
* Contabilidad.
* Gestión avanzada de inmobiliarias.
* Múltiples administradores por propietario.
* Proveedores de mantenimiento.
* Automatización avanzada.
* Estadísticas financieras.
* Integración con servicios externos.

Estas funciones se pueden añadir sobre la estructura existente sin modificar el núcleo:

**Propietario → Propiedad → Unidad → Contrato → Inquilino → Pagos/Servicios.**

---

# 26. Núcleo definitivo de GDP

La idea central del proyecto queda definida así:

```text
                    GDP
                     │
             GESTIÓN DE PROPIEDADES
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
   PROPIEDADES    INQUILINOS    ADMINISTRACIÓN
        │            │
        ↓            ↓
      UNIDADES ← CONTRATOS
                     │
              ┌──────┴──────┐
              ↓             ↓
            PAGOS       SERVICIOS
                            │
                     ┌──────┴──────┐
                     ↓             ↓
                  RECIBOS     COMPARTIDOS
                     
        ┌────────────┼────────────┐
        ↓            ↓            ↓
     ALERTAS    MANTENIMIENTO   REPORTES
```

**GDP no será simplemente un registro de propiedades.**

Será una plataforma para **automatizar la administración diaria de los inmuebles en arriendo**, comenzando por las necesidades más importantes: **cobros, contratos, recibos de agua/luz/gas, servicios compartidos, alertas y mantenimiento**, y dejando la estructura preparada para crecer posteriormente hacia una solución completa para propietarios e inmobiliarias.
