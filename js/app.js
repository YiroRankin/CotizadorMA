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
      quoteLogging: {
        ...DEFAULT_CONFIG.quoteLogging,
        ...(window.COTIZADOR_CONFIG?.quoteLogging || {}),
      },
    };
  }

  async function loadJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`No se pudo cargar ${url}`);
    }
    const data = await response.json();
    if (data && data.ok === false) {
      throw new Error(data.message || `El endpoint devolvió un error: ${url}`);
    }
    return data;
  }

  function hasObjectData(value) {
    return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
  }

  function hasArrayData(value) {
    return Array.isArray(value) && value.length > 0;
  }

  async function loadCatalogFromApi(config, type) {
    const endpointUrl = config.catalogApi?.endpointUrl;
    if (!(config.catalogApi?.enabled && endpointUrl)) return null;

    const url = new URL(endpointUrl);
    url.searchParams.set("type", type);
    url.searchParams.set("_ts", String(Date.now()));

    return loadJson(url.toString());
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

    const catalogs = {
      pricing: hasArrayData(apiPricing) ? apiPricing : staticCatalogs.pricing,
      specialists: staticCatalogs.specialists,
      courses: hasObjectData(apiCourses) ? apiCourses : staticCatalogs.courses,
      promotions: hasArrayData(apiPromotions) ? apiPromotions : staticCatalogs.promotions,
    };

    window.pricingRules = catalogs.pricing || [];
    window.specialists = catalogs.specialists || {};
    window.courseData = catalogs.courses || {};
    window.promotions = catalogs.promotions || [];
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
    const remaining = Math.max(0, (planPricing?.installment || 0) - registration);
    const monthly = remaining > 0 ? app.roundUpToNearest(remaining / Math.max(numPayments, 1), 100) : 0;

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
    const registrationInput = document.getElementById("registration-fee");
    const numPaymentsInput = document.getElementById("num-payments");
    const planDiscountSelector = document.getElementById("plan-discount-selector");
    const exportBtn = document.getElementById("export-pdf");

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
