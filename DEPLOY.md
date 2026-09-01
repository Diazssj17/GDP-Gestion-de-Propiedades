# Despliegue — GDP Gestión de Propiedades

Guía para desplegar la aplicación en producción (Render).

## 1. Repositorio

Todo el código está en GitHub. Asegúrate de que **no** se suba:
- `gdp.db` (base de datos local) → ya está en `.gitignore`
- `.env` → ya está en `.gitignore`
- `static/uploads/` (archivos subidos) → ya está en `.gitignore`

## 2. Variables de entorno (Render → Environment)

Configura estas variables en cada servicio (web y cron). Copia los nombres de `.env.example`:

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `ADMIN_EMAIL` | sí | Email del superadmin |
| `ADMIN_PASSWORD` | **sí** | Contraseña del superadmin (segura) |
| `SECRET_KEY` | recomendada | Clave de Flask (larga y aleatoria) |
| `SMTP_*` | para recuperar contraseña | Servidor SMTP |
| `BASE_URL` | sí | URL pública de la app |
| `WOMPI_PUBLIC_KEY` / `WOMPI_PRIVATE_KEY` | para pagos | Claves de Wompi |
| `WOMPI_BASE_URL` | sí | `https://production.wompi.co/v1` |
| `WOMPI_WEBHOOK_SECRET` | para webhook | Secreto del evento Wompi |
| `WHATSAPP_NUMERO` | para pagos por WhatsApp | Número con código de país |

> ⚠️ **Nunca** pongas las claves reales en el repositorio ni en `.env` (que está ignorado). Usa la sección **Environment** de Render.

## 3. Despliegue en Render (Blueprint)

1. Ve a https://dashboard.render.com → **New** → **Blueprint**
2. Conecta el repositorio de GitHub
3. Render lee `render.yaml` y crea automáticamente:
   - **gdp-gestion-propiedades** (web service: la API Flask)
   - **cobro-recurrente-diario** (Cron Job: cobro mensual a las 5 AM)

## 4. Configurar el webhook de Wompi

En el panel de Wompi (comercios.wompi.co), en la sección de **eventos/webhook**, apunta a:
```
https://tu-app.onrender.com/api/webhooks/wompi
```
Y pega el secreto en `WOMPI_WEBHOOK_SECRET`.

## 5. Base de datos (importante)

- Render usa **disco efímero** en el plan gratuito: `gdp.db` y `static/uploads/` se **borran en cada despliegue**.
- Para producción real, migra a **PostgreSQL** (Render ofrece instancias). El código usa SQL estándar (`sqlite3`); solo hay que cambiar `get_db()` en `database.py`.

## 6. Primer acceso

- Al desplegar, se crea el superadmin con `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- Entra a la app y crea propietarios/planes desde el panel de administración.

## 7. Verificación post-despliegue

- [ ] `GET /api/health` responde `ok`
- [ ] Login con el superadmin funciona
- [ ] Se envía correo de recuperación (si SMTP configurado)
- [ ] El cron de cobro corre (`python cobros_diarios.py` sin errores)
- [ ] El webhook de Wompi confirma pagos PSE

---

## Comandos de referencia

**Correr localmente:**
```bash
pip install -r requirements.txt
python database.py      # crea gdp.db + seed
python app.py           # http://localhost:5001
```

**Cobro recurrente manual:**
```bash
python cobros_diarios.py
```
