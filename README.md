# ⚽ Siguiente Jugada — SSR11 Fútbol Base

PWA de formación y reflexión futbolística: registro de partidos, emociones, misiones, gráficos, evolución y logros de jugadores de base.

## ✅ Versión web — código y pruebas

- **Frontend:** HTML/CSS/JS nativos, responsive, PWA instalable.
- **Login privado:** Cloudflare Workers + D1 (cuentas, contraseñas, sesiones y permisos).
- **Fuente de respuestas:** Google Sheets API (acceso de servicio privado, autorización por jugador).
- **Datos sensibles:** P54 solo para adultos expresamente autorizados.
- **Una lectura de respuestas por inicio de sesión desde la interfaz**; ninguna recarga automática al navegar.
- **Recursos:** logo, personaje y balón SSR11 en `public/assets/sources/`; iconos y tamaños optimizados durante compilación.
- **Privacidad:** ni `private/`, ni SQLite, ni Excel, ni credenciales se suben o despliegan.
- **Estado:** código preparado y validación automatizada; **Cloudflare aún no está conectado**, por lo que **todavía NO existe un enlace público operativo con login**.

## 📂 Estructura

- `index.html`, `js/`, `css/`, `config/`, `public/`, `vendor/` — aplicación web.
- `api/cloudflare-worker/accounts-worker.js` — login, permisos, sesiones y API privada.
- `api/cloudflare-worker/migrations/` — esquema de cuentas para Cloudflare D1.
- `scripts/build-deploy.py` — copia estrictamente los archivos públicos y genera iconos.
- `.github/workflows/validate.yml` — validación automática en cada cambio.
- `.github/workflows/deploy.yml` — **despliegue manual** a Cloudflare; no se ejecuta sin credenciales y aprobación.

## 🚀 Activación real

1. Conectar tu cuenta Cloudflare y crear la base D1 `siguiente-jugada-accounts`.
2. Configurar los secretos de despliegue **en GitHub Actions**, sin pegarlos en código ni en chats: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` y `D1_DATABASE_ID`.
3. Configurar los secretos **en el Worker Cloudflare**: `BOOTSTRAP_TOKEN`, `PLAYERS_JSON`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `ALLOWED_SHEETS_JSON` y `GOOGLE_SHEETS_URL`. Compartir la hoja DEMO/REAL con la cuenta de servicio de Google (lectura).
4. Ejecutar manualmente [Deploy Siguiente Jugada](https://github.com/asjGITbot/Siguiente_Jugada/actions/workflows/deploy.yml). El workflow construirá la PWA, aplicará la migración D1 y desplegará la app con API protegida.
5. Abrir `/admin/#setup=TOKEN_PRIVADO` **solo una vez**, crear administrador y cuentas. Después validar jugador, familiar, P54 y datos reales desde distintos dispositivos antes de configurar dominio.

**No activar GitHub Pages como alojamiento de producción:** Pages no ejecuta el backend con D1. GitHub guarda el código; Cloudflare sirve la web y su API segura en un mismo origen.

Consulta [guía detallada de Cloudflare](docs/DEPLOY_CLOUDFLARE.md).
