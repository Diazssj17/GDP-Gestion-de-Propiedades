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
import re
from datetime import datetime, timedelta

from flask import Flask, jsonify, request, g
from werkzeug.security import check_password_hash, generate_password_hash

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

# --- Seguridad (ISO 27001) ---

SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
}

@app.after_request
def add_security_headers(resp):
    for k, v in SECURITY_HEADERS.items():
        resp.headers[k] = v
    # Auditoria (ISO 27001 A.12.4): registrar peticiones de escritura en /api/
    try:
        if request.method in ("POST", "PUT", "PATCH", "DELETE") and request.path.startswith("/api/"):
            user = current_user()
            _log_evento(
                "http_" + request.method.lower(),
                detalles=f"{request.method} {request.path} -> {resp.status_code}",
                usuario_id=user["id"] if user else None,
            )
        elif request.path.startswith("/api/") and resp.status_code >= 400:
            # Registrar errores de acceso (401/403) para monitoreo (A.12.4)
            user = current_user()
            _log_evento(
                "acceso_denegado",
                detalles=f"{request.method} {request.path} -> {resp.status_code}",
                usuario_id=user["id"] if user else None,
            )
    except Exception:
        pass
    return resp

def _log_evento(accion, entidad_tipo="", entidad_id=0, detalles="", usuario_id=None):
    """Log de auditoria (ISO 27001 A.12). Persiste en la tabla logs."""
    if usuario_id is None:
        user = current_user()
        usuario_id = user["id"] if user else None
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "")[:60]
    try:
        g.db.execute(
            "INSERT INTO logs (usuario_id, accion, entidad_tipo, entidad_id, detalles, ip) VALUES (?,?,?,?,?,?)",
            (usuario_id, accion, entidad_tipo, entidad_id, detalles[:2000], ip),
        )
        g.db.commit()
    except Exception:
        pass

def _validar_password(password):
    """Politica de contrasenas (ISO 27001 A.9.4.3). Min 8, letra + numero."""
    if not password or len(password) < 8:
        return "La contrasena debe tener al menos 8 caracteres"
    if not re.search(r"[A-Za-z]", password) or not re.search(r"[0-9]", password):
        return "La contrasena debe incluir letras y numeros"
    return None

def _hash_password(password):
    # scrypt (mas resistente a fuerza bruta que pbkdf2 por defecto)
    return generate_password_hash(password, method="scrypt")

def _ip():
    return request.headers.get("X-Forwarded-For", request.remote_addr or "")[:60]

def _politica(clave, default="0"):
    f = query_one("SELECT valor FROM politicas WHERE clave=?", (clave,))
    return f["valor"] if f else default

def _check_bloqueo(email):
    max_i = int(_politica("login_max_intentos", "5"))
    min_bloq = int(_politica("login_bloqueo_min", "15"))
    reg = query_one("SELECT intentos, bloqueado_hasta FROM login_intentos WHERE email=? AND ip=?", (email, _ip()))
    if reg and reg["intentos"] >= max_i and reg["bloqueado_hasta"]:
        try:
            if datetime.fromisoformat(reg["bloqueado_hasta"]) > datetime.now():
                return True, min_bloq
        except ValueError:
            pass
    return False, min_bloq

def _registrar_intento(email, exito):
    ip = _ip()
    if exito:
        try:
            g.db.execute("DELETE FROM login_intentos WHERE email=? AND ip=?", (email, ip))
        except Exception:
            pass
        return
    max_i = int(_politica("login_max_intentos", "5"))
    min_bloq = int(_politica("login_bloqueo_min", "15"))
    reg = query_one("SELECT id, intentos FROM login_intentos WHERE email=? AND ip=?", (email, ip))
    if reg:
        nuevo = reg["intentos"] + 1
        bloqueo = (datetime.now() + timedelta(minutes=min_bloq)).isoformat() if nuevo >= max_i else None
        g.db.execute("UPDATE login_intentos SET intentos=?, bloqueado_hasta=?, ultimo=? WHERE id=?", (nuevo, bloqueo, datetime.now().isoformat(), reg["id"]))
    else:
        bloqueo = (datetime.now() + timedelta(minutes=min_bloq)).isoformat() if 1 >= max_i else None
        g.db.execute("INSERT INTO login_intentos (email, ip, intentos, bloqueado_hasta, ultimo) VALUES (?,?,?,?,?)", (email, ip, 1, bloqueo, datetime.now().isoformat()))
    g.db.commit()

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

    # Anti fuerza bruta (ISO 27001 A.9.4.2)
    bloqueado, mins = _check_bloqueo(email)
    if bloqueado:
        _log_evento("login_bloqueado", detalles=f"email={email}")
        return jsonify({"error": f"Cuenta bloqueada temporalmente. Intenta en {mins} min"}), 429

    user = query_one("SELECT * FROM usuarios WHERE lower(email) = ?", (email,))
    if not user or not check_password_hash(user["password_hash"], password):
        _registrar_intento(email, False)
        _log_evento("login_fallido", detalles=f"email={email}", usuario_id=user["id"] if user else None)
        return jsonify({"error": "Credenciales invalidas"}), 401
    if not user["activo"]:
        _log_evento("login_usuario_inactivo", detalles=f"email={email}", usuario_id=user["id"])
        return jsonify({"error": "Usuario inactivo"}), 403

    _registrar_intento(email, True)
    token = secrets.token_hex(32)
    # Vigencia del token desde politicas
    ttl = int(_politica("token_ttl_dias", str(TOKEN_TTL_DAYS)))
    expiracion = (datetime.now() + timedelta(days=ttl)).isoformat() if ttl else None
    g.db.execute(
        "INSERT INTO tokens (usuario_id, token, dispositivo, fecha_expiracion) VALUES (?,?,?,?)",
        (user["id"], token, data.get("dispositivo", ""), expiracion),
    )
    g.db.commit()
    _log_evento("login_exitoso", detalles=f"email={email}", usuario_id=user["id"])
    return jsonify({"token": token, "usuario": _public_user(dict(user)), "expira_en_dias": ttl})

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
        if prop:
            plan = query_one("""
                SELECT pl.* FROM suscripciones s JOIN planes pl ON pl.id = s.plan_id
                WHERE s.usuario_id = ? AND s.estado = 'activa'
            """, (user["id"],))
            data["plan"] = row_to_dict(plan) or {}
    elif user["rol"] == "inquilino":
        inq = query_one("SELECT * FROM inquilinos WHERE usuario_id=?", (user["id"],))
        data["perfil"] = row_to_dict(inq) or {}
        # Vinculacion: contrato(s) activo(s) + propiedad + propietario
        if inq:
            ctr = query_one("""
                SELECT c.id as contrato_id, c.fecha_inicio, c.fecha_fin, c.canon, c.estado,
                       u.codigo as unidad_codigo, pr.nombre as propiedad_nombre, pu.nombre as propietario_nombre
                FROM contratos c
                JOIN unidades u ON u.id = c.unidad_id
                JOIN propiedades pr ON pr.id = u.propiedad_id
                JOIN propietarios po ON po.id = pr.propietario_id
                JOIN usuarios pu ON pu.id = po.usuario_id
                WHERE c.inquilino_id = ? AND c.estado = 'activo'
                ORDER BY c.fecha_inicio DESC LIMIT 1
            """, (inq["id"],))
            data["vinculacion"] = row_to_dict(ctr) or {}
    return jsonify(data)

