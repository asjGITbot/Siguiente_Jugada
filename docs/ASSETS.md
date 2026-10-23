# Assets SSR11

Los archivos de `public/assets/` son derivados web independientes y reemplazables. Las fuentes de `../../MEDIA/` se trataron como solo lectura: el proceso registra su SHA-256 antes de generar y vuelve a comprobar el inventario al terminar. El inventario completo de 23 imágenes y diseños, con dimensiones, peso y hash, está en `docs/assets-validation.json`.

Las seis maquetas de escritorio están en `docs/design-reference/`. Son referencias visuales de 1536×1024 y no pertenecen al build público, no se usan como fondos y no aportan cifras a la aplicación.

## Derivados activos

| ID | Fuente (px) | Archivo derivado (px) | Render CSS previsto (px) | Uso |
|---|---|---|---|---|
| `logo` | `Logo_SSR11.png` (1536×1024) | `public/assets/brand/logo-ssr11-240x160.webp` (240×160) | 180×120 | Encabezado compacto |
| `logoLarge` | `Logo_SSR11.png` (1536×1024) | `public/assets/brand/logo-ssr11-360x240.webp` (360×240) | 270×180 | Acceso e identidad destacada |
| `character` | `Canon_Personaje_Salvador.png` (1024×1536) | `public/assets/character/salvador-128x192.webp` (128×192) | 64×96 | Mini avatar opcional |
| `characterLarge` | `Canon_Personaje_Salvador.png` (1024×1536) | `public/assets/character/salvador-256x384.webp` (256×384) | 128×192 | Avatar de acceso, sin ocupar gráficos |
| `ball` | `canon_balon_oficial.png` (1254×1254) | `public/assets/icons/balon-oficial-96x96.webp` (96×96) | 48×48 | Icono decorativo pequeño |
| `ballLarge` | `canon_balon_oficial.png` (1254×1254) | `public/assets/icons/balon-oficial-192x192.webp` (192×192) | 96×96 | Icono decorativo destacado |
| `seal` | `balon_logo_65.png` (1283×1226) | `public/assets/icons/balon-logo-128x128.webp` (128×128) | 64×64 | Sello o logro; centrado con `contain` |
| `pwa192` | `balon_logo_65.png` (1283×1226) | `public/assets/pwa/icon-192.png` (192×192) | 192×192 | Instalación PWA |
| `pwa512` | `balon_logo_65.png` (1283×1226) | `public/assets/pwa/icon-512.png` (512×512) | 512×512 | Instalación PWA de alta resolución |
| `pwaMaskable` | `balon_logo_65.png` (1283×1226) | `public/assets/pwa/icon-maskable-512.png` (512×512) | 512×512 | Icono `maskable`, con margen seguro y fondo marino |
| `apple` | `balon_logo_65.png` (1283×1226) | `public/assets/pwa/apple-touch-icon-180.png` (180×180) | 180×180 | Pantalla de inicio Apple |

Los tamaños intrínsecos, tamaños previstos de render, textos alternativos, roles, estado y SHA-256 vigentes están en `config/assets-manifest.json`. El frontend debe resolver las imágenes por `id`, no duplicar rutas en los componentes.

## Inventario de fuentes MEDIA

| Fuente | Dimensiones | Estado de uso |
|---|---:|---|
| `balon_logo_65.png` | 1283×1226 | Fuente activa: sello e iconos PWA |
| `botones.png` | 2172×724 | Disponible; no incorporada a la UI |
| `canon_balon_oficial.png` | 1254×1254 | Fuente activa: iconos de balón |
| `Canon_Expresiones_Salvador.png` | 1491×1055 | Disponible; no incorporada a la UI |
| `Canon_Personaje_Salvador.png` | 1024×1536 | Fuente activa: mini avatar |
| `Canon_TurnAround_Salvador.png` | 1448×1086 | Disponible; no incorporada a la UI |
| `grow_page_16x9_1200x675.psd` | 1200×675 | Diseño maestro; excluido del build |
| `grow_page_16x9_1200x675png.png` | 1200×675 | Disponible; no incorporada a la UI |
| `grow_page_1x1_1200x1200.png` | 1200×1200 | Disponible; no incorporada a la UI |
| `grow_page_1x1_1200x1200.psd` | 1200×1200 | Diseño maestro; excluido del build |
| `grow_page_9x16_675x1200.png` | 675×1200 | Disponible; no incorporada a la UI |
| `grow_page_9x16_675x1200.psd` | 675×1200 | Diseño maestro; excluido del build |
| `Header_Redes.png` | 2660×1140 | Disponible; no incorporada a la UI |
| `iconos_redes.png` | 2172×724 | Disponible; no incorporada a la UI |
| `logo_65.png` | 1536×1024 | Disponible; no incorporada a la UI |
| `Logo_SSR11.png` | 1536×1024 | Fuente activa: identidad SSR11 |
| `movil_390_844.psd` | 780×1688 | Diseño maestro; excluido del build |
| `Musica_que_juega_contigo.png` | 1170×1344 | Disponible; no incorporada a la UI |
| `Musica_que_juega_contigo_v.png` | 1983×793 | Disponible; no incorporada a la UI |
| `Screenshot_1.png` | 167×229 | Disponible; no incorporada a la UI |
| `siguenos.png` | 1981×793 | Disponible; no incorporada a la UI |
| `tablet_1024x768.psd` | 1024×768 | Diseño maestro; excluido del build |
| `web_1920x1080.psd` | 1920×1080 | Diseño maestro; excluido del build |

## Regeneración y reemplazo

Se requiere Python 3 y Pillow. Desde la raíz del sandbox:

```powershell
python scripts/prepare-assets.py
python scripts/validate-assets.py
```

`prepare-assets.py` usa `contain` con remuestreo LANCZOS, conserva proporciones y nunca escribe en MEDIA. Los formatos WebP usan calidad 88; los PNG PWA se optimizan sin pérdida. El sello queda centrado en lienzo transparente. El icono `maskable` conserva el balón dentro de la zona segura sobre un fondo marino opaco.

Para reemplazar una fuente autorizada, mantenga el nombre y la proporción previstos, ejecute ambos scripts y revise visualmente el resultado. Si se agrega un asset nuevo, añada su especificación al script, regenere el manifiesto y haga que la UI lo solicite por el nuevo `id`. Si cambia solo la ruta pública, actualice esa ruta en el manifiesto y en la especificación generadora.

En HTML se deben declarar `width` y `height` intrínsecos, y en CSS se debe limitar el tamaño con los valores `renderWidth`/`renderHeight` o una regla `aspect-ratio`. Esto evita saltos de layout y estiramientos.

`validate-assets.py` produce `PASS` o `FAIL` por rutas, IDs, campos obligatorios, dimensiones, dimensiones codificadas en nombres, hashes derivados, seis referencias e integridad de todo MEDIA. Si `manifest.webmanifest` todavía no existe emite una advertencia; cuando existe, valida que declare los cuatro iconos PWA con sus tamaños.
