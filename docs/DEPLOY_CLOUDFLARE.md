# Publicación Siguiente Jugada desde GitHub y Cloudflare

## Arquitectura
Código en GitHub: asjGITbot/Siguiente_Jugada. Web y API de autenticación **en el mismo origen HTTPS** con Cloudflare Workers Static Assets; D1 guarda cuentas y sesiones. Google Sheets no se publica: el Worker lo lee con credenciales de cuenta de servicio y filtra filas por jugador; P54 se elimina del lado del servidor para usuarios sin permiso. GitHub Pages **no puede ejecutar** este backend y no se utilizará como hosting funcional.

## Activación (requiere acceso a tu cuenta Cloudflare)
1. En Cloudflare, crea una base D1 llamada `siguiente-jugada-accounts`: `npx wrangler d1 create siguiente-jugada-accounts`.
2. Coloca el UUID de D1 en el secreto GitHub Actions `D1_DATABASE_ID`. Configura también `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` con los permisos mínimos.
3. Con el ID de D1 configurado en una **copia local** de `wrangler.jsonc`, ejecuta `npx wrangler d1 migrations apply siguiente-jugada-accounts --remote` desde `api/cloudflare-worker`. Nunca sobreescribas la base local de SSR11.
4. Define **solo en Cloudflare Worker secrets**: `BOOTSTRAP_TOKEN` (cadena aleatoria >=32 caracteres), `PLAYERS_JSON` (array JSON de jugadores permitidos), `GOOGLE_SERVICE_ACCOUNT_JSON` (JSON privado de cuenta de servicio), `ALLOWED_SHEETS_JSON` (JSON con ID → `{"datasetKind":"DEMO" o "REAL", "range":"'Respuestas de formulario 1'!A:BH"}`), y `GOOGLE_SHEETS_URL` (el enlace único que se sustituye entre DEMO y REAL).
5. En Google Cloud habilita Sheets API y comparte las hojas de 60 columnas con el correo de la cuenta de servicio en solo lectura.
6. GitHub → Actions → Deploy Siguiente Jugada to Cloudflare → Run workflow. Obtendrás una URL HTTPS `siguiente-jugada.<tu-subdominio>.workers.dev`. Sin Cloudflare conectado, la app **no** estará en línea.
7. Abre una sola vez `/admin/#setup=TU_BOOTSTRAP_TOKEN`, crea el administrador; desde su panel crea cuentas para jugador y familiares. Cada usuario cambia su contraseña temporal en `/account/`.

## Garantías y pruebas
`python scripts/build-deploy.py` copia solo assets aprobados y falla si faltan imágenes; nunca copia `private/`, `server/`, Excel ni secretos. Las contraseñas usan PBKDF2 con sal; sesiones HttpOnly Secure SameSite Strict y revocables; CSRF rechazado por origen y cabecera; controles P54 y jugador verificados antes de serializar; el cliente consulta Sheets una vez al iniciar sesión y no cachea respuestas privadas.

Antes de conectar dominio real: validar login, cambio de contraseña, permisos entre jugadores, administración, 60 columnas, P54, caché PWA, móvil/escritorio y enlace real. Dominio final se añade en Cloudflare → Workers → Custom Domains después de validar.
