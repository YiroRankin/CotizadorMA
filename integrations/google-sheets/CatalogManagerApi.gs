/**
 * CotizadorMA · Catalog Manager API
 *
 * Web App para altas controladas de cursos, precios y promociones en Google Sheets.
 * Complementa CatalogsApi.gs, que publica los catalogos al cotizador.
 */
const SHEET_ID = 'PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET';
const ADMIN_TOKEN = 'CAMBIA_ESTA_CLAVE';

const SHEETS = {
  courses: 'Cursos_Publicables',
  campusConfig: 'Campus_Config',
  pricing: 'Precios',
  promotions: 'Promociones',
};

const HEADERS = {
  courses: [
    'activo',
    'courseId',
    'temario',
    'campusFuente',
    'campusCotizador',
    'nombreVisible',
    'fechaInicio',
    'fechaTermino',
    'dias',
    'horario',
    'modalidad',
    'direccion',
    'locationUrl',
    'createdAt',
    'groupId',
  ],
  campusConfig: [
    'activo',
    'campusFuente',
    'campusCotizador',
    'modalidad',
    'direccion',
    'locationUrl',
    'createdAt',
  ],
  pricing: [
    'activo',
    'temario',
    'modalidad',
    'vigenciaDesde',
    'vigenciaHasta',
    'precioLista',
    'precioContado',
    'descuentoContado',
    'precioPlan',
    'descuentoPlan',
    'createdAt',
  ],
  promotions: [
    'activo',
    'promoId',
    'nombrePromo',
    'vigenciaDesde',
    'vigenciaHasta',
    'temario',
    'campus',
    'modalidad',
    'formaPago',
    'beneficio',
    'textoPDF',
    'prioridad',
    'createdAt',
  ],
};

function doGet(e) {
  return handlePublicRead_(e);
}

function doPost(e) {
  return handleManagerRequest_(e);
}

function handlePublicRead_(e) {
  try {
    validateSheetConfig_();

    const type = ((e && e.parameter && e.parameter.type) || 'all').toLowerCase();

    if (type === 'health') {
      return publicOutput_({ ok: true, message: 'Catalogos activos', timestamp: new Date().toISOString() }, e);
    }

    if (type === 'courses') {
      return publicOutput_(buildCoursesCatalog_(), e);
    }

    if (type === 'pricing') {
      return publicOutput_(buildPricingCatalog_(), e);
    }

    if (type === 'promotions') {
      return publicOutput_(buildPromotionsCatalog_(), e);
    }

    if (type === 'all') {
      return publicOutput_({
        ok: true,
        generatedAt: new Date().toISOString(),
        courses: buildCoursesCatalog_(),
        pricing: buildPricingCatalog_(),
        promotions: buildPromotionsCatalog_(),
      }, e);
    }

    return publicOutput_({ ok: false, message: 'Tipo de catalogo no reconocido: ' + type }, e);
  } catch (error) {
    return publicOutput_({ ok: false, message: error.message }, e);
  }
}

function handleManagerRequest_(e) {
  try {
    validateConfig_();

    const payload = getPayload_(e);
    validateToken_(payload.token);

    const action = clean_(payload.action || 'health').toLowerCase();

    if (action === 'health') {
      return jsonOutput_({ ok: true, message: 'Catalog Manager activo', timestamp: new Date().toISOString() });
    }

    if (action === 'setup') {
      return jsonOutput_(setupSheets_());
    }

    if (action === 'append') {
      return jsonOutput_(appendRow_(payload.type, payload.data || {}));
    }

    if (action === 'list') {
      return jsonOutput_(listRows_(payload.type, Number(payload.limit || 25)));
    }

    if (action === 'validate') {
      return jsonOutput_(validateCatalogs_());
    }

    return jsonOutput_({ ok: false, message: 'Accion no reconocida: ' + action });
  } catch (error) {
    return jsonOutput_({ ok: false, message: error.message });
  }
}

