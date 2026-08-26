# Arquitectura GDP

## Stack Base
- **Backend:** Python 3 + Flask (ligero, fácil de escalar a Django/FastAPI después)
- **DB:** SQLite (desarrollo) → PostgreSQL (producción) sin cambiar SQL (queries estándar)
- **ORM:** SQL directo con `sqlite3` + `row_factory` (transparente y sin dependencias pesadas, migrable a SQLAlchemy)
- **Frontend:** Jinja2 + Bootstrap 5 (SSR rápido, después escalable a SPA)
- **Deploy:** Render / PythonAnywhere / Docker

## Estructura de carpetas
```
GDP-Gestion-de-Propiedades/
├── app.py               # Rutas Flask y lógica de negocio
├── database.py          # Esquema, migraciones y seed (14 tablas)
├── wsgi.py              # Entry point para gunicorn
├── requirements.txt
├── gdp.db               # SQLite local (no se sube a GitHub)
├── docs/
│   ├── modelo.md        # Jerarquía y reglas de escalabilidad
│   ├── arquitectura.md  # Este archivo
│   └── requisitos.md
├── static/
│   └── uploads/         # Comprobantes de pago, fotos de unidades
├── templates/           # Jinja2 (cuando haya UI)
└── src/                 # Módulos futuros (services, jobs)
```

## Principios de escalabilidad aplicados

1. **Normalización 3FN:** cada entidad en su tabla, sin duplicar datos.
2. **Claves foráneas + ON DELETE CASCADE/SET NULL** según caso.
3. **Índices en FK y estados** para filtros masivos.
4. **Paginación obligatoria** en listados (propiedades, unidades, pagos).
5. **Roles en DB** (`superadmin`, `propietario`, `inquilino`) + decoradores en Flask.
6. **Soft history:** no se borra, se cambia `estado`.
7. **Desacoplado:** alertas y reportes son lecturas, no bloquean escrituras.

## Flujo de datos

```
Login (usuarios) → Middleware rol → 
  SuperAdmin: CRUD planes/suscripciones/usuarios
  Propietario: CRUD propiedades → unidades → contratos → pagos/servicios → alertas/mantenimiento → reportes
  Inquilino: ver contrato/pagos/servicios, reportar mantenimiento
```

## Migración a gran escala (cuando toque)

- Cambiar `DB_PATH` a PostgreSQL: solo cambia `get_db()` (usar `psycopg2`).
- Añadir Redis/Celery para alertas periódicas (hoy es un cron en `app.py`).
- Añadir paginación + búsqueda full-text (índices).
- Sin tocar el diagrama ER base.
