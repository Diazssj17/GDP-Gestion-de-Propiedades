# GDP - Gestión de Propiedades

**Jerarquía oficial:** `Administrador Plataforma → Propietario → Propiedad → Unidad → Inquilino → Contrato → Pagos → Servicios → Alertas → Mantenimiento → Reportes`

Sistema SaaS escalable para gestionar desde **1 propietario con 2 casas** hasta **miles de propiedades e inmobiliarias** sin cambiar la estructura fundamental.

## Regla de oro de escalabilidad

- **Casa individual = Propiedad con 1 Unidad** (`num_unidades=1`, `codigo='UNICA'`). No hay caso especial en el código.
- **Inmobiliaria = Propietario tipo `inmobiliaria`** con N propiedades. No se crea tabla nueva.

Así el mismo código que lista 2 unidades funciona para 4.000 con paginación e índices.

## Arquitectura

- **Backend:** Python 3 + Flask (ver `app.py:1`)
- **DB:** SQLite (`gdp.db`) → PostgreSQL en producción sin cambiar esquema (`database.py:1`)
- **Deploy:** Render (ver `render.yaml:1`) / PythonAnywhere / Docker
- **Tablas:** 14 (usuarios, planes, suscripciones, propietarios, propiedades, unidades, inquilinos, contratos, pagos, servicios, unidad_servicios, alertas, mantenimiento, reportes_generados) + 13 índices para gran volumen.

Ver detalle: `docs/modelo.md:1` y `docs/arquitectura.md:1`

## Estructura

```
GDP-Gestion-de-Propiedades/
├── app.py               # API Flask + paginación + reportes
├── database.py          # Esquema completo escalable + seed
├── wsgi.py              # Entry point gunicorn
├── requirements.txt
├── render.yaml
├── docs/
│   ├── modelo.md        # Jerarquía y diagrama ER
│   ├── arquitectura.md  # Stack y principios
│   └── requisitos.md
├── static/uploads/      # Comprobantes, fotos unidades
└── templates/
```

## Instalación local

```bash
git clone https://github.com/Diazssj17/GDP-Gestion-de-Propiedades.git
cd GDP-Gestion-de-Propiedades
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python database.py     # crea gdp.db + seed
python app.py          # http://localhost:5001
```

## Usuarios seed

| Rol | Email | Clave | Alcance |
|-----|-------|-------|---------|
| Superadmin (plataforma) | `admin@gdp.com` | `admin123` | Planes, suscripciones, todos los datos |
| Propietario demo | `demo@propietario.com` | `demo123` | 2 casas demo (2 propiedades → 2 unidades) |

## API (ejemplos)

```bash
curl http://localhost:5001/
curl http://localhost:5001/api/health
curl http://localhost:5001/api/propiedades?propietario_id=1&page=1&per_page=20
curl http://localhost:5001/api/unidades?estado=disponible
curl http://localhost:5001/api/reportes/resumen
```

## Planes (control del Administrador Plataforma)

- **Básico** $29k: 5 propiedades / 10 unidades
- **Profesional** $59k: 20 / 100 + alertas y reportes
- **Empresarial** $129k: 200 / 1000 + API

Tabla `planes` + `suscripciones` permite monetización sin tocar el dominio.

## Escalabilidad sin refactorización

- FK + índices en todas las relaciones
- Listados con `LIMIT/OFFSET` (paginación)
- Estados (`disponible/ocupada`, `activo/vencido`, `pendiente/mora`) para filtros
- Historial conservado (no se borra, se cambia estado)
- Alertas/reportes desacoplados (pueden pasar a Redis/Celery después)

## Repositorio

https://github.com/Diazssj17/GDP-Gestion-de-Propiedades
