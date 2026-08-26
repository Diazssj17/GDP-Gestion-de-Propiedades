"""
app.py - GDP Gestion de Propiedades
Flask + autenticacion por tokens (sesiones) + jerarquia completa escalable.

Auth:
  POST /api/login   -> {token, usuario:{id,nombre,email,rol}}
  GET  /api/me      -> usuario autenticado (Bearer)
  POST /api/logout  -> invalida token
  GET  /api/propietarios  -> solo superadmin
  Datos filtrados por rol: propietario ve solo sus propiedades, inquilino ve su contrato/pagos.
"""

import secrets
import os
import time
import base64
from datetime import datetime, timedelta

from flask import Flask, jsonify, request, g
from werkzeug.security import check_password_hash

from database import get_db, crear_tablas, UPLOAD_FOLDER
import sqlite3

app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

# Duracion del token en dias (0 = no expira, se revoca con logout)
TOKEN_TTL_DAYS = 30

# Inicializa DB al primer arranque
crear_tablas()

@app.before_request
def before_request():
    g.db = get_db()

@app.teardown_request
def teardown_request(exception):
    db = getattr(g, 'db', None)
    if db is not None:
        db.close()

# --- Helpers ---
def query_one(sql, params=()):
    return g.db.execute(sql, params).fetchone()

def query_all(sql, params=()):
    return g.db.execute(sql, params).fetchall()

def row_to_dict(row):
    return dict(row) if row else None

# --- Autenticacion ---

def _parse_token():
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:].strip()
    return None

def current_user():
    """Devuelve el usuario autenticado (dict) o None."""
    token = _parse_token()
    if not token:
        return None
    fila = query_one("""
        SELECT t.token, t.fecha_expiracion, u.*
        FROM tokens t JOIN usuarios u ON u.id = t.usuario_id
        WHERE t.token = ? AND t.activo = 1
    """, (token,))
    if not fila:
        return None
    exp = fila["fecha_expiracion"]
    if exp:
        try:
            if datetime.fromisoformat(exp) < datetime.now():
                return None
        except ValueError:
            pass
    return dict(fila)

def require_auth():
    user = current_user()
    if not user:
        return None
    return user

def _public_user(user):
    return {"id": user["id"], "nombre": user["nombre"], "email": user["email"], "rol": user["rol"]}

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return jsonify({"error": "Email y contrasena requeridos"}), 400

    user = query_one("SELECT * FROM usuarios WHERE lower(email) = ?", (email,))
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Credenciales invalidas"}), 401
    if not user["activo"]:
        return jsonify({"error": "Usuario inactivo"}), 403

    token = secrets.token_hex(32)
    expiracion = (datetime.now() + timedelta(days=TOKEN_TTL_DAYS)).isoformat() if TOKEN_TTL_DAYS else None
    g.db.execute(
        "INSERT INTO tokens (usuario_id, token, dispositivo, fecha_expiracion) VALUES (?,?,?,?)",
        (user["id"], token, data.get("dispositivo", ""), expiracion),
    )
    g.db.commit()
    return jsonify({"token": token, "usuario": _public_user(dict(user))})

@app.route("/api/me")
def me():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    data = {"usuario": _public_user(user)}
    # Datos de perfil segun rol
    if user["rol"] == "propietario":
        prop = query_one("SELECT id, tipo, documento, ciudad FROM propietarios WHERE usuario_id=?", (user["id"],))
        data["perfil"] = row_to_dict(prop) or {}
    elif user["rol"] == "inquilino":
        inq = query_one("SELECT id, nombre, documento FROM inquilinos WHERE usuario_id=?", (user["id"],))
        data["perfil"] = row_to_dict(inq) or {}
    return jsonify(data)

@app.route("/api/logout", methods=["POST"])
def logout():
    token = _parse_token()
    if token:
        g.db.execute("UPDATE tokens SET activo=0 WHERE token=?", (token,))
        g.db.commit()
    return jsonify({"ok": True})

# --- Rutas basicas ---

