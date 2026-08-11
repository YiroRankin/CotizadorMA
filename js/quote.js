window.CotizadorApp = window.CotizadorApp || {};

(function (app) {
  const state = app.state || {
    quoteData: null,
    currentPricing: null,
    planPricingOptions: [],
    selectedPlanPricing: null,
    recommendationPriority: "none",
    recommendationHelperValue: "",
  };

  app.state = state;

  const CASH_DISCOUNT_EXCLUDED_CAMPUSES = ["Mérida - Caucel"];
  const CASH_DISCOUNT_EXCLUDED_NOTICE = "No aplica descuento por pago de contado";

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function isCashDiscountExcludedCampus(campus) {
    const normalizedCampus = normalizeText(campus);
    return CASH_DISCOUNT_EXCLUDED_CAMPUSES.some((item) => normalizeText(item) === normalizedCampus);
  }

  function shouldApplyCashDiscountExclusion(temario, campus) {
    return temario !== "EXANI II" && isCashDiscountExcludedCampus(campus);
  }

  function getCashDiscountNoticeForCampus(campus, temario) {
    return shouldApplyCashDiscountExclusion(temario, campus) ? CASH_DISCOUNT_EXCLUDED_NOTICE : "";
  }

  function applyCashDiscountPolicy(pricing, campus, temario) {
    if (!pricing) return null;
    if (!shouldApplyCashDiscountExclusion(temario, campus)) return pricing;

    return {
      ...pricing,
      cash: pricing.listPrice,
      cashDiscount: 0,
      cashDiscountExcluded: true,
      cashDiscountNotice: CASH_DISCOUNT_EXCLUDED_NOTICE,
    };
  }

  function todayIso() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function findPricing(temario, modality, dateIso) {
    const date = dateIso || todayIso();

    let exactMatches = pricingRules.filter(
      (rule) => rule.temario === temario && rule.modality === modality
    );

    let match = exactMatches.find((rule) => date >= rule.from && date <= rule.to);

    if (!match) {
      const genericMatches = pricingRules.filter(
        (rule) => rule.temario === "*" && rule.modality === modality
      );
      match = genericMatches.find((rule) => date >= rule.from && date <= rule.to);
    }

    return match || null;
  }

  function getRuleKey(rule) {
    if (!rule) return "";
    return [rule.temario, rule.modality, rule.from, rule.to].join("|");
  }

  function parseIsoDate(iso) {
    return new Date(`${iso}T00:00:00`);
  }

  function isWithinLast3DaysOfMonth(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return lastDay - date.getDate() <= 3;
  }

  function getMonthYearLabelFromRule(rule) {
    if (!rule) return "";

    const start = parseIsoDate(rule.from);
    const end = parseIsoDate(rule.to);
    const formatter = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" });

    const startLabel = formatter.format(start);
    const endLabel = formatter.format(end);

    if (startLabel === endLabel) {
      return startLabel.charAt(0).toUpperCase() + startLabel.slice(1);
    }

    return `${startLabel.charAt(0).toUpperCase() + startLabel.slice(1)} - ${
      endLabel.charAt(0).toUpperCase() + endLabel.slice(1)
    }`;
  }

  function shouldShowCashDiagnosticBenefit(rule) {
    return false;
  }

  function roundUpToNearest(value, step) {
    if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return 0;
    return Math.ceil(value / step) * step;
  }

  function formatIsoToDMY(iso) {
    if (!iso) return "";
    const parts = iso.split("-");
    if (parts.length !== 3) return iso;
    const [y, m, d] = parts;
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  }

  function formatDateToInputValue(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function formatCurrencyMXN(value) {
    return Number(value || 0).toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
    });
  }

  function getVigenciaQuincena(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const lastDay = new Date(year, month + 1, 0).getDate();

    if (day < 15) return new Date(year, month, 15);
    if (day < lastDay) return new Date(year, month, lastDay);
    return new Date(year, month + 1, 15);
  }

  function getDefaultQuoteValidityDateIso(date = new Date()) {
    return formatDateToInputValue(getVigenciaQuincena(date));
  }

  function getQuoteValidityDateIso() {
    const fallback = getDefaultQuoteValidityDateIso(new Date());
    if (typeof document === "undefined") return fallback;

    const input = document.getElementById("quote-validity-date");
    return input?.value || fallback;
  }

  function getQuoteValidityLabel() {
    const validityDate = getQuoteValidityDateIso();
    return `Vigencia hasta el ${formatIsoToDMY(validityDate)}`;
  }

  function showToast(message, type = "error", duration = 3000) {
    const div = document.createElement("div");
    div.textContent = message;
    div.style.position = "fixed";
    div.style.left = "50%";
    div.style.top = "16px";
    div.style.transform = "translateX(-50%)";
    div.style.zIndex = "9999";
    div.style.padding = "10px 18px";
    div.style.borderRadius = "999px";
    div.style.fontSize = "13px";
    div.style.fontWeight = "600";
    div.style.color = "#fff";
    div.style.boxShadow = "0 10px 30px rgba(15,23,42,0.25)";
    div.style.background = type === "success" ? "#059669" : "#dc2626";
    document.body.appendChild(div);
    setTimeout(() => div.remove(), duration);
  }

  function getPrioritySelect() {
    return document.getElementById("recommendation-priority");
  }

  function getHelperSelect() {
    return document.getElementById("recommendation-helper");
  }

  function getHelperBox() {
    return document.getElementById("recommendation-helper-box");
  }

  function setRecommendationPriority(value) {
    state.recommendationPriority = value || "none";
  }

  function getRecommendationPriority() {
    return state.recommendationPriority || getPrioritySelect()?.value || "none";
  }

  function getCoursesForTemario(temario) {
    const campuses = courseData[temario] || {};
    return Object.entries(campuses).flatMap(([campusName, campusCourses]) =>
      campusCourses
        .filter(isCourseAvailable)
        .map((course) => ({ ...course, campus: campusName }))
    );
  }

  function sortCourses(a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.name !== b.name) return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    return (a.schedule || "").localeCompare(b.schedule || "", "es", { sensitivity: "base" });
  }

  function getScheduleKey(course) {
    return `${course?.days || "-"} · ${course?.schedule || "-"}`;
  }

  function isCourseAvailable(course) {
    return !course?.isClosedByCapacity;
  }

  function getCourseAvailabilityLabel(course) {
    const status = String(course?.capacity?.status || "").toLowerCase();
    if (status === "unknown") return "disponibilidad por confirmar";
    return "";
  }

  function getScheduleSimilarityScore(baseCourse, candidateCourse) {
    if (!baseCourse || !candidateCourse) return 0;

    const baseDays = String(baseCourse.days || "").trim().toLowerCase();
    const candidateDays = String(candidateCourse.days || "").trim().toLowerCase();
    const baseSchedule = String(baseCourse.schedule || "").trim().toLowerCase();
    const candidateSchedule = String(candidateCourse.schedule || "").trim().toLowerCase();

    const sameDays = baseDays && candidateDays && baseDays === candidateDays;
    const sameSchedule = baseSchedule && candidateSchedule && baseSchedule === candidateSchedule;

    if (sameDays && sameSchedule) return 3;
    if (sameSchedule) return 2;
    if (sameDays) return 1;
    return 0;
  }

  function updateRecommendationHelper() {
    const syllabus = document.getElementById("syllabus").value;
    const priority = getRecommendationPriority();
    const helperBox = getHelperBox();
    const helperSelect = getHelperSelect();
    const helperLabel = document.getElementById("recommendation-helper-label");
    const helperCopy = document.getElementById("recommendation-helper-copy");

    helperSelect.innerHTML = "";
    state.recommendationHelperValue = "";

    if (!syllabus || priority === "none") {
      helperBox.classList.add("hidden");
      document.getElementById("campus").disabled = !syllabus;
      return;
    }

    helperBox.classList.remove("hidden");

    if (priority === "campus") {
      helperLabel.textContent = "Campus preferido";
      helperCopy.textContent = "Te mostraremos primero los cursos de ese campus y sus horarios disponibles.";
      const campuses = Object.entries(courseData[syllabus] || {})
        .filter(([, courses]) => Array.isArray(courses) && courses.some(isCourseAvailable))
        .map(([campus]) => campus)
        .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
      helperSelect.innerHTML = '<option value="">Selecciona un campus</option>';
      campuses.forEach((campus) => {
        const option = document.createElement("option");
        option.value = campus;
        option.textContent = campus;
        helperSelect.appendChild(option);
      });
    } else if (priority === "schedule") {
      helperLabel.textContent = "Horario preferido";
      helperCopy.textContent = "Buscaremos cursos de distintos campus que compartan ese mismo horario exacto.";
      const scheduleMap = new Map();
      getCoursesForTemario(syllabus).forEach((course) => {
        const key = getScheduleKey(course);
        if (!scheduleMap.has(key)) {
          scheduleMap.set(key, { key, label: key });
        }
      });
      helperSelect.innerHTML = '<option value="">Selecciona un horario</option>';
      [...scheduleMap.values()]
        .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }))
        .forEach((item) => {
          const option = document.createElement("option");
          option.value = item.key;
          option.textContent = item.label;
          helperSelect.appendChild(option);
        });
    }
  }

  function getSelectedCourseDetails() {
    if (!state.quoteData) return null;
    const { syllabus, campus, courseId } = state.quoteData;
    const byTemario = courseData[syllabus];
    if (!byTemario) return null;
    const courses = byTemario[campus];
    if (!courses) return null;
    return courses.find((course) => course.id === courseId) || null;
  }

  function getPricingForQuote() {
    if (!state.quoteData) return null;
    const course = getSelectedCourseDetails();
    if (!course) return null;
    const pricing = findPricing(state.quoteData.syllabus, course.modality, todayIso());
    return applyCashDiscountPolicy(pricing, state.quoteData.campus, state.quoteData.syllabus);
  }

  function getPlanPricingOptions() {
    if (!state.quoteData) return [];

    const course = getSelectedCourseDetails();
    if (!course) return [];

    const temario = state.quoteData.syllabus;
    const modality = course.modality;
    const today = new Date();
    const currentRule = findPricing(temario, modality, todayIso());

    if (!currentRule) return [];

    const options = [currentRule];

    if (isWithinLast3DaysOfMonth(today)) {
      const nextRule = pricingRules
        .filter(
          (rule) =>
            rule.temario === temario &&
            rule.modality === modality &&
            rule.from > currentRule.to
        )
        .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))[0];

      if (nextRule && getRuleKey(nextRule) !== getRuleKey(currentRule)) {
        options.push(nextRule);
      }
    }

    return options;
  }

  function updatePlanDiscountOptions() {
    const selector = document.getElementById("plan-discount-selector");
    const note = document.getElementById("plan-discount-selector-note");
    if (!selector) return;

    state.planPricingOptions = getPlanPricingOptions();
    selector.innerHTML = "";

    if (!state.planPricingOptions.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Sin vigencias disponibles";
      selector.appendChild(opt);
      selector.disabled = true;
      state.selectedPlanPricing = null;
      return;
    }

    state.planPricingOptions.forEach((rule) => {
      const opt = document.createElement("option");
      opt.value = getRuleKey(rule);
      opt.textContent = `${getMonthYearLabelFromRule(rule)} · ${rule.installmentDiscount || 0}%`;
      selector.appendChild(opt);
    });

    selector.disabled = false;
    selector.value = getRuleKey(state.planPricingOptions[0]);
    state.selectedPlanPricing = state.planPricingOptions[0];

    if (note) {
      note.textContent =
        state.planPricingOptions.length > 1
          ? "Ya puedes cotizar con la vigencia actual o con la del siguiente mes."
          : "Por ahora solo hay una vigencia disponible para este plan.";
    }
  }

  function getSelectedPlanPricing() {
    const selector = document.getElementById("plan-discount-selector");
    if (!selector || !state.planPricingOptions.length) {
      return state.selectedPlanPricing || state.currentPricing;
    }

    const selectedKey = selector.value;
    const found = state.planPricingOptions.find((rule) => getRuleKey(rule) === selectedKey);
    return found || state.planPricingOptions[0] || state.selectedPlanPricing || state.currentPricing;
  }

  function updateDisplayPrices() {
    if (!state.currentPricing) return;

    state.selectedPlanPricing = getSelectedPlanPricing() || state.currentPricing;

    const cashPriceEl = document.getElementById("cash-price");
    const totalInstallmentEl = document.getElementById("total-installment");
    const listPriceCashEl = document.getElementById("list-price-cash");
    const listPricePlanEl = document.getElementById("list-price-plan");
    const cashDiscountEl = document.getElementById("cash-discount");
    const planDiscountEl = document.getElementById("plan-discount");
    const msiListPriceEl = document.getElementById("msi-list-price");
    const msi6El = document.getElementById("msi-6");
    const msi9El = document.getElementById("msi-9");
    const msi12El = document.getElementById("msi-12");
    const cashBestPriceBenefitEl = document.getElementById("cash-best-price-benefit");
    const cashNoDiscountNoticeEl = document.getElementById("cash-no-discount-notice");
    const cashDiscountExcluded = Boolean(state.currentPricing.cashDiscountExcluded);

    cashPriceEl.textContent = formatCurrencyMXN(state.currentPricing.cash);
    totalInstallmentEl.textContent = formatCurrencyMXN(state.selectedPlanPricing.installment);
    listPriceCashEl.textContent = formatCurrencyMXN(state.currentPricing.listPrice);
    listPricePlanEl.textContent = formatCurrencyMXN(state.selectedPlanPricing.listPrice);
    cashDiscountEl.textContent = cashDiscountExcluded ? "No aplica" : `${state.currentPricing.cashDiscount || 0}%`;
    planDiscountEl.textContent = `${state.selectedPlanPricing.installmentDiscount || 0}%`;
    msiListPriceEl.textContent = formatCurrencyMXN(state.currentPricing.listPrice);
    msi6El.textContent = formatCurrencyMXN((state.currentPricing.listPrice || 0) / 6);
    msi9El.textContent = formatCurrencyMXN((state.currentPricing.listPrice || 0) / 9);
    msi12El.textContent = formatCurrencyMXN((state.currentPricing.listPrice || 0) / 12);
    if (cashBestPriceBenefitEl) cashBestPriceBenefitEl.classList.toggle("hidden", cashDiscountExcluded);
    if (cashNoDiscountNoticeEl) cashNoDiscountNoticeEl.classList.toggle("hidden", !cashDiscountExcluded);

    const onlySixMSI = state.quoteData && state.quoteData.syllabus === "EXANI I";
    if (msi6El && msi6El.parentElement) msi6El.parentElement.style.display = "";
    if (msi9El && msi9El.parentElement) msi9El.parentElement.style.display = onlySixMSI ? "none" : "";
    if (msi12El && msi12El.parentElement) msi12El.parentElement.style.display = onlySixMSI ? "none" : "";
  }

  function updateCampusOptions() {
    const syllabus = document.getElementById("syllabus").value;
    const campusSelect = document.getElementById("campus");
    const courseSelect = document.getElementById("course-date");
    const scheduleSelect = document.getElementById("course-schedule");
    const priority = getRecommendationPriority();
    const helperValue = getHelperSelect()?.value || "";

    campusSelect.innerHTML = '<option value="">Selecciona un campus</option>';
    courseSelect.innerHTML = '<option value="">Selecciona un curso</option>';
    scheduleSelect.innerHTML = '<option value="">Selecciona un horario</option>';
    courseSelect.disabled = true;
    scheduleSelect.disabled = true;

    if (!(syllabus && courseData[syllabus])) {
      campusSelect.disabled = true;
      return;
    }

    let campuses = Object.entries(courseData[syllabus])
      .filter(([, courses]) => Array.isArray(courses) && courses.some(isCourseAvailable))
      .map(([campus]) => campus);

    if (priority === "campus") {
      if (!helperValue) {
        campusSelect.disabled = true;
        return;
      }
      campuses = campuses.filter((campus) => campus === helperValue);
    } else if (priority === "schedule" && helperValue) {
      const matchingCampuses = new Set(
        getCoursesForTemario(syllabus)
          .filter((course) => getScheduleKey(course) === helperValue)
          .map((course) => course.campus)
      );
      campuses = campuses.filter((campus) => matchingCampuses.has(campus));
    }

    campuses
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
      .forEach((campus) => {
        const opt = document.createElement("option");
        opt.value = campus;
        opt.textContent = campus;
        campusSelect.appendChild(opt);
      });

    campusSelect.disabled = campuses.length === 0;

    if (priority === "campus" && campuses.length === 1) {
      campusSelect.value = campuses[0];
    }
  }

  function updateCourseOptions() {
    const syllabus = document.getElementById("syllabus").value;
    const campus = document.getElementById("campus").value;
    const courseSelect = document.getElementById("course-date");
    const scheduleSelect = document.getElementById("course-schedule");
    const priority = getRecommendationPriority();
    const helperValue = getHelperSelect()?.value || "";

    courseSelect.innerHTML = '<option value="">Selecciona un curso</option>';
    scheduleSelect.innerHTML = '<option value="">Selecciona un horario</option>';
    scheduleSelect.disabled = true;

    if (!(syllabus && campus && courseData[syllabus] && courseData[syllabus][campus])) {
      courseSelect.disabled = true;
      updatePaymentLimits();
      return;
    }

    let courses = courseData[syllabus][campus].filter(isCourseAvailable);

    if (priority === "schedule" && helperValue) {
      courses = courses.filter((course) => getScheduleKey(course) === helperValue);
    }

    courses.sort(sortCourses);

    const grouped = new Map();
    courses.forEach((course) => {
      const key = `${course.name}|${course.date}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(course);
    });

    [...grouped.entries()].forEach(([key, groupedCourses]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = groupedCourses[0].name;
      opt.dataset.courseName = groupedCourses[0].name;
      courseSelect.appendChild(opt);
    });

    courseSelect.disabled = grouped.size === 0;

    if (grouped.size === 1) {
      courseSelect.value = [...grouped.keys()][0];
    }

    updateScheduleOptions();
    updatePaymentLimits();
  }

  function updateScheduleOptions() {
    const syllabus = document.getElementById("syllabus").value;
    const campus = document.getElementById("campus").value;
    const selectedCourseKey = document.getElementById("course-date").value;
    const scheduleSelect = document.getElementById("course-schedule");
    const helperValue = getHelperSelect()?.value || "";
    const priority = getRecommendationPriority();

    scheduleSelect.innerHTML = '<option value="">Selecciona un horario</option>';

    if (!(syllabus && campus && selectedCourseKey && courseData[syllabus] && courseData[syllabus][campus])) {
      scheduleSelect.disabled = true;
      return;
    }

    let matches = courseData[syllabus][campus]
      .filter((course) => isCourseAvailable(course) && `${course.name}|${course.date}` === selectedCourseKey);

    if (priority === "schedule" && helperValue) {
      matches = matches.filter((course) => getScheduleKey(course) === helperValue);
    }

    matches = matches.sort((a, b) => (a.schedule || "").localeCompare(b.schedule || "", "es", { sensitivity: "base" }));

    matches.forEach((course) => {
      const opt = document.createElement("option");
      const availabilityLabel = getCourseAvailabilityLabel(course);
      opt.value = course.id;
      opt.textContent = `${course.days || "-"} - ${course.schedule || "-"}${availabilityLabel ? ` - ${availabilityLabel}` : ""}`;
      opt.dataset.courseName = course.name;
      scheduleSelect.appendChild(opt);
    });

    scheduleSelect.disabled = matches.length === 0;

    if (matches.length === 1) {
      scheduleSelect.value = matches[0].id;
    }
  }

  function updatePaymentLimits() {
    const numPaymentsInput = document.getElementById("num-payments");
    const paymentsError = document.getElementById("payments-error");
    const paymentsErrorText = document.getElementById("payments-error-text");

    numPaymentsInput.max = "5";
    numPaymentsInput.min = "1";

    const current = parseInt(numPaymentsInput.value || "0", 10);

    if (current < 1) {
      paymentsErrorText.textContent = "El mínimo permitido es 1 mensualidad.";
      paymentsError.classList.remove("hidden");
      numPaymentsInput.style.borderColor = "#dc2626";
      return;
    }

    if (current > 5) {
      paymentsErrorText.textContent = "El máximo permitido es 5 mensualidades.";
      paymentsError.classList.remove("hidden");
      numPaymentsInput.style.borderColor = "#dc2626";
      return;
    }

    paymentsError.classList.add("hidden");
    numPaymentsInput.style.borderColor = "#c7d2fe";
  }

  function calculateInstallments() {
    const pricing = getSelectedPlanPricing() || state.currentPricing;
    if (!pricing) return;

    const registrationInput = document.getElementById("registration-fee");
    const paymentsInput = document.getElementById("num-payments");
    const registrationError = document.getElementById("registration-error");
    const monthlySpan = document.getElementById("monthly-payment");
    const totalSpan = document.getElementById("total-installment");

    let registration = parseFloat(registrationInput.value || "0");
    let numPayments = parseInt(paymentsInput.value || "0", 10);

    if (registration < 1000) {
      registrationError.classList.remove("hidden");
      registrationInput.style.borderColor = "#dc2626";
    } else {
      registrationError.classList.add("hidden");
      registrationInput.style.borderColor = "#c7d2fe";
    }

    if (!numPayments || numPayments < 1) {
      numPayments = 1;
    }

    const remaining = Math.max(0, pricing.installment - registration);
    const monthly = remaining > 0 ? roundUpToNearest(remaining / numPayments, 100) : 0;

    monthlySpan.textContent = formatCurrencyMXN(monthly);
    totalSpan.textContent = formatCurrencyMXN(pricing.installment);
  }

  function getAlternativeCourses(limit = 3) {
    const selectedCourse = getSelectedCourseDetails();
    if (!state.quoteData || !selectedCourse) return [];

    const temario = state.quoteData.syllabus;
    const selectedDate = selectedCourse.date;
    const selectedId = selectedCourse.id;
    const selectedCampus = state.quoteData.campus;
    const targetModality = selectedCourse.modality;
    const priority = getRecommendationPriority();

    const campuses = courseData[temario] || {};
    const allCourses = Object.entries(campuses).flatMap(([campusName, campusCourses]) =>
      campusCourses
        .filter(isCourseAvailable)
        .map((course) => ({
          ...course,
          campus: campusName,
        }))
    );

    const baseCourses = allCourses.filter(
      (course) =>
        course.id !== selectedId &&
        course.modality === targetModality &&
        course.date >= selectedDate
    );

    if (priority === "campus") {
      return baseCourses
        .filter((course) => course.campus === selectedCampus)
        .sort(sortCourses)
        .slice(0, limit);
    }

    if (priority === "schedule") {
      const prioritized = baseCourses
        .map((course) => ({
          ...course,
          similarityScore: getScheduleSimilarityScore(selectedCourse, course),
          sameCampusPenalty: course.campus === selectedCampus ? 1 : 0,
        }))
        .filter((course) => course.similarityScore > 0)
        .sort((a, b) => {
          if (b.similarityScore !== a.similarityScore) return b.similarityScore - a.similarityScore;
          if (a.sameCampusPenalty !== b.sameCampusPenalty) return a.sameCampusPenalty - b.sameCampusPenalty;
          return sortCourses(a, b);
        });

      if (prioritized.length >= limit) {
        return prioritized.slice(0, limit);
      }

      const usedIds = new Set(prioritized.map((course) => course.id));
      const fallback = baseCourses
        .filter((course) => !usedIds.has(course.id))
        .sort(sortCourses);

      return [...prioritized, ...fallback].slice(0, limit);
    }

    return baseCourses
      .sort(sortCourses)
      .slice(0, limit);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function formatCourseDisplayName(name) {
    const lower = String(name || "").toLowerCase();
    return lower ? lower.charAt(0).toUpperCase() + lower.slice(1) : "";
  }

  function buildAlternativeSubtitle(temario, modality, campus) {
    const parts = [temario, modality];
    if (campus && campus.toLowerCase() !== String(modality || "").toLowerCase()) {
      parts.push(campus);
    }
    return parts.filter(Boolean).join(" · ");
  }

  app.todayIso = todayIso;
  app.findPricing = findPricing;
  app.getRuleKey = getRuleKey;
  app.parseIsoDate = parseIsoDate;
  app.isWithinLast3DaysOfMonth = isWithinLast3DaysOfMonth;
  app.getMonthYearLabelFromRule = getMonthYearLabelFromRule;
  app.shouldShowCashDiagnosticBenefit = shouldShowCashDiagnosticBenefit;
  app.roundUpToNearest = roundUpToNearest;
  app.formatIsoToDMY = formatIsoToDMY;
  app.getDefaultQuoteValidityDateIso = getDefaultQuoteValidityDateIso;
  app.getQuoteValidityDateIso = getQuoteValidityDateIso;
  app.getQuoteValidityLabel = getQuoteValidityLabel;
  app.formatCurrencyMXN = formatCurrencyMXN;
  app.getVigenciaQuincena = getVigenciaQuincena;
  app.showToast = showToast;
  app.getSelectedCourseDetails = getSelectedCourseDetails;
  app.getPricingForQuote = getPricingForQuote;
  app.getPlanPricingOptions = getPlanPricingOptions;
  app.updatePlanDiscountOptions = updatePlanDiscountOptions;
  app.getSelectedPlanPricing = getSelectedPlanPricing;
  app.updateDisplayPrices = updateDisplayPrices;
  app.setRecommendationPriority = setRecommendationPriority;
  app.getRecommendationPriority = getRecommendationPriority;
  app.isCourseAvailable = isCourseAvailable;
  app.getCourseAvailabilityLabel = getCourseAvailabilityLabel;
  app.updateRecommendationHelper = updateRecommendationHelper;
  app.updateCampusOptions = updateCampusOptions;
  app.updateCourseOptions = updateCourseOptions;
  app.updateScheduleOptions = updateScheduleOptions;
  app.updatePaymentLimits = updatePaymentLimits;
  app.calculateInstallments = calculateInstallments;
  app.getAlternativeCourses = getAlternativeCourses;
  app.getCashDiscountNoticeForCampus = getCashDiscountNoticeForCampus;
  app.escapeHtml = escapeHtml;
  app.escapeAttr = escapeAttr;
  app.formatCourseDisplayName = formatCourseDisplayName;
  app.buildAlternativeSubtitle = buildAlternativeSubtitle;
})(window.CotizadorApp);
