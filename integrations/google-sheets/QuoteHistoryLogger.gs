/**
 * Configura estas dos constantes antes de desplegar el Web App.
 */
const SHEET_ID = 'PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET';
const SHEET_NAME = 'HistorialCotizaciones';

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: 'Logger activo' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const payload = getPayload_(e);
    const sheet = getSheet_();
    ensureHeaders_(sheet);

    sheet.appendRow([
      new Date(),
      payload.createdAt || '',
      payload.source || '',
      payload.eventType || 'quote_generated',
      payload.studentName || '',
      payload.syllabus || '',
      payload.campus || '',
      payload.courseId || '',
      payload.courseName || '',
      payload.specialistName || '',
      payload.specialistPhone || '',
      payload.courseDate || '',
      payload.courseEndDate || '',
      payload.schedule || '',
      payload.days || '',
      payload.modality || '',
      payload.address || '',
      payload.locationUrl || '',
      payload.listPrice || 0,
      payload.cashPrice || 0,
      payload.cashDiscount || 0,
      payload.planPrice || 0,
      payload.planDiscount || 0,
      payload.planVigencia || '',
      payload.registration || 0,
      payload.numPayments || 0,
      payload.monthlyPayment || 0,
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getPayload_(e) {
  if (e && e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }

  if (e && e.postData && e.postData.contents) {
    return JSON.parse(e.postData.contents);
  }

  return {};
}

function getSheet_() {
  if (!SHEET_ID || SHEET_ID === 'PEGA_AQUI_EL_ID_DE_TU_GOOGLE_SHEET') {
    throw new Error('Configura la constante SHEET_ID antes de usar el logger.');
  }

  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
  return sheet;
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() > 0) return;

  sheet.appendRow([
    'timestampServidor',
    'createdAtCliente',
    'source',
    'eventType',
    'studentName',
    'syllabus',
    'campus',
    'courseId',
    'courseName',
    'specialistName',
    'specialistPhone',
    'courseDate',
    'courseEndDate',
    'schedule',
    'days',
    'modality',
    'address',
    'locationUrl',
    'listPrice',
    'cashPrice',
    'cashDiscount',
    'planPrice',
    'planDiscount',
    'planVigencia',
    'registration',
    'numPayments',
    'monthlyPayment',
  ]);
}
