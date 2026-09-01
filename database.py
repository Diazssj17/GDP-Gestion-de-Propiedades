"""
database.py - GDP Gestion de Propiedades v2
Sincronizado con docs/modelo.md v2 (26 secciones)
Esquema: Usuario -> Propietario -> Propiedad -> Unidad -> Contrato -> Inquilino -> Pagos y Servicios (recibos + distribucion)
+ Alertas/Notificaciones + Mantenimiento + Documentos + Planes/Suscripciones/Descuentos + Logs/Configuracion

Escalabilidad: Casa = Propiedad con 1 Unidad | Inmobiliaria = propietarios.tipo='inmobiliaria'
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
    for sub in ["comprobantes", "unidades", "recibos", "documentos", "contratos", "mantenimiento"]:
        os.makedirs(os.path.join(UPLOAD_FOLDER, sub), exist_ok=True)

    # --- 0) Roles (catalogo) ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE CHECK(nombre IN ('superadmin','propietario','inquilino','operador')),
            descripcion TEXT DEFAULT '',
            activo INTEGER NOT NULL DEFAULT 1
        )
    """)

    # --- 1) Usuarios ---
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
    # Migracion: agregar rol_id FK a roles si falta (para compatibilidad futura)
    if not _tiene_columna(conexion, "usuarios", "rol_id"):
        conexion.execute("ALTER TABLE usuarios ADD COLUMN rol_id INTEGER REFERENCES roles(id)")
        conexion.commit()

    # --- 2) Planes ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS planes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            descripcion TEXT DEFAULT '',
            precio_mensual REAL NOT NULL DEFAULT 0,
            max_propiedades INTEGER NOT NULL DEFAULT 5,
            max_unidades INTEGER NOT NULL DEFAULT 20,
            max_propietarios_gestionados INTEGER NOT NULL DEFAULT 1,
            max_usuarios INTEGER NOT NULL DEFAULT 1,
            almacenamiento_mb INTEGER NOT NULL DEFAULT 100,
            features TEXT DEFAULT '[]',
            activo INTEGER NOT NULL DEFAULT 1,
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # --- 3) Suscripciones ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS suscripciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            plan_id INTEGER NOT NULL REFERENCES planes(id),
            estado TEXT NOT NULL DEFAULT 'activa' CHECK(estado IN ('activa','vencida','cancelada','trial','pendiente')),
            fecha_inicio TEXT NOT NULL DEFAULT (date('now')),
            fecha_fin TEXT,
            fecha_proximo_cobro TEXT,
            acepta_terminos INTEGER NOT NULL DEFAULT 0,
            acepta_tratamiento INTEGER NOT NULL DEFAULT 0,
            autoriza_debito INTEGER NOT NULL DEFAULT 0,
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(usuario_id, plan_id, fecha_inicio)
        )
    """)
    for col, tipo in [("fecha_proximo_cobro", "TEXT"), ("acepta_terminos", "INTEGER NOT NULL DEFAULT 0"),
                      ("acepta_tratamiento", "INTEGER NOT NULL DEFAULT 0"), ("autoriza_debito", "INTEGER NOT NULL DEFAULT 0"),
                      ("intentos_fallo", "INTEGER NOT NULL DEFAULT 0"), ("bloqueada", "INTEGER NOT NULL DEFAULT 0")]:
        if not _tiene_columna(conexion, "suscripciones", col):
            conexion.execute(f"ALTER TABLE suscripciones ADD COLUMN {col} {tipo}")
            conexion.commit()

    # --- 3b) Descuentos / Promociones (separado del precio base del plan) ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS descuentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT NOT NULL UNIQUE,
            descripcion TEXT DEFAULT '',
            tipo TEXT NOT NULL DEFAULT 'porcentaje' CHECK(tipo IN ('porcentaje','valor_fijo')),
            valor REAL NOT NULL DEFAULT 0,
            plan_id INTEGER REFERENCES planes(id) ON DELETE SET NULL,
            activo INTEGER NOT NULL DEFAULT 1,
            fecha_inicio TEXT,
            fecha_fin TEXT,
            usos_max INTEGER DEFAULT 0,
            usos_actual INTEGER NOT NULL DEFAULT 0,
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # --- 4) Propietarios ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS propietarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
            tipo TEXT NOT NULL DEFAULT 'persona' CHECK(tipo IN ('persona','persona_natural','empresa','inmobiliaria')),
            documento TEXT NOT NULL DEFAULT '',
            direccion TEXT DEFAULT '',
            ciudad TEXT DEFAULT '',
            notas TEXT DEFAULT '',
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # --- 5) Propiedades ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS propiedades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            propietario_id INTEGER NOT NULL REFERENCES propietarios(id) ON DELETE CASCADE,
            nombre TEXT NOT NULL,
            tipo TEXT NOT NULL DEFAULT 'casa' CHECK(tipo IN ('casa','apartamento','edificio','conjunto','local','lote','finca','bodega','oficina','otro')),
            direccion TEXT NOT NULL,
            ciudad TEXT NOT NULL DEFAULT '',
            barrio TEXT DEFAULT '',
            estrato INTEGER DEFAULT 0,
            descripcion TEXT DEFAULT '',
            num_unidades INTEGER NOT NULL DEFAULT 1,
            area_total_m2 REAL DEFAULT 0,
            estado TEXT NOT NULL DEFAULT 'activa' CHECK(estado IN ('activa','inactiva','en_venta','inactiva')),
            fotografias TEXT DEFAULT '[]',
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    if not _tiene_columna(conexion, "propiedades", "barrio"):
        conexion.execute("ALTER TABLE propiedades ADD COLUMN barrio TEXT DEFAULT ''")
    if not _tiene_columna(conexion, "propiedades", "fotografias"):
        conexion.execute("ALTER TABLE propiedades ADD COLUMN fotografias TEXT DEFAULT '[]'")

    # --- 6) Unidades ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS unidades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            propiedad_id INTEGER NOT NULL REFERENCES propiedades(id) ON DELETE CASCADE,
            codigo TEXT NOT NULL,
            nombre TEXT DEFAULT '',
            tipo TEXT NOT NULL DEFAULT 'apartamento' CHECK(tipo IN ('apartamento','casa','local','habitacion','parqueadero','bodega','oficina','lote','otro')),
            habitaciones INTEGER DEFAULT 0,
            banos INTEGER DEFAULT 0,
            area_m2 REAL DEFAULT 0,
            canon_base REAL NOT NULL DEFAULT 0,
            administracion REAL DEFAULT 0,
            estado TEXT NOT NULL DEFAULT 'disponible' CHECK(estado IN ('disponible','ocupada','mantenimiento','reservada','inactiva')),
            caracteristicas TEXT DEFAULT '{}',
            descripcion TEXT DEFAULT '',
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(propiedad_id, codigo)
        )
    """)
    if not _tiene_columna(conexion, "unidades", "nombre"):
        conexion.execute("ALTER TABLE unidades ADD COLUMN nombre TEXT DEFAULT ''")
    if not _tiene_columna(conexion, "unidades", "caracteristicas"):
        conexion.execute("ALTER TABLE unidades ADD COLUMN caracteristicas TEXT DEFAULT '{}'")

    # --- 7) Inquilinos ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS inquilinos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
            propietario_id INTEGER REFERENCES propietarios(id) ON DELETE SET NULL,
            nombre TEXT NOT NULL,
            documento TEXT NOT NULL DEFAULT '',
            email TEXT DEFAULT '',
            telefono TEXT DEFAULT '',
            direccion TEXT DEFAULT '',
            contacto_emergencia TEXT DEFAULT '',
            referencia TEXT DEFAULT '',
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    if not _tiene_columna(conexion, "inquilinos", "contacto_emergencia"):
        conexion.execute("ALTER TABLE inquilinos ADD COLUMN contacto_emergencia TEXT DEFAULT ''")
    if not _tiene_columna(conexion, "inquilinos", "propietario_id"):
        conexion.execute("ALTER TABLE inquilinos ADD COLUMN propietario_id INTEGER REFERENCES propietarios(id) ON DELETE SET NULL")

    # --- 8) Contratos ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS contratos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unidad_id INTEGER NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
            inquilino_id INTEGER NOT NULL REFERENCES inquilinos(id) ON DELETE CASCADE,
            fecha_inicio TEXT NOT NULL,
            fecha_fin TEXT NOT NULL,
            canon REAL NOT NULL,
            dia_limite_pago INTEGER DEFAULT 5,
            deposito REAL DEFAULT 0,
            incremento_anual_pct REAL DEFAULT 0,
            estado TEXT NOT NULL DEFAULT 'activo' CHECK(estado IN ('pendiente','activo','proximo_a_vencer','finalizado','cancelado','vencido','terminado')),
            clausulas TEXT DEFAULT '',
            documento TEXT DEFAULT '',
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    if not _tiene_columna(conexion, "contratos", "dia_limite_pago"):
        conexion.execute("ALTER TABLE contratos ADD COLUMN dia_limite_pago INTEGER DEFAULT 5")
    if not _tiene_columna(conexion, "contratos", "documento"):
        conexion.execute("ALTER TABLE contratos ADD COLUMN documento TEXT DEFAULT ''")

    # --- 9) Pagos ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS pagos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contrato_id INTEGER NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
            concepto TEXT NOT NULL DEFAULT 'canon' CHECK(concepto IN ('canon','deposito','administracion','servicios','multa','otro')),
            periodo TEXT DEFAULT '' ,
            monto REAL NOT NULL,
            pagado REAL NOT NULL DEFAULT 0,
            fecha_vencimiento TEXT NOT NULL,
            fecha_pago TEXT,
            metodo TEXT DEFAULT '' CHECK(metodo IN ('','efectivo','transferencia','consignacion','pse','otro')),
            estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','pagado','mora','parcial','anulado','vencido')),
            comprobante TEXT DEFAULT '',
            notas TEXT DEFAULT '',
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    if not _tiene_columna(conexion, "pagos", "periodo"):
        conexion.execute("ALTER TABLE pagos ADD COLUMN periodo TEXT DEFAULT ''")
    if not _tiene_columna(conexion, "pagos", "pagado"):
        conexion.execute("ALTER TABLE pagos ADD COLUMN pagado REAL NOT NULL DEFAULT 0")

    # --- 9b) Abonos (pagos parciales acumulables) ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS abonos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pago_id INTEGER NOT NULL REFERENCES pagos(id) ON DELETE CASCADE,
            monto REAL NOT NULL,
            metodo TEXT DEFAULT '' CHECK(metodo IN ('','efectivo','transferencia','consignacion','pse','otro')),
            comprobante TEXT DEFAULT '',
            notas TEXT DEFAULT '',
            fecha TEXT NOT NULL DEFAULT (date('now'))
        )
    """)

    # --- 10) Servicios (catalogo) ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS servicios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            descripcion TEXT DEFAULT '',
            tipo TEXT NOT NULL DEFAULT 'mensual' CHECK(tipo IN ('mensual','bimestral','ocasional')),
            activo INTEGER NOT NULL DEFAULT 1
        )
    """)

    # --- 10b) Unidad <-> Servicios (legacy, se mantiene por compatibilidad) ---
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

    # --- 11) Recibos (servicios publicos: agua, energia, gas, etc.) ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS recibos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            servicio_id INTEGER NOT NULL REFERENCES servicios(id),
            propiedad_id INTEGER NOT NULL REFERENCES propiedades(id) ON DELETE CASCADE,
            unidad_id INTEGER REFERENCES unidades(id) ON DELETE SET NULL,
            empresa_prestadora TEXT DEFAULT '',
            numero_cuenta TEXT DEFAULT '',
            periodo TEXT NOT NULL DEFAULT (strftime('%Y-%m','now')),
            valor REAL NOT NULL DEFAULT 0,
            fecha_vencimiento TEXT,
            estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','pagado','vencido','parcial')),
            recibo_adjunto TEXT DEFAULT '',
            notas TEXT DEFAULT '',
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # --- 12) Distribucion de servicios compartidos ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS distribucion_servicios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recibo_id INTEGER NOT NULL REFERENCES recibos(id) ON DELETE CASCADE,
            unidad_id INTEGER NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
            metodo TEXT NOT NULL DEFAULT 'partes_iguales' CHECK(metodo IN ('partes_iguales','porcentaje','consumo','valor_fijo','manual')),
            porcentaje REAL DEFAULT 0,
            monto REAL NOT NULL DEFAULT 0,
            consumo REAL DEFAULT 0,
            notas TEXT DEFAULT '',
            UNIQUE(recibo_id, unidad_id)
        )
    """)

    # --- 13) Alertas (legacy) ---
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

    # --- 13b) Notificaciones (nombre nuevo del modelo v2, espejo de alertas) ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS notificaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_destino_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            tipo TEXT NOT NULL CHECK(tipo IN ('pago_proximo','pago_vencido','pago_parcial','recibo_proximo','recibo_vencido','contrato_proximo','contrato_finalizado','mantenimiento','sistema','otro')),
            titulo TEXT NOT NULL,
            mensaje TEXT NOT NULL,
            referencia_tipo TEXT DEFAULT '',
            referencia_id INTEGER DEFAULT 0,
            leida INTEGER NOT NULL DEFAULT 0,
            canal TEXT DEFAULT 'app' CHECK(canal IN ('app','email','sms','whatsapp')),
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            fecha_vencimiento TEXT
        )
    """)

    # --- 14) Mantenimiento (singular legacy) ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS mantenimiento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unidad_id INTEGER NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
            propiedad_id INTEGER REFERENCES propiedades(id) ON DELETE SET NULL,
            reportado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
            tipo TEXT NOT NULL DEFAULT 'correctivo' CHECK(tipo IN ('preventivo','correctivo','mejora','inspeccion')),
            titulo TEXT NOT NULL,
            descripcion TEXT NOT NULL,
            prioridad TEXT NOT NULL DEFAULT 'media' CHECK(prioridad IN ('baja','media','alta','critica')),
            estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','en_proceso','resuelto','cancelado','reportado','en_revision')),
            responsable TEXT DEFAULT '',
            costo_estimado REAL DEFAULT 0,
            costo_real REAL DEFAULT 0,
            fotografias TEXT DEFAULT '[]',
            fecha_reporte TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            fecha_resolucion TEXT
        )
    """)
    if not _tiene_columna(conexion, "mantenimiento", "propiedad_id"):
        conexion.execute("ALTER TABLE mantenimiento ADD COLUMN propiedad_id INTEGER REFERENCES propiedades(id) ON DELETE SET NULL")
    if not _tiene_columna(conexion, "mantenimiento", "responsable"):
        conexion.execute("ALTER TABLE mantenimiento ADD COLUMN responsable TEXT DEFAULT ''")
    if not _tiene_columna(conexion, "mantenimiento", "fotografias"):
        conexion.execute("ALTER TABLE mantenimiento ADD COLUMN fotografias TEXT DEFAULT '[]'")

    # --- 14b) Mantenimientos (plural, nombre oficial v2) - vista espejo ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS mantenimientos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unidad_id INTEGER NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
            propiedad_id INTEGER REFERENCES propiedades(id) ON DELETE SET NULL,
            reportado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
            tipo TEXT NOT NULL DEFAULT 'correctivo' CHECK(tipo IN ('preventivo','correctivo')),
            titulo TEXT NOT NULL,
            descripcion TEXT NOT NULL,
            prioridad TEXT NOT NULL DEFAULT 'media' CHECK(prioridad IN ('baja','media','alta','critica')),
            estado TEXT NOT NULL DEFAULT 'reportado' CHECK(estado IN ('reportado','pendiente','en_revision','en_proceso','resuelto','cancelado')),
            responsable TEXT DEFAULT '',
            costo_estimado REAL DEFAULT 0,
            costo_real REAL DEFAULT 0,
            fotografias TEXT DEFAULT '[]',
            fecha_reporte TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            fecha_resolucion TEXT
        )
    """)

    # --- 15) Documentos ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS documentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entidad_tipo TEXT NOT NULL CHECK(entidad_tipo IN ('propiedad','unidad','contrato','inquilino','pago','recibo','mantenimiento','propietario','usuario','otro')),
            entidad_id INTEGER NOT NULL,
            nombre TEXT NOT NULL,
            ruta TEXT NOT NULL DEFAULT '',
            tipo TEXT DEFAULT '' ,
            tamanio INTEGER DEFAULT 0,
            subido_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
            descripcion TEXT DEFAULT '',
            fecha_subida TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # --- 16) Reportes generados ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS reportes_generados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            generado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
            tipo TEXT NOT NULL CHECK(tipo IN ('ocupacion','cartera','rentabilidad','mantenimiento','vencimientos','general','propiedades','financiero','servicios')),
            filtros TEXT DEFAULT '{}',
            resultado_resumen TEXT DEFAULT '',
            fecha_generacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # --- 17) Logs ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
            accion TEXT NOT NULL,
            entidad_tipo TEXT DEFAULT '',
            entidad_id INTEGER DEFAULT 0,
            detalles TEXT DEFAULT '',
            ip TEXT DEFAULT '',
            fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # --- 18) Configuracion ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS configuracion (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clave TEXT NOT NULL UNIQUE,
            valor TEXT NOT NULL DEFAULT '',
            descripcion TEXT DEFAULT '',
            actualizado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
            fecha_actualizacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # --- 19) Tokens de sesion (autenticacion movil) ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            token TEXT NOT NULL UNIQUE,
            dispositivo TEXT DEFAULT '',
            activo INTEGER NOT NULL DEFAULT 1,
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            fecha_expiracion TEXT
        )
    """)

    # --- 20) Registro de intentos de login (anti fuerza bruta, ISO 27001 A.9) ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS login_intentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            ip TEXT DEFAULT '',
            intentos INTEGER NOT NULL DEFAULT 0,
            bloqueado_hasta TEXT,
            ultimo TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(email, ip)
        )
    """)

    # --- 21) Politicas de seguridad (configuracion) ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS politicas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clave TEXT NOT NULL UNIQUE,
            valor TEXT NOT NULL,
            descripcion TEXT DEFAULT ''
        )
    """)

    # --- 22) Recuperacion de contrasena ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS recuperaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            token TEXT NOT NULL UNIQUE,
            usado INTEGER NOT NULL DEFAULT 0,
            fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            fecha_expiracion TEXT NOT NULL
        )
    """)

    # --- 23) Transacciones de pago (pasarela Wompi) ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS transacciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            plan_id INTEGER NOT NULL REFERENCES planes(id),
            referencia TEXT NOT NULL UNIQUE,
            wompi_id TEXT DEFAULT '',
            monto_cents INTEGER NOT NULL,
            metodo TEXT NOT NULL DEFAULT 'card' CHECK(metodo IN ('card','pse','whatsapp')),
            estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','aprobada','rechazada','error')),
            detalles TEXT DEFAULT '',
            fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # --- 24) Dispositivos (push notifications Expo) ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS dispositivos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            expo_push_token TEXT NOT NULL UNIQUE,
            plataforma TEXT DEFAULT '',
            activo INTEGER NOT NULL DEFAULT 1,
            fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # --- 25) Documentos legales (terminos, privacidad, tratamiento de datos) ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS documentos_legales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clave TEXT NOT NULL UNIQUE,
            titulo TEXT NOT NULL,
            contenido TEXT NOT NULL DEFAULT '',
            version TEXT DEFAULT '1.0',
            fecha_actualizacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # --- 26) Tarjetas tokenizadas (cobro recurrente Wompi) ---
    conexion.execute("""
        CREATE TABLE IF NOT EXISTS tarjetas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            wompi_token TEXT NOT NULL,
            ultimos4 TEXT DEFAULT '',
            marca TEXT DEFAULT '',
            exp_mes TEXT DEFAULT '',
            exp_anio TEXT DEFAULT '',
            activo INTEGER NOT NULL DEFAULT 1,
            fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Indices escalabilidad
    indices = [
        "CREATE INDEX IF NOT EXISTS idx_propiedades_propietario ON propiedades(propietario_id)",
        "CREATE INDEX IF NOT EXISTS idx_unidades_propiedad ON unidades(propiedad_id)",
        "CREATE INDEX IF NOT EXISTS idx_unidades_estado ON unidades(estado)",
        "CREATE INDEX IF NOT EXISTS idx_contratos_unidad ON contratos(unidad_id)",
        "CREATE INDEX IF NOT EXISTS idx_contratos_inquilino ON contratos(inquilino_id)",
        "CREATE INDEX IF NOT EXISTS idx_inquilinos_propietario ON inquilinos(propietario_id)",        "CREATE INDEX IF NOT EXISTS idx_contratos_estado ON contratos(estado)",
        "CREATE INDEX IF NOT EXISTS idx_contratos_fechas ON contratos(fecha_fin, estado)",
        "CREATE INDEX IF NOT EXISTS idx_pagos_contrato ON pagos(contrato_id)",
        "CREATE INDEX IF NOT EXISTS idx_pagos_estado_vencimiento ON pagos(estado, fecha_vencimiento)",
        "CREATE INDEX IF NOT EXISTS idx_pagos_periodo ON pagos(periodo)",
        "CREATE INDEX IF NOT EXISTS idx_abonos_pago ON abonos(pago_id)",
        "CREATE INDEX IF NOT EXISTS idx_alertas_usuario_leida ON alertas(usuario_destino_id, leida)",
        "CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_leida ON notificaciones(usuario_destino_id, leida)",
        "CREATE INDEX IF NOT EXISTS idx_mantenimiento_unidad_estado ON mantenimiento(unidad_id, estado)",
        "CREATE INDEX IF NOT EXISTS idx_mantenimientos_unidad_estado ON mantenimientos(unidad_id, estado)",
        "CREATE INDEX IF NOT EXISTS idx_suscripciones_usuario ON suscripciones(usuario_id)",
        "CREATE INDEX IF NOT EXISTS idx_unidad_servicios_unidad_periodo ON unidad_servicios(unidad_id, periodo)",
        "CREATE INDEX IF NOT EXISTS idx_recibos_propiedad_periodo ON recibos(propiedad_id, periodo)",
        "CREATE INDEX IF NOT EXISTS idx_recibos_servicio ON recibos(servicio_id)",
        "CREATE INDEX IF NOT EXISTS idx_distribucion_recibo ON distribucion_servicios(recibo_id)",
        "CREATE INDEX IF NOT EXISTS idx_distribucion_unidad ON distribucion_servicios(unidad_id)",
        "CREATE INDEX IF NOT EXISTS idx_documentos_entidad ON documentos(entidad_tipo, entidad_id)",
        "CREATE INDEX IF NOT EXISTS idx_logs_usuario_fecha ON logs(usuario_id, fecha)",
        "CREATE INDEX IF NOT EXISTS idx_descuentos_codigo ON descuentos(codigo)",
        "CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens(token)",
        "CREATE INDEX IF NOT EXISTS idx_tokens_usuario ON tokens(usuario_id)",
        "CREATE INDEX IF NOT EXISTS idx_logs_usuario ON logs(usuario_id)",
        "CREATE INDEX IF NOT EXISTS idx_recuperaciones_token ON recuperaciones(token)",
        "CREATE INDEX IF NOT EXISTS idx_transacciones_usuario ON transacciones(usuario_id)",
        "CREATE INDEX IF NOT EXISTS idx_dispositivos_usuario ON dispositivos(usuario_id)",
        "CREATE INDEX IF NOT EXISTS idx_tarjetas_usuario ON tarjetas(usuario_id)",
    ]
    for sql in indices:
        conexion.execute(sql)

    conexion.commit()
    sembrar_datos_iniciales(conexion)
    conexion.close()


def sembrar_datos_iniciales(conexion):
    # Roles
    roles_exist = conexion.execute("SELECT COUNT(*) as c FROM roles").fetchone()["c"]
    if roles_exist == 0:
        for r in [("superadmin","Administrador de plataforma"),("propietario","Propietario / Inmobiliaria"),("inquilino","Inquilino"),("operador","Operador / Asistente")]:
            conexion.execute("INSERT INTO roles (nombre, descripcion) VALUES (?,?)", r)
        print("[OK] Roles creados: superadmin, propietario, inquilino, operador")

    # Superadmin
    admin = conexion.execute("SELECT id FROM usuarios WHERE email=?", ("admin@gdp.com",)).fetchone()
    if not admin:
        conexion.execute(
            "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?,?,?,?)",
            ("Administrador Plataforma", "admin@gdp.com", generate_password_hash("admin123"), "superadmin"),
        )
        print("[OK] Superadmin creado: admin@gdp.com / admin123")

    # Vincular rol_id
    try:
        conexion.execute("""
            UPDATE usuarios SET rol_id = (SELECT id FROM roles WHERE roles.nombre = usuarios.rol)
            WHERE rol_id IS NULL
        """)
    except:
        pass

    # Planes (incluye GRATIS del modelo v2)
    planes_count = conexion.execute("SELECT COUNT(*) as c FROM planes").fetchone()["c"]
    if planes_count == 0:
        planes = [
            ("Gratis", "Plan de prueba", 0, 1, 2, 1, 1, 50, '["dashboard"]'),
            ("Basico", "Para propietarios pequenos (hasta 5 propiedades, 10 unidades)", 29000, 5, 10, 1, 1, 200, '["dashboard","contratos","pagos"]'),
            ("Profesional", "Para propietarios medianos e inmobiliarias pequenas", 59000, 20, 100, 5, 3, 1024, '["dashboard","contratos","pagos","servicios","alertas","reportes","documentos"]'),
            ("Inmobiliaria", "Para inmobiliarias grandes, sin limites practicos", 129000, 200, 1000, 50, 10, 5120, '["todo","multiusuario","api","soporte_prioritario","compartidos"]'),
        ]
        for p in planes:
            conexion.execute(
                "INSERT INTO planes (nombre, descripcion, precio_mensual, max_propiedades, max_unidades, max_propietarios_gestionados, max_usuarios, almacenamiento_mb, features) VALUES (?,?,?,?,?,?,?,?,?)", p
            )
        print("[OK] Planes creados: Gratis, Basico, Profesional, Inmobiliaria")

    # Servicios catalogo
    servicios_count = conexion.execute("SELECT COUNT(*) as c FROM servicios").fetchone()["c"]
    if servicios_count == 0:
        servicios = [
            ("Agua", "Acueducto", "mensual"),
            ("Energia", "Energia electrica", "mensual"),
            ("Gas", "Gas natural", "mensual"),
            ("Internet", "Internet / TV", "mensual"),
            ("Administracion", "Cuota administracion", "mensual"),
            ("Aseo", "Servicio aseo", "mensual"),
        ]
        for s in servicios:
            conexion.execute("INSERT INTO servicios (nombre, descripcion, tipo) VALUES (?,?,?)", s)
        print("[OK] Servicios catalogo creado")

    # Descuento ejemplo
    desc_count = conexion.execute("SELECT COUNT(*) as c FROM descuentos").fetchone()["c"]
    if desc_count == 0:
        # 20% en Profesional como ejemplo del doc
        prof_id = conexion.execute("SELECT id FROM planes WHERE nombre='Profesional'").fetchone()
        if prof_id:
            conexion.execute(
                "INSERT INTO descuentos (codigo, descripcion, tipo, valor, plan_id, activo) VALUES (?,?,?,?,?,?)",
                ("LANZAMIENTO20", "Descuento lanzamiento 20%", "porcentaje", 20, prof_id["id"], 1)
            )
            print("[OK] Descuento ejemplo: LANZAMIENTO20 20% en Profesional")

    # Configuracion base
    conf_count = conexion.execute("SELECT COUNT(*) as c FROM configuracion").fetchone()["c"]
    if conf_count == 0:
        for clave, valor, desc in [
            ("app_nombre", "GDP", "Nombre de la plataforma"),
            ("moneda", "COP", "Moneda base"),
            ("dias_alerta_contrato", "30", "Dias antes de vencimiento para alertar"),
            ("dias_alerta_pago", "3", "Dias antes de vencimiento de pago"),
            ("whatsapp_numero", "573156652423", "Numero de WhatsApp para organizar pagos"),
            ("wompi_link", "https://checkout.wompi.co/l/VPOS_jKycIe", "Link de pago de Wompi"),
            ("tasa_mora_anual", "33.03", "Tasa de interes moratorio anual (%)"),
            ("dia_limite_pago_default", "5", "Dia limite de pago por defecto"),
        ]:
            conexion.execute("INSERT INTO configuracion (clave, valor, descripcion) VALUES (?,?,?)", (clave, valor, desc))
        print("[OK] Configuracion base creada")

    # Documentos legales (Ley 1581 de 2012, estatuto del consumidor, terminos SaaS)
    leg_count = conexion.execute("SELECT COUNT(*) as c FROM documentos_legales").fetchone()["c"]
    if leg_count == 0:
        docs = [
            ("terminos", "Términos y Condiciones", "Al usar GDP aceptas: (1) el servicio es de suscripción mensual; (2) los pagos se renuevan automáticamente cada mes hasta que canceles; (3) eres responsable de la información que registres; (4) podemos suspender el servicio por impago."),
            ("privacidad", "Política de Privacidad", "Recopilamos nombre, email y datos de tu negocio para prestar el servicio. No compartimos tu información con terceros sin tu autorización, salvo obligación legal."),
            ("tratamiento_datos", "Política de Tratamiento de Datos Personales (Ley 1581 de 2012)", "Autorizo el tratamiento de mis datos personales conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013, para la gestión de mi cuenta, facturación y envío de información relevante."),
            ("debito_recurrente", "Autorización de Débito Recurrente", "Autorizo de forma expresa e irrevocable a GDP a debitar mensualmente de mi medio de pago el valor del plan seleccionado, hasta que solicite la cancelación de la suscripción."),
        ]
        for k, t, c in docs:
            conexion.execute("INSERT INTO documentos_legales (clave, titulo, contenido) VALUES (?,?,?)", (k, t, c))
        print("[OK] Documentos legales creados")

    # Politicas de seguridad (ISO 27001 A.9/A.10)
    poli_count = conexion.execute("SELECT COUNT(*) as c FROM politicas").fetchone()["c"]
    if poli_count == 0:
        poemas = [
            ("password_min_len", "8", "Longitud minima de contrasena"),
            ("login_max_intentos", "5", "Intentos fallidos antes de bloquear"),
            ("login_bloqueo_min", "15", "Minutos de bloqueo tras fallos"),
            ("token_ttl_dias", "30", "Vigencia del token de sesion"),
            ("expiracion_sesion", "1", "1 = sesion expira, 0 = no"),
        ]
        for k, v, d in poemas:
            conexion.execute("INSERT INTO politicas (clave, valor, descripcion) VALUES (?,?,?)", (k, v, d))
        print("[OK] Politicas de seguridad creadas")

    # Demo: 1 propietario con 2 casas
    demo_user = conexion.execute("SELECT id FROM usuarios WHERE email=?", ("demo@propietario.com",)).fetchone()
    if not demo_user:
        conexion.execute(
            "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?,?,?,?)",
            ("Propietario Demo", "demo@propietario.com", generate_password_hash("demo123"), "propietario"),
        )
        demo_user_id = conexion.execute("SELECT id FROM usuarios WHERE email=?", ("demo@propietario.com",)).fetchone()["id"]
        conexion.execute("UPDATE usuarios SET rol_id=(SELECT id FROM roles WHERE nombre='propietario') WHERE id=?", (demo_user_id,))
        conexion.execute(
            "INSERT INTO propietarios (usuario_id, tipo, documento, direccion, ciudad) VALUES (?,?,?,?,?)",
            (demo_user_id, "persona", "1000000001", "Calle 10 # 5-20", "Villavicencio"),
        )
        prop_id = conexion.execute("SELECT id FROM propietarios WHERE usuario_id=?", (demo_user_id,)).fetchone()["id"]
        conexion.execute(
            "INSERT INTO propiedades (propietario_id, nombre, tipo, direccion, ciudad, barrio, num_unidades) VALUES (?,?,?,?,?,?,?)",
            (prop_id, "Casa Centro", "casa", "Calle 10 # 5-20", "Villavicencio", "Centro", 1),
        )
        casa_id = conexion.execute("SELECT id FROM propiedades WHERE nombre='Casa Centro' AND propietario_id=?", (prop_id,)).fetchone()["id"]
        conexion.execute(
            "INSERT INTO unidades (propiedad_id, codigo, nombre, tipo, habitaciones, banos, area_m2, canon_base, estado) VALUES (?,?,?,?,?,?,?,?,?)",
            (casa_id, "UNICA", "Casa Principal", "casa", 3, 2, 120, 900000, "disponible"),
        )
        conexion.execute(
            "INSERT INTO propiedades (propietario_id, nombre, tipo, direccion, ciudad, barrio, num_unidades) VALUES (?,?,?,?,?,?,?)",
            (prop_id, "Casa Barzal", "casa", "Carrera 30 # 40-15", "Villavicencio", "Barzal", 1),
        )
        casa2_id = conexion.execute("SELECT id FROM propiedades WHERE nombre='Casa Barzal' AND propietario_id=?", (prop_id,)).fetchone()["id"]
        conexion.execute(
            "INSERT INTO unidades (propiedad_id, codigo, nombre, tipo, habitaciones, banos, area_m2, canon_base, estado) VALUES (?,?,?,?,?,?,?,?,?)",
            (casa2_id, "UNICA", "Casa Principal", "casa", 2, 1, 80, 700000, "disponible"),
        )
        plan_basico = conexion.execute("SELECT id FROM planes WHERE nombre='Basico'").fetchone()["id"]
        conexion.execute(
            "INSERT INTO suscripciones (usuario_id, plan_id, estado) VALUES (?,?,?)",
            (demo_user_id, plan_basico, "activa"),
        )
        print("[OK] Demo creado: demo@propietario.com / demo123 -> 2 casas (2 propiedades, 2 unidades)")

    conexion.commit()


if __name__ == "__main__":
    crear_tablas()
    print(f"Base de datos GDP lista en: {DB_PATH}")
    con = get_db()
    for tabla in ["roles","usuarios","planes","suscripciones","descuentos","propietarios","propiedades","unidades","inquilinos","contratos","pagos","servicios","recibos","distribucion_servicios","alertas","notificaciones","mantenimiento","mantenimientos","documentos","reportes_generados","logs","configuracion","tokens","login_intentos","politicas","recuperaciones","transacciones","dispositivos","documentos_legales","tarjetas"]:
        try:
            count = con.execute(f"SELECT COUNT(*) as c FROM {tabla}").fetchone()["c"]
            print(f"  {tabla}: {count}")
        except Exception as e:
            print(f"  {tabla}: error {e}")
    con.close()