@app.route("/api/logout", methods=["POST"])
def logout():
    token = _parse_token()
    if token:
        g.db.execute("UPDATE tokens SET activo=0 WHERE token=?", (token,))
        g.db.commit()
    _log_evento("logout")
    return jsonify({"ok": True})


# --- Planes publicos (para registro) ---
@app.route("/api/planes/publico")
def planes_publico():
    rows = query_all("SELECT id, nombre, descripcion, precio_mensual, max_propiedades, max_unidades, max_usuarios, almacenamiento_mb FROM planes WHERE activo=1 ORDER BY precio_mensual")
    return jsonify([row_to_dict(r) for r in rows])


# --- Registro publico (elige plan) ---
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    nombre = (data.get("nombre") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    plan_id = data.get("plan_id")
    if not nombre or not email or not password or not plan_id:
        return jsonify({"error": "nombre, email, password y plan_id requeridos"}), 400
    err = _validar_password(password)
    if err:
        return jsonify({"error": err}), 400
    if query_one("SELECT id FROM usuarios WHERE lower(email)=?", (email,)):
        return jsonify({"error": "Ya existe un usuario con ese email"}), 409
    plan = query_one("SELECT id FROM planes WHERE id=? AND activo=1", (plan_id,))
    if not plan:
        return jsonify({"error": "Plan no existe"}), 400

    cur_user = g.db.execute(
        "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?,?,?,?)",
        (nombre, email, _hash_password(password), "propietario"),
    )
    uid = cur_user.lastrowid
    g.db.execute("""
        INSERT INTO propietarios (usuario_id, tipo, documento, direccion, ciudad)
        VALUES (?,?,?,?,?)
    """, (uid, data.get("tipo", "persona"), data.get("documento", ""), data.get("direccion", ""), data.get("ciudad", "")))
    g.db.execute("INSERT INTO suscripciones (usuario_id, plan_id, estado) VALUES (?,?,?)", (uid, plan_id, "activa"))

    # Genera sesion automatica
    token = secrets.token_hex(32)
    ttl = int(_politica("token_ttl_dias", str(TOKEN_TTL_DAYS)))
    expiracion = (datetime.now() + timedelta(days=ttl)).isoformat() if ttl else None
    g.db.execute("INSERT INTO tokens (usuario_id, token, dispositivo, fecha_expiracion) VALUES (?,?,?,?)",
                 (uid, token, data.get("dispositivo", ""), expiracion))
    g.db.commit()
    _log_evento("registro", entidad_tipo="propietario", entidad_id=uid, detalles=f"email={email} plan_id={plan_id}", usuario_id=uid)
    return jsonify({"token": token, "usuario": {"id": uid, "nombre": nombre, "email": email, "rol": "propietario"}}), 201


# --- Recuperacion de contrasena ---
@app.route("/api/recuperar", methods=["POST"])
def recuperar():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "email requerido"}), 400
    user = query_one("SELECT id FROM usuarios WHERE lower(email)=?", (email,))
    # No revelar si existe el email (seguridad)
    if user:
        token = secrets.token_urlsafe(24)
        expiracion = (datetime.now() + timedelta(minutes=30)).isoformat()
        g.db.execute("INSERT INTO recuperaciones (usuario_id, token, fecha_expiracion) VALUES (?,?,?)",
                     (user["id"], token, expiracion))
        g.db.commit()
        _log_evento("recuperar_solicitado", detalles=f"email={email}", usuario_id=user["id"])
        # En produccion se envia por correo (SMTP). En dev se devuelve el token para probar.
        return jsonify({"ok": True, "mensaje": "Si el email existe, recibiras un enlace", "token_dev": token})
    return jsonify({"ok": True, "mensaje": "Si el email existe, recibiras un enlace"})


@app.route("/api/restablecer", methods=["POST"])
def restablecer():
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    password = data.get("password") or ""
    if not token or not password:
        return jsonify({"error": "token y password requeridos"}), 400
    rec = query_one("SELECT * FROM recuperaciones WHERE token=?", (token,))
    if not rec:
        return jsonify({"error": "Token invalido"}), 400
    if rec["usado"]:
        return jsonify({"error": "Token ya usado"}), 400
    try:
        if datetime.fromisoformat(rec["fecha_expiracion"]) < datetime.now():
            return jsonify({"error": "Token expirado"}), 400
    except ValueError:
        return jsonify({"error": "Token invalido"}), 400
    err = _validar_password(password)
    if err:
        return jsonify({"error": err}), 400
    g.db.execute("UPDATE usuarios SET password_hash=? WHERE id=?", (_hash_password(password), rec["usuario_id"]))
    g.db.execute("UPDATE recuperaciones SET usado=1 WHERE id=?", (rec["id"],))
    g.db.commit()
    _log_evento("restablecer_password", entidad_tipo="usuario", entidad_id=rec["usuario_id"], usuario_id=rec["usuario_id"])
    return jsonify({"ok": True, "mensaje": "Contrasena actualizada"})


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

def _plan_del_propietario(propietario_id):
    """Devuelve el plan activo del propietario o None."""
    return query_one("""
        SELECT pl.* FROM propietarios p
        JOIN suscripciones s ON s.usuario_id = p.usuario_id AND s.estado = 'activa'
        JOIN planes pl ON pl.id = s.plan_id
        WHERE p.id = ? LIMIT 1
    """, (propietario_id,))

def _contar_propiedades(propietario_id):
    return query_one("SELECT COUNT(*) as c FROM propiedades WHERE propietario_id=?", (propietario_id,))["c"]

def _contar_unidades(propietario_id):
    return query_one("""
        SELECT COUNT(*) as c FROM unidades u JOIN propiedades pr ON pr.id = u.propiedad_id
        WHERE pr.propietario_id = ?
    """, (propietario_id,))["c"]

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

