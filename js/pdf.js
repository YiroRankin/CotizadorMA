(function (app) {
  function buildPrintableQuoteHtml(printData) {
    const alternativesHtml = printData.alternatives.length
      ? printData.alternatives
          .map(
            (alt, idx) => `
              <div class="box ${idx === 1 ? "soft" : ""} alt-card">
                <div class="section-kicker" style="color:#667085">Alternativa ${idx + 1}</div>
                <div class="alt-title">${app.escapeHtml(alt.title)}</div>
                <div class="alt-sub">${app.escapeHtml(alt.sub)}</div>
                <div class="alt-grid">
                  <div><div class="field-label">Días</div><div class="field-value">${app.escapeHtml(alt.days)}</div></div>
                  <div><div class="field-label">Horario</div><div class="field-value">${app.escapeHtml(alt.schedule)}</div></div>
                  <div><div class="field-label">Inicio</div><div class="field-value">${app.escapeHtml(alt.start)}</div></div>
                  <div><div class="field-label">Término</div><div class="field-value">${app.escapeHtml(alt.end)}</div></div>
                </div>
                ${alt.note ? `<div class="alt-note">${app.escapeHtml(alt.note)}</div>` : ``}
              </div>
            `
          )
          .join("")
      : `
          <div class="box alt-card">
            <div class="section-kicker" style="color:#667085">Opciones disponibles</div>
            <div class="alt-title" style="font-size:24px">Por el momento no contamos con más alternativas registradas</div>
            <div class="alt-sub">Si necesitas otro horario, nuestra especialista puede apoyarte a revisar nuevas opciones.</div>
          </div>
        `;

    const msiRows = printData.onlySixMSI
      ? `<div class="row"><span>6 MSI</span><span>${app.escapeHtml(printData.pricing.msi6)}</span></div>`
      : `
          <div class="row"><span>6 MSI</span><span>${app.escapeHtml(printData.pricing.msi6)}</span></div>
          <div class="row"><span>9 MSI</span><span>${app.escapeHtml(printData.pricing.msi9)}</span></div>
          <div class="row"><span>12 MSI</span><span>${app.escapeHtml(printData.pricing.msi12)}</span></div>
        `;
    const cashPaymentHtml = printData.hideCashPaymentOption
      ? ""
      : `
          <div class="box brand equal-pay">
            <div class="pill">${printData.noCashDiscountNotice ? "Pago &uacute;nico" : "Mejor opci&oacute;n"}</div>
            <div class="section-kicker" style="color:rgba(255,255,255,.75);padding-right:90px">Pago de contado</div>
            <div class="strike">${app.escapeHtml(printData.pricing.list)}</div>
            <div class="price">${app.escapeHtml(printData.pricing.cash)}</div>
            <div class="discount">${app.escapeHtml(printData.pricing.cashDiscount)}</div>
            <ul class="list">
              <li>Pago &uacute;nico</li>
              ${printData.noCashDiscountNotice ? `<li>${app.escapeHtml(printData.noCashDiscountNotice)}</li>` : `<li>Mejor precio disponible</li>`}
            </ul>
          </div>
        `;

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cotización premium · ${app.escapeHtml(printData.studentName)}</title>
  <style>
    :root {
      --bg: #ececec;
      --paper: #ffffff;
      --ink: #0f172a;
      --muted: #667085;
      --line: #d9d9df;
      --brand: #34124B;
      --gold: #f4d000;
      --gold-soft: #fff7d1;
      --gold-line: #e0c85a;
      --soft: #f7f7f8;
    }

    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: var(--bg); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      gap: 14px;
      align-items: center;
      justify-content: center;
      padding: 14px 18px;
      background: rgba(236,236,236,.92);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid rgba(0,0,0,.06);
      flex-wrap: wrap;
    }
    .btn {
      appearance: none;
      border: 0;
      border-radius: 999px;
      background: var(--brand);
      color: white;
      padding: 12px 18px;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: .01em;
    }
    .toolbar .hint { color: #475467; font-size: 13px; line-height: 1.45; max-width: 760px; }
    .toolbar .hint strong { color: #344054; }
    .pages {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 22px;
      padding: 24px 20px 48px;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      background: var(--paper);
      box-shadow: 0 20px 55px rgba(15, 23, 42, .18);
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .topband { height: 8px; background: var(--gold); }
    .hero {
      background: var(--brand);
      color: white;
      padding: 18px 34px 16px;
      display: grid;
      grid-template-columns: 1fr 232px;
      gap: 22px;
      align-items: start;
    }
    .logo {
      width: 136px;
      height: auto;
      display: block;
      margin-bottom: 12px;
    }
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: .26em;
      font-size: 12px;
      color: rgba(255,255,255,.78);
      margin-bottom: 12px;
    }
    .hero-copy {
      font-size: 17.5px;
      line-height: 1.38;
      font-weight: 300;
      max-width: 520px;
      margin: 0;
    }
    .contact-card {
      background: rgba(255,255,255,.11);
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 18px;
      padding: 13px 15px 11px;
    }
    .contact-card h4,
    .section-kicker,
    .kicker {
      margin: 0 0 10px;
      text-transform: uppercase;
      letter-spacing: .22em;
      font-size: 10px;
      font-weight: 600;
    }
    .contact-card h4 { color: rgba(255,255,255,.75); }
    .contact-card .label { color: rgba(255,255,255,.72); font-size: 12px; margin-bottom: 2px; }
    .contact-card .value { color: white; font-size: 13px; font-weight: 700; margin-bottom: 6px; }
    .contact-card a { color: white; font-weight: 700; text-decoration: underline; }
    .content { padding: 20px 34px 14px; flex: 1; display: flex; flex-direction: column; }
    .intro {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 18px;
      align-items: end;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--line);
      margin-bottom: 16px;
    }
    .intro h1 { margin: 0 0 8px; font-size: 27px; line-height: 1.18; }
    .intro p { margin: 0; font-size: 14px; line-height: 1.55; color: #475467; max-width: 560px; }
    .temario { text-align: right; }
    .temario .value { font-size: 19px; font-weight: 800; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 18px; align-items: stretch; }
    .grid-3.no-cash { grid-template-columns: 1fr 1fr; }
    .equal { min-height: 168px; }
    .equal-pay { min-height: 188px; }
    .box {
      border: 1px solid var(--line);
      border-radius: 22px;
      padding: 14px 18px;
      background: white;
    }
    .box.soft { background: var(--soft); }
    .box.gold { background: var(--gold-soft); border-color: var(--gold-line); }
    .box.brand { background: var(--brand); border-color: var(--brand); color: white; position: relative; }
    .course-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px 24px;
      font-size: 13px;
      margin-top: 12px;
    }
    .field-label { color: #667085; font-size: 12px; margin-bottom: 2px; }
    .field-value { font-weight: 700; }
    .promo-note {
      display: flex;
      gap: 10px;
      align-items: center;
      color: #6a5200;
      font-weight: 700;
      font-size: 14px;
      margin-top: 26px;
    }
    .dot { width: 10px; height: 10px; border-radius: 999px; background: #d9b300; display: inline-block; }
    .pill {
      position: absolute;
      top: 18px;
      right: 18px;
      background: var(--gold);
      color: #342600;
      font-size: 10px;
      font-weight: 800;
      padding: 8px 14px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: .16em;
    }
    .strike { text-decoration: line-through; color: rgba(255,255,255,.72); margin: 12px 0 4px; font-size: 15px; }
    .price { font-size: 33px; line-height: 1; font-weight: 800; margin: 2px 0 6px; }
    .price.dark { color: var(--ink); }
    .discount { font-size: 14px; color: rgba(255,255,255,.82); margin-bottom: 14px; }
    .discount.dark { color: #667085; }
    .list { margin: 14px 0 0; padding-left: 16px; font-size: 14px; line-height: 1.75; }
    .list li { margin: 0; }
    .subgrid { display: grid; gap: 12px; font-size: 14px; margin-top: 14px; }
    .row { display: flex; justify-content: space-between; gap: 16px; }
    .row span:last-child { font-weight: 700; }
    .bank { margin-top: 4px; }
    .bank-head {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      align-items: center;
      margin-bottom: 10px;
    }
    .bank-title { font-size: 18px; font-weight: 800; margin: 0; }
    .bank-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
      padding-top: 10px;
      border-top: 1px solid var(--line);
      font-size: 13px;
    }
    .signature {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid var(--line);
      display: grid;
      grid-template-columns: 1fr 280px;
      gap: 20px;
      align-items: end;
    }
    .signature .name { font-size: 15px; font-weight: 800; margin-bottom: 2px; }
    .signature .role { color: #667085; font-size: 13px; margin-bottom: 4px; }
    .signature a { color: var(--brand); font-size: 14px; font-weight: 700; text-decoration: underline; }
    .signature .note { color: #98a2b3; text-align: right; font-size: 12px; line-height: 1.5; }
    .hero-mini {
      background: var(--brand);
      color: white;
      padding: 24px 34px 22px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
    }
    .hero-mini .logo { width: 150px; margin: 0; }
    .hero-mini .eyebrow { margin: 0; }
    .alt-header {
      display: grid;
      grid-template-columns: 1fr 270px;
      gap: 18px;
      align-items: start;
      margin-bottom: 18px;
    }
    .alt-header h2 { margin: 0 0 8px; font-size: 27px; line-height: 1.15; }
    .alt-header p { margin: 0; font-size: 14px; line-height: 1.65; color: #475467; max-width: 520px; }
    .gold-note {
      background: var(--gold-soft);
      border: 1px solid var(--gold-line);
      border-radius: 18px;
      padding: 16px;
      font-size: 14px;
      line-height: 1.5;
      color: #6a5200;
      font-weight: 700;
    }
    .alt-card { padding: 16px 24px; }
    .alt-title { font-size: 22px; line-height: 1.15; font-weight: 700; margin-bottom: 4px; }
    .alt-sub { color: #667085; font-size: 14px; margin-bottom: 18px; }
    .alt-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 18px;
      padding-top: 12px;
      border-top: 1px solid var(--line);
      font-size: 13px;
    }
    .alt-note {
      margin-top: 14px;
      padding: 10px 12px;
      border-radius: 12px;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      color: #9a3412;
      font-size: 12px;
      font-weight: 700;
    }
    .bottom-grid {
      margin-top: 18px;
      display: grid;
      grid-template-columns: 1.2fr .8fr;
      gap: 18px;
      align-items: stretch;
    }
    .equal-bottom { min-height: 172px; }
    .contact-dark {
      background: var(--brand);
      border-color: var(--brand);
      color: white;
    }
    .contact-dark .name { font-size: 18px; font-weight: 800; margin-bottom: 2px; }
    .contact-dark .subtle,
    .contact-dark .line { color: rgba(255,255,255,.84); }
    .contact-dark a { color: white; text-decoration: underline; font-weight: 700; }
    .footer-line {
      margin-top: auto;
      padding-top: 16px;
      border-top: 1px solid var(--line);
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-end;
      color: #98a2b3;
      font-size: 12px;
      line-height: 1.55;
    }
    @media print {
      @page { size: A4; margin: 0; }
      html, body { background: white; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .toolbar { display: none !important; }
      .pages { padding: 0; gap: 0; }
      .page { box-shadow: none; width: 210mm; min-height: 297mm; page-break-after: always; }
      .page:last-child { page-break-after: auto; }
      .page:first-child .content { zoom: 0.962; padding-top: 20px; padding-bottom: 10px; }
      .page:first-child .grid-2 { margin-bottom: 12px; }
      .page:first-child .grid-3 { margin-bottom: 14px; }
      .page:first-child .bank { margin-top: 2px; }
      .page:first-child .signature { margin-top: 10px; padding-top: 10px; }
      .page:last-child .content { zoom: 0.97; padding-top: 26px; padding-bottom: 14px; }
      a { color: inherit; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn" onclick="window.print()">Generar PDF para enviar</button>
    <div class="hint"><strong>Instrucciones para especialistas:</strong> al hacer clic se abrirá la ventana de impresión. Selecciona <strong>Guardar como PDF</strong> y después haz clic en <strong>Guardar</strong>. Este aviso no aparecerá en el PDF final.</div>
  </div>

  <div class="pages">
    <section class="page">
      <div class="topband"></div>
      <div class="hero">
        <div>
          <img class="logo" src="https://misionadmision-assets.s3.amazonaws.com/img/website/logo-misionadmision.png" alt="Misión Admisión" />
          <div class="eyebrow">Cotización personalizada</div>
          <p class="hero-copy">${app.escapeHtml(printData.copy.hero)}</p>
        </div>
        <div class="contact-card">
          <h4>Atención personalizada</h4>
          <div class="label">Especialista</div>
          <div class="value">${app.escapeHtml(printData.specialist.name)}</div>
          <div class="label">Fecha de emisión</div>
          <div class="value">${app.escapeHtml(printData.issueDate)}</div>
          <div class="label">WhatsApp</div>
          <div class="value"><a href="${app.escapeAttr(printData.specialist.whatsappUrl)}" target="_blank" rel="noreferrer">Enviar WhatsApp</a></div>
        </div>
      </div>

      <div class="content">
        <div class="intro">
          <div>
            <div class="eyebrow" style="color:#667085;margin-bottom:10px">Propuesta para</div>
            <h1>${app.escapeHtml(printData.studentName)}</h1>
            <p>${app.escapeHtml(printData.copy.intro)}</p>
          </div>
          <div class="temario">
            <div class="eyebrow" style="color:#667085;margin-bottom:8px">Temario</div>
            <div class="value">${app.escapeHtml(printData.temario)}</div>
          </div>
        </div>

        <div class="grid-2">
          <div class="box soft equal">
            <div class="section-kicker" style="color:#667085">Detalles del curso</div>
            <div class="course-grid">
              <div><div class="field-label">Campus</div><div class="field-value">${app.escapeHtml(printData.campus)}</div></div>
              <div><div class="field-label">Modalidad</div><div class="field-value">${app.escapeHtml(printData.modality)}</div></div>
              <div><div class="field-label">Inicio</div><div class="field-value">${app.escapeHtml(printData.start)}</div></div>
              <div><div class="field-label">Término</div><div class="field-value">${app.escapeHtml(printData.end)}</div></div>
              <div><div class="field-label">Horario</div><div class="field-value">${app.escapeHtml(printData.schedule)}</div></div>
              <div><div class="field-label">Días</div><div class="field-value">${app.escapeHtml(printData.days)}</div></div>
            </div>
          </div>
          <div class="box gold equal">
            <div class="section-kicker" style="color:#7A6200">Recomendación destacada</div>
            <div style="font-size:14px;line-height:1.85;color:#433a16">${app.escapeHtml(printData.copy.highlight)}</div>
          </div>
        </div>

        <div class="grid-3 ${printData.hideCashPaymentOption ? "no-cash" : ""}">
          ${cashPaymentHtml}
          <div class="box equal-pay">
            <div class="section-kicker" style="color:#667085">Plan de pagos</div>
            <div class="strike" style="color:#98a2b3">${app.escapeHtml(printData.pricing.list)}</div>
            <div class="price dark">${app.escapeHtml(printData.pricing.plan)}</div>
            <div class="discount dark">${app.escapeHtml(printData.pricing.planDiscount)}</div>
            <div class="subgrid">
              <div class="row"><span>Vigencia elegida</span><span>${app.escapeHtml(printData.pricing.planVigencia)}</span></div>
              <div class="row"><span>Inscripción</span><span>${app.escapeHtml(printData.pricing.inscription)}</span></div>
              <div class="row"><span>${app.escapeHtml(printData.pricing.paymentsLabel)}</span><span>${app.escapeHtml(printData.pricing.paymentAmount)}</span></div>
            </div>
          </div>
          <div class="box soft equal-pay">
            <div class="section-kicker" style="color:#667085">Meses sin intereses</div>
            <div style="font-size:14px;color:#667085;margin:10px 0 18px">Precio de lista</div>
            <div class="subgrid">${msiRows}</div>
          </div>
        </div>

        <div class="box bank">
          <div class="bank-head">
            <div>
              <div class="section-kicker" style="color:#667085;margin-bottom:8px">Reserva tu lugar</div>
              <h3 class="bank-title">Datos para depósito o transferencia</h3>
            </div>
            <div style="font-size:13px;color:#667085">${app.escapeHtml(printData.validity)}</div>
          </div>
          <div class="bank-grid">
            <div><div class="field-label">Banco</div><div class="field-value">BBVA Bancomer</div></div>
            <div><div class="field-label">CLABE</div><div class="field-value">012910001106113871</div></div>
            <div><div class="field-label">Beneficiario</div><div class="field-value">Grupo KX S.A. de C.V.</div></div>
          </div>
        </div>

        <div class="signature">
          <div>
            <div class="name">${app.escapeHtml(printData.specialist.name)}</div>
            <div class="role">Especialista académica</div>
            <a href="${app.escapeAttr(printData.specialist.whatsappUrl)}" target="_blank" rel="noreferrer">Enviar WhatsApp</a>
          </div>
          <div class="note">Documento comercial de referencia para acompañar la decisión de inscripción y explicar las opciones de pago disponibles.</div>
        </div>
      </div>
    </section>

    <section class="page">
      <div class="topband"></div>
      <div class="hero-mini">
        <img class="logo" src="https://misionadmision-assets.s3.amazonaws.com/img/website/logo-misionadmision.png" alt="Misión Admisión" />
        <div class="eyebrow">Opciones complementarias</div>
      </div>

      <div class="content">
        <div class="alt-header">
          <div>
            <div class="eyebrow" style="color:#667085;margin-bottom:8px">Página 2</div>
            <h2>Cursos alternativos sugeridos</h2>
            <p>Si este horario no se ajusta por completo a tus necesidades, te compartimos otras opciones dentro de la misma modalidad para ayudarte a tomar la mejor decisión.</p>
          </div>
          <div class="gold-note">Mismo temario · Misma modalidad · Nuevas combinaciones de horario</div>
        </div>

        <div style="display:grid; gap:16px;">${alternativesHtml}</div>

        <div class="bottom-grid">
          <div class="box soft equal-bottom">
            <div class="section-kicker" style="color:#667085">Siguiente paso sugerido</div>
            <div style="font-size:18px;line-height:1.35;font-weight:800;margin-bottom:14px;max-width:360px">Aparta tu lugar con la opción que mejor se ajuste a tu agenda</div>
            <div style="font-size:14px;line-height:1.75;color:#475467">Una vez realizada tu inscripción o pago inicial, comparte tu comprobante por WhatsApp para confirmar tu lugar y darte seguimiento personalizado.</div>
          </div>
          <div class="box contact-dark equal-bottom">
            <div class="section-kicker" style="color:rgba(255,255,255,.75)">Contacto directo</div>
            <div class="name">${app.escapeHtml(printData.specialist.name)}</div>
            <div class="subtle" style="font-size:14px;margin-bottom:14px">Especialista académica</div>
            <div style="display:grid;gap:8px;font-size:14px;line-height:1.6">
              <div><a href="${app.escapeAttr(printData.specialist.whatsappUrl)}" target="_blank" rel="noreferrer">Enviar WhatsApp</a></div>
              <div class="line">especialista@misionadmision.com</div>
              <div class="line">Lun–Vie · 8:30 a 17:30</div>
            </div>
          </div>
        </div>

        <div class="footer-line">
          <div>Esta segunda hoja presenta opciones alternativas de horario dentro de la misma modalidad, con el objetivo de facilitar la decisión de inscripción sin cambiar el enfoque académico del curso.</div>
          <div>Página 2 de 2</div>
        </div>
      </div>
    </section>
  </div>
</body>
</html>`;
  }

  function generatePDF() {
    const { quoteData, currentPricing } = app.state;

    if (!quoteData) {
      app.showToast("Primero genera una cotización.", "error");
      return;
    }

    const registration = parseFloat(document.getElementById("registration-fee").value || "0");
    const numPayments = parseInt(document.getElementById("num-payments").value || "0", 10);

    if (registration < 1000 || numPayments < 1) {
      app.showToast("Corrige los datos de inscripción y mensualidades antes de continuar.", "error");
      return;
    }

    if (!currentPricing) {
      app.showToast("No se encontró información de precios para esta cotización.", "error");
      return;
    }

    const course = app.getSelectedCourseDetails();
    const planPricing = app.getSelectedPlanPricing() || currentPricing;
    const remaining = Math.max(0, planPricing.installment - registration);
    const monthly = remaining > 0 ? app.roundUpToNearest(remaining / numPayments, 100) : 0;
    const showDiagnostic = app.shouldShowCashDiagnosticBenefit(currentPricing);
    const onlySixMSI = quoteData.syllabus === "EXANI I";
    const today = new Date();
    const issueDate = `${String(today.getDate()).padStart(2, "0")}/${String(
      today.getMonth() + 1
    ).padStart(2, "0")}/${today.getFullYear()}`;
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
        intro:
          "Le compartimos una propuesta clara y flexible para su curso de preparación EXANI, con esquemas de pago y beneficios vigentes.",
        highlight:
          "Por disponibilidad y estructura de beneficios, esta propuesta prioriza el mejor valor inmediato y una lectura simple de los costos.",
      },
      pricing: {
        list: app.formatCurrencyMXN(currentPricing.listPrice),
        cash: app.formatCurrencyMXN(currentPricing.cash),
        cashDiscount: currentPricing.cashDiscountExcluded ? "Sin descuento de contado" : `${currentPricing.cashDiscount || 0}% de descuento`,
        plan: app.formatCurrencyMXN(planPricing.installment),
        planDiscount: `${planPricing.installmentDiscount || 0}% de descuento`,
        planVigencia: app.getMonthYearLabelFromRule(planPricing),
        inscription: app.formatCurrencyMXN(registration),
        paymentsLabel: `${numPayments} mensualidades`,
        paymentAmount: app.formatCurrencyMXN(monthly),
        msi6: app.formatCurrencyMXN((currentPricing.listPrice || 0) / 6),
        msi9: app.formatCurrencyMXN((currentPricing.listPrice || 0) / 9),
        msi12: app.formatCurrencyMXN((currentPricing.listPrice || 0) / 12),
      },
      alternatives: alternativeCourses,
      noCashDiscountNotice: currentPricing.cashDiscountNotice || "",
      hideCashPaymentOption: app.shouldHideCashPaymentOption
        ? app.shouldHideCashPaymentOption(quoteData.syllabus, quoteData.campus)
        : false,
      showDiagnostic,
      onlySixMSI,
    };

    const html = buildPrintableQuoteHtml(printData);
    const previewWindow = window.open("", "_blank");

    if (!previewWindow) {
      app.showToast(
        "Tu navegador bloqueó la nueva ventana. Permite pop-ups para abrir la vista del PDF.",
        "error",
        4500
      );
      return;
    }

    previewWindow.document.open();
    previewWindow.document.write(html);
    previewWindow.document.close();
    previewWindow.focus();
    app.showToast("Se abrió la vista premium para guardar como PDF.", "success", 3500);
  }

  app.buildPrintableQuoteHtml = buildPrintableQuoteHtml;
  app.generatePDF = generatePDF;
})(window.CotizadorApp);