function buildCoursesCatalog_() {
  const rows = readRows_('courses');
  const campusConfig = readCampusConfig_();
  const catalog = {};

  rows.forEach(function(row) {
    if (!isActive_(row.activo)) return;

    const temario = clean_(row.temario);
    const campusFuente = clean_(row.campusFuente);
    const config = campusConfig[normalizeKey_(campusFuente)] || {};
    const campus = clean_(row.campusCotizador) || config.campusCotizador || campusFuente;
    const date = formatDate_(row.fechaInicio);
    const endDate = formatDate_(row.fechaTermino);
    const name = clean_(row.nombreVisible);
    const days = clean_(row.dias);
    const schedule = clean_(row.horario);
    const modality = clean_(row.modalidad) || config.modalidad;
    const address = clean_(row.direccion) || config.direccion;
    const locationUrl = clean_(row.locationUrl) || config.locationUrl;
    const courseId = clean_(row.courseId) || buildCourseId_(temario, campus, date, days, schedule, modality);
    const groupId = clean_(row.groupId);

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
      groupId: groupId,
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

function readCampusConfig_() {
  try {
    const rows = readRows_('campusConfig');
    const map = {};

    rows.forEach(function(row) {
      if (!isActive_(row.activo)) return;

      const campusFuente = clean_(row.campusFuente);
      if (!campusFuente) return;

      map[normalizeKey_(campusFuente)] = {
        campusCotizador: clean_(row.campusCotizador) || campusFuente,
        modalidad: clean_(row.modalidad),
        direccion: clean_(row.direccion),
        locationUrl: clean_(row.locationUrl),
      };
    });

    return map;
  } catch (error) {
    return {};
  }
}

function buildPricingCatalog_() {
  return readRows_('pricing')
    .filter(function(row) { return isActive_(row.activo); })
    .map(function(row) {
      return {
        temario: clean_(row.temario),
        modality: clean_(row.modalidad),
        from: formatDate_(row.vigenciaDesde),
        to: formatDate_(row.vigenciaHasta),
        listPrice: number_(row.precioLista),
        cash: number_(row.precioContado),
        cashDiscount: number_(row.descuentoContado),
        installment: number_(row.precioPlan),
        installmentDiscount: number_(row.descuentoPlan),
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
  return readRows_('promotions')
    .filter(function(row) { return isActive_(row.activo); })
    .map(function(row) {
      return {
        id: clean_(row.promoId) || buildSlug_(row.nombrePromo),
        name: clean_(row.nombrePromo),
        from: formatDate_(row.vigenciaDesde),
        to: formatDate_(row.vigenciaHasta),
        temario: clean_(row.temario) || '*',
        campus: clean_(row.campus) || '*',
        modality: clean_(row.modalidad) || '*',
        paymentMethod: clean_(row.formaPago) || '*',
        benefit: clean_(row.beneficio),
        pdfText: clean_(row.textoPDF),
        priority: number_(row.prioridad) || 0,
      };
    })
    .filter(function(promo) { return promo.name && promo.from && promo.to; })
    .sort(function(a, b) { return b.priority - a.priority; });
}

function getPayload_(e) {
  if (e && e.postData && e.postData.contents) {
    return JSON.parse(e.postData.contents);
  }

  if (e && e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }

  return (e && e.parameter) || {};
}

function setupSheets_() {
  Object.keys(SHEETS).forEach(function(type) {
    ensureSheet_(type);
  });

  return {
    ok: true,
    sheets: SHEETS,
  };
}

function appendRow_(type, data) {
  validateType_(type);

  const normalized = normalizeData_(type, data);
  const errors = validateRow_(type, normalized);

  if (errors.length) {
    return {
      ok: false,
      message: errors.join(' | '),
      errors: errors,
    };
  }

  const sheet = ensureSheet_(type);
  const headers = HEADERS[type];
  const row = headers.map(function(header) {
    return normalized[header] == null ? '' : normalized[header];
  });

  sheet.appendRow(row);

  return {
    ok: true,
    type: type,
    rowNumber: sheet.getLastRow(),
    row: normalized,
  };
}

function listRows_(type, limit) {
  validateType_(type);

  const rows = readRows_(type);
  const safeLimit = Math.max(1, Math.min(Number(limit || 25), 200));
  const recent = rows.slice(Math.max(0, rows.length - safeLimit)).reverse();

  return {
    ok: true,
    type: type,
    total: rows.length,
    rows: recent,
  };
}

function validateCatalogs_() {
  setupSheets_();

  const courses = readRows_('courses');
  const pricing = readRows_('pricing');
  const promotions = readRows_('promotions');
  const issues = [];

  validateDuplicateCourseIds_(courses, issues);
  validatePricingRanges_(pricing, issues);

  courses.forEach(function(row, index) {
    validateRow_('courses', row).forEach(function(message) {
      issues.push(issue_('courses', index + 2, message));
    });
  });

  pricing.forEach(function(row, index) {
    validateRow_('pricing', row).forEach(function(message) {
      issues.push(issue_('pricing', index + 2, message));
    });
  });

  promotions.forEach(function(row, index) {
    validateRow_('promotions', row).forEach(function(message) {
      issues.push(issue_('promotions', index + 2, message));
    });
  });

  return {
    ok: true,
    summary: {
      courses: courses.length,
      pricing: pricing.length,
      promotions: promotions.length,
    },
    issues: issues,
  };
}

function normalizeData_(type, data) {
  const now = new Date();
  const normalized = {};

  Object.keys(data || {}).forEach(function(key) {
    normalized[key] = typeof data[key] === 'string' ? data[key].trim() : data[key];
  });

  normalized.activo = normalized.activo || 'si';
  normalized.createdAt = normalized.createdAt || now;

  if (type === 'courses' && !normalized.courseId) {
    normalized.courseId = buildSlug_([
      normalized.temario,
      normalized.campusCotizador || normalized.campusFuente,
      normalized.fechaInicio,
      normalized.dias,
      normalized.horario,
      normalized.modalidad,
    ].join('-'));
  }

  if (type === 'promotions' && !normalized.promoId) {
    normalized.promoId = buildSlug_(normalized.nombrePromo);
  }

  if (type === 'pricing') {
    ['precioLista', 'precioContado', 'descuentoContado', 'precioPlan', 'descuentoPlan'].forEach(function(key) {
      normalized[key] = number_(normalized[key]);
    });
  }

  if (type === 'promotions') {
    normalized.prioridad = number_(normalized.prioridad);
  }

  return normalized;
}

function validateRow_(type, row) {
  if (!isActive_(row.activo)) return [];

  const errors = [];

  if (type === 'courses') {
    requireFields_(row, ['temario', 'campusFuente', 'nombreVisible', 'fechaInicio', 'fechaTermino', 'dias', 'horario', 'modalidad'], errors);
    validateDatePair_(row.fechaInicio, row.fechaTermino, 'fechas del curso', errors);
  }

  if (type === 'pricing') {
    requireFields_(row, ['temario', 'modalidad', 'vigenciaDesde', 'vigenciaHasta'], errors);
    validateDatePair_(row.vigenciaDesde, row.vigenciaHasta, 'vigencia de precio', errors);
    ['precioLista', 'precioContado', 'precioPlan'].forEach(function(key) {
      if (number_(row[key]) <= 0) errors.push(key + ' debe ser mayor a 0');
    });
  }

  if (type === 'promotions') {
    requireFields_(row, ['nombrePromo', 'vigenciaDesde', 'vigenciaHasta', 'beneficio'], errors);
    validateDatePair_(row.vigenciaDesde, row.vigenciaHasta, 'vigencia de promocion', errors);
  }

  return errors;
}

function validateDuplicateCourseIds_(courses, issues) {
  const seen = {};

  courses.forEach(function(row, index) {
    if (!row.courseId) return;
    if (seen[row.courseId]) {
      issues.push(issue_('courses', index + 2, 'courseId duplicado: ' + row.courseId));
      return;
    }
    seen[row.courseId] = true;
  });
}

function validatePricingRanges_(pricing, issues) {
  const groups = {};

  pricing
    .filter(function(row) { return isActive_(row.activo); })
    .forEach(function(row, index) {
      const key = [row.temario, row.modalidad].join('|');
      if (!groups[key]) groups[key] = [];
      groups[key].push({
        rowNumber: index + 2,
        from: formatDate_(row.vigenciaDesde),
        to: formatDate_(row.vigenciaHasta),
      });
    });

  Object.keys(groups).forEach(function(key) {
    const ranges = groups[key].sort(function(a, b) {
      return a.from < b.from ? -1 : a.from > b.from ? 1 : 0;
    });

    for (var i = 1; i < ranges.length; i++) {
      if (ranges[i].from <= ranges[i - 1].to) {
        issues.push(issue_('pricing', ranges[i].rowNumber, 'vigencia traslapada para ' + key));
      }
    }
  });
}

function ensureSheet_(type) {
  validateType_(type);

  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const sheetName = SHEETS[type];
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  ensureHeaders_(sheet, HEADERS[type]);
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }

  const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(function(header) {
    return String(header || '').trim();
  });
  const existing = {};

  current.forEach(function(header) {
    if (header) existing[header] = true;
  });

  const missing = headers.filter(function(header) {
    return !existing[header];
  });

  if (missing.length) {
    sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }
}

function readRows_(type) {
  const sheet = ensureSheet_(type);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return [];

  const headers = values[0].map(function(header) {
    return String(header || '').trim();
  });

  return values.slice(1).map(function(row) {
    const obj = {};
    headers.forEach(function(header, index) {
      if (header) obj[header] = row[index];
    });
    return obj;
  });
}

function requireFields_(row, fields, errors) {
  fields.forEach(function(field) {
    if (!clean_(row[field])) errors.push(field + ' es obligatorio');
  });
}

function validateDatePair_(from, to, label, errors) {
  const start = formatDate_(from);
  const end = formatDate_(to);

  if (!start || !end) {
    errors.push(label + ' incompleta');
    return;
  }

  if (start > end) {
    errors.push(label + ' tiene fecha final anterior a fecha inicial');
  }
}

function issue_(type, rowNumber, message) {
  return {
    type: type,
    rowNumber: rowNumber,
    message: message,
  };
}

function normalizeKey_(value) {
  return clean_(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function buildCourseId_(temario, campus, date, days, schedule, modality) {
  return buildSlug_([temario, campus, date, days, schedule, modality].join('-'));
}

function validateType_(type) {
  if (!HEADERS[type] || !SHEETS[type]) {
    throw new Error('Tipo de catalogo no reconocido: ' + type);
  }
}

function validateConfig_() {
  validateSheetConfig_();

  if (!ADMIN_TOKEN || ADMIN_TOKEN === 'CAMBIA_ESTA_CLAVE') {
    throw new Error('Configura ADMIN_TOKEN antes de desplegar CatalogManagerApi.gs.');
  }
}

function validateSheetConfig_() {
  if (!SHEET_ID || SHEET_ID === 'PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET') {
    throw new Error('Configura SHEET_ID antes de desplegar CatalogManagerApi.gs.');
  }
}

function validateToken_(token) {
  if (String(token || '') !== ADMIN_TOKEN) {
    throw new Error('Clave de edicion invalida.');
  }
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

function buildSlug_(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function publicOutput_(payload, e) {
  const callback = clean_(e && e.parameter && e.parameter.callback);

  if (callback) {
    if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
      return jsonOutput_({ ok: false, message: 'Callback JSONP invalido.' });
    }

    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(payload) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return jsonOutput_(payload);
}
