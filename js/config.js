window.COTIZADOR_CONFIG = {
  dataUrls: {
    pricing: "./data/pricing.json",
    specialists: "./data/specialists.json",
    courses: "./data/courses.json",
  },
  catalogApi: {
    enabled: false,
    endpointUrl: "https://script.google.com/macros/s/AKfycbzWmwrMzFduDRJDN2ZM-tLuDWrAcICaxqh-zrH9WDB7ljeyzmEPdSwZ4_ewXGq2gXLNgg/exec",
  },
  quoteLogging: {
    enabled: true,
    endpointUrl: "https://script.google.com/macros/s/AKfycbxPNCQUolYDZSkAlseM4rp1ghGGx-kR-IZTx86xGbXJrUpq0eJpzbTYyS43kQl1soxW/exec",
  },
};

(function () {
  function sanitizeVisibleVigencias() {
    const selector = document.getElementById("plan-discount-selector");
    if (!selector) return;

    Array.from(selector.options).forEach((option) => {
      const text = option.textContent || "";
      const parts = text.split(" · ");
      const vigencia = parts[0] || "";

      if (vigencia.includes(" - ")) {
        const visibleMonth = vigencia.split(" - ")[0].trim();
        option.textContent = [visibleMonth, ...parts.slice(1)].join(" · ");
      }
    });

    const note = document.getElementById("plan-discount-selector-note");
    if (note) {
      note.textContent = "Selecciona la vigencia que corresponda a esta cotización.";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const selector = document.getElementById("plan-discount-selector");
    if (!selector) return;

    sanitizeVisibleVigencias();

    const observer = new MutationObserver(sanitizeVisibleVigencias);
    observer.observe(selector, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    selector.addEventListener("change", sanitizeVisibleVigencias);
  });
})();
