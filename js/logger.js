window.CotizadorApp = window.CotizadorApp || {};

(function (app) {
  function buildBeaconUrl(endpointUrl, payload) {
    const url = new URL(endpointUrl);
    url.searchParams.set("payload", JSON.stringify(payload));
    url.searchParams.set("_ts", String(Date.now()));
    return url.toString();
  }

  function sendWithImageBeacon(endpointUrl, payload) {
    return new Promise((resolve) => {
      const img = new Image();
      const finalize = (result) => {
        img.onload = null;
        img.onerror = null;
        resolve(result);
      };

      img.onload = () => finalize(true);
      img.onerror = () => finalize(false);
      img.src = buildBeaconUrl(endpointUrl, payload);

      setTimeout(() => finalize(true), 2500);
    });
  }

  async function sendQuoteLog(config, payload) {
    const enabled = Boolean(config && config.enabled && config.endpointUrl);
    if (!enabled) return false;

    try {
      return await sendWithImageBeacon(config.endpointUrl, payload);
    } catch (error) {
      console.warn("No se pudo enviar el log de cotización por image beacon.", error);
      return false;
    }
  }

  app.sendQuoteLog = sendQuoteLog;
})(window.CotizadorApp);