@app.route("/")
def index():
    return jsonify({
        "app": "GDP - Gestion de Propiedades",
        "version": "1.1.0",
        "jerarquia": "Administrador -> Propietario -> Propiedad -> Unidad -> Inquilino -> Contrato -> Pagos -> Servicios -> Alertas -> Mantenimiento -> Reportes",
        "endpoints": [
            "/api/login", "/api/me", "/api/logout",
            "/api/health", "/api/propietarios", "/api/propiedades",
            "/api/unidades", "/api/contratos", "/api/pagos",
            "/api/alertas", "/api/reportes/resumen"
        ],
        "escalabilidad": "Casa = Propiedad con 1 Unidad. Inmobiliaria = Propietario tipo inmobiliaria."
    })

@app.route("/api/health")
def health():
    tablas = ["usuarios","propietarios","propiedades","unidades","contratos","pagos","tokens"]
    stats = {}
    for t in tablas:
        try:
            stats[t] = query_one(f"SELECT COUNT(*) as c FROM {t}")["c"]
        except sqlite3.OperationalError:
            stats[t] = 0
    return jsonify({"status": "ok", "stats": stats})

# --- Helpers de filtrado por rol ---

def _id_propietario_del_usuario(usuario_id):
    p = query_one("SELECT id FROM propietarios WHERE usuario_id=?", (usuario_id,))
    return p["id"] if p else None

def _id_unidades_del_propietario(propietario_id):
    rows = query_all("""
        SELECT u.id FROM unidades u
        JOIN propiedades pr ON pr.id = u.propiedad_id
        WHERE pr.propietario_id = ?
    """, (propietario_id,))
    return [r["id"] for r in rows]

def detectar_mora():
    """Marca como 'mora' los pagos pendientes cuya fecha de vencimiento ya paso."""
    g.db.execute(
        "UPDATE pagos SET estado='mora' WHERE estado='pendiente' AND fecha_vencimiento != '' AND fecha_vencimiento < date('now')"
    )
    g.db.commit()

# --- Propietarios (solo superadmin) ---
@app.route("/api/propietarios")
def list_propietarios():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] != "superadmin":
        return jsonify({"error": "No autorizado (solo superadmin)"}), 403
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    offset = (page - 1) * per_page
    rows = query_all("""
        SELECT p.id, u.nombre, u.email, p.tipo, p.ciudad, p.documento
        FROM propietarios p JOIN usuarios u ON u.id = p.usuario_id
        ORDER BY p.id LIMIT ? OFFSET ?
    """, (per_page, offset))
    return jsonify([row_to_dict(r) for r in rows])

# --- Propiedades (superadmin: todas | propietario: solo las suyas) ---
@app.route("/api/propiedades")
def list_propiedades():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    propietario_id = request.args.get("propietario_id")
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    offset = (page - 1) * per_page

    if user["rol"] == "propietario":
        pid = _id_propietario_del_usuario(user["id"])
        if pid is None:
            return jsonify([])
        # Un propietario solo ve lo suyo, ignore propietario_id del query
        rows = query_all("SELECT * FROM propiedades WHERE propietario_id=? ORDER BY id LIMIT ? OFFSET ?", (pid, per_page, offset))
    elif user["rol"] == "superadmin":
        if propietario_id:
            rows = query_all("SELECT * FROM propiedades WHERE propietario_id=? ORDER BY id LIMIT ? OFFSET ?", (propietario_id, per_page, offset))
        else:
            rows = query_all("SELECT * FROM propiedades ORDER BY id LIMIT ? OFFSET ?", (per_page, offset))
    else:
        return jsonify({"error": "No autorizado"}), 403
    return jsonify([row_to_dict(r) for r in rows])

@app.route("/api/unidades")
def list_unidades():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    propiedad_id = request.args.get("propiedad_id")
    estado = request.args.get("estado")
    sql = "SELECT * FROM unidades WHERE 1=1"
    params = []

    if user["rol"] == "propietario":
        pid = _id_propietario_del_usuario(user["id"])
        if pid is None:
            return jsonify([])
        sql += " AND propiedad_id IN (SELECT id FROM propiedades WHERE propietario_id=?)"
        params.append(pid)
    elif user["rol"] == "inquilino":
        # inquilino ve la unidad de su contrato activo
        inq = query_one("SELECT id FROM inquilinos WHERE usuario_id=?", (user["id"],))
        if not inq:
            return jsonify([])
        sql += " AND id IN (SELECT unidad_id FROM contratos WHERE inquilino_id=? AND estado='activo')"
        params.append(inq["id"])
    # superadmin sin filtro adicional

    if propiedad_id:
        sql += " AND propiedad_id=?"
        params.append(propiedad_id)
    if estado:
        sql += " AND estado=?"
        params.append(estado)
    sql += " ORDER BY id LIMIT 50"
    return jsonify([row_to_dict(r) for r in query_all(sql, params)])

