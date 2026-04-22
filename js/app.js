window.CotizadorApp = window.CotizadorApp || {};

(function (app) {
  const DEFAULT_CONFIG = {
    dataUrls: {
      pricing: "./data/pricing.json",
      specialists: "./data/specialists.json",
      courses: "./data/courses.json",
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
    return response.json();
  }

  async function loadCatalogs(config) {
    const [pricingData, specialistsData, coursesData] = await Promise.all([
      loadJson(config.dataUrls.pricing),
      loadJson(config.dataUrls.specialists),
      loadJson(config.dataUrls.courses),
    ]);

    window.pricingRules = pricingData;
    window.specialists = specialistsData;
    window.courseData = coursesData;
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
