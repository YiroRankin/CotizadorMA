const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const pricingRules = JSON.parse(fs.readFileSync('data/pricing.json', 'utf8'));
const courseData = JSON.parse(fs.readFileSync('data/courses.json', 'utf8'));
class QuoteDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-09-28T12:00:00Z'])); } }
const context = vm.createContext({window: {}, pricingRules, courseData, Date: QuoteDate});
vm.runInContext(fs.readFileSync('js/quote.js', 'utf8'), context);
const app = context.window.CotizadorApp;
for (const course of courseData['EXANI II'].Monterrey) {
  app.state.quoteData = {syllabus: 'EXANI II', campus: 'Monterrey', courseId: course.id};
  const price = app.getPricingForQuote();
  assert.equal(price.cash, 6900);
  assert.equal(price.installment, 8625);
}
for (const syllabus of ['EXANI I', 'EXANI II']) {
  for (const modality of ['Presencial', 'Virtual']) {
    assert(app.findPricing(syllabus, modality, '2026-09-28'));
    assert(app.findPricing(syllabus, modality, '2026-10-31'));
  }
}
assert(app.findPricing('EXANI II', 'Presencial', '2026-11-30'));
assert.equal(app.findPricing('EXANI II', 'Presencial', '2026-12-01'), null);
assert.equal(app.findPricing('EXANI I', 'Virtual', '2026-11-01'), null);
console.log('PASS: Monterrey noviembre y enero cotizan con respaldo vigente; no se extienden tarifas vencidas.');