@app.route("/api/contratos")
def list_contratos():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    sql = """
        SELECT c.*, u.codigo as unidad_codigo, i.nombre as inquilino_nombre
        FROM contratos c
        JOIN unidades u ON u.id = c.unidad_id
        JOIN inquilinos i ON i.id = c.inquilino_id
    """
    params = []
    if user["rol"] == "propietario":
        pid = _id_propietario_del_usuario(user["id"])
        if pid is None:
            return jsonify([])
        sql += " WHERE u.propiedad_id IN (SELECT id FROM propiedades WHERE propietario_id=?)"
        params.append(pid)
    elif user["rol"] == "inquilino":
        inq = query_one("SELECT id FROM inquilinos WHERE usuario_id=?", (user["id"],))
        if not inq:
            return jsonify([])
        sql += " WHERE c.inquilino_id=?"
        params.append(inq["id"])
    sql += " ORDER BY c.fecha_inicio DESC LIMIT 50"
    return jsonify([row_to_dict(r) for r in query_all(sql, params)])

@app.route("/api/pagos")
def list_pagos():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    detectar_mora()
    estado = request.args.get("estado", "")
    sql = "SELECT p.*, c.canon, c.unidad_id, u.codigo as unidad_codigo, i.nombre as inquilino_nombre FROM pagos p JOIN contratos c ON c.id = p.contrato_id JOIN unidades u ON u.id = c.unidad_id JOIN inquilinos i ON i.id = c.inquilino_id"
    params = []
    if user["rol"] == "propietario":
        pid = _id_propietario_del_usuario(user["id"])
        if pid is None:
            return jsonify([])
        sql += " WHERE c.unidad_id IN (SELECT u.id FROM unidades u JOIN propiedades pr ON pr.id=u.propiedad_id WHERE pr.propietario_id=?)"
        params.append(pid)
        if estado:
            sql += " AND p.estado=?"
            params.append(estado)
    elif user["rol"] == "inquilino":
        inq = query_one("SELECT id FROM inquilinos WHERE usuario_id=?", (user["id"],))
        if not inq:
            return jsonify([])
        sql += " WHERE c.inquilino_id=?"
        params.append(inq["id"])
        if estado:
            sql += " AND p.estado=?"
            params.append(estado)
    else:
        if estado:
            sql += " WHERE p.estado=?"
            params.append(estado)
    sql += " ORDER BY p.fecha_vencimiento DESC LIMIT 50"
    return jsonify([row_to_dict(r) for r in query_all(sql, params)])

@app.route("/api/alertas")
def list_alertas():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    rows = query_all("SELECT * FROM alertas WHERE usuario_destino_id=? ORDER BY fecha_creacion DESC LIMIT 20", (user["id"],))
    return jsonify([row_to_dict(r) for r in rows])