# --- Planes (solo superadmin) ---
@app.route("/api/admin/resumen")
def admin_resumen():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] != "superadmin":
        return jsonify({"error": "No autorizado (solo superadmin)"}), 403
    detectar_mora()
    def c(sql, params=()):
        return query_one(sql, params)["c"]
    stats = {
        "propietarios": c("SELECT COUNT(*) as c FROM propietarios"),
        "propiedades": c("SELECT COUNT(*) as c FROM propiedades"),
        "unidades": c("SELECT COUNT(*) as c FROM unidades"),
        "unidades_ocupadas": c("SELECT COUNT(*) as c FROM unidades WHERE estado='ocupada'"),
        "contratos_activos": c("SELECT COUNT(*) as c FROM contratos WHERE estado='activo'"),
        "inquilinos": c("SELECT COUNT(*) as c FROM inquilinos"),
        "pagos_mora": c("SELECT COUNT(*) as c FROM pagos WHERE estado='mora'"),
        "pagos_pendientes": c("SELECT COUNT(*) as c FROM pagos WHERE estado='pendiente'"),
        "ingresos_cobrados": query_one("SELECT COALESCE(SUM(pagado),0) as v FROM pagos")["v"],
        "ingresos_por_cobrar": query_one("SELECT COALESCE(SUM(monto - pagado),0) as v FROM pagos WHERE estado!='pagado'")["v"],
        "suscripciones_activas": c("SELECT COUNT(*) as c FROM suscripciones WHERE estado='activa'"),
        "mantenimiento_pendiente": c("SELECT COUNT(*) as c FROM mantenimientos WHERE estado IN ('reportado','pendiente','en_revision','en_proceso')"),
    }
    planes = query_all("""
        SELECT pl.nombre, COUNT(s.id) as suscriptores
        FROM planes pl
        LEFT JOIN suscripciones s ON s.plan_id = pl.id AND s.estado='activa'
        GROUP BY pl.id ORDER BY pl.id
    """)
    stats["planes"] = [row_to_dict(r) for r in planes]
    return jsonify(stats)


@app.route("/api/planes")
def list_planes():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] != "superadmin":
        return jsonify({"error": "No autorizado (solo superadmin)"}), 403
    rows = query_all("SELECT * FROM planes ORDER BY id")
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/planes/<int:plan_id>", methods=["PATCH"])
def actualizar_plan(plan_id):
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] != "superadmin":
        return jsonify({"error": "No autorizado (solo superadmin)"}), 403
    plan = query_one("SELECT * FROM planes WHERE id=?", (plan_id,))
    if not plan:
        return jsonify({"error": "Plan no existe"}), 404
    data = request.get_json(silent=True) or {}
    g.db.execute("""
        UPDATE planes SET nombre=?, descripcion=?, precio_mensual=?, max_propiedades=?, max_unidades=?,
            max_usuarios=?, almacenamiento_mb=? WHERE id=?
    """, (data.get("nombre", plan["nombre"]), data.get("descripcion", plan["descripcion"]),
          data.get("precio_mensual", plan["precio_mensual"]), data.get("max_propiedades", plan["max_propiedades"]),
          data.get("max_unidades", plan["max_unidades"]), data.get("max_usuarios", plan["max_usuarios"]),
          data.get("almacenamiento_mb", plan["almacenamiento_mb"]), plan_id))
    g.db.commit()
    return jsonify({"ok": True})


# --- Propietarios (solo superadmin) ---
@app.route("/api/propietarios")
def list_propietarios():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] != "superadmin":
        return jsonify({"error": "No autorizado (solo superadmin)"}), 403
    rows = query_all("""
        SELECT p.id, u.nombre, u.email, u.activo as usuario_activo, p.tipo, p.ciudad, p.documento,
               pl.nombre as plan_nombre, pl.id as plan_id, s.estado as suscripcion_estado
        FROM propietarios p
        JOIN usuarios u ON u.id = p.usuario_id
        LEFT JOIN suscripciones s ON s.usuario_id = u.id AND s.estado = 'activa'
        LEFT JOIN planes pl ON pl.id = s.plan_id
        ORDER BY p.id
    """)
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/propietarios", methods=["POST"])
def crear_propietario():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] != "superadmin":
        return jsonify({"error": "No autorizado (solo superadmin)"}), 403
    data = request.get_json(silent=True) or {}
    nombre = (data.get("nombre") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not nombre or not email or not password:
        return jsonify({"error": "nombre, email y password requeridos"}), 400
    err = _validar_password(password)
    if err:
        return jsonify({"error": err}), 400
    if query_one("SELECT id FROM usuarios WHERE lower(email)=?", (email,)):
        return jsonify({"error": "Ya existe un usuario con ese email"}), 400
    cur_user = g.db.execute(
        "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?,?,?,?)",
        (nombre, email, _hash_password(password), "propietario"),
    )
    uid = cur_user.lastrowid
    cur = g.db.execute("""
        INSERT INTO propietarios (usuario_id, tipo, documento, direccion, ciudad)
        VALUES (?,?,?,?,?)
    """, (uid, data.get("tipo", "persona"), data.get("documento", ""), data.get("direccion", ""), data.get("ciudad", "")))
    # Asigna plan si viene
    if data.get("plan_id"):
        g.db.execute("INSERT INTO suscripciones (usuario_id, plan_id, estado) VALUES (?,?,?)",
                     (uid, data["plan_id"], "activa"))
    g.db.commit()
    _log_evento("crear_propietario", entidad_tipo="propietario", entidad_id=cur.lastrowid, detalles=f"email={email}", usuario_id=user["id"])
    return jsonify({"ok": True, "id": cur.lastrowid, "usuario_id": uid}), 201


@app.route("/api/propietarios/<int:propietario_id>")
def detalle_propietario(propietario_id):
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] != "superadmin":
        return jsonify({"error": "No autorizado (solo superadmin)"}), 403
    p = query_one("""
        SELECT p.*, u.nombre, u.email, u.activo as usuario_activo,
               pl.nombre as plan_nombre, pl.id as plan_id, pl.max_propiedades, pl.max_unidades, s.estado as suscripcion_estado
        FROM propietarios p
        JOIN usuarios u ON u.id = p.usuario_id
        LEFT JOIN suscripciones s ON s.usuario_id = u.id AND s.estado = 'activa'
        LEFT JOIN planes pl ON pl.id = s.plan_id
        WHERE p.id = ?
    """, (propietario_id,))
    if not p:
        return jsonify({"error": "Propietario no existe"}), 404
    d = row_to_dict(p)
    d["stats"] = {
        "propiedades": query_one("SELECT COUNT(*) as c FROM propiedades WHERE propietario_id=?", (propietario_id,))["c"],
        "unidades": query_one("""
            SELECT COUNT(*) as c FROM unidades u JOIN propiedades pr ON pr.id = u.propiedad_id
            WHERE pr.propietario_id = ?
        """, (propietario_id,))["c"],
        "contratos": query_one("""
            SELECT COUNT(*) as c FROM contratos c JOIN unidades u ON u.id=c.unidad_id
            JOIN propiedades pr ON pr.id=u.propiedad_id WHERE pr.propietario_id = ?
        """, (propietario_id,))["c"],
        "inquilinos": query_one("SELECT COUNT(*) as c FROM inquilinos WHERE propietario_id=?", (propietario_id,))["c"],
    }
    return jsonify(d)


