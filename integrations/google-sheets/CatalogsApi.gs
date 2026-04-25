/**
 * CotizadorMA · Catalogs API
 *
 * Este Web App publica los catálogos del cotizador desde Google Sheets.
 *
 * Endpoints:
 *   ?type=health
 *   ?type=courses
 *   ?type=pricing
 *   ?type=promotions
 *   ?type=all
 *
 * Requiere estas pestañas:
 *   Cursos_Publicables
 *   Precios
 *   Promociones
 */
const SHEET_ID = 'PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET';

const SHEETS = {
  courses: 'Cursos_Publicables',
  pricing: 'Precios',
  promotions: 'Promociones',
};

function doGet(e) {
  try {
    validateConfig_();

    const type = ((e && e.parameter && e.parameter.type) || 'all').toLowerCase();

    if (type === 'health') {
      return jsonOutput_({ ok: true, message: 'Catalogs API activa', timestamp: new Date().toISOString() });
    }

    if (type === 'courses') {
      return jsonOutput_(buildCoursesCatalog_());
    }

    if (type === 'pricing') {
      return jsonOutput_(buildPricingCatalog_());
    }

    if (type === 'promotions') {
      return jsonOutput_(buildPromotionsCatalog_());
    }

    if (type === 'all') {
      return jsonOutput_({
        ok: true,
        generatedAt: new Date().toISOString(),
        courses: buildCoursesCatalog_(),
        pricing: buildPricingCatalog_(),
        promotions: buildPromotionsCatalog_(),
      });
    }

    return jsonOutput_({ ok: false, message: 'Tipo de catálogo no reconocido: ' + type });
  } catch (error) {
    return jsonOutput_({ ok: false, message: error.message });
  }
}

function buildCoursesCatalog_() {
  const rows = readRows_(SHEETS.courses);
  const catalog = {};

  rows.forEach(function(row) {
    if (!isActive_(getValue_(row, ['activo', 'active']))) return;

    const temario = clean_(getValue_(row, ['temario', 'syllabus']));
    const campus = clean_(getValue_(row, ['campus']));
    const date = formatDate_(getValue_(row, ['fechaInicio', 'date', 'inicio']));
    const endDate = formatDate_(getValue_(row, ['fechaTermino', 'endDate', 'termino']));
    const name = clean_(getValue_(row, ['nombreVisible', 'name', 'curso']));
    const days = clean_(getValue_(row, ['dias', 'days']));
    const schedule = clean_(getValue_(row, ['horario', 'schedule']));
    const modality = clean_(getValue_(row, ['modalidad', 'modality']));
    const address = clean_(getValue_(row, ['direccion', 'address']));
    const locationUrl = clean_(getValue_(row, ['locationUrl', 'locationURL', 'linkUbicacion', 'link de ubicación']));
    const courseId = clean_(getValue_(row, ['courseId', 'id'])) || buildCourseId_(temario, campus, date, days, schedule, modality);

    if (!(temario && campus && date && name && schedule && modality)) return;

    if (!catalog[temario]) catalog[temario] = {};
    if (!catalog[temario][campus]) catalog[temario][campus] = [];

    catalog[temario][campus].push({
      id: courseId,
      name: name,
      date: date,
      schedule: schedule,
      days: days,
      modality: modality,
      address: address,
      locationUrl: locationUrl,
      endDate: endDate,
    });
  });

  Object.keys(catalog).forEach(function(temario) {
    Object.keys(catalog[temario]).forEach(function(campus) {
      catalog[temario][campus].sort(function(a, b) {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        if (a.name !== b.name) return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
        return String(a.schedule || '').localeCompare(String(b.schedule || ''), 'es', { sensitivity: 'base' });
      });
    });
  });

  return catalog;
}

