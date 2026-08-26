"""
app.py - GDP Gestión de Propiedades
Flask + jerarquía completa. Sirve como base funcional y ejemplo de uso del modelo escalable.
"""

from flask import Flask, jsonify, request, g
from database import get_db, crear_tablas
import sqlite3

app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

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

# --- Rutas básicas ---

@app.route("/")
def index():
    return jsonify({
        "app": "GDP - Gestión de Propiedades",
        "version": "1.0.0",
        "jerarquia": "Administrador → Propietario → Propiedad → Unidad → Inquilino → Contrato → Pagos → Servicios → Alertas → Mantenimiento → Reportes",
        "endpoints": [
            "/api/health",
            "/api/propietarios",
            "/api/propiedades",
            "/api/unidades",
            "/api/contratos",
            "/api/pagos",
            "/api/alertas",
            "/api/reportes/resumen"
        ],
        "escalabilidad": "Casa = Propiedad con 1 Unidad. Inmobiliaria = Propietario tipo inmobiliaria. Sin refactorización."
    })

@app.route("/api/health")
def health():
    # conteo rápido
    tablas = ["usuarios","propietarios","propiedades","unidades","contratos","pagos"]
    stats = {}
    for t in tablas:
        try:
            stats[t] = query_one(f"SELECT COUNT(*) as c FROM {t}")["c"]
        except sqlite3.OperationalError:
            stats[t] = 0
    return jsonify({"status": "ok", "stats": stats})

# Listados con paginación (escalable a miles)
@app.route("/api/propietarios")
def list_propietarios():
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    offset = (page - 1) * per_page
    rows = query_all("""
        SELECT p.id, u.nombre, u.email, p.tipo, p.ciudad, p.documento
        FROM propietarios p JOIN usuarios u ON u.id = p.usuario_id
        ORDER BY p.id LIMIT ? OFFSET ?
    """, (per_page, offset))
    return jsonify([row_to_dict(r) for r in rows])

@app.route("/api/propiedades")
def list_propiedades():
    propietario_id = request.args.get("propietario_id")
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    offset = (page - 1) * per_page
    if propietario_id:
        rows = query_all("SELECT * FROM propiedades WHERE propietario_id=? ORDER BY id LIMIT ? OFFSET ?", (propietario_id, per_page, offset))
    else:
        rows = query_all("SELECT * FROM propiedades ORDER BY id LIMIT ? OFFSET ?", (per_page, offset))
    return jsonify([row_to_dict(r) for r in rows])

@app.route("/api/unidades")
def list_unidades():
    propiedad_id = request.args.get("propiedad_id")
    estado = request.args.get("estado")
    sql = "SELECT * FROM unidades WHERE 1=1"
    params = []
    if propiedad_id:
        sql += " AND propiedad_id=?"
        params.append(propiedad_id)
    if estado:
        sql += " AND estado=?"
        params.append(estado)
    sql += " ORDER BY id LIMIT 50"
    rows = query_all(sql, params)
    return jsonify([row_to_dict(r) for r in rows])

@app.route("/api/contratos")
def list_contratos():
    rows = query_all("""
        SELECT c.*, u.codigo as unidad_codigo, i.nombre as inquilino_nombre
        FROM contratos c
        JOIN unidades u ON u.id = c.unidad_id
        JOIN inquilinos i ON i.id = c.inquilino_id
        ORDER BY c.fecha_inicio DESC LIMIT 50
    """)
    return jsonify([row_to_dict(r) for r in rows])

@app.route("/api/pagos")
def list_pagos():
    estado = request.args.get("estado", "")
    if estado:
        rows = query_all("SELECT * FROM pagos WHERE estado=? ORDER BY fecha_vencimiento DESC LIMIT 50", (estado,))
    else:
        rows = query_all("SELECT * FROM pagos ORDER BY fecha_vencimiento DESC LIMIT 50")
    return jsonify([row_to_dict(r) for r in rows])

@app.route("/api/alertas")
def list_alertas():
    rows = query_all("SELECT * FROM alertas ORDER BY fecha_creacion DESC LIMIT 20")
    return jsonify([row_to_dict(r) for r in rows])

@app.route("/api/reportes/resumen")
def reporte_resumen():
    # Reporte general (escalable: en producción usar vistas materializadas)
    total_propiedades = query_one("SELECT COUNT(*) as c FROM propiedades")["c"]
    total_unidades = query_one("SELECT COUNT(*) as c FROM unidades")["c"]
    ocupadas = query_one("SELECT COUNT(*) as c FROM unidades WHERE estado='ocupada'")["c"]
    disponibles = query_one("SELECT COUNT(*) as c FROM unidades WHERE estado='disponible'")["c"]
    contratos_activos = query_one("SELECT COUNT(*) as c FROM contratos WHERE estado='activo'")["c"]
    pagos_mora = query_one("SELECT COUNT(*) as c FROM pagos WHERE estado='mora'")["c"]
    pagos_pendientes = query_one("SELECT COUNT(*) as c FROM pagos WHERE estado='pendiente'")["c"]
    tickets_pendientes = query_one("SELECT COUNT(*) as c FROM mantenimiento WHERE estado='pendiente'")["c"]
    ocupacion_pct = round((ocupadas / total_unidades * 100) if total_unidades else 0, 1)

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

# --- Crear contrato de ejemplo (valida regla 1 contrato activo por unidad) ---
@app.route("/api/contratos", methods=["POST"])
def crear_contrato():
    data = request.get_json() or {}
    # validación mínima: unidad disponible
    unidad = query_one("SELECT * FROM unidades WHERE id=?", (data.get("unidad_id"),))
    if not unidad:
        return jsonify({"error": "Unidad no existe"}), 404
    if unidad["estado"] != "disponible":
        return jsonify({"error": f"Unidad no disponible (estado: {unidad['estado']})"}), 400
    # verifica que no haya contrato activo previo
    activo = query_one("SELECT id FROM contratos WHERE unidad_id=? AND estado='activo'", (unidad["id"],))
    if activo:
        return jsonify({"error": "Ya existe contrato activo para esa unidad"}), 400

    g.db.execute("""
        INSERT INTO contratos (unidad_id, inquilino_id, fecha_inicio, fecha_fin, canon, deposito, estado)
        VALUES (?,?,?,?,?,?,?)
    """, (data["unidad_id"], data["inquilino_id"], data["fecha_inicio"], data["fecha_fin"], data["canon"], data.get("deposito",0), "activo"))
    g.db.execute("UPDATE unidades SET estado='ocupada' WHERE id=?", (unidad["id"],))
    g.db.commit()
    return jsonify({"ok": True}), 201


if __name__ == "__main__":
    app.run(debug=True, port=5001)