@app.route("/api/propietarios/<int:propietario_id>", methods=["PATCH"])
def gestionar_propietario(propietario_id):
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] != "superadmin":
        return jsonify({"error": "No autorizado (solo superadmin)"}), 403
    p = query_one("SELECT * FROM propietarios WHERE id=?", (propietario_id,))
    if not p:
        return jsonify({"error": "Propietario no existe"}), 404
    data = request.get_json(silent=True) or {}
    accion = data.get("accion")

    if accion == "asignar_plan":
        plan_id = data.get("plan_id")
        if not plan_id:
            return jsonify({"error": "plan_id requerido"}), 400
        # deja inactivas las suscripciones previas y crea una nueva activa
        g.db.execute("UPDATE suscripciones SET estado='cancelada' WHERE usuario_id=? AND estado='activa'", (p["usuario_id"],))
        g.db.execute("INSERT INTO suscripciones (usuario_id, plan_id, estado) VALUES (?,?,?)", (p["usuario_id"], plan_id, "activa"))
        g.db.commit()
        _log_evento("asignar_plan", entidad_tipo="propietario", entidad_id=propietario_id, detalles=f"plan_id={plan_id}", usuario_id=user["id"])
        return jsonify({"ok": True})

    if accion in ("activar", "desactivar"):
        activo = 1 if accion == "activar" else 0
        g.db.execute("UPDATE usuarios SET activo=? WHERE id=?", (activo, p["usuario_id"]))
        g.db.commit()
        _log_evento(accion, entidad_tipo="propietario", entidad_id=propietario_id, detalles=f"usuario_id={p['usuario_id']}", usuario_id=user["id"])
        return jsonify({"ok": True, "activo": activo})

    if accion == "reset_password":
        password = data.get("password") or ""
        err = _validar_password(password)
        if err:
            return jsonify({"error": err}), 400
        g.db.execute("UPDATE usuarios SET password_hash=? WHERE id=?", (_hash_password(password), p["usuario_id"]))
        g.db.commit()
        _log_evento("reset_password", entidad_tipo="propietario", entidad_id=propietario_id, usuario_id=user["id"])
        return jsonify({"ok": True})

    return jsonify({"error": "accion invalida (asignar_plan/activar/desactivar/reset_password)"}), 400


@app.route("/api/propietarios/<int:propietario_id>/datos")
def analisis_propietario(propietario_id):
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] != "superadmin":
        return jsonify({"error": "No autorizado (solo superadmin)"}), 403
    if not query_one("SELECT id FROM propietarios WHERE id=?", (propietario_id,)):
        return jsonify({"error": "Propietario no existe"}), 404
    propiedades = query_all("SELECT * FROM propiedades WHERE propietario_id=? ORDER BY id", (propietario_id,))
    unidades = query_all("""
        SELECT u.*, pr.nombre as propiedad_nombre FROM unidades u
        JOIN propiedades pr ON pr.id = u.propiedad_id
        WHERE pr.propietario_id = ? ORDER BY u.id
    """, (propietario_id,))
    contratos = query_all("""
        SELECT c.*, u.codigo as unidad_codigo, i.nombre as inquilino_nombre
        FROM contratos c JOIN unidades u ON u.id = c.unidad_id JOIN inquilinos i ON i.id = c.inquilino_id
        WHERE u.propiedad_id IN (SELECT id FROM propiedades WHERE propietario_id=?) ORDER BY c.id
    """, (propietario_id,))
    pagos = query_all("""
        SELECT p.*, c.canon, u.codigo as unidad_codigo, i.nombre as inquilino_nombre
        FROM pagos p JOIN contratos c ON c.id = p.contrato_id JOIN unidades u ON u.id = c.unidad_id JOIN inquilinos i ON i.id = c.inquilino_id
        WHERE u.propiedad_id IN (SELECT id FROM propiedades WHERE propietario_id=?) ORDER BY p.fecha_vencimiento DESC
    """, (propietario_id,))
    recibos = query_all("""
        SELECT r.*, s.nombre as servicio_nombre, pr.nombre as propiedad_nombre
        FROM recibos r JOIN servicios s ON s.id = r.servicio_id JOIN propiedades pr ON pr.id = r.propiedad_id
        WHERE pr.propietario_id = ? ORDER BY r.id
    """, (propietario_id,))
    mantenimientos = query_all("""
        SELECT m.*, u.codigo as unidad_codigo
        FROM mantenimientos m JOIN unidades u ON u.id = m.unidad_id
        WHERE u.propiedad_id IN (SELECT id FROM propiedades WHERE propietario_id=?) ORDER BY m.id
    """, (propietario_id,))
    inquilinos = query_all("SELECT * FROM inquilinos WHERE propietario_id=? ORDER BY id", (propietario_id,))
    return jsonify({
        "propiedades": [row_to_dict(r) for r in propiedades],
        "unidades": [row_to_dict(r) for r in unidades],
        "contratos": [row_to_dict(r) for r in contratos],
        "pagos": [row_to_dict(r) for r in pagos],
        "recibos": [row_to_dict(r) for r in recibos],
        "mantenimientos": [row_to_dict(r) for r in mantenimientos],
        "inquilinos": [row_to_dict(r) for r in inquilinos],
    })



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


# --- CRUD Propiedades (limitado por plan) ---
@app.route("/api/propiedades", methods=["POST"])
def crear_propiedad():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] not in ("superadmin", "propietario"):
        return jsonify({"error": "No autorizado"}), 403
    data = request.get_json(silent=True) or {}
    nombre = (data.get("nombre") or "").strip()
    if not nombre:
        return jsonify({"error": "nombre requerido"}), 400
    if user["rol"] == "propietario":
        pid = _id_propietario_del_usuario(user["id"])
        if pid is None:
            return jsonify({"error": "No autorizado"}), 403
        plan = _plan_del_propietario(pid)
        if plan is None or plan["max_propiedades"] is None:
            return jsonify({"error": "No tiene plan activo"}), 403
        if _contar_propiedades(pid) >= int(plan["max_propiedades"]):
            return jsonify({"error": f"Limite del plan: máximo {plan['max_propiedades']} propiedades"}), 403
    else:
        pid = data.get("propietario_id")
        if not pid:
            return jsonify({"error": "propietario_id requerido"}), 400
    cur = g.db.execute("""
        INSERT INTO propiedades (propietario_id, nombre, tipo, direccion, ciudad, barrio, estrato, descripcion, num_unidades, area_total_m2, estado)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
    """, (pid, nombre, data.get("tipo", "casa"), data.get("direccion", ""), data.get("ciudad", ""),
          data.get("barrio", ""), data.get("estrato", 0), data.get("descripcion", ""), data.get("num_unidades", 1),
          data.get("area_total_m2", 0), data.get("estado", "activa")))
    g.db.commit()
    return jsonify({"ok": True, "id": cur.lastrowid}), 201


