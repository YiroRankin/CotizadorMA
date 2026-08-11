window.CotizadorApp = window.CotizadorApp || {};

(function (app) {
  const DEFAULT_CONFIG = {
    dataUrls: {
      pricing: "./data/pricing.json",
      specialists: "./data/specialists.json",
      courses: "./data/courses.json",
    },
    catalogApi: {
      enabled: false,
      endpointUrl: "",
      jsonpFallback: true,
    },
    capacityApi: {
      enabled: false,
      endpointUrl: "",
      timeoutMs: 8000,
    },
    quoteLogging: {
      enabled: false,
      endpointUrl: "",
    },
  };

  function getConfig() {
    return {
      ...DEFAULT_CONFIG,
      ...(window.COTIZADOR_CONFIG || {}),
      dataUrls: {
        ...DEFAULT_CONFIG.dataUrls,
        ...(window.COTIZADOR_CONFIG?.dataUrls || {}),
      },
      catalogApi: {
        ...DEFAULT_CONFIG.catalogApi,
        ...(window.COTIZADOR_CONFIG?.catalogApi || {}),
      },
      capacityApi: {
        ...DEFAULT_CONFIG.capacityApi,
        ...(window.COTIZADOR_CONFIG?.capacityApi || {}),
      },
      quoteLogging: {
        ...DEFAULT_CONFIG.quoteLogging,
        ...(window.COTIZADOR_CONFIG?.quoteLogging || {}),
      },
    };
  }

  async function loadJson(url, options = {}) {
    const response = await fetch(url, { cache: "no-store", ...options });
    if (!response.ok) {
      throw new Error(`No se pudo cargar ${url}`);
    }
    const data = await response.json();
    if (data && data.ok === false) {
      throw new Error(data.message || `El endpoint devolvió un error: ${url}`);
    }
    return data;
  }

  function loadJsonp(url, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const callbackName = `cotizadorCatalogCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      const cleanup = () => {
        delete window[callbackName];
        script.remove();
      };
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error(`No se pudo cargar ${url.toString()} por JSONP`));
      }, timeoutMs);

      window[callbackName] = (data) => {
        window.clearTimeout(timer);
        cleanup();

        if (data && data.ok === false) {
          reject(new Error(data.message || `El endpoint devolvio un error: ${url.toString()}`));
          return;
        }

        resolve(data);
      };

      url.searchParams.set("callback", callbackName);
      script.src = url.toString();
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timer);
        cleanup();
        reject(new Error(`No se pudo cargar ${url.toString()} por JSONP`));
      };

      document.head.appendChild(script);
    });
  }

  function hasObjectData(value) {
    return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
  }

  function hasArrayData(value) {
    return Array.isArray(value) && value.length > 0;
  }

  function clonePlain(value, fallback) {
    return JSON.parse(JSON.stringify(value || fallback));
  }

  function getCourseGroupId(course) {
    return String(course?.groupId || course?.capacityGroupId || "").trim();
  }

  function isCapacityDataFresh(capacityData) {
    const generatedAt = Date.parse(capacityData?.generatedAt || "");
    if (!Number.isFinite(generatedAt)) return false;

    const maxAgeMinutes = Number(capacityData?.policy?.maxAgeMinutes || 30);
    const maxAgeMs = Math.max(1, maxAgeMinutes) * 60 * 1000;
    return Date.now() - generatedAt <= maxAgeMs;
  }

  function buildCapacityMeta(group, capacityDataIsFresh) {
    if (!group) return null;
    const capacity = Number(group.capacity);
    const enrolled = Number(group.enrolled);
    const availablePlaces = Number(group.availablePlaces);
    const status = String(group.status || "unknown").toLowerCase().trim();

    return {
      groupId: group.groupId || "",
      groupName: group.groupName || "",
      capacity: Number.isFinite(capacity) ? capacity : 0,
      enrolled: Number.isFinite(enrolled) ? enrolled : 0,
      availablePlaces: Number.isFinite(availablePlaces) ? availablePlaces : null,
      status,
      statusReason: group.statusReason || "",
      countMethod: group.countMethod || "",
      fresh: capacityDataIsFresh,
      full: capacityDataIsFresh && (status === "full" || status === "over_capacity"),
    };
  }

  function applyCapacityToCourses(coursesCatalog, capacityData) {
    const groups = Array.isArray(capacityData?.groups) ? capacityData.groups : [];
    if (!groups.length) return coursesCatalog;

    const annotated = clonePlain(coursesCatalog, {});
    const capacityDataIsFresh = isCapacityDataFresh(capacityData);
    const groupById = new Map(groups.map((group) => [String(group.groupId || "").trim(), group]));

    Object.entries(annotated).forEach(([temario, campuses]) => {
      Object.entries(campuses || {}).forEach(([campus, courses]) => {
        if (!Array.isArray(courses)) return;

        courses.forEach((course) => {
          const groupId = getCourseGroupId(course);
          if (!groupId) return;

          const capacity = buildCapacityMeta(groupById.get(groupId), capacityDataIsFresh);
          if (!capacity) return;

          course.capacity = capacity;
          course.isClosedByCapacity = Boolean(capacity.full);
        });
      });
    });

    return annotated;
  }

  function getCourseKey(course) {
    if (!course) return "";
    return course.id || [course.name, course.date, course.days, course.schedule, course.modality].join("|");
  }

  function mergeCourseCatalogs(baseCatalog, apiCatalog) {
    const merged = clonePlain(baseCatalog, {});

    Object.entries(apiCatalog || {}).forEach(([syllabus, campuses]) => {
      if (!merged[syllabus]) merged[syllabus] = {};

      Object.entries(campuses || {}).forEach(([campus, courses]) => {
        if (!Array.isArray(courses)) return;
        if (!Array.isArray(merged[syllabus][campus])) merged[syllabus][campus] = [];

        const indexByKey = new Map(
          merged[syllabus][campus].map((course, index) => [getCourseKey(course), index])
        );

        courses.forEach((course) => {
          const key = getCourseKey(course);
          if (key && indexByKey.has(key)) {
            const previousCourse = merged[syllabus][campus][indexByKey.get(key)] || {};
            merged[syllabus][campus][indexByKey.get(key)] = {
              ...previousCourse,
              ...course,
              groupId: course.groupId || previousCourse.groupId,
              capacityGroupId: course.capacityGroupId || previousCourse.capacityGroupId,
            };
          } else {
            merged[syllabus][campus].push(course);
          }
        });
      });
    });

    return merged;
  }

  function getPricingKey(rule) {
    if (!rule) return "";
    return [rule.temario, rule.modality, rule.from, rule.to].join("|");
  }

  function mergePricingRules(baseRules, apiRules) {
    const byKey = new Map();

    (baseRules || []).forEach((rule) => {
      const key = getPricingKey(rule);
      if (key) byKey.set(key, rule);
    });

    (apiRules || []).forEach((rule) => {
      const key = getPricingKey(rule);
      if (key) byKey.set(key, rule);
    });

    return [...byKey.values()].sort((a, b) => {
      if (a.temario !== b.temario) return a.temario.localeCompare(b.temario, "es", { sensitivity: "base" });
      if (a.modality !== b.modality) return a.modality.localeCompare(b.modality, "es", { sensitivity: "base" });
      return a.from < b.from ? -1 : a.from > b.from ? 1 : 0;
    });
  }

  function getPromotionKey(promotion) {
    if (!promotion) return "";
    return promotion.id || [promotion.name, promotion.from, promotion.to, promotion.temario, promotion.campus, promotion.modality].join("|");
  }

  function mergePromotions(basePromotions, apiPromotions) {
    const byKey = new Map();

    (basePromotions || []).forEach((promotion) => {
      const key = getPromotionKey(promotion);
      if (key) byKey.set(key, promotion);
    });

    (apiPromotions || []).forEach((promotion) => {
      const key = getPromotionKey(promotion);
      if (key) byKey.set(key, promotion);
    });

    return [...byKey.values()].sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  }

  async function loadCatalogFromApi(config, type) {
    const endpointUrl = config.catalogApi?.endpointUrl;
    if (!(config.catalogApi?.enabled && endpointUrl)) return null;

    const url = new URL(endpointUrl);
    url.searchParams.set("type", type);
    url.searchParams.set("_ts", String(Date.now()));

    try {
      return await loadJson(url.toString());
    } catch (error) {
      if (!config.catalogApi?.jsonpFallback) throw error;
      console.warn(`No se pudo cargar ${type} con fetch. Intentando JSONP.`, error);
      return loadJsonp(url);
    }
  }

  async function loadCapacityFromApi(config) {
    const endpointUrl = config.capacityApi?.endpointUrl;
    if (!(config.capacityApi?.enabled && endpointUrl)) return null;

    if (typeof AbortController === "undefined") {
      return loadJson(endpointUrl);
    }

    const controller = new AbortController();
    const timeoutMs = Number(config.capacityApi?.timeoutMs || 8000);
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await loadJson(endpointUrl, { signal: controller.signal });
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function loadCatalogsFromStaticJson(config) {
    const [pricingData, specialistsData, coursesData] = await Promise.all([
      loadJson(config.dataUrls.pricing),
      loadJson(config.dataUrls.specialists),
      loadJson(config.dataUrls.courses),
    ]);

    return {
      pricing: pricingData,
      specialists: specialistsData,
      courses: coursesData,
      promotions: [],
    };
  }

  async function loadCatalogs(config) {
    const staticCatalogs = await loadCatalogsFromStaticJson(config);
    let apiCourses = null;
    let apiPricing = null;
    let apiPromotions = null;
    let capacityData = null;

    if (config.catalogApi?.enabled && config.catalogApi?.endpointUrl) {
      try {
        apiCourses = await loadCatalogFromApi(config, "courses");
      } catch (error) {
        console.warn("No se pudieron cargar cursos desde Sheets. Se usará respaldo JSON.", error);
      }

      try {
        apiPricing = await loadCatalogFromApi(config, "pricing");
      } catch (error) {
        console.warn("No se pudieron cargar precios desde Sheets. Se usará respaldo JSON.", error);
      }

      try {
        apiPromotions = await loadCatalogFromApi(config, "promotions");
      } catch (error) {
        console.warn("No se pudieron cargar promociones desde Sheets. Se continuará sin promociones dinámicas.", error);
      }
    }

    try {
      capacityData = await loadCapacityFromApi(config);
    } catch (error) {
      console.warn("No se pudo cargar la capacidad de grupos. Se mostraran todos los cursos.", error);
    }

    const mergedCourses = hasObjectData(apiCourses)
      ? mergeCourseCatalogs(staticCatalogs.courses, apiCourses)
      : staticCatalogs.courses;

    const catalogs = {
      pricing: hasArrayData(apiPricing) ? mergePricingRules(staticCatalogs.pricing, apiPricing) : staticCatalogs.pricing,
      specialists: staticCatalogs.specialists,
      courses: applyCapacityToCourses(mergedCourses, capacityData),
      promotions: hasArrayData(apiPromotions) ? mergePromotions(staticCatalogs.promotions, apiPromotions) : staticCatalogs.promotions,
    };

    window.pricingRules = catalogs.pricing || [];
    window.specialists = catalogs.specialists || {};
    window.courseData = catalogs.courses || {};
    window.promotions = catalogs.promotions || [];
    window.capacityData = capacityData || {};
  }

  function populateSpecialists() {
    const specialistSelect = document.getElementById("specialist");
    specialistSelect.innerHTML = '<option value="">Selecciona una especialista</option>';

    Object.keys(window.specialists || {})
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
      .forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        specialistSelect.appendChild(option);
      });
  }

  function updateSummary(quoteData, course) {
    document.getElementById("summary-name").textContent = quoteData.studentName;
    document.getElementById("summary-syllabus").textContent = quoteData.syllabus;
    document.getElementById("summary-campus").textContent = quoteData.campus;
    document.getElementById("summary-date").textContent = quoteData.courseName;
    document.getElementById("summary-schedule").textContent = course ? course.schedule : "-";
    document.getElementById("summary-days").textContent = course ? course.days : "-";
    document.getElementById("summary-modality").textContent = course ? course.modality : "-";
    document.getElementById("summary-address").textContent = course ? course.address : "-";
    document.getElementById("summary-specialist").textContent = quoteData.specialistName || "-";
    document.getElementById("summary-specialist-phone").textContent = quoteData.specialistPhone || "-";
  }

  function buildLogPayload(quoteData, course, currentPricing, planPricing, eventType) {
    const registration = parseFloat(document.getElementById("registration-fee").value || "0");
    const numPayments = parseInt(document.getElementById("num-payments").value || "0", 10);
    const customPlan = app.getCustomPlanSummary ? app.getCustomPlanSummary() : null;
    const remaining = Math.max(0, (planPricing?.installment || 0) - registration);
    const monthly = customPlan && customPlan.payments.length
      ? customPlan.payments[0].amount
      : remaining > 0 ? app.roundUpToNearest(remaining / Math.max(numPayments, 1), 100) : 0;

    return {
      createdAt: new Date().toISOString(),
      source: "github-pages",
      eventType: eventType || "quote_generated",
      studentName: quoteData.studentName,
      syllabus: quoteData.syllabus,
      campus: quoteData.campus,
      courseId: quoteData.courseId,
      courseName: quoteData.courseName,
      specialistName: quoteData.specialistName,
      specialistPhone: quoteData.specialistPhone,
      courseDate: course?.date || "",
      courseEndDate: course?.endDate || "",
      schedule: course?.schedule || "",
      days: course?.days || "",
      modality: course?.modality || "",
      address: course?.address || "",
      locationUrl: course?.locationUrl || "",
      listPrice: currentPricing?.listPrice || 0,
      cashPrice: currentPricing?.cash || 0,
      cashDiscount: currentPricing?.cashDiscount || 0,
      planPrice: planPricing?.installment || 0,
      planDiscount: planPricing?.installmentDiscount || 0,
      planVigencia: planPricing ? app.getMonthYearLabelFromRule(planPricing) : "",
      registration,
      numPayments: Math.max(numPayments || 1, 1),
      monthlyPayment: monthly,
      customPaymentSchedule: customPlan ? customPlan.paymentsText : "",
    };
  }

  function logEvent(config, eventType) {
    if (!(config.quoteLogging?.enabled && config.quoteLogging?.endpointUrl && app.sendQuoteLog)) {
      return;
    }

    if (!app.state.quoteData || !app.state.currentPricing) {
      return;
    }

    const course = app.getSelectedCourseDetails();
    const planPricing = app.getSelectedPlanPricing() || app.state.currentPricing;
    const payload = buildLogPayload(app.state.quoteData, course, app.state.currentPricing, planPricing, eventType);
    void app.sendQuoteLog(config.quoteLogging, payload);
  }

  function wireEvents(config) {
    const specialistSelect = document.getElementById("specialist");
    const syllabusSelect = document.getElementById("syllabus");
    const prioritySelect = document.getElementById("recommendation-priority");
    const helperSelect = document.getElementById("recommendation-helper");
    const campusSelect = document.getElementById("campus");
    const courseSelect = document.getElementById("course-date");
    const scheduleSelect = document.getElementById("course-schedule");
    const quoteForm = document.getElementById("quote-form");
    const quoteResults = document.getElementById("quote-results");
    const validityInput = document.getElementById("quote-validity-date");
    const registrationInput = document.getElementById("registration-fee");
    const numPaymentsInput = document.getElementById("num-payments");
    const planDiscountSelector = document.getElementById("plan-discount-selector");
    const exportBtn = document.getElementById("export-pdf");

    if (validityInput && !validityInput.value) {
      validityInput.value = app.getDefaultQuoteValidityDateIso ? app.getDefaultQuoteValidityDateIso() : "";
    }

    app.setRecommendationPriority(prioritySelect.value);

    syllabusSelect.addEventListener("change", () => {
      app.updateRecommendationHelper();
      app.updateCampusOptions();
      app.updateCourseOptions();
    });

    prioritySelect.addEventListener("change", () => {
      app.setRecommendationPriority(prioritySelect.value);
      app.updateRecommendationHelper();
      app.updateCampusOptions();
      app.updateCourseOptions();
    });

    helperSelect.addEventListener("change", () => {
      app.state.recommendationHelperValue = helperSelect.value || "";
      app.updateCampusOptions();
      app.updateCourseOptions();
    });

    campusSelect.addEventListener("change", () => {
      app.updateCourseOptions();
    });

    courseSelect.addEventListener("change", () => {
      app.updateScheduleOptions();
      app.updatePaymentLimits();
    });

    scheduleSelect.addEventListener("change", () => {
      app.updatePaymentLimits();
    });

    registrationInput.addEventListener("input", () => {
      app.calculateInstallments();
    });

    numPaymentsInput.addEventListener("input", () => {
      app.updatePaymentLimits();
      app.calculateInstallments();
    });

    planDiscountSelector.addEventListener("change", () => {
      app.state.selectedPlanPricing = app.getSelectedPlanPricing();
      app.updateDisplayPrices();
      app.calculateInstallments();
    });

    quoteForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const studentName = document.getElementById("student-name").value.trim();
      const syllabus = syllabusSelect.value;
      const campus = campusSelect.value;
      const courseOption = courseSelect.options[courseSelect.selectedIndex];
      const scheduleOption = scheduleSelect.options[scheduleSelect.selectedIndex];
      const specialistKey = specialistSelect.value;
      const specialist = window.specialists[specialistKey] || { name: specialistKey, phone: "" };

      if (!studentName || !specialistKey || !syllabus || !campus || !courseOption?.value || !scheduleOption?.value) {
        app.showToast("Completa todos los datos del formulario.", "error");
        return;
      }

      app.state.quoteData = {
        studentName,
        syllabus,
        campus,
        courseId: scheduleOption.value,
        courseName: courseOption.dataset.courseName || courseOption.textContent,
        specialistKey,
        specialistName: specialist.name || specialistKey,
        specialistPhone: specialist.phone || "",
      };

      const course = app.getSelectedCourseDetails();
      if (!course || !app.isCourseAvailable?.(course)) {
        app.showToast("Este grupo ya aparece como lleno. Selecciona otra opcion disponible.", "error");
        return;
      }

      updateSummary(app.state.quoteData, course);

      app.state.currentPricing = app.getPricingForQuote();
      if (!app.state.currentPricing) {
        app.showToast("No se encontró una regla de precio para esta combinación de temario, modalidad y fecha.", "error");
        return;
      }

      app.updatePlanDiscountOptions();
      app.updateDisplayPrices();
      quoteResults.classList.remove("hidden");
      app.calculateInstallments();

      logEvent(config, "quote_generated");
    });

    exportBtn.addEventListener("click", (e) => {
      e.preventDefault();
      logEvent(config, "pdf_generated");
      app.generatePDF();
    });
  }

  async function init() {
    const config = getConfig();

    try {
      await loadCatalogs(config);
      populateSpecialists();
      wireEvents(config);
    } catch (error) {
      console.error(error);
      app.showToast("No se pudieron cargar los catálogos del cotizador.", "error", 4500);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})(window.CotizadorApp);

(function (app) {
  const originalUpdateDisplayPrices = app.updateDisplayPrices;

  function clamp(value, min, max) {
    const number = parseInt(value || "0", 10);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, number));
  }

  function parseMoney(value) {
    const number = Number(String(value == null ? "" : value).replace(/[$,\s]/g, ""));
    return Number.isFinite(number) ? number : 0;
  }

  function getPlanPricing() {
    return app.getSelectedPlanPricing ? app.getSelectedPlanPricing() || app.state.currentPricing : app.state.currentPricing;
  }

  function getPlanTotal() {
    return Number(getPlanPricing()?.installment || 0);
  }

  function getRegistration() {
    return parseMoney(document.getElementById("registration-fee")?.value || 0);
  }

  function getNumPayments() {
    return clamp(document.getElementById("num-payments")?.value || 1, 1, 5);
  }

  function ensureCustomPlanUI() {
    const numPaymentsInput = document.getElementById("num-payments");
    const registrationInput = document.getElementById("registration-fee");
    if (!numPaymentsInput || !registrationInput) return false;

    registrationInput.min = "0";
    registrationInput.step = "100";
    numPaymentsInput.min = "1";
    numPaymentsInput.max = "5";
    numPaymentsInput.step = "1";

    const label = document.querySelector('label[for="num-payments"]');
    if (label) label.textContent = "Número de mensualidades (1 a 5)";

    const oldMonthly = document.getElementById("monthly-payment");
    const oldMonthlyBox = oldMonthly ? oldMonthly.closest(".rounded-2xl") : null;
    if (oldMonthlyBox) oldMonthlyBox.style.display = "none";

    const oldNote = oldMonthlyBox?.nextElementSibling;
    if (oldNote && oldNote.classList.contains("mini-copy")) {
      oldNote.textContent = "* La suma de inscripción y mensualidades no debe sobrepasar el total del plan de pagos.";
    }

    if (!document.getElementById("custom-payments-wrapper")) {
      const wrapper = document.createElement("div");
      wrapper.id = "custom-payments-wrapper";
      wrapper.innerHTML = `
        <label class="label-title !mb-1">Montos por mensualidad</label>
        <div id="custom-payments-container" class="grid gap-2"></div>
        <div id="custom-plan-summary" class="rounded-2xl border border-dashed border-[var(--ma-border-strong)] bg-white px-3 py-3 mt-3 mini-copy"></div>
        <p id="custom-plan-warning" class="hidden text-[11px] text-[var(--ma-err-text)] mt-1 font-semibold"></p>
      `;
      const numBlock = numPaymentsInput.closest("div");
      numBlock.insertAdjacentElement("afterend", wrapper);
    }

    if (!registrationInput.dataset.customPlanListener) {
      registrationInput.dataset.customPlanListener = "true";
      registrationInput.addEventListener("input", () => renderPaymentRows(true));
    }

    if (!numPaymentsInput.dataset.customPlanListener) {
      numPaymentsInput.dataset.customPlanListener = "true";
      numPaymentsInput.addEventListener("input", () => renderPaymentRows(true));
    }

    return true;
  }

  function buildDefaultPayments(total, registration, count) {
    const remaining = Math.max(0, total - registration);
    if (!count) return [];
    const base = Math.floor(remaining / count / 100) * 100;
    const payments = Array(count).fill(base);
    payments[count - 1] = Math.max(0, remaining - base * (count - 1));
    return payments;
  }

  function renderPaymentRows(reset = false) {
    if (!ensureCustomPlanUI()) return;

    const container = document.getElementById("custom-payments-container");
    const count = getNumPayments();
    const planTotal = getPlanTotal();
    const registration = getRegistration();
    const existing = Array.from(container.querySelectorAll(".custom-payment-amount")).map((input) => parseMoney(input.value));
    const shouldRebuild = reset || Number(container.dataset.count || 0) !== count || existing.length !== count;
    const values = shouldRebuild ? buildDefaultPayments(planTotal, registration, count) : existing;

    if (shouldRebuild) {
      container.innerHTML = "";
      values.forEach((amount, index) => {
        const row = document.createElement("div");
        row.className = "grid grid-cols-[1fr_120px] gap-2 items-center";
        row.innerHTML = `
          <span class="mini-copy font-semibold text-slate-700">Mensualidad ${index + 1}</span>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-700 font-semibold">$</span>
            <input type="number" class="custom-payment-amount field-control !py-3 text-xs" min="0" step="100" value="${amount}" data-index="${index}" />
          </div>
        `;
        container.appendChild(row);
      });
      container.dataset.count = String(count);

      container.querySelectorAll(".custom-payment-amount").forEach((input) => {
        input.addEventListener("input", () => app.calculateInstallments());
      });
    }

    app.calculateInstallments();
  }

  function getCustomPlanSummary() {
    ensureCustomPlanUI();
    const planTotal = getPlanTotal();
    const registration = getRegistration();
    const payments = Array.from(document.querySelectorAll(".custom-payment-amount")).map((input, index) => ({
      label: `Mensualidad ${index + 1}`,
      amount: parseMoney(input.value),
    }));
    const monthlyTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const capturedTotal = registration + monthlyTotal;
    const difference = planTotal - capturedTotal;
    const exceeds = capturedTotal > planTotal + 0.01;
    const paymentsText = payments.length
      ? payments.map((payment, index) => `${index + 1}) ${app.formatCurrencyMXN(payment.amount)}`).join(" · ")
      : "Sin mensualidades capturadas";

    return {
      planTotal,
      registration,
      payments,
      monthlyTotal,
      capturedTotal,
      difference,
      exceeds,
      paymentsText,
    };
  }

  function validateCustomPlan() {
    const summary = getCustomPlanSummary();
    const warning = document.getElementById("custom-plan-warning");
    const summaryBox = document.getElementById("custom-plan-summary");
    const paymentsError = document.getElementById("payments-error");
    const paymentsErrorText = document.getElementById("payments-error-text");
    const registrationError = document.getElementById("registration-error");
    const monthlySpan = document.getElementById("monthly-payment");

    if (monthlySpan) monthlySpan.textContent = app.formatCurrencyMXN(summary.monthlyTotal);
    if (registrationError) registrationError.classList.add("hidden");

    const differenceLabel = summary.exceeds
      ? `Excedente: ${app.formatCurrencyMXN(Math.abs(summary.difference))}`
      : `Disponible por asignar: ${app.formatCurrencyMXN(Math.max(0, summary.difference))}`;

    if (summaryBox) {
      summaryBox.innerHTML = `
        <div class="grid gap-1">
          <div>Total del plan: <strong>${app.formatCurrencyMXN(summary.planTotal)}</strong></div>
          <div>Total capturado: <strong>${app.formatCurrencyMXN(summary.capturedTotal)}</strong></div>
          <div>${differenceLabel}</div>
        </div>
      `;
    }

    if (summary.exceeds) {
      const message = "La inscripción y mensualidades no deben sobrepasar el total del plan.";
      if (warning) {
        warning.textContent = message;
        warning.classList.remove("hidden");
      }
      if (paymentsError && paymentsErrorText) {
        paymentsErrorText.textContent = message;
        paymentsError.classList.remove("hidden");
      }
      return false;
    }

    if (warning) warning.classList.add("hidden");
    if (paymentsError) paymentsError.classList.add("hidden");
    return true;
  }

  app.getCustomPlanSummary = getCustomPlanSummary;

  app.updatePaymentLimits = function () {
    ensureCustomPlanUI();
    validateCustomPlan();
  };

  app.calculateInstallments = function () {
    ensureCustomPlanUI();
    validateCustomPlan();
  };

  app.updateDisplayPrices = function () {
    if (typeof originalUpdateDisplayPrices === "function") originalUpdateDisplayPrices();
    renderPaymentRows(true);
  };

  app.generatePDF = function () {
    const { quoteData, currentPricing } = app.state;

    if (!quoteData) {
      app.showToast("Primero genera una cotización.", "error");
      return;
    }

    if (!currentPricing) {
      app.showToast("No se encontró información de precios para esta cotización.", "error");
      return;
    }

    const summary = getCustomPlanSummary();
    if (summary.exceeds) {
      app.showToast("Corrige el plan de pagos: el total capturado sobrepasa el monto del plan.", "error", 4200);
      return;
    }

    const course = app.getSelectedCourseDetails();
    const planPricing = getPlanPricing() || currentPricing;
    const showDiagnostic = app.shouldShowCashDiagnosticBenefit(currentPricing);
    const onlySixMSI = quoteData.syllabus === "EXANI I";
    const today = new Date();
    const issueDate = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
    const validity = app.getQuoteValidityLabel ? app.getQuoteValidityLabel() : "";
    const specialistWhatsapp = quoteData.specialistPhone ? `https://wa.me/52${quoteData.specialistPhone}` : "#";

    const alternativeCourses = app.getAlternativeCourses(3).map((alt) => ({
      title: app.formatCourseDisplayName(alt.name),
      sub: app.buildAlternativeSubtitle(quoteData.syllabus, alt.modality, alt.campus),
      note: app.getCashDiscountNoticeForCampus ? app.getCashDiscountNoticeForCampus(alt.campus, quoteData.syllabus) : "",
      days: alt.days || "-",
      schedule: alt.schedule || "-",
      start: app.formatIsoToDMY(alt.date) || "-",
      end: app.formatIsoToDMY(alt.endDate) || "-",
    }));

    const pendingText = summary.difference > 0.01 ? ` · Pendiente por asignar: ${app.formatCurrencyMXN(summary.difference)}` : "";

    const printData = {
      studentName: quoteData.studentName || "Alumno(a)",
      temario: quoteData.syllabus || "-",
      campus: quoteData.campus || "-",
      modality: course ? course.modality : "-",
      start: course ? app.formatIsoToDMY(course.date) : "-",
      end: course ? app.formatIsoToDMY(course.endDate) : "-",
      schedule: course ? course.schedule || "-" : "-",
      days: course ? course.days || "-" : "-",
      issueDate,
      validity,
      specialist: {
        name: quoteData.specialistName || "Especialista académica",
        whatsappUrl: specialistWhatsapp,
      },
      copy: {
        hero: "Curso propedéutico EXANI diseñado para impulsar la mejor decisión de inscripción.",
        intro: "Le compartimos una propuesta clara y flexible para su curso de preparación EXANI, con esquemas de pago y beneficios vigentes.",
        highlight: "Por disponibilidad y estructura de beneficios, esta propuesta prioriza el mejor valor inmediato y una lectura simple de los costos.",
      },
      pricing: {
        list: app.formatCurrencyMXN(currentPricing.listPrice),
        cash: app.formatCurrencyMXN(currentPricing.cash),
        cashDiscount: currentPricing.cashDiscountExcluded ? "Sin descuento de contado" : `${currentPricing.cashDiscount || 0}% de descuento`,
        plan: app.formatCurrencyMXN(planPricing.installment),
        planDiscount: `${planPricing.installmentDiscount || 0}% de descuento`,
        planVigencia: app.getMonthYearLabelFromRule(planPricing),
        inscription: app.formatCurrencyMXN(summary.registration),
        paymentsLabel: "Mensualidades capturadas",
        paymentAmount: `${summary.paymentsText}${pendingText}`,
        msi6: app.formatCurrencyMXN((currentPricing.listPrice || 0) / 6),
        msi9: app.formatCurrencyMXN((currentPricing.listPrice || 0) / 9),
        msi12: app.formatCurrencyMXN((currentPricing.listPrice || 0) / 12),
      },
      alternatives: alternativeCourses,
      noCashDiscountNotice: currentPricing.cashDiscountNotice || "",
      showDiagnostic,
      onlySixMSI,
    };

    const html = app.buildPrintableQuoteHtml(printData);
    const previewWindow = window.open("", "_blank");

    if (!previewWindow) {
      app.showToast("Tu navegador bloqueó la nueva ventana. Permite pop-ups para abrir la vista del PDF.", "error", 4500);
      return;
    }

    previewWindow.document.open();
    previewWindow.document.write(html);
    previewWindow.document.close();
    previewWindow.focus();
    app.showToast("Se abrió la vista premium para guardar como PDF.", "success", 3500);
  };

  document.addEventListener("DOMContentLoaded", () => {
    ensureCustomPlanUI();
    renderPaymentRows(true);
  });
})(window.CotizadorApp);
