# Contrato V04

54 preguntas, 60 columnas, siete secciones. A es fecha de envío; B–BA corresponden a P1–P52; BB–BG son seis subcampos de P53; BH es P54.

Fuente de catálogos: PDF oficial de 21 páginas aportado por el usuario. SHA-256 `2ceff63e82744ffd99f73b97dc32fba85f1978df590b554234b30ec57a50ea4a`. Todos los literales del catálogo se contrastan con el texto del PDF mediante `scripts/validate-demo.py`. Encabezados provienen del Anexo A; J declara explícitamente alias de uno y dos espacios. Se normaliza NFC, espacios y selector de presentación emoji; no se altera el valor bruto ni se cambian categorías por similitud.

Estados: VALID, MISSING, NOT_OBSERVED, NOT_APPLICABLE, INVALID. Solo VALID entra en promedios. Cero explícito es válido solo en conteos de goles/penales. “No” permanece categoría. Las seis filas de P53 son independientes; N/O no vale cero. Multiselección cuenta una marca por partido; los porcentajes pueden superar 100%.

Cada gráfico publica n_valid/n_eligible, n_missing, n_no, n_na, n_invalid. El umbral de evolución es 3, configurable. Un valor se muestra como punto; los huecos no se unen. Las escalas de tipo scale se mantienen 1–5; ordinales conservan el orden de opciones sin interpretación clínica.

Las dependencias contextuales P25→P26–28, P32→P33–37 y P39→P40–49 siguen el encargo. El PDF impreso NO permite certificar la lógica de navegación del formulario vivo. Un hijo respondido cuando el padre es No se conserva en bruto, se marca NOT_APPLICABLE y genera alerta; no se modifica la fuente. Padre ausente no equivale a No.

Fecha MDY para texto histórico (6/24/2026); números Excel con base 1899-12-30. Hora local America/Lima, UTC−05:00. No se infiere DD/MM. Fechas inválidas se conservan para auditoría, sin punto temporal. Marca temporal es envío, no fecha de juego.

ID de Google Forms si existe; de otro modo SHA-256 de datos semánticos reproducibles de la fila, timestamp normalizado y sin P54. Nunca se deduplica solo por día. Filtrado no cambia XP global. Resultados reglamentarios se derivan de P11/P12; tanda se conserva en P40–P42. Etiquetas de P10 que contienen “penales” generan advertencia.

La API devuelve encabezados de 60 columnas y filas autorizadas. P54 se devuelve null y redactedFields=[q54] a player y a adultos sin permiso explícito. Las respuestas no se guardan en almacenamiento del navegador.