@app.route("/api/propiedades/<int:propiedad_id>", methods=["PATCH"])
def actualizar_propiedad(propiedad_id):
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] not in ("superadmin", "propietario"):
        return jsonify({"error": "No autorizado"}), 403
    p = query_one("SELECT * FROM propiedades WHERE id=?", (propiedad_id,))
    if not p:
        return jsonify({"error": "Propiedad no existe"}), 404
    if user["rol"] == "propietario":
        pid = _id_propietario_del_usuario(user["id"])
        if pid is None or p["propietario_id"] != pid:
            return jsonify({"error": "No autorizado sobre esa propiedad"}), 403
    data = request.get_json(silent=True) or {}
    g.db.execute("""
        UPDATE propiedades SET nombre=?, tipo=?, direccion=?, ciudad=?, barrio=?, estrato=?, descripcion=?, area_total_m2=?, estado=? WHERE id=?
    """, (data.get("nombre", p["nombre"]), data.get("tipo", p["tipo"]), data.get("direccion", p["direccion"]),
          data.get("ciudad", p["ciudad"]), data.get("barrio", p["barrio"]), data.get("estrato", p["estrato"]),
          data.get("descripcion", p["descripcion"]), data.get("area_total_m2", p["area_total_m2"]),
          data.get("estado", p["estado"]), propiedad_id))
    g.db.commit()
    return jsonify({"ok": True})


@app.route("/api/propiedades/<int:propiedad_id>", methods=["DELETE"])
def eliminar_propiedad(propiedad_id):
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] not in ("superadmin", "propietario"):
        return jsonify({"error": "No autorizado"}), 403
    p = query_one("SELECT * FROM propiedades WHERE id=?", (propiedad_id,))
    if not p:
        return jsonify({"error": "Propiedad no existe"}), 404
    if user["rol"] == "propietario":
        pid = _id_propietario_del_usuario(user["id"])
        if pid is None or p["propietario_id"] != pid:
            return jsonify({"error": "No autorizado sobre esa propiedad"}), 403
    g.db.execute("DELETE FROM propiedades WHERE id=?", (propiedad_id,))
    g.db.commit()
    return jsonify({"ok": True})


# --- CRUD Unidades (limitado por plan) ---
@app.route("/api/unidades", methods=["POST"])
def crear_unidad():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] not in ("superadmin", "propietario"):
        return jsonify({"error": "No autorizado"}), 403
    data = request.get_json(silent=True) or {}
    propiedad_id = data.get("propiedad_id")
    propiedad = query_one("SELECT * FROM propiedades WHERE id=?", (propiedad_id,))
    if not propiedad:
        return jsonify({"error": "Propiedad no existe"}), 404
    if user["rol"] == "propietario":
        pid = _id_propietario_del_usuario(user["id"])
        if pid is None or propiedad["propietario_id"] != pid:
            return jsonify({"error": "No autorizado sobre esa propiedad"}), 403
        plan = _plan_del_propietario(pid)
        if plan is None or plan["max_unidades"] is None:
            return jsonify({"error": "No tiene plan activo"}), 403
        if _contar_unidades(pid) >= int(plan["max_unidades"]):
            return jsonify({"error": f"Limite del plan: máximo {plan['max_unidades']} unidades"}), 403
    codigo = data.get("codigo")
    if not codigo:
        return jsonify({"error": "codigo requerido"}), 400
    cur = g.db.execute("""
        INSERT INTO unidades (propiedad_id, codigo, nombre, tipo, habitaciones, banos, area_m2, canon_base, administracion, estado, descripcion)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
    """, (propiedad_id, codigo, data.get("nombre", ""), data.get("tipo", "apartamento"),
          data.get("habitaciones", 0), data.get("banos", 0), data.get("area_m2", 0), data.get("canon_base", 0),
          data.get("administracion", 0), data.get("estado", "disponible"), data.get("descripcion", "")))
    g.db.commit()
    return jsonify({"ok": True, "id": cur.lastrowid}), 201


@app.route("/api/unidades/<int:unidad_id>", methods=["PATCH"])
def actualizar_unidad(unidad_id):
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] not in ("superadmin", "propietario"):
        return jsonify({"error": "No autorizado"}), 403
    u = query_one("SELECT * FROM unidades WHERE id=?", (unidad_id,))
    if not u:
        return jsonify({"error": "Unidad no existe"}), 404
    if user["rol"] == "propietario":
        pid = _id_propietario_del_usuario(user["id"])
        prop = query_one("SELECT propietario_id FROM propiedades WHERE id=?", (u["propiedad_id"],))
        if pid is None or prop is None or prop["propietario_id"] != pid:
            return jsonify({"error": "No autorizado sobre esa unidad"}), 403
    data = request.get_json(silent=True) or {}
    g.db.execute("""
        UPDATE unidades SET codigo=?, nombre=?, tipo=?, habitaciones=?, banos=?, area_m2=?, canon_base=?, administracion=?, estado=?, descripcion=? WHERE id=?
    """, (data.get("codigo", u["codigo"]), data.get("nombre", u["nombre"]), data.get("tipo", u["tipo"]),
          data.get("habitaciones", u["habitaciones"]), data.get("banos", u["banos"]), data.get("area_m2", u["area_m2"]),
          data.get("canon_base", u["canon_base"]), data.get("administracion", u["administracion"]),
          data.get("estado", u["estado"]), data.get("descripcion", u["descripcion"]), unidad_id))
    g.db.commit()
    return jsonify({"ok": True})


@app.route("/api/unidades/<int:unidad_id>", methods=["DELETE"])
def eliminar_unidad(unidad_id):
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] not in ("superadmin", "propietario"):
        return jsonify({"error": "No autorizado"}), 403
    u = query_one("SELECT * FROM unidades WHERE id=?", (unidad_id,))
    if not u:
        return jsonify({"error": "Unidad no existe"}), 404
    if user["rol"] == "propietario":
        pid = _id_propietario_del_usuario(user["id"])
        prop = query_one("SELECT propietario_id FROM propiedades WHERE id=?", (u["propiedad_id"],))
        if pid is None or prop is None or prop["propietario_id"] != pid:
            return jsonify({"error": "No autorizado sobre esa unidad"}), 403
    g.db.execute("DELETE FROM unidades WHERE id=?", (unidad_id,))
    g.db.commit()
    return jsonify({"ok": True})


@app.route("/api/contratos")
def list_contratos():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    estado = request.args.get("estado")
    sql = """
        SELECT c.*, u.codigo as unidad_codigo, i.nombre as inquilino_nombre,
               u.propiedad_id, pr.nombre as propiedad_nombre, pu.nombre as propietario_nombre
        FROM contratos c
        JOIN unidades u ON u.id = c.unidad_id
        JOIN inquilinos i ON i.id = c.inquilino_id
        JOIN propiedades pr ON pr.id = u.propiedad_id
        JOIN propietarios po ON po.id = pr.propietario_id
        JOIN usuarios pu ON pu.id = po.usuario_id
    """
    where = []
    params = []
    if user["rol"] == "propietario":
        pid = _id_propietario_del_usuario(user["id"])
        if pid is None:
            return jsonify([])
        where.append("u.propiedad_id IN (SELECT id FROM propiedades WHERE propietario_id=?)")
        params.append(pid)
    elif user["rol"] == "inquilino":
        inq = query_one("SELECT id FROM inquilinos WHERE usuario_id=?", (user["id"],))
        if not inq:
            return jsonify([])
        where.append("c.inquilino_id=?")
        params.append(inq["id"])
    if estado:
        where.append("c.estado=?")
        params.append(estado)
    if where:
        sql += " WHERE " + " AND ".join(where)
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
    tickets_pendientes = query_one(f"SELECT COUNT(*) as c FROM mantenimientos WHERE estado IN ('reportado','pendiente','en_revision','en_proceso') {man_scope}", params_man)["c"]

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

    documento = _guardar_foto(data.get("documento_base64"), sub="contratos", prefix="doc")
    cur = g.db.execute("""
        INSERT INTO contratos (unidad_id, inquilino_id, fecha_inicio, fecha_fin, canon, deposito, dia_limite_pago, estado, documento)
        VALUES (?,?,?,?,?,?,?,?,?)
    """, (data["unidad_id"], data["inquilino_id"], data["fecha_inicio"], data["fecha_fin"],
          data["canon"], data.get("deposito", 0), data.get("dia_limite_pago", 5), "activo", documento))
    g.db.execute("UPDATE unidades SET estado='ocupada' WHERE id=?", (unidad["id"],))
    g.db.commit()
    return jsonify({"ok": True, "id": cur.lastrowid, "documento": documento}), 201


