window.CotizadorApp = window.CotizadorApp || {};

(function (app) {
  function ensureHiddenFrame(frameName) {
    let frame = document.querySelector(`iframe[name="${frameName}"]`);
    if (frame) return frame;

    frame = document.createElement("iframe");
    frame.name = frameName;
    frame.style.display = "none";
    frame.setAttribute("aria-hidden", "true");
    document.body.appendChild(frame);
    return frame;
  }

  function sendWithHiddenForm(endpointUrl, payload) {
    const frameName = "cotizador-log-frame";
    ensureHiddenFrame(frameName);

    const form = document.createElement("form");
    form.method = "POST";
    form.action = endpointUrl;
    form.target = frameName;
    form.style.display = "none";

    const payloadInput = document.createElement("input");
    payloadInput.type = "hidden";
    payloadInput.name = "payload";
    payloadInput.value = JSON.stringify(payload);
    form.appendChild(payloadInput);

    const sourceInput = document.createElement("input");
    sourceInput.type = "hidden";
    sourceInput.name = "source";
    sourceInput.value = payload.source || "github-pages";
    form.appendChild(sourceInput);

    document.body.appendChild(form);
    form.submit();

    setTimeout(() => {
      form.remove();
    }, 1500);

    return true;
  }

  async function sendQuoteLog(config, payload) {
    const enabled = Boolean(config && config.enabled && config.endpointUrl);
    if (!enabled) return false;

    try {
      return sendWithHiddenForm(config.endpointUrl, payload);
    } catch (error) {
      console.warn("Falló el envío por formulario oculto. Se intentará por fetch.", error);
    }

    try {
      await fetch(config.endpointUrl, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
      });
      return true;
    } catch (error) {
      console.warn("No se pudo enviar el log de cotización.", error);
      return false;
    }
  }

  app.sendQuoteLog = sendQuoteLog;
})(window.CotizadorApp);