@app.route("/api/reportes/resumen")
def reporte_resumen():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    detectar_mora()
    vacio = {"total_propiedades": 0, "total_unidades": 0, "ocupadas": 0, "disponibles": 0, "ocupacion_pct": 0, "contratos_activos": 0, "pagos_mora": 0, "pagos_pendientes": 0, "mantenimiento_pendiente": 0}

    # Scopes por tabla, segun rol
    prop_scope = ""        # para propiedades (col propietario_id)
    unidad_scope = ""      # para unidades (col propiedad_id)
    man_scope = ""         # para mantenimiento (col unidad_id)
    params_prop, params_unidad, params_man = [], [], []

    if user["rol"] == "propietario":
        pid = _id_propietario_del_usuario(user["id"])
        if pid is None:
            return jsonify(vacio)
        prop_scope = "AND propietario_id = ?"
        params_prop = [pid]
        unidad_scope = "AND propiedad_id IN (SELECT id FROM propiedades WHERE propietario_id = ?)"
        params_unidad = [pid]
        man_scope = "AND unidad_id IN (SELECT u.id FROM unidades u JOIN propiedades pr ON pr.id = u.propiedad_id WHERE pr.propietario_id = ?)"
        params_man = [pid]
    elif user["rol"] == "inquilino":
        inq = query_one("SELECT id FROM inquilinos WHERE usuario_id=?", (user["id"],))
        if not inq:
            return jsonify(vacio)
        unidad_scope = "AND id IN (SELECT unidad_id FROM contratos WHERE inquilino_id = ? AND estado='activo')"
        params_unidad = [inq["id"]]
        man_scope = "AND unidad_id IN (SELECT unidad_id FROM contratos WHERE inquilino_id = ? AND estado='activo')"
        params_man = [inq["id"]]
        prop_scope = "AND id IN (SELECT propiedad_id FROM unidades WHERE id IN (SELECT unidad_id FROM contratos WHERE inquilino_id = ? AND estado='activo'))"
        params_prop = [inq["id"]]
    # superadmin: sin filtros

    total_propiedades = query_one(f"SELECT COUNT(*) as c FROM propiedades WHERE 1=1 {prop_scope}", params_prop)["c"]
    total_unidades = query_one(f"SELECT COUNT(*) as c FROM unidades WHERE 1=1 {unidad_scope}", params_unidad)["c"]
    ocupadas = query_one(f"SELECT COUNT(*) as c FROM unidades WHERE estado='ocupada' {unidad_scope}", params_unidad)["c"]
    disponibles = query_one(f"SELECT COUNT(*) as c FROM unidades WHERE estado='disponible' {unidad_scope}", params_unidad)["c"]
    ocupacion_pct = round((ocupadas / total_unidades * 100) if total_unidades else 0, 1)

    # Clauses sobre joins con alias 'u' (columna unidad: u.id / u.propiedad_id)
    if user["rol"] == "propietario":
        u_clause = "AND u.propiedad_id IN (SELECT id FROM propiedades WHERE propietario_id = ?)"
        u_params = [pid]
    elif user["rol"] == "inquilino":
        u_clause = "AND c.inquilino_id = ?"
        u_params = [inq["id"]]
    else:
        u_clause = ""
        u_params = []

    contratos_activos = query_one(f"""
        SELECT COUNT(*) as c FROM contratos c JOIN unidades u ON u.id=c.unidad_id
        WHERE c.estado='activo' {u_clause}
    """, u_params)["c"]
    pagos_mora = query_one(f"""
        SELECT COUNT(*) as c FROM pagos p JOIN contratos c ON c.id=p.contrato_id JOIN unidades u ON u.id=c.unidad_id
        WHERE p.estado='mora' {u_clause}
    """, u_params)["c"]
    pagos_pendientes = query_one(f"""
        SELECT COUNT(*) as c FROM pagos p JOIN contratos c ON c.id=p.contrato_id JOIN unidades u ON u.id=c.unidad_id
        WHERE p.estado='pendiente' {u_clause}
    """, u_params)["c"]
    tickets_pendientes = query_one(f"SELECT COUNT(*) as c FROM mantenimiento WHERE estado='pendiente' {man_scope}", params_man)["c"]

    return jsonify({
        "total_propiedades": total_propiedades,
        "total_unidades": total_unidades,
        "ocupadas": ocupadas,
        "disponibles": disponibles,
        "ocupacion_pct": ocupacion_pct,
        "contratos_activos": contratos_activos,
        "pagos_mora": pagos_mora,
        "pagos_pendientes": pagos_pendientes,
        "mantenimiento_pendiente": tickets_pendientes
    })

