const AdminApp = (() => {
  const state = {
    rows: [],
    filteredRows: [],
    charts: {},
  };

  const els = {};
  const CHART_COLORS = {
    purple: '#4b3fb4',
    purpleSoft: 'rgba(75, 63, 180, 0.18)',
    yellow: '#f4d000',
    yellowSoft: 'rgba(244, 208, 0, 0.22)',
    grid: 'rgba(24, 34, 48, 0.10)',
    tick: '#667085',
  };

  function qs(id) {
    return document.getElementById(id);
  }

  function bindElements() {
    els.lastUpdated = qs('last-updated');
    els.filterPeriod = qs('filter-period');
    els.filterSpecialist = qs('filter-specialist');
    els.filterSyllabus = qs('filter-syllabus');
    els.filterCampus = qs('filter-campus');
    els.filterSearch = qs('filter-search');
    els.refreshBtn = qs('refresh-btn');
    els.kpiQuotes = qs('kpi-quotes');
    els.kpiPdfs = qs('kpi-pdfs');
    els.kpiRate = qs('kpi-rate');
    els.kpiSpecialists = qs('kpi-specialists');
    els.summarySpecialistsBody = qs('summary-specialists-body');
    els.historyBody = qs('history-body');
    els.historyCount = qs('history-count');
    els.downloadCsv = qs('download-csv');
    els.emptyRowTemplate = qs('empty-row-template');
  }

  async function loadHistory() {
    const endpointUrl = window.ADMIN_APP_CONFIG?.historyEndpointUrl;
    if (!endpointUrl) {
      throw new Error('Configura historyEndpointUrl en admin/config.js');
    }

    const url = new URL(endpointUrl);
    url.searchParams.set('mode', 'history');
    url.searchParams.set('limit', '2000');
    url.searchParams.set('_ts', String(Date.now()));

    const response = await fetch(url.toString(), { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('No se pudo leer el histórico del panel.');
    }

    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.message || 'El endpoint devolvió un error.');
    }

    state.rows = (data.rows || []).map(normalizeRow);
    state.filteredRows = [...state.rows];
  }

  function normalizeRow(row) {
    return {
      timestampServidor: row.timestampServidor || '',
      createdAtCliente: row.createdAtCliente || '',
      source: row.source || '',
      eventType: row.eventType || 'quote_generated',
      studentName: row.studentName || '',
      syllabus: row.syllabus || '',
      campus: row.campus || '',
      courseId: row.courseId || '',
      courseName: row.courseName || '',
      specialistName: row.specialistName || '',
      specialistPhone: row.specialistPhone || '',
      courseDate: row.courseDate || '',
      courseEndDate: row.courseEndDate || '',
      schedule: row.schedule || '',
      days: row.days || '',
      modality: row.modality || '',
      address: row.address || '',
      locationUrl: row.locationUrl || '',
      listPrice: Number(row.listPrice || 0),
      cashPrice: Number(row.cashPrice || 0),
      cashDiscount: Number(row.cashDiscount || 0),
      planPrice: Number(row.planPrice || 0),
      planDiscount: Number(row.planDiscount || 0),
      planVigencia: row.planVigencia || '',
      registration: Number(row.registration || 0),
      numPayments: Number(row.numPayments || 0),
      monthlyPayment: Number(row.monthlyPayment || 0),
      customPaymentSchedule: row.customPaymentSchedule || '',
      dateObj: row.timestampServidor ? new Date(row.timestampServidor) : null,
    };
  }

  function fillSelect(select, values, defaultLabel = 'Todos') {
    const current = select.value;
    select.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = 'all';
    defaultOption.textContent = defaultLabel;
    select.appendChild(defaultOption);

    values.forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });

    if ([...select.options].some((opt) => opt.value === current)) {
      select.value = current;
    }
  }

  function populateFilters() {
    const specialists = uniqueSorted(state.rows.map((row) => row.specialistName).filter(Boolean));
    const syllabi = uniqueSorted(state.rows.map((row) => row.syllabus).filter(Boolean));
    const campuses = uniqueSorted(state.rows.map((row) => row.campus).filter(Boolean));

    fillSelect(els.filterSpecialist, specialists, 'Todas');
    fillSelect(els.filterSyllabus, syllabi, 'Todos');
    fillSelect(els.filterCampus, campuses, 'Todos');
  }

  function uniqueSorted(values) {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }

  function applyFilters() {
    const period = els.filterPeriod.value;
    const specialist = els.filterSpecialist.value;
    const syllabus = els.filterSyllabus.value;
    const campus = els.filterCampus.value;
    const search = (els.filterSearch.value || '').trim().toLowerCase();

    const now = new Date();

    state.filteredRows = state.rows.filter((row) => {
      if (period !== 'all' && row.dateObj) {
        const days = Number(period);
        const threshold = new Date(now);
        threshold.setHours(0, 0, 0, 0);
        threshold.setDate(threshold.getDate() - days);
        if (row.dateObj < threshold) return false;
      }

      if (specialist !== 'all' && row.specialistName !== specialist) return false;
      if (syllabus !== 'all' && row.syllabus !== syllabus) return false;
      if (campus !== 'all' && row.campus !== campus) return false;
      if (search && !row.studentName.toLowerCase().includes(search)) return false;

      return true;
    });
  }

  function getSummary() {
    const quotes = state.filteredRows.filter((row) => row.eventType === 'quote_generated');
    const pdfs = state.filteredRows.filter((row) => row.eventType === 'pdf_generated');
    const specialists = new Set(state.filteredRows.map((row) => row.specialistName).filter(Boolean));

    return {
      quotes,
      pdfs,
      quotesCount: quotes.length,
      pdfsCount: pdfs.length,
      rate: quotes.length ? pdfs.length / quotes.length : 0,
      activeSpecialists: specialists.size,
    };
  }

  function renderKpis() {
    const summary = getSummary();
    els.kpiQuotes.textContent = formatNumber(summary.quotesCount);
    els.kpiPdfs.textContent = formatNumber(summary.pdfsCount);
    els.kpiRate.textContent = formatPercent(summary.rate);
    els.kpiSpecialists.textContent = formatNumber(summary.activeSpecialists);
  }

  function renderLastUpdated() {
    const maxDate = state.rows
      .map((row) => row.dateObj)
      .filter(Boolean)
      .sort((a, b) => b - a)[0];

    els.lastUpdated.textContent = maxDate ? formatDateTime(maxDate) : 'Sin datos';
  }

  function groupByKey(rows, key) {
    const map = new Map();
    rows.forEach((row) => {
      const value = row[key] || 'Sin dato';
      map.set(value, (map.get(value) || 0) + 1);
    });
    return map;
  }

  function getSpecialistSummaryRows() {
    const quotes = state.filteredRows.filter((row) => row.eventType === 'quote_generated');
    const pdfs = state.filteredRows.filter((row) => row.eventType === 'pdf_generated');

    const specialists = uniqueSorted(state.filteredRows.map((row) => row.specialistName).filter(Boolean));

    return specialists.map((name) => {
      const quoteCount = quotes.filter((row) => row.specialistName === name).length;
      const pdfCount = pdfs.filter((row) => row.specialistName === name).length;
      const latest = state.filteredRows
        .filter((row) => row.specialistName === name)
        .map((row) => row.dateObj)
        .filter(Boolean)
        .sort((a, b) => b - a)[0];

      return {
        name,
        quoteCount,
        pdfCount,
        rate: quoteCount ? pdfCount / quoteCount : 0,
        latest,
      };
    }).sort((a, b) => b.quoteCount - a.quoteCount || b.pdfCount - a.pdfCount);
  }

  function renderSpecialistsTable() {
    const rows = getSpecialistSummaryRows();
    els.summarySpecialistsBody.innerHTML = '';

    if (!rows.length) {
      const empty = els.emptyRowTemplate.content.cloneNode(true);
      const td = empty.querySelector('td');
      td.colSpan = 5;
      els.summarySpecialistsBody.appendChild(empty);
      return;
    }

    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-4 py-3 font-medium text-slate-800">${escapeHtml(row.name)}</td>
        <td class="px-4 py-3 text-right text-slate-700">${formatNumber(row.quoteCount)}</td>
        <td class="px-4 py-3 text-right text-slate-700">${formatNumber(row.pdfCount)}</td>
        <td class="px-4 py-3 text-right text-slate-700">${formatPercent(row.rate)}</td>
        <td class="px-4 py-3 text-slate-500">${row.latest ? formatDateTime(row.latest) : '—'}</td>
      `;
      els.summarySpecialistsBody.appendChild(tr);
    });
  }

  function renderHistoryTable() {
    els.historyBody.innerHTML = '';
    const rows = [...state.filteredRows].sort((a, b) => (b.dateObj || 0) - (a.dateObj || 0)).slice(0, 200);
    els.historyCount.textContent = `${formatNumber(state.filteredRows.length)} registros`;

    if (!rows.length) {
      els.historyBody.appendChild(els.emptyRowTemplate.content.cloneNode(true));
      return;
    }

    rows.forEach((row) => {
      const badgeClass = row.eventType === 'pdf_generated' ? 'badge badge--pdf' : 'badge badge--quote';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-4 py-3 text-slate-500 whitespace-nowrap">${row.dateObj ? formatDateTime(row.dateObj) : '—'}</td>
        <td class="px-4 py-3"><span class="${badgeClass}">${escapeHtml(row.eventType)}</span></td>
        <td class="px-4 py-3 font-medium text-slate-800">${escapeHtml(row.studentName || '—')}</td>
        <td class="px-4 py-3 text-slate-700">${escapeHtml(row.specialistName || '—')}</td>
        <td class="px-4 py-3 text-slate-700">${escapeHtml(row.syllabus || '—')}</td>
        <td class="px-4 py-3 text-slate-700">${escapeHtml(row.campus || '—')}</td>
        <td class="px-4 py-3 text-slate-700">${escapeHtml(row.courseName || '—')}</td>
        <td class="px-4 py-3 text-slate-700">${escapeHtml(row.modality || '—')}</td>
      `;
      els.historyBody.appendChild(tr);
    });
  }

  function baseChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: CHART_COLORS.tick, font: { family: 'Montserrat' } } } },
      scales: {
        x: { beginAtZero: true, ticks: { color: CHART_COLORS.tick, font: { family: 'Montserrat' } }, grid: { color: CHART_COLORS.grid } },
        y: { beginAtZero: true, ticks: { color: CHART_COLORS.tick, font: { family: 'Montserrat' } }, grid: { color: CHART_COLORS.grid } },
      },
    };
  }

  function upsertChart(key, canvasId, config) {
    if (state.charts[key]) {
      state.charts[key].destroy();
    }
    const ctx = qs(canvasId).getContext('2d');
    state.charts[key] = new Chart(ctx, config);
  }

  function renderCharts() {
    const specialistRows = getSpecialistSummaryRows().slice(0, 8);
    const specialistOptions = baseChartOptions();
    specialistOptions.indexAxis = 'y';
    upsertChart('specialists', 'chart-specialists', {
      type: 'bar',
      data: {
        labels: specialistRows.map((row) => row.name),
        datasets: [
          { label: 'Cotizaciones', data: specialistRows.map((row) => row.quoteCount), backgroundColor: CHART_COLORS.purple, borderColor: CHART_COLORS.purple, borderWidth: 0, borderRadius: 8 },
          { label: 'PDFs', data: specialistRows.map((row) => row.pdfCount), backgroundColor: CHART_COLORS.yellow, borderColor: CHART_COLORS.yellow, borderWidth: 0, borderRadius: 8 },
        ],
      },
      options: specialistOptions,
    });

    const quoteRows = state.filteredRows.filter((row) => row.eventType === 'quote_generated');
    const campusMap = groupByKey(quoteRows, 'campus');
    const campusLabels = [...campusMap.keys()];
    const campusData = [...campusMap.values()];
    const campusOptions = baseChartOptions();
    campusOptions.plugins.legend.display = false;
    upsertChart('campus', 'chart-campus', {
      type: 'bar',
      data: { labels: campusLabels, datasets: [{ label: 'Cotizaciones', data: campusData, backgroundColor: CHART_COLORS.purple, borderColor: CHART_COLORS.purple, borderWidth: 0, borderRadius: 10 }] },
      options: campusOptions,
    });

    const syllabusMap = groupByKey(quoteRows, 'syllabus');
    upsertChart('syllabus', 'chart-syllabus', {
      type: 'doughnut',
      data: {
        labels: [...syllabusMap.keys()],
        datasets: [{ data: [...syllabusMap.values()], backgroundColor: [CHART_COLORS.purple, CHART_COLORS.yellow], borderColor: ['#ffffff', '#ffffff'], borderWidth: 3 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: CHART_COLORS.tick, font: { family: 'Montserrat' } } } },
      },
    });

    const dailyMap = new Map();
    state.filteredRows.forEach((row) => {
      if (!row.dateObj) return;
      const key = row.dateObj.toISOString().slice(0, 10);
      const current = dailyMap.get(key) || { quote_generated: 0, pdf_generated: 0 };
      current[row.eventType] = (current[row.eventType] || 0) + 1;
      dailyMap.set(key, current);
    });
    const dailyLabels = [...dailyMap.keys()].sort();
    const dailyOptions = baseChartOptions();
    upsertChart('daily', 'chart-daily', {
      type: 'line',
      data: {
        labels: dailyLabels,
        datasets: [
          { label: 'Cotizaciones', data: dailyLabels.map((label) => dailyMap.get(label)?.quote_generated || 0), tension: 0.3, borderColor: CHART_COLORS.purple, backgroundColor: CHART_COLORS.purpleSoft, fill: false },
          { label: 'PDFs', data: dailyLabels.map((label) => dailyMap.get(label)?.pdf_generated || 0), tension: 0.3, borderColor: CHART_COLORS.yellow, backgroundColor: CHART_COLORS.yellowSoft, fill: false },
        ],
      },
      options: dailyOptions,
    });
  }

  function downloadCsv() {
    const headers = [
      'timestampServidor',
      'eventType',
      'studentName',
      'specialistName',
      'syllabus',
      'campus',
      'courseName',
      'modality',
      'registration',
      'numPayments',
      'monthlyPayment',
      'customPaymentSchedule',
    ];
    const lines = [headers.join(',')];

    state.filteredRows.forEach((row) => {
      const values = headers.map((key) => csvEscape(row[key] || ''));
      lines.push(values.join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'panel-cotizador-historial.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function csvEscape(value) {
    const safe = String(value).replace(/"/g, '""');
    return `"${safe}"`;
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString('es-MX');
  }

  function formatPercent(value) {
    return `${Math.round((Number(value || 0) * 100) * 10) / 10}%`;
  }

  function formatDateTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  function attachEvents() {
    [els.filterPeriod, els.filterSpecialist, els.filterSyllabus, els.filterCampus].forEach((el) => {
      el.addEventListener('change', render);
    });
    els.filterSearch.addEventListener('input', render);
    els.refreshBtn.addEventListener('click', async () => {
      await boot(true);
    });
    els.downloadCsv.addEventListener('click', downloadCsv);
  }

  function render() {
    applyFilters();
    renderKpis();
    renderSpecialistsTable();
    renderHistoryTable();
    renderCharts();
  }

  async function boot(forceReload = false) {
    try {
      if (forceReload || !state.rows.length) {
        await loadHistory();
        populateFilters();
        renderLastUpdated();
      }
      render();
    } catch (error) {
      console.error(error);
      alert(error.message || 'No se pudo cargar el panel.');
    }
  }

  async function init() {
    bindElements();
    attachEvents();
    await boot();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  AdminApp.init();
});