# --- Documentos de contrato (varios: cedula, certificado laboral, fiador, etc.) ---
@app.route("/api/contratos/<int:contrato_id>/documentos", methods=["GET"])
def list_documentos_contrato(contrato_id):
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    rows = query_all("SELECT * FROM documentos WHERE entidad_tipo='contrato' AND entidad_id=? ORDER BY id", (contrato_id,))
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/contratos/<int:contrato_id>/documentos", methods=["POST"])
def subir_documento_contrato(contrato_id):
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] not in ("superadmin", "propietario"):
        return jsonify({"error": "No autorizado"}), 403
    contrato = query_one("SELECT id FROM contratos WHERE id=?", (contrato_id,))
    if not contrato:
        return jsonify({"error": "Contrato no existe"}), 404
    data = request.get_json(silent=True) or {}
    nombre = data.get("nombre", "documento")
    tipo = data.get("tipo", "otro")
    filename = _guardar_foto(data.get("base64"), sub="documentos", prefix="doc")
    if not filename:
        return jsonify({"error": "base64 requerido"}), 400
    cur = g.db.execute("""
        INSERT INTO documentos (entidad_tipo, entidad_id, nombre, ruta, tipo, tamanio, subido_por)
        VALUES ('contrato', ?, ?, ?, ?, ?, ?)
    """, (contrato_id, nombre, filename, tipo, data.get("tamanio", 0), user["id"]))
    g.db.commit()
    return jsonify({"ok": True, "id": cur.lastrowid, "ruta": filename}), 201


@app.route("/api/documentos/<int:doc_id>", methods=["DELETE"])
def eliminar_documento(doc_id):
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] not in ("superadmin", "propietario"):
        return jsonify({"error": "No autorizado"}), 403
    doc = query_one("SELECT * FROM documentos WHERE id=?", (doc_id,))
    if not doc:
        return jsonify({"error": "Documento no existe"}), 404
    g.db.execute("DELETE FROM documentos WHERE id=?", (doc_id,))
    g.db.commit()
    return jsonify({"ok": True})


def _sumar_meses(fecha, meses):
    if not fecha:
        return fecha
    try:
        d = datetime.strptime(fecha, "%Y-%m-%d")
    except ValueError:
        return fecha
    mes_total = d.month - 1 + meses
    anio = d.year + mes_total // 12
    mes = mes_total % 12 + 1
    dia = min(d.day, [31, 29 if anio % 4 == 0 and (anio % 100 != 0 or anio % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1])
    return f"{anio:04d}-{mes:02d}-{dia:02d}"


@app.route("/api/contratos/<int:contrato_id>", methods=["PATCH"])
def actualizar_contrato(contrato_id):
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] not in ("superadmin", "propietario"):
        return jsonify({"error": "No autorizado"}), 403
    c = query_one("SELECT * FROM contratos WHERE id=?", (contrato_id,))
    if not c:
        return jsonify({"error": "Contrato no existe"}), 404
    if user["rol"] == "propietario":
        pid = _id_propietario_del_usuario(user["id"])
        unidad = query_one("SELECT * FROM unidades WHERE id=?", (c["unidad_id"],))
        if pid is None or query_one("SELECT id FROM propiedades WHERE id=? AND propietario_id=?", (unidad["propiedad_id"], pid)) is None:
            return jsonify({"error": "No autorizado sobre ese contrato"}), 403
    data = request.get_json(silent=True) or {}
    accion = data.get("accion")

    if accion == "renovar":
        nueva_fecha_fin = data.get("nueva_fecha_fin")
        if not nueva_fecha_fin and data.get("meses"):
            nueva_fecha_fin = _sumar_meses(c["fecha_fin"] or c["fecha_inicio"], int(data["meses"]))
        if not nueva_fecha_fin:
            return jsonify({"error": "nueva_fecha_fin o meses requerido"}), 400
        canon = data.get("canon")
        if canon is not None:
            g.db.execute("UPDATE contratos SET fecha_fin=?, canon=?, estado='activo' WHERE id=?", (nueva_fecha_fin, canon, contrato_id))
        else:
            g.db.execute("UPDATE contratos SET fecha_fin=?, estado='activo' WHERE id=?", (nueva_fecha_fin, contrato_id))
        g.db.execute("UPDATE unidades SET estado='ocupada' WHERE id=?", (c["unidad_id"],))
        g.db.commit()
        return jsonify({"ok": True, "estado": "activo", "fecha_fin": nueva_fecha_fin})

    if accion in ("terminar", "cancelar"):
        estado = "terminado" if accion == "terminar" else "cancelado"
        g.db.execute("UPDATE contratos SET estado=? WHERE id=?", (estado, contrato_id))
        g.db.execute("UPDATE unidades SET estado='disponible' WHERE id=?", (c["unidad_id"],))
        g.db.commit()
        return jsonify({"ok": True, "estado": estado})

    return jsonify({"error": "accion invalida (renovar/terminar/cancelar)"}), 400


