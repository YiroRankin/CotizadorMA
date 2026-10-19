const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const pricingRules = JSON.parse(fs.readFileSync('data/pricing.json', 'utf8'));
const courseData = JSON.parse(fs.readFileSync('data/courses.json', 'utf8'));
const context = vm.createContext({ window: {}, pricingRules, courseData });
vm.runInContext(fs.readFileSync('js/quote.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('js/pdf.js', 'utf8'), context);

const app = context.window.CotizadorApp;
const course = courseData.UNAM.Virtual[0];
assert.equal(course.date, '2027-01-29');
assert.equal(course.endDate, '2027-05-12');
assert.equal(course.schedule, '16:00 a 20:30');
assert.equal(course.days, 'Lunes, miércoles y viernes');

app.state.quoteData = { syllabus: 'UNAM', campus: 'Virtual', courseId: course.id };
const price = app.findPricing('UNAM', 'Virtual', '2026-10-19');
assert.equal(price.listPrice, 7800);
assert.equal(price.installment, 5460);
assert.equal(price.installmentDiscount, 30);
assert.equal(app.findPricing('UNAM', 'Virtual', '2027-01-31').installment, 5460);
assert.equal(app.findPricing('UNAM', 'Virtual', '2027-02-01'), null);
assert.equal(app.shouldHideCashPaymentOption('UNAM', 'Virtual'), true);
assert.equal(app.getAlternativeCourses().length, 0);
assert.equal((price.installment - 1500) / 3, 1320);

const html = app.buildPrintableQuoteHtml({
  studentName: 'Alumno de prueba', temario: 'UNAM', campus: 'Virtual', modality: 'Virtual',
  start: '29/01/2027', end: '12/05/2027', schedule: course.schedule, days: course.days,
  issueDate: '19/10/2026', validity: 'Vigencia hasta el 31/10/2026',
  specialist: { name: 'Especialista', whatsappUrl: '#' },
  copy: { hero: 'Curso UNAM virtual', intro: 'Propuesta UNAM', highlight: 'Plan con 30% de descuento' },
  pricing: {
    list: '$7,800.00', cash: '$0.00', cashDiscount: '0%', plan: '$5,460.00',
    planDiscount: '30% de descuento', planVigencia: 'Octubre 2026 - Enero 2027',
    inscription: '$1,500.00', paymentsLabel: '3 mensualidades', paymentAmount: '$1,320.00',
    msi3: '$2,600.00', msi6: '$1,300.00', msi9: '$866.67', msi12: '$650.00',
  },
  alternatives: [], hideAlternatives: true, hideCashPaymentOption: true,
  msiTerms: [3, 6], showDiagnostic: false,
});
assert.match(html, /<body class="single-course">/);
assert.match(html, /\.single-course \.alternatives-page \{ display: none; \}/);
assert.match(html, /3 MSI/);
assert.match(html, /6 MSI/);
assert.doesNotMatch(html, /9 MSI|12 MSI|Pago de contado|Curso propedéutico EXANI/);
console.log('PASS: UNAM virtual usa su tarifa, 3 y 6 MSI, sin contado ni alternativas visibles.');
