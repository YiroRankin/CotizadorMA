window.CotizadorApp = window.CotizadorApp || {};

(function (app) {
  async function sendQuoteLog(config, payload) {
    const enabled = Boolean(config && config.enabled && config.endpointUrl);
    if (!enabled) return false;

    const body = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
      return navigator.sendBeacon(config.endpointUrl, blob);
    }

    try {
      await fetch(config.endpointUrl, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body,
      });
      return true;
    } catch (error) {
      console.warn("No se pudo enviar el log de cotización.", error);
      return false;
    }
  }

  app.sendQuoteLog = sendQuoteLog;
})(window.CotizadorApp);