# --- Inquilinos ---
@app.route("/api/inquilinos")
def list_inquilinos():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] == "superadmin":
        rows = query_all("""
            SELECT i.*, us.email as usuario_email, us.activo as usuario_activo
            FROM inquilinos i LEFT JOIN usuarios us ON us.id = i.usuario_id
            ORDER BY i.nombre LIMIT 200
        """)
    elif user["rol"] == "propietario":
        pid = _id_propietario_del_usuario(user["id"])
        if pid is None:
            return jsonify([])
        rows = query_all("""
            SELECT i.*, us.email as usuario_email, us.activo as usuario_activo
            FROM inquilinos i
            LEFT JOIN usuarios us ON us.id = i.usuario_id
            WHERE i.propietario_id = ?
               OR i.id IN (
                 SELECT c.inquilino_id FROM contratos c
                 JOIN unidades u ON u.id = c.unidad_id
                 JOIN propiedades pr ON pr.id = u.propiedad_id
                 WHERE pr.propietario_id = ?
               )
            ORDER BY i.nombre
        """, (pid, pid))
    else:
        rows = query_all("""
            SELECT i.*, us.email as usuario_email, us.activo as usuario_activo
            FROM inquilinos i LEFT JOIN usuarios us ON us.id = i.usuario_id
            WHERE i.usuario_id = ?
        """, (user["id"],))
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
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    propietario_id = None
    if user["rol"] == "propietario":
        propietario_id = _id_propietario_del_usuario(user["id"])

    # Crear cuenta de usuario (rol inquilino) si se pide email + password
    usuario_id = None
    creado_usuario = False
    if email and password:
        err = _validar_password(password)
        if err:
            return jsonify({"error": err}), 400
        existente = query_one("SELECT id FROM usuarios WHERE lower(email)=?", (email,))
        if existente:
            return jsonify({"error": "Ya existe un usuario con ese email"}), 400
        cur_user = g.db.execute(
            "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?,?,?,?)",
            (nombre, email, _hash_password(password), "inquilino"),
        )
        usuario_id = cur_user.lastrowid
        creado_usuario = True

    cur = g.db.execute("""
        INSERT INTO inquilinos (nombre, documento, email, telefono, direccion, referencia, usuario_id, propietario_id)
        VALUES (?,?,?,?,?,?,?,?)
    """, (nombre, data.get("documento", ""), email, data.get("telefono", ""),
          data.get("direccion", ""), data.get("referencia", ""), usuario_id, propietario_id))
    g.db.commit()
    _log_evento("crear_inquilino", entidad_tipo="inquilino", entidad_id=cur.lastrowid, detalles=f"email={email}", usuario_id=user["id"])
    return jsonify({"ok": True, "id": cur.lastrowid, "usuario_id": usuario_id, "creado_usuario": creado_usuario}), 201


@app.route("/api/inquilinos/<int:inquilino_id>", methods=["PATCH"])
def gestionar_inquilino(inquilino_id):
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] not in ("superadmin", "propietario"):
        return jsonify({"error": "No autorizado"}), 403
    inq = query_one("SELECT * FROM inquilinos WHERE id=?", (inquilino_id,))
    if not inq:
        return jsonify({"error": "Inquilino no existe"}), 404
    data = request.get_json(silent=True) or {}
    accion = data.get("accion")

    # Actualizar datos basicos
    if accion is None:
        g.db.execute("""
            UPDATE inquilinos SET nombre=?, documento=?, telefono=?, direccion=?, referencia=? WHERE id=?
        """, (data.get("nombre", inq["nombre"]), data.get("documento", inq["documento"]),
              data.get("telefono", inq["telefono"]), data.get("direccion", inq["direccion"]),
              data.get("referencia", inq["referencia"]), inquilino_id))
        g.db.commit()
        return jsonify({"ok": True})

    # Crear cuenta de acceso
    if accion == "crear_cuenta":
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        if not email or not password:
            return jsonify({"error": "email y password requeridos"}), 400
        if inq["usuario_id"]:
            return jsonify({"error": "El inquilino ya tiene cuenta"}), 400
        existente = query_one("SELECT id FROM usuarios WHERE lower(email)=?", (email,))
        if existente:
            return jsonify({"error": "Ya existe un usuario con ese email"}), 400
        err = _validar_password(password)
        if err:
            return jsonify({"error": err}), 400
        cur = g.db.execute(
            "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?,?,?,?)",
            (inq["nombre"], email, _hash_password(password), "inquilino"),
        )
        g.db.execute("UPDATE inquilinos SET usuario_id=?, email=? WHERE id=?", (cur.lastrowid, email, inquilino_id))
        g.db.commit()
        _log_evento("crear_cuenta_inquilino", entidad_tipo="inquilino", entidad_id=inquilino_id, usuario_id=user["id"])
        return jsonify({"ok": True, "usuario_id": cur.lastrowid})

    # Desactivar / activar cuenta
    if accion in ("desactivar", "activar"):
        if not inq["usuario_id"]:
            return jsonify({"error": "El inquilino no tiene cuenta"}), 400
        activo = 1 if accion == "activar" else 0
        g.db.execute("UPDATE usuarios SET activo=? WHERE id=?", (activo, inq["usuario_id"]))
        g.db.commit()
        _log_evento(accion, entidad_tipo="inquilino", entidad_id=inquilino_id, usuario_id=user["id"])
        return jsonify({"ok": True, "activo": activo})

    # Resetear contrasena
    if accion == "reset_password":
        password = data.get("password") or ""
        err = _validar_password(password)
        if err:
            return jsonify({"error": err}), 400
        if not inq["usuario_id"]:
            return jsonify({"error": "El inquilino no tiene cuenta"}), 400
        g.db.execute("UPDATE usuarios SET password_hash=? WHERE id=?", (_hash_password(password), inq["usuario_id"]))
        g.db.commit()
        _log_evento("reset_password", entidad_tipo="inquilino", entidad_id=inquilino_id, usuario_id=user["id"])
        return jsonify({"ok": True})

    return jsonify({"error": "accion invalida (crear_cuenta/desactivar/activar/reset_password)"}), 400


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

    # monto_abono = lo que se abona AHORA; si no viene, se abona el total restante
    restante = float(pago["monto"]) - float(pago["pagado"] or 0)
    monto_abono = data.get("monto_abono")
    if monto_abono is None:
        monto_abono = restante
    monto_abono = float(monto_abono)
    if monto_abono <= 0:
        return jsonify({"error": "El abono debe ser mayor a 0"}), 400

    g.db.execute("""
        INSERT INTO abonos (pago_id, monto, metodo, comprobante, fecha)
        VALUES (?,?,?,?,?)
    """, (pago_id, monto_abono, metodo, comprobante, fecha_pago))

    nuevo_pagado = round((float(pago["pagado"] or 0) + monto_abono), 2)
    if nuevo_pagado >= float(pago["monto"]):
        estado = "pagado"
        nuevo_pagado = float(pago["monto"])
    else:
        estado = "parcial"
    g.db.execute("UPDATE pagos SET pagado=?, fecha_pago=?, metodo=?, comprobante=?, estado=? WHERE id=?",
                 (nuevo_pagado, fecha_pago, metodo, comprobante, estado, pago_id))
    g.db.commit()
    return jsonify({"ok": True, "estado": estado, "pagado": nuevo_pagado, "monto": pago["monto"], "restante": round(float(pago["monto"]) - nuevo_pagado, 2)})


