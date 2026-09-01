"""
cobros_diarios.py - Cobro recurrente mensual de planes (para Render Cron Job).

Uso: python cobros_diarios.py

Se ejecuta diariamente (Cron Job de Render) y cobra automaticamente
a las suscripciones cuya fecha_proximo_cobro ya vencio, usando la
tarjeta tokenizada guardada en Wompi.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import g
from app import app, _renovar_cobros
from database import get_db


def main():
    with app.app_context():
        g.db = get_db()
        try:
            _renovar_cobros()
            print("Cobros recurrentes procesados correctamente.")
        except Exception as e:
            print(f"Error al procesar cobros: {e}")
        finally:
            g.db.close()


if __name__ == "__main__":
    main()
