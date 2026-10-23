# Seguridad actual — cuentas locales

23-10-2026: AUTH_LOCAL_VERIFIED. El acceso principal ya no usa un selector de roles simulado: usa usuarios persistentes y contraseñas, con 18 pruebas de cuentas aprobadas. El contenido futbolero sigue siendo simulado. Internet y Google Sheets real no están activados.

- SQLite privado, consultas parametrizadas, contraseñas scrypt:32768:8:1 y sal individual.
- Sesiones aleatorias de 256 bits; solo su SHA-256 se guarda en la base. Cookie HttpOnly y SameSite=Strict; caducidad absoluta de una hora. HTTP se limita a loopback; no afirmar HTTPS ni Secure para este modo local.
- Alta inicial mediante token de un uso, de 30 minutos, emitido por un script local. Hash en SQLite y token en fragmento URL, retirado con replaceState; nunca en peticiones GET o logs. Bloqueo de alta inicial una vez existe cualquier cuenta y transacción serializada frente a carreras.
- Contraseña temporal obligatoriamente reemplazada antes de acceder a datos o administración. Cambio de contraseña rota la sesión; reset/desactivación/cambio de permisos revoca sesiones. El último administrador activo y la desactivación propia se protegen.
- Roles siempre derivados del servidor. Administrar cuentas no concede lectura automática de respuestas. P54 se elimina de la respuesta para jugadores y adultos sin permiso; selección de jugadores antes de serializar.
- JSON más cabecera propia y Origin exacto en todas las escrituras. Sin CORS; Host acotado a localhost/127.0.0.1 y puerto del proceso. Límite persistente de intentos de acceso y cuerpos de 16 KB. Sin logs de contraseñas o cuerpos.
- DB, servidor, muestra, tests, documentos y credenciales fuera de la allowlist web. Se valida la ruta resuelta para bloquear traversal codificado. CSP, frame-ancestors none, nosniff, no-referrer y no-store.
- No se cachean sesiones, administración ni respuestas privadas en Service Worker. La sesión de datos del navegador sigue en memoria y consulta una vez al entrar. Una revocación bloquea nuevos accesos del servidor; no borra a distancia una respuesta ya entregada. Expiración, salir o cerrar página limpia esa memoria.
- No se verifican direcciones de correo ni se envían mensajes; se acepta un alias para el jugador. El administrador entrega la contraseña temporal por su canal habitual.
- La recuperación del propietario es un script local interactivo, nunca una ruta web. Quien controla el archivo SQLite controla las cuentas: proteger el equipo y sus copias de seguridad.

## Integración externa anterior

El Worker conservado valida JWT RS256 de Cloudflare Access y permisos APP_USERS_JSON/ALLOWED_SHEETS_JSON; usa Google Service Account de solo lectura. Sigue sin desplegar y NO es el backend del panel actual. Su configuración no crea cuentas SQLite ni se sincroniza con ellas. No se ha probado inicio/logout de Access ni lectura de Sheets real.

## Publicación

El servidor entregado solo escucha 127.0.0.1. Para internet hay que configurar alojamiento persistente, HTTPS, origen autorizado y cookies Secure; revisar catálogo P1 y privacidad del frontend. El empaquetador estático bloquea esta versión para evitar publicar una app sin su autenticación. No hay cambios de DNS, hosting, Firestore, Cloudflare ni permisos de Drive en este trabajo.