@app.route("/api/pagos/<int:pago_id>")
def detalle_pago(pago_id):
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    pago = query_one("""
        SELECT p.*, c.canon, c.unidad_id, u.codigo as unidad_codigo, u.nombre as unidad_nombre,
               i.nombre as inquilino_nombre, i.documento as inquilino_documento, i.telefono as inquilino_telefono
        FROM pagos p
        JOIN contratos c ON c.id = p.contrato_id
        JOIN unidades u ON u.id = c.unidad_id
        JOIN inquilinos i ON i.id = c.inquilino_id
        WHERE p.id = ?
    """, (pago_id,))
    if not pago:
        return jsonify({"error": "Pago no existe"}), 404
    if user["rol"] == "propietario":
        pid = _id_propietario_del_usuario(user["id"])
        unidad = query_one("SELECT propiedad_id FROM unidades WHERE id=?", (pago["unidad_id"],))
        if pid is None or query_one("SELECT id FROM propiedades WHERE id=? AND propietario_id=?", (unidad["propiedad_id"], pid)) is None:
            return jsonify({"error": "No autorizado"}), 403
    elif user["rol"] == "inquilino":
        inq = query_one("SELECT id FROM inquilinos WHERE usuario_id=?", (user["id"],))
        ctr = query_one("SELECT inquilino_id FROM contratos WHERE id=?", (pago["contrato_id"],))
        if not inq or ctr["inquilino_id"] != inq["id"]:
            return jsonify({"error": "No autorizado"}), 403
    abonos = query_all("SELECT * FROM abonos WHERE pago_id=? ORDER BY fecha DESC, id DESC", (pago_id,))
    d = row_to_dict(pago)
    d["abonos"] = [row_to_dict(a) for a in abonos]
    return jsonify(d)


# --- Mantenimiento (tickets con camara) ---
@app.route("/api/mantenimientos")
def list_mantenimientos():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    estado = request.args.get("estado", "")
    sql = """
        SELECT m.*, u.codigo as unidad_codigo, u.nombre as unidad_nombre, p.nombre as propiedad_nombre, us.nombre as reportado_nombre
        FROM mantenimientos m
        JOIN unidades u ON u.id = m.unidad_id
        LEFT JOIN propiedades p ON p.id = m.propiedad_id
        LEFT JOIN usuarios us ON us.id = m.reportado_por
    """
    where = []
    params = []
    if user["rol"] == "propietario":
        pid = _id_propietario_del_usuario(user["id"])
        if pid is None:
            return jsonify([])
        where.append("m.unidad_id IN (SELECT u.id FROM unidades u JOIN propiedades pr ON pr.id = u.propiedad_id WHERE pr.propietario_id = ?)")
        params.append(pid)
    elif user["rol"] == "inquilino":
        inq = query_one("SELECT id FROM inquilinos WHERE usuario_id=?", (user["id"],))
        if inq:
            where.append("(m.reportado_por = ? OR m.unidad_id IN (SELECT unidad_id FROM contratos WHERE inquilino_id = ? AND estado='activo'))")
            params.append(user["id"])
            params.append(inq["id"])
    if estado:
        where.append("m.estado = ?")
        params.append(estado)
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY m.fecha_reporte DESC LIMIT 100"
    return jsonify([row_to_dict(r) for r in query_all(sql, params)])


@app.route("/api/mantenimientos", methods=["POST"])
def crear_mantenimiento():
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    data = request.get_json(silent=True) or {}
    unidad_id = data.get("unidad_id")
    titulo = data.get("titulo")
    descripcion = data.get("descripcion")
    if not unidad_id or not titulo or not descripcion:
        return jsonify({"error": "unidad_id, titulo y descripcion son requeridos"}), 400
    unidad = query_one("SELECT * FROM unidades WHERE id=?", (unidad_id,))
    if not unidad:
        return jsonify({"error": "Unidad no existe"}), 404

    fotos = []
    foto = _guardar_foto(data.get("foto_base64"), sub="mantenimiento", prefix="mant")
    if foto:
        fotos.append(foto)
    import json as _json
    cur = g.db.execute("""
        INSERT INTO mantenimientos (unidad_id, propiedad_id, reportado_por, tipo, titulo, descripcion, prioridad, estado, responsable, costo_estimado, fotografias)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
    """, (unidad_id, unidad["propiedad_id"], user["id"], data.get("tipo", "correctivo"), titulo, descripcion,
          data.get("prioridad", "media"), "reportado", data.get("responsable", ""), data.get("costo_estimado", 0),
          _json.dumps(fotos)))
    g.db.commit()
    return jsonify({"ok": True, "id": cur.lastrowid}), 201


@app.route("/api/mantenimientos/<int:ticket_id>", methods=["PATCH"])
def actualizar_mantenimiento(ticket_id):
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] not in ("superadmin", "propietario"):
        return jsonify({"error": "No autorizado"}), 403
    t = query_one("SELECT * FROM mantenimientos WHERE id=?", (ticket_id,))
    if not t:
        return jsonify({"error": "Ticket no existe"}), 404
    data = request.get_json(silent=True) or {}
    estado = data.get("estado", t["estado"])
    costo_real = data.get("costo_real", t["costo_real"])
    responsable = data.get("responsable", t["responsable"])
    fecha_resolucion = data.get("fecha_resolucion", t["fecha_resolucion"])
    if estado in ("resuelto", "cancelado") and not fecha_resolucion:
        fecha_resolucion = datetime.now().strftime("%Y-%m-%d")
    g.db.execute("""
        UPDATE mantenimientos SET estado=?, costo_real=?, responsable=?, fecha_resolucion=? WHERE id=?
    """, (estado, costo_real, responsable, fecha_resolucion, ticket_id))
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
    estado = request.args.get("estado")
    # Auto-marca como vencido (mora) los recibos pendientes vencidos
    g.db.execute("UPDATE recibos SET estado='vencido' WHERE estado='pendiente' AND fecha_vencimiento IS NOT NULL AND fecha_vencimiento != '' AND fecha_vencimiento < date('now')")
    g.db.commit()
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
    if estado:
        where.append("r.estado=?")
        params.append(estado)
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


@app.route("/api/recibos/<int:recibo_id>", methods=["PATCH"])
def actualizar_recibo(recibo_id):
    user = require_auth()
    if not user:
        return jsonify({"error": "No autenticado"}), 401
    if user["rol"] not in ("superadmin", "propietario"):
        return jsonify({"error": "No autorizado"}), 403
    recibo = query_one("SELECT * FROM recibos WHERE id=?", (recibo_id,))
    if not recibo:
        return jsonify({"error": "Recibo no existe"}), 404
    data = request.get_json(silent=True) or {}
    estado = data.get("estado")
    if estado not in ("pendiente", "pagado", "vencido", "parcial"):
        return jsonify({"error": "estado invalido (pendiente/pagado/vencido/parcial)"}), 400
    g.db.execute("UPDATE recibos SET estado=? WHERE id=?", (estado, recibo_id))
    g.db.commit()
    return jsonify({"ok": True, "estado": estado})


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


def _guardar_foto(foto_base64, sub="recibos", prefix="recibo"):
    if not foto_base64:
        return ""
    try:
        if "," in foto_base64:
            header, data = foto_base64.split(",", 1)
            ext = (header.split(";")[0].split("/")[-1] or "jpg").replace("jpeg", "jpg")
        else:
            data = foto_base64
            ext = "jpg"
        filename = f"{prefix}_{int(time.time())}.{ext}"
        ruta = os.path.join(UPLOAD_FOLDER, sub, filename)
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
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