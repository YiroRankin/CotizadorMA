# Historial de cotizaciones en Google Sheets

Esta carpeta deja lista una integración sencilla para registrar cotizaciones desde el sitio en GitHub Pages hacia Google Sheets.

## Cómo funciona

1. El cotizador genera la cotización normalmente.
2. `js/app.js` arma un payload con los datos principales.
3. `js/logger.js` lo envía de forma silenciosa a un endpoint.
4. Un Web App de Google Apps Script recibe el payload y lo agrega a una hoja.

## Archivos relevantes

- `QuoteHistoryLogger.gs`: Apps Script para pegar dentro de un proyecto nuevo.
- `../../js/config.js`: aquí activarás el envío desde el cotizador.

## Pasos de activación

### 1) Crear el Google Sheet
Crea un Sheet nuevo donde quieras guardar el historial.

### 2) Crear Apps Script
En ese Sheet:
- Extensiones
- Apps Script

Pega el contenido de `QuoteHistoryLogger.gs`.

### 3) Configurar el ID del Sheet
Reemplaza:

```javascript
const SHEET_ID = 'PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET';
```

Por el ID real de tu spreadsheet.

### 4) Desplegar como Web App
En Apps Script:
- Deploy
- New deployment
- Type: Web app
- Execute as: Me
- Who has access: Anyone

Copia la URL del Web App.

### 5) Activar el logger en el cotizador
En `js/config.js` cambia a algo así:

```javascript
window.COTIZADOR_CONFIG = {
  dataUrls: {
    pricing: "./data/pricing.json",
    specialists: "./data/specialists.json",
    courses: "./data/courses.json",
  },
  quoteLogging: {
    enabled: true,
    endpointUrl: "AQUI_PEGA_TU_URL_DEL_WEB_APP",
  },
};
```

## Qué datos se guardan

- fecha y hora
- alumno
- temario
- campus
- curso
- especialista
- modalidad
- precios
- inscripción
- número de mensualidades
- pago mensual estimado

## Nota importante

El sitio de GitHub Pages no escribe directo al API de Google Sheets con credenciales privadas.  
La ruta segura y práctica es:

GitHub Pages -> Apps Script Web App -> Google Sheet

Así evitas exponer llaves sensibles en el frontend público.
