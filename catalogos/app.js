(function () {
  const storageKey = "cotizador_catalog_manager";
  const state = {
    endpointUrl: "",
    adminToken: "",
  };

  const els = {};

  function qs(id) {
    return document.getElementById(id);
  }

  function bindElements() {
    els.endpointUrl = qs("endpoint-url");
    els.adminToken = qs("admin-token");
    els.connectionLabel = qs("connection-label");
    els.alertBox = qs("alert-box");
    els.resultBox = qs("result-box");
    els.resultCount = qs("result-count");
    els.validationSummary = qs("validation-summary");
  }

  function loadSession() {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || "{}");
    state.endpointUrl = saved.endpointUrl || window.CATALOG_MANAGER_CONFIG?.endpointUrl || "";
    state.adminToken = saved.adminToken || "";
    els.endpointUrl.value = state.endpointUrl;
    els.adminToken.value = state.adminToken;
    updateConnectionLabel();
  }

  function saveSession() {
    state.endpointUrl = els.endpointUrl.value.trim();
    state.adminToken = els.adminToken.value.trim();
    sessionStorage.setItem(storageKey, JSON.stringify(state));
    updateConnectionLabel();
    showAlert("Configuracion guardada para esta sesion.", "ok");
  }

  function updateConnectionLabel() {
    els.connectionLabel.textContent = state.endpointUrl ? "Endpoint configurado" : "Sin endpoint";
  }

  function showAlert(message, type) {
    els.alertBox.textContent = message;
    els.alertBox.className = `alert ${type || "ok"}`;
  }

  function clearAlert() {
    els.alertBox.className = "alert hidden";
    els.alertBox.textContent = "";
  }

  function requireConfig() {
    if (!state.endpointUrl) {
      throw new Error("Configura el endpoint de Apps Script.");
    }
    if (!state.adminToken) {
      throw new Error("Ingresa la clave de edicion.");
    }
  }

  function formToObject(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function normalizePayload(type, data) {
    const payload = { ...data, activo: "si" };

    if (type === "pricing") {
      ["precioLista", "precioContado", "descuentoContado", "precioPlan", "descuentoPlan"].forEach((key) => {
        payload[key] = Number(payload[key] || 0);
      });
    }

    if (type === "promotions") {
      payload.prioridad = Number(payload.prioridad || 0);
    }

    return payload;
  }

  async function callApi(payload) {
    requireConfig();

    const response = await fetch(state.endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        ...payload,
        token: state.adminToken,
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.message || "La operacion no fue aceptada.");
    }

    return data;
  }

  function renderResult(data) {
    const rows = data.rows || data.issues || data.summary || data;
    const count = Array.isArray(rows) ? rows.length : data.total || "";
    els.resultCount.textContent = count === "" ? "Resultado" : `${count} registros`;
    els.resultBox.textContent = JSON.stringify(data, null, 2);
  }

  function renderSummary(data) {
    const summary = data.summary || {};
    els.validationSummary.innerHTML = "";
    [
      ["Cursos", summary.courses || 0],
      ["Precios", summary.pricing || 0],
      ["Promociones", summary.promotions || 0],
    ].forEach(([label, value]) => {
      const card = document.createElement("div");
      card.className = "summary-card";
      card.innerHTML = `<strong>${value}</strong><span>${label}</span>`;
      els.validationSummary.appendChild(card);
    });
  }

  async function handleSubmit(event, type) {
    event.preventDefault();
    clearAlert();
    const form = event.currentTarget;

    try {
      const data = normalizePayload(type, formToObject(form));
      const result = await callApi({ action: "append", type, data });
      renderResult(result);
      showAlert("Registro guardado en Sheets.", "ok");
      form.reset();
    } catch (error) {
      showAlert(error.message, "err");
    }
  }

  async function listRows(type) {
    clearAlert();

    try {
      const result = await callApi({ action: "list", type, limit: 25 });
      renderResult(result);
      showAlert("Datos leidos desde Sheets.", "ok");
    } catch (error) {
      showAlert(error.message, "err");
    }
  }

  async function validateCatalogs() {
    clearAlert();

    try {
      const result = await callApi({ action: "validate" });
      renderResult(result);
      renderSummary(result);
      showAlert(result.issues.length ? "Validacion terminada con observaciones." : "Catalogos sin observaciones criticas.", result.issues.length ? "err" : "ok");
    } catch (error) {
      showAlert(error.message, "err");
    }
  }

  async function setupSheets() {
    clearAlert();

    try {
      const result = await callApi({ action: "setup" });
      renderResult(result);
      showAlert("Hojas preparadas.", "ok");
    } catch (error) {
      showAlert(error.message, "err");
    }
  }

  async function healthCheck() {
    clearAlert();

    try {
      const result = await callApi({ action: "health" });
      renderResult(result);
      showAlert("Conexion correcta.", "ok");
    } catch (error) {
      showAlert(error.message, "err");
    }
  }

  function attachEvents() {
    qs("save-config-btn").addEventListener("click", saveSession);
    qs("setup-btn").addEventListener("click", setupSheets);
    qs("health-btn").addEventListener("click", healthCheck);
    qs("validate-btn").addEventListener("click", validateCatalogs);
    qs("list-all-btn").addEventListener("click", validateCatalogs);

    qs("course-form").addEventListener("submit", (event) => handleSubmit(event, "courses"));
    qs("pricing-form").addEventListener("submit", (event) => handleSubmit(event, "pricing"));
    qs("promotion-form").addEventListener("submit", (event) => handleSubmit(event, "promotions"));

    document.querySelectorAll("[data-list]").forEach((button) => {
      button.addEventListener("click", () => listRows(button.dataset.list));
    });

    document.querySelectorAll(".tab").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("is-active"));
        document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("is-active"));
        button.classList.add("is-active");
        document.querySelector(`[data-panel="${button.dataset.tab}"]`).classList.add("is-active");
      });
    });
  }

  function init() {
    bindElements();
    loadSession();
    attachEvents();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