# --- Crear contrato (valida regla 1 contrato activo por unidad) ---
@app.route("/api/contratos", methods=["POST"])
def crear_contrato():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] not in ("superadmin", "propietario"):
        return jsonify({"error": "No autorizado"}), 403
    data = request.get_json() or {}
    unidad = query_one("SELECT * FROM unidades WHERE id=?", (data.get("unidad_id"),))
    if not unidad:
        return jsonify({"error": "Unidad no existe"}), 404
    if unidad["estado"] != "disponible":
        return jsonify({"error": f"Unidad no disponible (estado: {unidad['estado']})"}), 400
    activo = query_one("SELECT id FROM contratos WHERE unidad_id=? AND estado='activo'", (unidad["id"],))
    if activo:
        return jsonify({"error": "Ya existe contrato activo para esa unidad"}), 400
    inquilino = query_one("SELECT id FROM inquilinos WHERE id=?", (data.get("inquilino_id"),))
    if not inquilino:
        return jsonify({"error": "Inquilino no existe"}), 404
    if not data.get("fecha_inicio") or not data.get("fecha_fin") or not data.get("canon"):
        return jsonify({"error": "fecha_inicio, fecha_fin y canon son requeridos"}), 400

    g.db.execute("""
        INSERT INTO contratos (unidad_id, inquilino_id, fecha_inicio, fecha_fin, canon, deposito, dia_limite_pago, estado)
        VALUES (?,?,?,?,?,?,?,?)
    """, (data["unidad_id"], data["inquilino_id"], data["fecha_inicio"], data["fecha_fin"],
          data["canon"], data.get("deposito", 0), data.get("dia_limite_pago", 5), "activo"))
    g.db.execute("UPDATE unidades SET estado='ocupada' WHERE id=?", (unidad["id"],))
    g.db.commit()
    return jsonify({"ok": True}), 201


# --- Inquilinos ---
@app.route("/api/inquilinos")
def list_inquilinos():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] == "superadmin":
        rows = query_all("SELECT * FROM inquilinos ORDER BY nombre LIMIT 100")
    elif user["rol"] == "propietario":
        pid = _id_propietario_del_usuario(user["id"])
        if pid is None:
            return jsonify([])
        rows = query_all("""
            SELECT DISTINCT i.* FROM inquilinos i
            JOIN contratos c ON c.inquilino_id = i.id
            JOIN unidades u ON u.id = c.unidad_id
            JOIN propiedades pr ON pr.id = u.propiedad_id
            WHERE pr.propietario_id = ?
            ORDER BY i.nombre
        """, (pid,))
    else:
        rows = query_all("SELECT * FROM inquilinos WHERE usuario_id=?", (user["id"],))
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/inquilinos", methods=["POST"])
def crear_inquilino():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] not in ("superadmin", "propietario"):
        return jsonify({"error": "No autorizado"}), 403
    data = request.get_json(silent=True) or {}
    nombre = (data.get("nombre") or "").strip()
    if not nombre:
        return jsonify({"error": "nombre requerido"}), 400
    cur = g.db.execute("""
        INSERT INTO inquilinos (nombre, documento, email, telefono, direccion, referencia)
        VALUES (?,?,?,?,?,?)
    """, (nombre, data.get("documento", ""), data.get("email", ""), data.get("telefono", ""),
          data.get("direccion", ""), data.get("referencia", "")))
    g.db.commit()
    return jsonify({"ok": True, "id": cur.lastrowid}), 201


# --- Pagos (crear + registrar con mora) ---
@app.route("/api/pagos", methods=["POST"])
def crear_pago():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] not in ("superadmin", "propietario"):
        return jsonify({"error": "No autorizado"}), 403
    data = request.get_json(silent=True) or {}
    contrato = query_one("SELECT * FROM contratos WHERE id=?", (data.get("contrato_id"),))
    if not contrato:
        return jsonify({"error": "Contrato no existe"}), 404
    if user["rol"] == "propietario":
        pid = _id_propietario_del_usuario(user["id"])
        unidad = query_one("SELECT * FROM unidades WHERE id=?", (contrato["unidad_id"],))
        if pid is None or query_one("SELECT id FROM propiedades WHERE id=? AND propietario_id=?", (unidad["propiedad_id"], pid)) is None:
            return jsonify({"error": "No autorizado sobre ese contrato"}), 403
    monto = data.get("monto")
    if monto is None:
        return jsonify({"error": "monto requerido"}), 400
    fecha_vencimiento = data.get("fecha_vencimiento") or ""
    estado = "pendiente"
    if fecha_vencimiento and fecha_vencimiento < datetime.now().strftime("%Y-%m-%d"):
        estado = "mora"
    cur = g.db.execute("""
        INSERT INTO pagos (contrato_id, concepto, periodo, monto, fecha_vencimiento, estado, notas)
        VALUES (?,?,?,?,?,?,?)
    """, (contrato["id"], data.get("concepto", "canon"), data.get("periodo", ""), monto,
          fecha_vencimiento, estado, data.get("notas", "")))
    g.db.commit()
    return jsonify({"ok": True, "id": cur.lastrowid, "estado": estado}), 201