function buildPricingCatalog_() {
  const rows = readRows_(SHEETS.pricing);
  return rows
    .filter(function(row) { return isActive_(getValue_(row, ['activo', 'active'])); })
    .map(function(row) {
      return {
        temario: clean_(getValue_(row, ['temario', 'syllabus'])),
        modality: clean_(getValue_(row, ['modalidad', 'modality'])),
        from: formatDate_(getValue_(row, ['vigenciaDesde', 'from', 'desde'])),
        to: formatDate_(getValue_(row, ['vigenciaHasta', 'to', 'hasta'])),
        listPrice: number_(getValue_(row, ['precioLista', 'listPrice'])),
        cash: number_(getValue_(row, ['precioContado', 'cash'])),
        cashDiscount: number_(getValue_(row, ['descuentoContado', 'cashDiscount'])),
        installment: number_(getValue_(row, ['precioPlan', 'installment'])),
        installmentDiscount: number_(getValue_(row, ['descuentoPlan', 'installmentDiscount'])),
      };
    })
    .filter(function(rule) {
      return rule.temario && rule.modality && rule.from && rule.to && rule.listPrice > 0;
    })
    .sort(function(a, b) {
      if (a.temario !== b.temario) return a.temario.localeCompare(b.temario, 'es', { sensitivity: 'base' });
      if (a.modality !== b.modality) return a.modality.localeCompare(b.modality, 'es', { sensitivity: 'base' });
      return a.from < b.from ? -1 : a.from > b.from ? 1 : 0;
    });
}

function buildPromotionsCatalog_() {
  const rows = readRows_(SHEETS.promotions);
  return rows
    .filter(function(row) { return isActive_(getValue_(row, ['activo', 'active'])); })
    .map(function(row) {
      return {
        id: clean_(getValue_(row, ['promoId', 'id'])) || buildSlug_(clean_(getValue_(row, ['nombrePromo', 'name', 'promocion']))),
        name: clean_(getValue_(row, ['nombrePromo', 'name', 'promocion'])),
        from: formatDate_(getValue_(row, ['vigenciaDesde', 'from', 'desde'])),
        to: formatDate_(getValue_(row, ['vigenciaHasta', 'to', 'hasta'])),
        temario: clean_(getValue_(row, ['temario', 'syllabus'])) || '*',
        campus: clean_(getValue_(row, ['campus'])) || '*',
        modality: clean_(getValue_(row, ['modalidad', 'modality'])) || '*',
        paymentMethod: clean_(getValue_(row, ['formaPago', 'paymentMethod'])) || '*',
        benefit: clean_(getValue_(row, ['beneficio', 'benefit'])),
        pdfText: clean_(getValue_(row, ['textoPDF', 'pdfText'])),
        priority: number_(getValue_(row, ['prioridad', 'priority'])) || 0,
      };
    })
    .filter(function(promo) { return promo.name && promo.from && promo.to; })
    .sort(function(a, b) { return b.priority - a.priority; });
}

function readRows_(sheetName) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheetName);
  if (!sheet) throw new Error('No existe la pestaña: ' + sheetName);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(function(header) { return normalizeHeader_(header); });
  return values.slice(1).map(function(row) {
    const obj = {};
    headers.forEach(function(header, index) {
      if (header) obj[header] = row[index];
    });
    return obj;
  });
}

function getValue_(row, possibleHeaders) {
  for (var i = 0; i < possibleHeaders.length; i++) {
    const key = normalizeHeader_(possibleHeaders[i]);
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  }
  return '';
}

function normalizeHeader_(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isActive_(value) {
  const text = String(value == null ? '' : value).trim().toLowerCase();
  if (!text) return false;
  return ['si', 'sí', 'yes', 'true', '1', 'activo', 'activa'].indexOf(text) !== -1;
}

function clean_(value) {
  return String(value == null ? '' : value).trim();
}

function number_(value) {
  if (typeof value === 'number') return value;
  const cleaned = String(value == null ? '' : value).replace(/[$,\s]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function formatDate_(value) {
  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  return text;
}

function buildCourseId_(temario, campus, date, days, schedule, modality) {
  return buildSlug_([temario, campus, date, days, schedule, modality].join('-'));
}

function buildSlug_(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function validateConfig_() {
  if (!SHEET_ID || SHEET_ID === 'PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET') {
    throw new Error('Configura SHEET_ID antes de desplegar CatalogsApi.gs.');
  }
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
