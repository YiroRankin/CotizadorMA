# CotizadorMA

Cotizador web de Misión Admisión publicado en GitHub Pages, con registro automático de actividad en Google Sheets y un panel administrativo interno para Coordinación Comercial.

## URLs principales

- Cotizador: `https://yirorankin.github.io/CotizadorMA/`
- Panel comercial: `https://yirorankin.github.io/CotizadorMA/admin/`

## Qué incluye hoy

### 1) Cotizador público
Ubicado en la raíz del proyecto.

Funciones principales:
- selección de especialista, temario, campus, curso y horario
- lectura de catálogos desde `data/*.json`, con extensión opcional desde Google Sheets
- cotización con contado, plan de pagos y MSI
- vista premium para guardar como PDF
- registro automático de eventos:
  - `quote_generated`
  - `pdf_generated`

Archivos principales:
- `index.html`
- `js/config.js`
- `js/quote.js`
- `js/pdf.js`
- `js/logger.js`
- `js/app.js`
- `data/pricing.json`
- `data/specialists.json`
- `data/courses.json`

### 2) Panel comercial interno (Fase 1)
Ubicado en `/admin/`.

Funciones principales:
- KPIs de uso
- filtros por periodo, especialista, temario, campus y alumno
- gráficas de adopción
- resumen por especialista
- historial filtrable
- descarga CSV

Archivos principales:
- `admin/index.html`
- `admin/styles.css`
- `admin/config.js`
- `admin/app.js`

### 3) Integraciones con Google Sheets / Apps Script
Ubicadas en `integrations/google-sheets/`.

Scripts disponibles:
- `QuoteHistoryLogger.gs`: registra eventos del cotizador en la hoja
- `QuoteHistoryReadApi.gs`: expone el histórico como JSON para el panel
- `CatalogsApi.gs`: API de lectura de catálogos, conservada como referencia
- `CatalogManagerApi.gs`: permite altas controladas desde `/catalogos/` y publica catálogos al cotizador

## Arquitectura general

```txt
GitHub Pages
├─ /                 -> cotizador público
├─ /admin/           -> panel comercial interno
└─ /catalogos/       -> panel de carga de catálogos

Google Apps Script
├─ Logger Web App    -> recibe eventos y escribe en Google Sheets
├─ Read API Web App  -> lee Google Sheets y devuelve JSON al panel
└─ Catalog Manager   -> recibe altas y publica catálogos

Google Sheets
├─ HistorialCotizaciones
└─ Cursos_Publicables / Precios / Promociones
```

## Flujo actual de datos

### Cotizador
1. La especialista genera una cotización.
2. Se registra un evento `quote_generated`.
3. Si genera la vista PDF, se registra `pdf_generated`.
4. El logger guarda ambas filas en `HistorialCotizaciones`.
5. Los catálogos locales siguen como base; si `catalogApi.enabled` está activo, los registros válidos de Sheets se agregan encima.

### Panel
1. El panel llama al Read API.
2. El Read API lee `HistorialCotizaciones`.
3. El panel renderiza KPIs, gráficas, tablas e historial.

## Configuración importante

### Logger del cotizador
Archivo:
- `js/config.js`

Campo importante:
- `quoteLogging.endpointUrl`

Ese endpoint debe apuntar al Web App del logger.

### Read API del panel
Archivo:
- `admin/config.js`

Campo importante:
- `historyEndpointUrl`

Ese endpoint debe apuntar al Web App de lectura del panel.

### Catalog API del cotizador
Archivo:
- `js/config.js`

Campos importantes:
- `catalogApi.enabled`
- `catalogApi.endpointUrl`
- `catalogApi.jsonpFallback`

Cuando `catalogApi.enabled` está en `true`, el cotizador carga cursos, precios y promociones desde Apps Script y los combina con los JSON locales. Si Apps Script no responde, si hay bloqueo CORS o si no hay datos válidos, el cotizador conserva el respaldo local del repo.

## Estructura esperada de la hoja `HistorialCotizaciones`

Encabezados esperados:

```txt
A  timestampServidor
B  createdAtCliente
C  source
D  eventType
E  studentName
F  syllabus
G  campus
H  courseId
I  courseName
J  specialistName
K  specialistPhone
L  courseDate
M  courseEndDate
N  schedule
O  days
P  modality
Q  address
R  locationUrl
S  listPrice
T  cashPrice
U  cashDiscount
V  planPrice
W  planDiscount
X  planVigencia
Y  registration
Z  numPayments
AA monthlyPayment
AB customPaymentSchedule
```

## Cómo resetear el histórico

Para empezar desde cero sin romper el sistema:
1. abrir `HistorialCotizaciones`
2. borrar desde la fila 2 hacia abajo
3. conservar los encabezados

El cotizador y el panel volverán a poblarse con nuevos eventos.

## Mantenimiento operativo

### Para cambiar catálogos del cotizador hoy
Usar preferentemente:
- `/catalogos/`
- Google Sheets conectado a `CatalogManagerApi.gs`

Los JSON locales siguen siendo el respaldo operativo:
- `data/pricing.json`
- `data/specialists.json`
- `data/courses.json`

### Para revisar si el logger funciona
- generar una cotización
- generar PDF
- validar dos filas nuevas en `HistorialCotizaciones`

### Para revisar si el panel funciona
- abrir `/admin/`
- comprobar KPIs y gráficas
- usar filtros
- revisar la tabla de historial

## Limpieza realizada

Se retiraron archivos JS de catálogos que quedaron obsoletos tras la migración a JSON:
- `js/data/pricing.js`
- `js/data/specialists.js`
- `js/data/courses.js`

Se conserva `index-respaldo.html` como respaldo histórico por seguridad.

## Siguiente fase sugerida

### Fase 2
Administración de catálogos desde Sheets/App Script para que Coordinación Comercial pueda:
- editar especialistas
- editar cursos
- editar vigencias y precios

sin tocar GitHub ni archivos JSON manualmente.

## Panel alterno de catálogos

Ubicado en:
- `/catalogos/`

Esta página permite capturar cursos, precios y promociones hacia Google Sheets usando `CatalogManagerApi.gs`.

Estado recomendado de despliegue:
1. Crear o elegir el Google Sheet de catálogos.
2. Pegar `integrations/google-sheets/CatalogManagerApi.gs` en Apps Script.
3. Configurar `SHEET_ID` y `ADMIN_TOKEN`.
4. Desplegar como Web App.
5. Pegar la URL en `catalogos/config.js`.
6. Abrir `/catalogos/`, ingresar la clave de edición y usar `Preparar hojas`.
7. Cargar registros y correr `Validar catálogos`.
8. Probar la URL pública con `?type=all`.
9. Publicar los cambios del repo para que GitHub Pages tome `catalogApi.enabled`.

Con `catalogApi.enabled` en `true`, Sheets no reemplaza por completo al repo: agrega o sobrescribe registros equivalentes y deja los JSON como respaldo.