@app.route("/api/pagos/<int:pago_id>", methods=["PATCH"])
def registrar_pago(pago_id):
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] not in ("superadmin", "propietario"):
        return jsonify({"error": "No autorizado"}), 403
    pago = query_one("SELECT * FROM pagos WHERE id=?", (pago_id,))
    if not pago:
        return jsonify({"error": "Pago no existe"}), 404
    data = request.get_json(silent=True) or {}
    fecha_pago = data.get("fecha_pago") or datetime.now().strftime("%Y-%m-%d")
    metodo = data.get("metodo", "")
    comprobante = data.get("comprobante", "")
    monto_pagado = data.get("monto_pagado")

    if monto_pagado is not None and float(monto_pagado) < float(pago["monto"]):
        estado = "parcial"
    else:
        estado = "pagado"
    g.db.execute("UPDATE pagos SET fecha_pago=?, metodo=?, comprobante=?, estado=? WHERE id=?",
                 (fecha_pago, metodo, comprobante, estado, pago_id))
    g.db.commit()
    return jsonify({"ok": True, "estado": estado})


# --- Servicios y Recibos (servicios compartidos, modelo v2 11-12) ---

@app.route("/api/servicios")
def list_servicios():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    rows = query_all("SELECT * FROM servicios WHERE activo=1 ORDER BY id")
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/recibos")
def list_recibos():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    propiedad_id = request.args.get("propiedad_id")
    periodo = request.args.get("periodo")
    sql = """
        SELECT r.*, s.nombre as servicio_nombre, p.nombre as propiedad_nombre
        FROM recibos r
        JOIN servicios s ON s.id = r.servicio_id
        JOIN propiedades p ON p.id = r.propiedad_id
    """
    where = []
    params = []
    if user["rol"] == "propietario":
        pid = _id_propietario_del_usuario(user["id"])
        if pid is None:
            return jsonify([])
        where.append("r.propiedad_id IN (SELECT id FROM propiedades WHERE propietario_id=?)")
        params.append(pid)
    elif user["rol"] == "inquilino":
        inq = query_one("SELECT id FROM inquilinos WHERE usuario_id=?", (user["id"],))
        if not inq:
            return jsonify([])
        where.append("r.id IN (SELECT recibo_id FROM distribucion_servicios WHERE unidad_id IN (SELECT unidad_id FROM contratos WHERE inquilino_id=? AND estado='activo'))")
        params.append(inq["id"])
    if propiedad_id:
        where.append("r.propiedad_id=?")
        params.append(propiedad_id)
    if periodo:
        where.append("r.periodo=?")
        params.append(periodo)
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY r.fecha_creacion DESC LIMIT 100"

    result = []
    for r in query_all(sql, params):
        d = row_to_dict(r)
        dist = query_all("""
            SELECT d.id, d.unidad_id, d.metodo, d.porcentaje, d.monto, d.consumo, d.notas, u.codigo, u.nombre
            FROM distribucion_servicios d JOIN unidades u ON u.id = d.unidad_id
            WHERE d.recibo_id=?
        """, (r["id"],))
        d["distribucion"] = [row_to_dict(x) for x in dist]
        result.append(d)
    return jsonify(result)


def _calcular_distribucion(valor, metodo, distribucion, unidades_ids):
    """Devuelve {unidad_id: {monto, porcentaje, consumo}} segun el metodo."""
    n = len(unidades_ids)
    items = {d.get("unidad_id"): d for d in distribucion}
    result = {}
    if metodo == "partes_iguales":
        base = round(valor / n, 2)
        diff = round(valor - base * n, 2)
        for i, uid in enumerate(unidades_ids):
            monto = round(base + diff, 2) if i == n - 1 else base
            result[uid] = {"monto": monto, "porcentaje": round(100 / n, 4), "consumo": 0}
    elif metodo == "porcentaje":
        for uid in unidades_ids:
            pct = items.get(uid, {}).get("porcentaje", 0) or 0
            result[uid] = {"monto": round(valor * pct / 100, 2), "porcentaje": pct, "consumo": 0}
    elif metodo == "consumo":
        total_consumo = sum(items.get(uid, {}).get("consumo", 0) or 0 for uid in unidades_ids)
        total_consumo = total_consumo or 1
        for uid in unidades_ids:
            cons = items.get(uid, {}).get("consumo", 0) or 0
            result[uid] = {"monto": round(valor * cons / total_consumo, 2), "porcentaje": 0, "consumo": cons}
    else:  # valor_fijo o manual
        for uid in unidades_ids:
            monto = items.get(uid, {}).get("monto", 0) or 0
            result[uid] = {"monto": monto, "porcentaje": 0, "consumo": 0}
    return result


