"""
database.py - GDP Gestión de Propiedades
Esquema escalable: Administrador → Propietario → Propiedad → Unidad → Inquilino → Contrato → Pagos → Servicios → Alertas → Mantenimiento → Reportes

Diseñado para escalar de 1 propietario / 2 casas a miles sin cambiar la estructura base.
Casa individual = Propiedad con 1 Unidad.
Inmobiliaria = Propietario tipo 'inmobiliaria' con N Propiedades.
"""

import sqlite3
import os
from werkzeug.security import generate_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "gdp.db")
UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads")


def get_db():
    conexion = sqlite3.connect(DB_PATH)
    conexion.row_factory = sqlite3.Row
    conexion.execute("PRAGMA foreign_keys = ON")
    conexion.execute("PRAGMA journal_mode = WAL")
    return conexion


def _tiene_columna(conexion, tabla, columna):
    columnas = conexion.execute(f"PRAGMA table_info({tabla})").fetchall()
    return any(fila["name"] == columna for fila in columnas)


def _tiene_tabla(conexion, tabla):
    fila = conexion.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (tabla,)
    ).fetchone()
    return fila is not None


def crear_tablas():
    conexion = get_db()
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(os.path.join(UPLOAD_FOLDER, "comprobantes"), exist_ok=True)
    os.makedirs(os.path.join(UPLOAD_FOLDER, "unidades"), exist_ok=True)

    # 1) Usuarios base (auth) - sobre todo está el Administrador Plataforma
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            rol TEXT NOT NULL DEFAULT 'propietario' CHECK(rol IN ('superadmin','propietario','inquilino','operador')),
            telefono TEXT DEFAULT '',
            activo INTEGER NOT NULL DEFAULT 1,
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 2) Planes (controlados por Administrador plataforma)
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS planes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            descripcion TEXT DEFAULT '',
            precio_mensual REAL NOT NULL DEFAULT 0,
            max_propiedades INTEGER NOT NULL DEFAULT 5,
            max_unidades INTEGER NOT NULL DEFAULT 20,
            max_propietarios_gestionados INTEGER NOT NULL DEFAULT 1,
            features TEXT DEFAULT '[]',
            activo INTEGER NOT NULL DEFAULT 1,
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 3) Suscripciones (Propietario → Plan)
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS suscripciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            plan_id INTEGER NOT NULL REFERENCES planes(id),
            estado TEXT NOT NULL DEFAULT 'activa' CHECK(estado IN ('activa','vencida','cancelada','trial')),
            fecha_inicio TEXT NOT NULL DEFAULT (date('now')),
            fecha_fin TEXT,
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(usuario_id, plan_id, fecha_inicio)
        )
    """)

    # 4) Propietarios (perfil extendido de usuario propietario)
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS propietarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
            tipo TEXT NOT NULL DEFAULT 'persona_natural' CHECK(tipo IN ('persona_natural','empresa','inmobiliaria')),
            documento TEXT NOT NULL DEFAULT '',
            direccion TEXT DEFAULT '',
            ciudad TEXT DEFAULT '',
            notas TEXT DEFAULT '',
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 5) Propiedades
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS propiedades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            propietario_id INTEGER NOT NULL REFERENCES propietarios(id) ON DELETE CASCADE,
            nombre TEXT NOT NULL,
            tipo TEXT NOT NULL DEFAULT 'casa' CHECK(tipo IN ('casa','apartamento','edificio','conjunto','local','lote','finca','bodega')),
            direccion TEXT NOT NULL,
            ciudad TEXT NOT NULL DEFAULT '',
            estrato INTEGER DEFAULT 0,
            descripcion TEXT DEFAULT '',
            num_unidades INTEGER NOT NULL DEFAULT 1,
            area_total_m2 REAL DEFAULT 0,
            estado TEXT NOT NULL DEFAULT 'activa' CHECK(estado IN ('activa','inactiva','en_venta')),
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 6) Unidades (entidad arrendable mínima)
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS unidades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            propiedad_id INTEGER NOT NULL REFERENCES propiedades(id) ON DELETE CASCADE,
            codigo TEXT NOT NULL,
            tipo TEXT NOT NULL DEFAULT 'apartamento' CHECK(tipo IN ('apartamento','casa','local','habitacion','parqueadero','bodega','oficina','lote')),
            habitaciones INTEGER DEFAULT 0,
            banos INTEGER DEFAULT 0,
            area_m2 REAL DEFAULT 0,
            canon_base REAL NOT NULL DEFAULT 0,
            administracion REAL DEFAULT 0,
            estado TEXT NOT NULL DEFAULT 'disponible' CHECK(estado IN ('disponible','ocupada','mantenimiento','reservada')),
            descripcion TEXT DEFAULT '',
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(propiedad_id, codigo)
        )
    """)

    # 7) Inquilinos
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS inquilinos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
            nombre TEXT NOT NULL,
            documento TEXT NOT NULL DEFAULT '',
            email TEXT DEFAULT '',
            telefono TEXT DEFAULT '',
            direccion TEXT DEFAULT '',
            referencia TEXT DEFAULT '',
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 8) Contratos (Unidad ↔ Inquilino)
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS contratos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unidad_id INTEGER NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
            inquilino_id INTEGER NOT NULL REFERENCES inquilinos(id) ON DELETE CASCADE,
            fecha_inicio TEXT NOT NULL,
            fecha_fin TEXT NOT NULL,
            canon REAL NOT NULL,
            deposito REAL DEFAULT 0,
            incremento_anual_pct REAL DEFAULT 0,
            estado TEXT NOT NULL DEFAULT 'activo' CHECK(estado IN ('activo','vencido','terminado','cancelado')),
            clausulas TEXT DEFAULT '',
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 9) Pagos
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS pagos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contrato_id INTEGER NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
            concepto TEXT NOT NULL DEFAULT 'canon' CHECK(concepto IN ('canon','deposito','administracion','servicios','multa','otro')),
            monto REAL NOT NULL,
            fecha_vencimiento TEXT NOT NULL,
            fecha_pago TEXT,
            metodo TEXT DEFAULT '' CHECK(metodo IN ('','efectivo','transferencia','consignacion','pse','otro')),
            estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','pagado','mora','parcial','anulado')),
            comprobante TEXT DEFAULT '',
            notas TEXT DEFAULT '',
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 10) Servicios (catálogo)
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS servicios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            descripcion TEXT DEFAULT '',
            tipo TEXT NOT NULL DEFAULT 'mensual' CHECK(tipo IN ('mensual','bimestral','ocasional')),
            activo INTEGER NOT NULL DEFAULT 1
        )
    """)

    # 11) Unidad ↔ Servicios (costo por periodo)
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS unidad_servicios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unidad_id INTEGER NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
            servicio_id INTEGER NOT NULL REFERENCES servicios(id),
            costo REAL NOT NULL DEFAULT 0,
            responsable TEXT NOT NULL DEFAULT 'inquilino' CHECK(responsable IN ('inquilino','propietario','compartido')),
            periodo TEXT NOT NULL DEFAULT (strftime('%Y-%m','now')),
            estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','pagado','mora')),
            notas TEXT DEFAULT '',
            UNIQUE(unidad_id, servicio_id, periodo)
        )
    """)

    # 12) Alertas
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS alertas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_destino_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            tipo TEXT NOT NULL CHECK(tipo IN ('vencimiento_contrato','mora','pago_proximo','mantenimiento','servicio','sistema','otro')),
            titulo TEXT NOT NULL,
            mensaje TEXT NOT NULL,
            referencia_tipo TEXT DEFAULT '',
            referencia_id INTEGER DEFAULT 0,
            leida INTEGER NOT NULL DEFAULT 0,
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            fecha_vencimiento TEXT
        )
    """)

    # 13) Mantenimiento
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS mantenimiento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unidad_id INTEGER NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
            reportado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
            tipo TEXT NOT NULL DEFAULT 'correctivo' CHECK(tipo IN ('preventivo','correctivo','mejora','inspeccion')),
            titulo TEXT NOT NULL,
            descripcion TEXT NOT NULL,
            prioridad TEXT NOT NULL DEFAULT 'media' CHECK(prioridad IN ('baja','media','alta','critica')),
            estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','en_proceso','resuelto','cancelado')),
            costo_estimado REAL DEFAULT 0,
            costo_real REAL DEFAULT 0,
            fecha_reporte TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            fecha_resolucion TEXT
        )
    """)

    # 14) Reportes generados (auditoría)
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS reportes_generados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            generado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
            tipo TEXT NOT NULL CHECK(tipo IN ('ocupacion','cartera','rentabilidad','mantenimiento','vencimientos','general')),
            filtros TEXT DEFAULT '{}',
            resultado_resumen TEXT DEFAULT '',
            fecha_generacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Índices para escalabilidad (consultas frecuentes con miles de filas)
    indices = [
        "CREATE INDEX IF NOT EXISTS idx_propiedades_propietario ON propiedades(propietario_id)",
        "CREATE INDEX IF NOT EXISTS idx_unidades_propiedad ON unidades(propiedad_id)",
        "CREATE INDEX IF NOT EXISTS idx_unidades_estado ON unidades(estado)",
        "CREATE INDEX IF NOT EXISTS idx_contratos_unidad ON contratos(unidad_id)",
        "CREATE INDEX IF NOT EXISTS idx_contratos_inquilino ON contratos(inquilino_id)",
        "CREATE INDEX IF NOT EXISTS idx_contratos_estado ON contratos(estado)",
        "CREATE INDEX IF NOT EXISTS idx_contratos_fechas ON contratos(fecha_fin, estado)",
        "CREATE INDEX IF NOT EXISTS idx_pagos_contrato ON pagos(contrato_id)",
        "CREATE INDEX IF NOT EXISTS idx_pagos_estado_vencimiento ON pagos(estado, fecha_vencimiento)",
        "CREATE INDEX IF NOT EXISTS idx_alertas_usuario_leida ON alertas(usuario_destino_id, leida)",
        "CREATE INDEX IF NOT EXISTS idx_mantenimiento_unidad_estado ON mantenimiento(unidad_id, estado)",
        "CREATE INDEX IF NOT EXISTS idx_suscripciones_usuario ON suscripciones(usuario_id)",
        "CREATE INDEX IF NOT EXISTS idx_unidad_servicios_unidad_periodo ON unidad_servicios(unidad_id, periodo)",
    ]
    for sql in indices:
        conexion.execute(sql)

    conexion.commit()
    sembrar_datos_iniciales(conexion)
    conexion.close()


