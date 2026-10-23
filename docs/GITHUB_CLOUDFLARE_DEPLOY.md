> Actualización 23-10-2026: el panel actual requiere el servidor Python y SQLite persistente. La publicación estática de la primera versión no sirve para esta app; package-static.py la bloquea. Las instrucciones siguientes son históricas y no despliegan el sistema nuevo de cuentas.

# Preparación para despliegue posterior

NO EJECUTADO. No se creó repositorio, Site alojado, dominio, DNS, Worker ni permisos.

La habilidad Sites se siguió en modalidad local-only porque el encargo prohíbe publicar. El código es buildless. Antes de cualquier despliegue se requiere la autorización humana posterior indicada en el encargo.

El build público se prepara con `python scripts/package-static.py`: copia solo index, manifest, SW, css, js, config, vendor y public. Excluye tests, docs, scripts, backend, secretos, PDF y Excel. El script informa si la configuración técnica está pendiente; preparar archivos locales no autoriza publicarlos. Revisar el catálogo P1 y mantener perfiles privados en servidor antes de autorizar estáticos públicos.

GitHub Pages aloja únicamente interfaz. Un dominio propio puede administrarse en Cloudflare. El Worker privado se despliega por separado después de configurar Access y secretos. No usar una URL pública de CSV. Hacer pruebas de login real, P54 por rol, revocación de sesión y ambas hojas antes de producción.

No ejecutar git init/commit/push, wrangler deploy ni cambios DNS como parte de esta entrega local.