def _guardar_foto(foto_base64):
    if not foto_base64:
        return ""
    try:
        if "," in foto_base64:
            header, data = foto_base64.split(",", 1)
            ext = (header.split(";")[0].split("/")[-1] or "jpg").replace("jpeg", "jpg")
        else:
            data = foto_base64
            ext = "jpg"
        filename = f"recibo_{int(time.time())}.{ext}"
        ruta = os.path.join(UPLOAD_FOLDER, "recibos", filename)
        with open(ruta, "wb") as f:
            f.write(base64.b64decode(data))
        return filename
    except Exception:
        return ""


@app.route("/api/recibos", methods=["POST"])
def crear_recibo():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] not in ("superadmin", "propietario"):
        return jsonify({"error": "No autorizado"}), 403

    data = request.get_json(silent=True) or {}
    servicio_id = data.get("servicio_id")
    propiedad_id = data.get("propiedad_id")
    valor = data.get("valor")
    if not servicio_id or not propiedad_id or valor is None:
        return jsonify({"error": "servicio_id, propiedad_id y valor son requeridos"}), 400

    prop = query_one("SELECT * FROM propiedades WHERE id=?", (propiedad_id,))
    if not prop:
        return jsonify({"error": "Propiedad no existe"}), 404
    if user["rol"] == "propietario":
        pid = _id_propietario_del_usuario(user["id"])
        if pid is None or prop["propietario_id"] != pid:
            return jsonify({"error": "No autorizado sobre esa propiedad"}), 403

    unidades = query_all("SELECT * FROM unidades WHERE propiedad_id=? ORDER BY id", (propiedad_id,))
    if not unidades:
        return jsonify({"error": "La propiedad no tiene unidades"}), 400

    distribucion = data.get("distribucion") or []
    unidades_ids = [d.get("unidad_id") for d in distribucion]
    if not unidades_ids:
        unidades_ids = [u["id"] for u in unidades]
    valid_ids = {u["id"] for u in unidades}
    for uid in unidades_ids:
        if uid not in valid_ids:
            return jsonify({"error": f"Unidad {uid} no pertenece a la propiedad"}), 400

    metodo = data.get("metodo", "partes_iguales")
    if metodo not in ("partes_iguales", "porcentaje", "consumo", "valor_fijo", "manual"):
        metodo = "partes_iguales"
    montos = _calcular_distribucion(valor, metodo, distribucion, unidades_ids)

    recibo_adjunto = _guardar_foto(data.get("foto_base64"))

    cur = g.db.execute("""
        INSERT INTO recibos (servicio_id, propiedad_id, periodo, valor, fecha_vencimiento, empresa_prestadora, numero_cuenta, estado, recibo_adjunto, notas)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    """, (servicio_id, propiedad_id, data.get("periodo") or datetime.now().strftime("%Y-%m"), valor,
          data.get("fecha_vencimiento"), data.get("empresa_prestadora", ""), data.get("numero_cuenta", ""),
          data.get("estado", "pendiente"), recibo_adjunto, data.get("notas", "")))
    recibo_id = cur.lastrowid

    for uid in unidades_ids:
        m = montos[uid]
        g.db.execute("""
            INSERT INTO distribucion_servicios (recibo_id, unidad_id, metodo, porcentaje, monto, consumo)
            VALUES (?,?,?,?,?,?)
        """, (recibo_id, uid, metodo, m["porcentaje"], m["monto"], m["consumo"]))
    g.db.commit()
    return jsonify({"ok": True, "recibo_id": recibo_id}), 201


if __name__ == "__main__":
    app.run(debug=True, port=5001, host="0.0.0.0")