def sembrar_datos_iniciales(conexion):
    # Superadmin plataforma
    admin = conexion.execute("SELECT id FROM usuarios WHERE email=?", ("admin@gdp.com",)).fetchone()
    if not admin:
        conexion.execute(
            "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?,?,?,?)",
            ("Administrador Plataforma", "admin@gdp.com", generate_password_hash("admin123"), "superadmin"),
        )
        print("[OK] Superadmin creado: admin@gdp.com / admin123")

    # Planes
    planes_count = conexion.execute("SELECT COUNT(*) as c FROM planes").fetchone()["c"]
    if planes_count == 0:
        planes = [
            ("Básico", "Para propietarios pequeños (hasta 5 propiedades, 10 unidades)", 29000, 5, 10, 1, '["dashboard","contratos","pagos"]'),
            ("Profesional", "Para propietarios medianos e inmobiliarias pequeñas", 59000, 20, 100, 5, '["dashboard","contratos","pagos","servicios","alertas","reportes"]'),
            ("Empresarial", "Para inmobiliarias grandes, sin límites prácticos", 129000, 200, 1000, 50, '["todo","multiusuario","api","soporte_prioritario"]'),
        ]
        for p in planes:
            conexion.execute(
                "INSERT INTO planes (nombre, descripcion, precio_mensual, max_propiedades, max_unidades, max_propietarios_gestionados, features) VALUES (?,?,?,?,?,?,?)", p
            )
        print("[OK] Planes creados: Basico, Profesional, Empresarial")

    # Servicios catálogo
    servicios_count = conexion.execute("SELECT COUNT(*) as c FROM servicios").fetchone()["c"]
    if servicios_count == 0:
        servicios = [
            ("Agua", "Acueducto", "mensual"),
            ("Luz", "Energía eléctrica", "mensual"),
            ("Gas", "Gas natural", "mensual"),
            ("Internet", "Internet / TV", "mensual"),
            ("Administración", "Cuota administración", "mensual"),
            ("Aseo", "Servicio aseo", "mensual"),
        ]
        for s in servicios:
            conexion.execute("INSERT INTO servicios (nombre, descripcion, tipo) VALUES (?,?,?)", s)
        print("[OK] Servicios catalogo creado")

    # Demo pequeño: 1 propietario con 2 casas (valida escalabilidad base)
    demo_user = conexion.execute("SELECT id FROM usuarios WHERE email=?", ("demo@propietario.com",)).fetchone()
    if not demo_user:
        conexion.execute(
            "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?,?,?,?)",
            ("Propietario Demo", "demo@propietario.com", generate_password_hash("demo123"), "propietario"),
        )
        demo_user_id = conexion.execute("SELECT id FROM usuarios WHERE email=?", ("demo@propietario.com",)).fetchone()["id"]
        conexion.execute(
            "INSERT INTO propietarios (usuario_id, tipo, documento, direccion, ciudad) VALUES (?,?,?,?,?)",
            (demo_user_id, "persona_natural", "1000000001", "Calle 10 # 5-20", "Villavicencio"),
        )
        prop_id = conexion.execute("SELECT id FROM propietarios WHERE usuario_id=?", (demo_user_id,)).fetchone()["id"]
        # Propiedad 1: Casa individual → 1 unidad (regla de oro)
        conexion.execute(
            "INSERT INTO propiedades (propietario_id, nombre, tipo, direccion, ciudad, num_unidades) VALUES (?,?,?,?,?,?)",
            (prop_id, "Casa Centro", "casa", "Calle 10 # 5-20", "Villavicencio", 1),
        )
        casa_id = conexion.execute("SELECT id FROM propiedades WHERE nombre='Casa Centro'").fetchone()["id"]
        conexion.execute(
            "INSERT INTO unidades (propiedad_id, codigo, tipo, habitaciones, banos, area_m2, canon_base, estado) VALUES (?,?,?,?,?,?,?,?)",
            (casa_id, "UNICA", "casa", 3, 2, 120, 900000, "disponible"),
        )
        # Propiedad 2: Casa segunda
        conexion.execute(
            "INSERT INTO propiedades (propietario_id, nombre, tipo, direccion, ciudad, num_unidades) VALUES (?,?,?,?,?,?)",
            (prop_id, "Casa Barzal", "casa", "Carrera 30 # 40-15", "Villavicencio", 1),
        )
        casa2_id = conexion.execute("SELECT id FROM propiedades WHERE nombre='Casa Barzal'").fetchone()["id"]
        conexion.execute(
            "INSERT INTO unidades (propiedad_id, codigo, tipo, habitaciones, banos, area_m2, canon_base, estado) VALUES (?,?,?,?,?,?,?,?)",
            (casa2_id, "UNICA", "casa", 2, 1, 80, 700000, "disponible"),
        )
        # Suscripción demo
        plan_basico = conexion.execute("SELECT id FROM planes WHERE nombre='Básico'").fetchone()["id"]
        conexion.execute(
            "INSERT INTO suscripciones (usuario_id, plan_id, estado) VALUES (?,?,?)",
            (demo_user_id, plan_basico, "activa"),
        )
        print("[OK] Demo creado: demo@propietario.com / demo123 -> 2 casas (2 propiedades, 2 unidades)")

    conexion.commit()


if __name__ == "__main__":
    crear_tablas()
    print(f"Base de datos GDP lista en: {DB_PATH}")
    # Resumen
    con = get_db()
    for tabla in ["usuarios","planes","propietarios","propiedades","unidades","inquilinos","contratos","pagos","servicios","alertas","mantenimiento"]:
        try:
            count = con.execute(f"SELECT COUNT(*) as c FROM {tabla}").fetchone()["c"]
            print(f"  {tabla}: {count}")
        except:
            pass
    con.close()
