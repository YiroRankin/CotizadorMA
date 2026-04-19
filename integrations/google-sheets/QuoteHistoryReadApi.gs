/**
 * API de lectura para el Panel Comercial (Fase 1).
 * Despliega este archivo como un Web App separado al logger.
 */
const SHEET_ID = 'PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET';
const SHEET_NAME = 'HistorialCotizaciones';

function doGet(e) {
  try {
    if (!SHEET_ID || SHEET_ID === 'PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET') {
      throw new Error('Configura SHEET_ID antes de desplegar este Web App.');
    }

    const mode = (e && e.parameter && e.parameter.mode) || 'history';
    const rows = readRows_();
    const filtered = applyFilters_(rows, e ? e.parameter : {});

    if (mode === 'history') {
      return jsonOutput_({
        ok: true,
        rows: filtered,
        total: filtered.length,
      });
    }

    return jsonOutput_({
      ok: true,
      rows: filtered,
      total: filtered.length,
    });
  } catch (error) {
    return jsonOutput_({ ok: false, message: error.message });
  }
}

function readRows_() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error('No existe la pestaña ' + SHEET_NAME + '.');
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0];
  return values.slice(1).map((row) => rowToObject_(headers, row));
}

function rowToObject_(headers, row) {
  const obj = {};
  headers.forEach(function(header, index) {
    obj[String(header || '').trim()] = row[index];
  });
  return obj;
}

function applyFilters_(rows, params) {
  const days = Number(params.days || 0);
  const limit = Number(params.limit || 0);
  const specialistName = (params.specialistName || '').trim();
  const syllabus = (params.syllabus || '').trim();
  const campus = (params.campus || '').trim();
  const eventType = (params.eventType || '').trim();
  const search = (params.search || '').trim().toLowerCase();

  let filtered = rows.filter(function(row) {
    if (days > 0 && row.timestampServidor) {
      const threshold = new Date();
      threshold.setHours(0, 0, 0, 0);
      threshold.setDate(threshold.getDate() - days);
      const rowDate = new Date(row.timestampServidor);
      if (rowDate < threshold) return false;
    }

    if (specialistName && row.specialistName !== specialistName) return false;
    if (syllabus && row.syllabus !== syllabus) return false;
    if (campus && row.campus !== campus) return false;
    if (eventType && row.eventType !== eventType) return false;
    if (search && String(row.studentName || '').toLowerCase().indexOf(search) === -1) return false;

    return true;
  });

  filtered.sort(function(a, b) {
    return new Date(b.timestampServidor) - new Date(a.timestampServidor);
  });

  if (limit > 0) {
    filtered = filtered.slice(0, limit);
  }

  return filtered;
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
