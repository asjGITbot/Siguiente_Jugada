# SSR11: dónde crear los usuarios

**Créalo todo desde el panel de administración de SSR11. No necesitas Firestore ni editar JSON.**

1. Abre `Administrar-SSR11.cmd` (doble clic desde el Explorador) o ejecuta `Administrar-SSR11.ps1` con PowerShell. El iniciador arranca el servidor y abre el alta del primer administrador con un enlace privado.
2. Elige tu nombre, usuario o correo y contraseña de al menos 12 caracteres. Pulsa **2. Crear mi administrador**. Si el enlace vence, abre de nuevo el iniciador.
3. En el panel pulsa **2. Nuevo usuario**. Completa nombre, usuario, rol, jugador permitido y contraseña temporal. Pulsa **3. Crear usuario**.
4. Cada persona entra en http://localhost:8311/ con su usuario y contraseña temporal. Primero deberá elegir su propia contraseña.

Después de activar tu administrador, puedes entrar directamente en http://localhost:8311/admin/.

| Rol | Permisos |
|---|---|
| Administrador | Crea, edita, desactiva cuentas y restablece contraseñas. |
| Jugador | Consulta los partidos del jugador asignado; nunca ve P54. |
| Familiar | Consulta los jugadores asignados; P54 solo si lo autorizas. |
| Psicólogo | Consulta los jugadores asignados; P54 solo si lo autorizas. |

Para cambiar una cuenta: **Editar → Guardar cambios**. Desmarca **Acceso activo** para desactivarla. Para restablecer una contraseña, escribe una nueva en el campo opcional: la persona tendrá que cambiarla al entrar. Los cambios cierran sus sesiones del servidor.

Los usuarios persisten en `Z:\ASJ_AI_OS\DOCKER_PROJECTS\SSR11_Futbol_Base\WEB_PSICOLOGIA\SSR11_PWA_SANDBOX\private\ssr11.sqlite3`. No edites ese archivo ni lo subas a un repositorio. Las contraseñas se guardan como hashes, no legibles. Un correo sirve como usuario; no se envían invitaciones o mensajes automáticos.

La app y las cuentas funcionan **en este equipo**. Los 100 partidos son simulados. El enlace de Sheets sigue guardado pero su lectura real no está activada. Para acceso desde otros equipos o teléfonos hace falta alojar el servidor con HTTPS; no hay publicación realizada.

Verificación: 18 pruebas de cuentas y 25 del motor aprobadas; prueba visual en escritorio/móvil; creación inicial, altas y cambio obligatorio de contraseña comprobados por API con bases aisladas. Tu base quedó sin cuentas de prueba.


## Arranque corregido

El iniciador usa scripts/start-server.py para crear un proceso oculto independiente de la terminal, con diagnóstico en private/server.log. Verificado: /admin/ devuelve HTTP 200 después de cerrar el lanzador; volver a abrirlo reutiliza el mismo proceso. Si reinicias Windows, vuelve a ejecutar Administrar-SSR11.cmd. No se creó una tarea programada ni un servicio de inicio automático.
