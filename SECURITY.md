# Seguridad — GDP (alineado a ISO/IEC 27001)

Control de seguridad implementado siguiendo buenas prácticas de la norma **ISO/IEC 27001** (Sistemas de Gestión de Seguridad de la Información - SGSI).

> Documento de control interno. Los datos y claves de la app no se exponen en el repositorio; la producción usa HTTPS (Render).

---

## 1. Control de acceso (A.9)

| Control | Implementación |
|---------|----------------|
| A.9.1.2 Acceso a redes y servicios | Rutas `/api/*` protegidas con token Bearer (`require_auth`/`current_user`). Sin token → 401. |
| A.9.2.1 Registro de usuarios | Creación de cuentas vía endpoints con rol asignado (superadmin/propietario/inquilino). |
| A.9.2.5 Revisión de derechos de acceso | El superadmin gestiona/desactiva cuentas de propietarios e inquilinos (`activo`). |
| A.9.4.2 Procedimiento de inicio de sesión | Bloqueo por intentos fallidos (`login_intentos`): 5 fallos → 15 min bloqueo (429). |
| A.9.4.3 Gestión de contraseñas | Política `_validar_password`: mínimo 8 caracteres, letras y números. |
| **Principio de mínimo privilegio** | Filtrado por rol: propietario solo lo suyo; inquilino solo su contrato/pagos; superadmin todo. |

## 2. Criptografía (A.10)

| Control | Implementación |
|---------|----------------|
| A.10.1.1 Política de uso de criptografía | Contraseñas con hash **scrypt** (`werkzeug.security`), nunca en texto plano. |
| A.10.1.2 Gestión de claves | Tokens de sesión aleatorios (`secrets.token_hex(32)`), vigencia y revocación. Transporte TLS/HTTPS en producción (HSTS). |

## 3. Seguridad de redes y sistemas (A.11/A.13)

| Control | Implementación |
|---------|----------------|
| A.13.1.1 Controles de red | Cabeceras de seguridad en todas las respuestas: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-XSS-Protection`, `Strict-Transport-Security`. |
| Datalo | El archivo `gdp.db` está en `.gitignore` (no se sube a GitHub). |

## 4. Registro y monitoreo (A.12)

| Control | Implementación |
|---------|----------------|
| A.12.4.1 Registro de eventos | Tabla `logs`: login exitoso/fallido/bloqueado, logout, creación/modificación de recursos, acceso denegado (401/403). |

## 5. Aspectos de seguridad del desarrollo (A.14)

| Control | Implementación |
|---------|----------------|
| A.14.2.1 Desarrollo seguro | Consultas **parametrizadas** (sin concatenación de SQL → previene inyección SQL). |
| A.14.2.2 Pruebas de seguridad | Validación de entrada en endpoints (nombre/email/código requeridos). |
| A.14.2.5 Principios de ingeniería de sistemas seguros | Mensajes de error genéricos (no se filtra si el email existe en login). |

## 6. Conformidad (A.18)

- No se almacenan datos sensibles en el repositorio; secretos vía variables de entorno (Render env).
- La app maneja datos personales; se debe implementar y publicar una **política de privacidad** y consentimiento de tratamiento de datos (ver `docs/modelo.md` sobre `acepta_tratamiento`).

---

## Mejoras recomendadas (roadmap de seguridad)

- **[Crítico] Generar tokens de acceso con vigencia corta + refresh** (par de tokens).
- **[Alto] 2FA (TOTP) para el superadmin.**
- **[Alto] Rotación de contraseñas expuestas y contraseñas de administrador por defecto (`admin123`)**.
- **[Alto] Migrar a PostgreSQL con cifrado en reposo y copias de seguridad automáticas.**
- **[Medio] Rate limiting IP global y bloqueo por geolocalización.**
- **[Medio] Firma de build (APK/IPA) y canal seguro de distribución.**
- **[Medio] Política de retención de logs y anonimización de datos.**

> **Nota importante:** cambiar la contraseña del superadmin por defecto (`admin@gdp.com / admin123`) antes de producción. En Render, configura `SMTP_*` y `BASE_URL` como variables de entorno.
