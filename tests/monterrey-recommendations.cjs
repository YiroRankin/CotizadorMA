const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const courseData = JSON.parse(fs.readFileSync('data/courses.json', 'utf8'));
const context = vm.createContext({ window: {}, courseData, Intl, Date });
vm.runInContext(fs.readFileSync('js/quote.js', 'utf8'), context);
const app = context.window.CotizadorApp;
const all = Object.entries(courseData['EXANI II']).flatMap(([campus, rows]) => rows.map(c => ({ ...c, campus })));
const run = (date, courses = all, selected = '') => Array.from(app.getMonterreyAlternatives(courses, selected, new Date(date)));
const dates = result => result.map(c => c.date);
assert.deepEqual(dates(run('2026-09-28T12:00:00Z')), ['2027-01-16', '2026-10-01', '2026-11-14']);
assert.deepEqual(dates(run('2026-10-01T06:00:00Z')), ['2027-01-16', '2026-11-14', '2026-12-02', '2026-12-02']);
assert.deepEqual(dates(run('2026-10-01T05:59:59Z')), ['2027-01-16', '2026-10-01', '2026-11-14']);
assert.deepEqual(dates(run('2026-11-15T12:00:00Z')), ['2027-01-16', '2026-12-02', '2026-12-02', '2027-01-16']);
assert.deepEqual(dates(run('2026-12-15T12:00:00Z')), ['2027-01-16', '2027-01-16']);
assert.equal(run('2027-01-17T12:00:00Z').length, 0);
assert.equal(run('2027-02-01T12:00:00Z').length, 0); // Nunca agrega virtuales de marzo.
const january = all.find(c => c.campus === 'Monterrey' && c.date === '2027-01-16');
assert.equal(run('2026-10-15T12:00:00Z', all, january.id).length, 3);
assert.equal(run('2026-10-15T12:00:00Z', all.map(c => ({ ...c, isClosedByCapacity: true }))).length, 0);
// La excepción se aplica incluso con prioridad de campus y no usa la fecha del curso elegido como límite inferior.
app.state.quoteData = { syllabus: 'EXANI II', campus: 'Monterrey', courseId: january.id };
app.state.recommendationPriority = 'campus';
class SeptemberDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-09-28T12:00:00Z'])); } }
context.Date = SeptemberDate;
assert.deepEqual(dates(Array.from(app.getAlternativeCourses(3))), ['2026-10-01', '2026-11-14']);
app.state.quoteData = { syllabus: 'EXANI II', campus: 'Virtual', courseId: 'course_010' };
assert(Array.from(app.getAlternativeCourses(3)).every(c => c.campus === 'Virtual'));
console.log('PASS: rotación mensual, ambos turnos, límite de año, zona horaria, cupos, selección y otros campus.');
