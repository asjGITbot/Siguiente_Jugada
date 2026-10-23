> Actualización 23-10-2026: esta guía describe el adaptador Cloudflare anterior, conservado como alternativa. La app activa crea usuarios en el panel y los guarda en SQLite, no en APP_USERS_JSON. Los dos sistemas no están sincronizados. DATA_MODE=SIMULATED sirve la muestra; cambiar solo la URL no activa Sheets real en este servidor. Véase README.md y ADMINISTRACION.md.

# Conectar la hoja privada

Ya está guardado el enlace aportado por el usuario en `public/config/data-source.json`, campo `GOOGLE_SHEETS_URL`. `API_BASE_URL` sigue pendiente. No se ha leído la hoja ni se han cambiado permisos.

1. Un adulto confirma cuál hoja es DEMO y cuál REAL, ambas con el contrato V04 de 60 columnas. No publicar la hoja en la web.
2. Con autorización externa posterior, preparar una cuenta de servicio Google con acceso lector a ambas hojas. Guardar su JSON como secreto GOOGLE_SERVICE_ACCOUNT_JSON del Worker; nunca en frontend ni repositorio.
3. Configurar Cloudflare Access para el API y el flujo de sesión, con APP_ORIGIN, ACCESS_TEAM_DOMAIN y ACCESS_AUDIENCE. Servir frontend y API preferentemente bajo subdominios del mismo dominio para cookies seguras. El adaptador `/auth/session` consume esa sesión autenticada; el inicio de sesión de Access se prueba en la integración externa.
4. Configurar ALLOWED_SHEETS_JSON como objeto por ID de spreadsheet: {"ID_DEMO":{"datasetKind":"DEMO","range":"'Hoja 1'!A:BH"},"ID_REAL":{"datasetKind":"REAL","range":"'Respuestas de formulario 1'!A:BH"}}. Usar nombres de pestaña reales; pueden ser distintos.
5. Configurar APP_USERS_JSON por email autenticado: {"cuenta@example.invalid":{"role":"player","players":["IDENTIDAD EXACTA P1"],"sheetIds":["ID_DEMO","ID_REAL"],"canReadP54":false}}. Roles parent/psychologist solo con autorización; P54 necesita canReadP54=true además de rol adulto.
6. Una sola vez fijar API_BASE_URL al endpoint privado HTTPS. Probar primero DEMO: headers, permisos, n válidos y ausencia de P54 en player. Probar el bloqueo de una hoja fuera de allowlist.
7. Para cambiar de DEMO a REAL, editar únicamente GOOGLE_SHEETS_URL y volver a entrar. Siempre que ambas hojas ya estén autorizadas, no se cambia el motor, UI, gráficos, XP ni API_BASE_URL. Si falta permiso, se debe mostrar bloqueo; nunca desactivar controles.

Los tests de JWT, permisos, cambio de URL y redacción son locales con respuestas HTTP simuladas; no sustituyen esta verificación externa.
