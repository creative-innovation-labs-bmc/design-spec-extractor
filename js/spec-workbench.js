const DEVICE_PRESETS = [
  { id: "desktop-large", kind: "desktop", label: "Large desktop", width: 1800, min: 1441, max: null, note: "Recommended primary width for wide editorial and portfolio layouts." },
  { id: "desktop-standard", kind: "desktop", label: "Standard desktop", width: 1440, min: 1200, max: 1800, note: "Common desktop and laptop design reference." },
  { id: "desktop-compact", kind: "desktop", label: "Compact desktop", width: 1280, min: 1025, max: 1439, note: "Useful QA width for smaller laptops." },
  { id: "tablet-landscape", kind: "tablet", label: "Tablet landscape", width: 1024, min: 835, max: 1199, note: "Useful transition layout between desktop and portrait tablet." },
  { id: "tablet-portrait", kind: "tablet", label: "Tablet portrait", width: 834, min: 769, max: 1023, note: "Strong general portrait tablet reference." },
  { id: "tablet-compact", kind: "tablet", label: "Compact tablet", width: 768, min: 641, max: 833, note: "Common compact tablet and breakpoint QA width." },
  { id: "mobile-large", kind: "mobile", label: "Large mobile", width: 430, min: 391, max: 640, note: "Large current phone reference." },
  { id: "mobile-standard", kind: "mobile", label: "Standard mobile", width: 390, min: 376, max: 430, note: "Recommended primary mobile design width." },
  { id: "mobile-compact", kind: "mobile", label: "Compact mobile", width: 375, min: 361, max: 389, note: "Useful compact iPhone-style reference." },
  { id: "mobile-minimum", kind: "mobile", label: "Minimum mobile QA", width: 360, min: 320, max: 374, note: "Minimum practical QA width for tighter Android layouts." },
];

const RESPONSIVE_BEHAVIOURS = [
  ["fluid", "Resize fluidly"],
  ["scale", "Scale proportionally"],
  ["stack", "Stack vertically"],
  ["wrap", "Wrap content"],
  ["reorder", "Change order"],
  ["hide", "Hide at this width"],
  ["replace", "Use breakpoint replacement"],
  ["fixed", "Keep fixed size"],
];

const ASSET_INSTRUCTIONS = [
  ["not-applicable", "Not an asset"],
  ["use-original", "Use supplied original asset"],
  ["extract-reference", "Extract or recreate from reference"],
  ["supply-separately", "Asset must be supplied separately"],
  ["placeholder", "Use labelled placeholder"],
  ["decorative", "Decorative only"],
];

const SEMANTIC_ROLES = [
  ["auto", "Auto / infer from context"],
  ["header", "Header"],
  ["nav", "Navigation"],
  ["main", "Main content"],
  ["section", "Section"],
  ["article", "Article"],
  ["aside", "Aside"],
  ["footer", "Footer"],
  ["button", "Button"],
  ["link", "Link"],
  ["form", "Form"],
  ["image", "Meaningful image"],
  ["presentation", "Decorative / presentation"],
];

const COMMON_GOOGLE_FONTS = [
  "Albert Sans", "Alegreya", "Archivo", "Barlow", "Bebas Neue", "Bitter", "Bodoni Moda", "Cabin",
  "Cardo", "Cormorant Garamond", "DM Sans", "DM Serif Display", "EB Garamond", "Figtree", "Fira Sans",
  "Fraunces", "IBM Plex Mono", "IBM Plex Sans", "IBM Plex Serif", "Inter", "Josefin Sans", "Karla",
  "Libre Baskerville", "Libre Franklin", "Lora", "Manrope", "Merriweather", "Montserrat", "Mulish",
  "Noto Sans", "Noto Serif", "Nunito Sans", "Onest", "Open Sans", "Oswald", "Outfit", "Playfair Display",
  "Plus Jakarta Sans", "Poppins", "PT Sans", "PT Serif", "Raleway", "Roboto", "Roboto Condensed", "Roboto Mono",
  "Roboto Slab", "Rubik", "Source Sans 3", "Source Serif 4", "Space Grotesk", "Space Mono", "Spectral",
  "Sora", "Urbanist", "Work Sans", "Zilla Slab",
];

const api = window.DesignSpecApp;
if (api) {
  initialiseWorkbench(api);
} else {
  document.addEventListener("designspec:ready", (event) => initialiseWorkbench(event.detail || window.DesignSpecApp), { once: true });
}

function initialiseWorkbench(core) {
  const runtime = {
    activeTab: "responsive",
    audit: null,
    googleChecks: new Map(),
    layoutSuggestions: new Map(),
    refreshQueued: false,
    lastContextKey: "",
  };

  ensureProjectModel(core.state.project);
  core.state.documents.forEach(ensureDocumentModel);
  injectHeaderControls();
  injectDialog();
  bindWorkbenchEvents();
  refresh();

  document.addEventListener("designspec:statechange", scheduleRefresh);
  document.addEventListener("designspec:ready", scheduleRefresh);

  window.DesignSpecWorkbench = {
    refresh,
    analysePdfPage,
    augmentPrompt,
    augmentMarkdown,
    generateAdditionalFiles,
    restoreAdditionalFiles,
    runAudit,
    openAudit: () => openWorkbench("audit"),
  };

  function scheduleRefresh() {
    if (runtime.refreshQueued) return;
    runtime.refreshQueued = true;
    requestAnimationFrame(() => {
      runtime.refreshQueued = false;
      refresh();
    });
  }

  function ensureProjectModel(project) {
    project.responsive ??= {
      guidanceVersion: 1,
      componentLinks: [],
      generatedRulesNotes: "",
    };
    project.responsive.componentLinks ??= [];
    project.fontSources ??= [];
    project.buildRequirements ??= {
      routes: [],
      cms: "",
      contentOwner: "",
      interactions: "",
      formsAndData: "",
      browserTargets: "Current Chrome, Edge, Safari and Firefox. Confirm any signage or embedded-browser constraints separately.",
      performance: "",
      seoAndIndexing: "",
      analyticsAndPrivacy: "",
      deployment: "",
      accessibilityTarget: "WCAG 2.2 AA where practical without changing the approved visual design.",
    };
    project.auditOverrides ??= [];
  }

  function ensureDocumentModel(doc) {
    doc.viewport ??= {
      kind: inferViewportKind(doc.cssWidth),
      label: "",
      presetId: "",
      minWidth: null,
      maxWidth: null,
      orientation: "auto",
      notes: "",
    };
    doc.pdfTextRuns ??= [];
    doc.detectedTypography ??= [];
    doc.layoutAnalysis ??= null;
    doc.comparisonScore ??= null;
    doc.annotations.forEach(ensureRegionModel);
  }

  function ensureRegionModel(region) {
    region.componentKey ??= "";
    region.responsive ??= {
      behaviour: "fluid",
      order: null,
      hidden: false,
      replacementKey: "",
      notes: "",
    };
    region.asset ??= {
      instruction: region.type === "image" ? "supply-separately" : "not-applicable",
      name: "",
      preferredFormat: "",
      notes: "",
    };
    region.accessibility ??= {
      role: semanticRoleForType(region.type),
      headingLevel: "",
      altText: "",
      decorative: region.type === "decoration",
      readingOrder: null,
      keyboardNotes: "",
    };
  }

  function injectHeaderControls() {
    const actions = document.querySelector(".header-actions");
    if (!actions || document.querySelector("#responsiveWorkbenchBtn")) return;

    const responsiveButton = document.createElement("button");
    responsiveButton.id = "responsiveWorkbenchBtn";
    responsiveButton.className = "button button-quiet workbench-header-button";
    responsiveButton.type = "button";
    responsiveButton.innerHTML = '<span class="workbench-button-label">Responsive</span><span id="responsiveHeaderStatus" class="workbench-button-meta">Set references</span>';

    const auditButton = document.createElement("button");
    auditButton.id = "auditWorkbenchBtn";
    auditButton.className = "button button-quiet workbench-header-button";
    auditButton.type = "button";
    auditButton.innerHTML = '<span class="workbench-button-label">Preflight</span><span id="auditHeaderStatus" class="workbench-button-meta">Not checked</span>';

    const exportButton = document.querySelector("#exportBtn");
    actions.insertBefore(responsiveButton, exportButton);
    actions.insertBefore(auditButton, exportButton);
  }

  function injectDialog() {
    if (document.querySelector("#designWorkbenchDialog")) return;
    const dialog = document.createElement("dialog");
    dialog.id = "designWorkbenchDialog";
    dialog.className = "workbench-dialog";
    dialog.innerHTML = `
      <div class="workbench-shell">
        <header class="workbench-header">
          <div>
            <p class="workbench-kicker">Build-readiness workbench</p>
            <h2>Complete the design package before coding</h2>
            <p>Responsive references, font locks, components, assets, accessibility and delivery requirements are exported with the measured design.</p>
          </div>
          <button id="closeWorkbenchBtn" class="icon-button" type="button" aria-label="Close workbench">×</button>
        </header>
        <nav class="workbench-nav" aria-label="Design package sections">
          ${[
            ["responsive", "Responsive"],
            ["typography", "Typography"],
            ["structure", "Structure"],
            ["assets", "Assets & accessibility"],
            ["requirements", "Build brief"],
            ["audit", "Preflight audit"],
          ].map(([id, label]) => `<button type="button" data-workbench-tab="${id}">${label}</button>`).join("")}
        </nav>
        <div class="workbench-content">
          <section data-workbench-panel="responsive"></section>
          <section data-workbench-panel="typography" hidden></section>
          <section data-workbench-panel="structure" hidden></section>
          <section data-workbench-panel="assets" hidden></section>
          <section data-workbench-panel="requirements" hidden></section>
          <section data-workbench-panel="audit" hidden></section>
        </div>
      </div>`;
    document.body.append(dialog);
  }

  function bindWorkbenchEvents() {
    document.querySelector("#responsiveWorkbenchBtn")?.addEventListener("click", () => openWorkbench("responsive"));
    document.querySelector("#auditWorkbenchBtn")?.addEventListener("click", () => openWorkbench("audit"));
    document.querySelector("#closeWorkbenchBtn")?.addEventListener("click", () => document.querySelector("#designWorkbenchDialog")?.close());
    document.querySelectorAll("[data-workbench-tab]").forEach((button) => {
      button.addEventListener("click", () => setWorkbenchTab(button.dataset.workbenchTab));
    });
    document.querySelector("#designWorkbenchDialog")?.addEventListener("click", (event) => {
      if (event.target.id === "designWorkbenchDialog") event.currentTarget.close();
    });
  }

  function openWorkbench(tab = runtime.activeTab) {
    ensureProjectModel(core.state.project);
    core.state.documents.forEach(ensureDocumentModel);
    runtime.lastContextKey = workbenchContextKey();
    setWorkbenchTab(tab);
    const dialog = document.querySelector("#designWorkbenchDialog");
    if (!dialog.open) dialog.showModal();
  }

  function setWorkbenchTab(tab) {
    runtime.activeTab = tab;
    document.querySelectorAll("[data-workbench-tab]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.workbenchTab === tab);
    });
    document.querySelectorAll("[data-workbench-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.workbenchPanel !== tab;
    });
    renderActiveWorkbenchPanel();
  }

  function refresh() {
    ensureProjectModel(core.state.project);
    core.state.documents.forEach(ensureDocumentModel);
    updateHeaderStatus();
    const contextKey = workbenchContextKey();
    if (document.querySelector("#designWorkbenchDialog")?.open && contextKey !== runtime.lastContextKey) {
      runtime.lastContextKey = contextKey;
      renderActiveWorkbenchPanel();
    }
  }

  function workbenchContextKey() {
    return [
      core.state.activeDocumentId || "",
      core.state.selectedRegionId || "",
      core.state.documents.length,
      core.state.documents.map((doc) => doc.annotations.length).join(","),
      core.state.project.typeStyles.length,
      core.state.project.fontSources.length,
      core.state.project.buildRequirements.routes.length,
    ].join("|");
  }

  function updateHeaderStatus() {
    const active = core.activeDocument();
    const responsiveStatus = document.querySelector("#responsiveHeaderStatus");
    if (responsiveStatus) {
      responsiveStatus.textContent = active
        ? `${titleCase(active.viewport.kind)} · ${Math.round(active.cssWidth)}px`
        : "Set references";
    }
    runtime.audit = runAudit({ silent: true });
    const auditStatus = document.querySelector("#auditHeaderStatus");
    if (auditStatus) {
      const count = runtime.audit.issues.length;
      auditStatus.textContent = count ? `${runtime.audit.score}% · ${count} issue${count === 1 ? "" : "s"}` : "100% · Ready";
      auditStatus.dataset.severity = runtime.audit.blocking.length ? "error" : runtime.audit.warnings.length ? "warning" : "ready";
    }
  }

  function renderActiveWorkbenchPanel() {
    const renderer = {
      responsive: renderResponsivePanel,
      typography: renderTypographyPanel,
      structure: renderStructurePanel,
      assets: renderAssetsPanel,
      requirements: renderRequirementsPanel,
      audit: renderAuditPanel,
    }[runtime.activeTab];
    renderer?.();
  }

  function renderResponsivePanel() {
    const panel = document.querySelector('[data-workbench-panel="responsive"]');
    const doc = core.activeDocument();
    const region = core.selectedRegion();
    const profiles = responsiveProfiles();
    panel.innerHTML = `
      <div class="workbench-section">
        <div class="workbench-section-heading">
          <div><h3>Practical reference widths</h3><p>These are design targets, not rigid media-query rules. Build fluidly between the supplied references.</p></div>
        </div>
        <div class="device-guidance-grid">
          ${deviceGuidanceCard("Desktop", "1800px primary", "1440px standard · 1280px QA", "Use 1800px for this portfolio design, then verify at 1440px and 1280px.")}
          ${deviceGuidanceCard("Tablet", "834px portrait", "1024px landscape · 768px compact", "Do not just shrink desktop. Confirm columns, navigation and content order.")}
          ${deviceGuidanceCard("Mobile", "390px primary", "430px large · 375px compact · 360px minimum QA", "Design at 390px and confirm nothing breaks at 360px.")}
        </div>
      </div>
      <div class="workbench-grid two-column">
        <div class="workbench-section">
          <div class="workbench-section-heading"><div><h3>Current reference</h3><p>${doc ? escape(doc.name) : "Select or import a reference first."}</p></div></div>
          ${doc ? responsiveDocumentEditor(doc) : emptyPrompt("No active reference", "Import a desktop, tablet or mobile reference, then assign its role here.")}
        </div>
        <div class="workbench-section">
          <div class="workbench-section-heading"><div><h3>Reference matrix</h3><p>Each artboard or PDF page can represent a different responsive state.</p></div><button id="addResponsiveReferenceBtn" class="button button-small button-quiet" type="button">Add reference</button></div>
          ${profiles.length ? `<div class="responsive-reference-list">${profiles.map(responsiveReferenceCard).join("")}</div>` : emptyPrompt("No references assigned", "Assign Desktop, Tablet or Mobile to the current reference.")}
        </div>
      </div>
      <div class="workbench-grid two-column">
        <div class="workbench-section">
          <div class="workbench-section-heading"><div><h3>Selected region behaviour</h3><p>Describe reflow rather than forcing the coding model to infer it.</p></div></div>
          ${region ? responsiveRegionEditor(region) : emptyPrompt("No region selected", "Select a measured region on the canvas to define how it changes across widths.")}
        </div>
        <div class="workbench-section">
          <div class="workbench-section-heading"><div><h3>Linked components</h3><p>Use one component key for equivalent regions across desktop, tablet and mobile references.</p></div><button id="autoLinkComponentsBtn" class="button button-small button-quiet" type="button">Auto-link names</button></div>
          ${componentLinkSummary()}
        </div>
      </div>
      <div class="workbench-section">
        <div class="workbench-section-heading"><div><h3>Multi-width comparison</h3><p>Load a comparison screenshot on each reference in the main workspace, then calculate a visual-difference score here.</p></div><button id="recalculateScoresBtn" class="button button-small button-quiet" type="button">Recalculate scores</button></div>
        ${comparisonDashboard()}
      </div>
      <div class="workbench-section">
        <div class="workbench-section-heading"><div><h3>Generated responsive CSS guidance</h3><p>This is a starting structure. The references remain the source of truth.</p></div></div>
        <pre class="code-preview">${escape(generateResponsiveCss())}</pre>
      </div>`;

    bindResponsivePanel(doc, region);
  }

  function responsiveDocumentEditor(doc) {
    const viewport = doc.viewport;
    return `
      <div class="field-row">
        <label class="field"><span>Reference role</span><select id="viewportKindSelect">
          ${["unassigned", "desktop", "tablet", "mobile", "custom"].map((kind) => `<option value="${kind}"${viewport.kind === kind ? " selected" : ""}>${titleCase(kind)}</option>`).join("")}
        </select></label>
        <label class="field"><span>Implementation width</span><input id="viewportCssWidth" type="number" min="320" max="10000" value="${Math.round(doc.cssWidth)}"></label>
      </div>
      <div class="preset-button-grid">
        ${DEVICE_PRESETS.filter((preset) => viewport.kind === "unassigned" || viewport.kind === "custom" || preset.kind === viewport.kind)
          .map((preset) => `<button class="preset-chip${Math.round(doc.cssWidth) === preset.width ? " is-active" : ""}" type="button" data-device-preset="${preset.id}" title="${escape(preset.note)}">${preset.width}px<br><small>${escape(preset.label)}</small></button>`).join("")}
      </div>
      <div class="field-row">
        <label class="field"><span>Breakpoint minimum</span><input id="viewportMinWidth" type="number" min="0" placeholder="Auto" value="${viewport.minWidth ?? ""}"></label>
        <label class="field"><span>Breakpoint maximum</span><input id="viewportMaxWidth" type="number" min="0" placeholder="No maximum" value="${viewport.maxWidth ?? ""}"></label>
      </div>
      <label class="field"><span>Reference label</span><input id="viewportLabel" type="text" value="${escapeAttribute(viewport.label || defaultViewportLabel(doc))}" placeholder="Desktop home page"></label>
      <label class="field"><span>Responsive notes for this reference</span><textarea id="viewportNotes" rows="4" placeholder="Navigation collapses, cards become one column, image crop changes…">${escape(viewport.notes || "")}</textarea></label>
      <p class="workbench-helper">Current source ${doc.width}px → implementation ${Math.round(doc.cssWidth)}px · multiplier ${(doc.cssWidth / doc.width).toFixed(4)} · ${((doc.cssWidth / doc.width) * 100).toFixed(2)}%</p>`;
  }

  function responsiveReferenceCard(doc) {
    const selected = doc.id === core.state.activeDocumentId;
    return `<button type="button" class="responsive-reference-card${selected ? " is-active" : ""}" data-select-document="${doc.id}">
      <span class="viewport-badge" data-kind="${doc.viewport.kind}">${titleCase(doc.viewport.kind)}</span>
      <strong>${escape(doc.viewport.label || doc.name)}</strong>
      <span>${Math.round(doc.cssWidth)}px implementation · ${doc.annotations.length} regions</span>
    </button>`;
  }

  function responsiveRegionEditor(region) {
    ensureRegionModel(region);
    const responsive = region.responsive;
    return `
      <p class="selected-region-title"><strong>${escape(region.name)}</strong> <span>${escape(region.type)}</span></p>
      <div class="field-row">
        <label class="field"><span>Responsive behaviour</span><select id="regionResponsiveBehaviour">
          ${RESPONSIVE_BEHAVIOURS.map(([value, label]) => `<option value="${value}"${responsive.behaviour === value ? " selected" : ""}>${label}</option>`).join("")}
        </select></label>
        <label class="field"><span>Component key</span><input id="regionComponentKey" type="text" value="${escapeAttribute(region.componentKey)}" placeholder="article-card"></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Order at this width</span><input id="regionResponsiveOrder" type="number" min="1" value="${responsive.order ?? ""}" placeholder="Unchanged"></label>
        <label class="field checkbox-field"><input id="regionResponsiveHidden" type="checkbox"${responsive.hidden ? " checked" : ""}><span>Hidden at this reference width</span></label>
      </div>
      <label class="field"><span>Replacement component key</span><input id="regionReplacementKey" type="text" value="${escapeAttribute(responsive.replacementKey)}" placeholder="mobile-navigation"></label>
      <label class="field"><span>Reflow notes</span><textarea id="regionResponsiveNotes" rows="4" placeholder="Moves below image, changes to horizontal scroll, keeps crop focal point…">${escape(responsive.notes || "")}</textarea></label>`;
  }

  function bindResponsivePanel(doc, region) {
    document.querySelector("#addResponsiveReferenceBtn")?.addEventListener("click", () => document.querySelector("#referenceInput")?.click());
    document.querySelectorAll("[data-select-document]").forEach((button) => {
      button.addEventListener("click", () => {
        core.state.activeDocumentId = button.dataset.selectDocument;
        core.state.selectedRegionId = null;
        core.renderAll();
        requestAnimationFrame(core.fitToViewport);
        refresh();
      });
    });
    if (doc) {
      document.querySelector("#viewportKindSelect")?.addEventListener("change", (event) => {
        doc.viewport.kind = event.target.value;
        const recommended = recommendedPreset(doc.viewport.kind);
        if (recommended && doc.viewport.kind !== "custom") applyDevicePreset(doc, recommended);
        commitWorkbenchChange();
      });
      document.querySelector("#viewportCssWidth")?.addEventListener("input", (event) => {
        setDocumentCssWidth(doc, Number(event.target.value));
        commitWorkbenchChange(false);
      });
      document.querySelector("#viewportMinWidth")?.addEventListener("input", (event) => {
        doc.viewport.minWidth = nullableNumber(event.target.value);
        commitWorkbenchChange(false);
      });
      document.querySelector("#viewportMaxWidth")?.addEventListener("input", (event) => {
        doc.viewport.maxWidth = nullableNumber(event.target.value);
        commitWorkbenchChange(false);
      });
      document.querySelector("#viewportLabel")?.addEventListener("input", (event) => {
        doc.viewport.label = event.target.value;
        commitWorkbenchChange(false);
      });
      document.querySelector("#viewportNotes")?.addEventListener("input", (event) => {
        doc.viewport.notes = event.target.value;
        commitWorkbenchChange(false);
      });
      document.querySelectorAll("[data-device-preset]").forEach((button) => {
        button.addEventListener("click", () => {
          const preset = DEVICE_PRESETS.find((item) => item.id === button.dataset.devicePreset);
          if (preset) applyDevicePreset(doc, preset);
          commitWorkbenchChange();
        });
      });
    }
    if (region) {
      const bindings = [
        ["#regionResponsiveBehaviour", (value) => { region.responsive.behaviour = value; }],
        ["#regionComponentKey", (value) => { region.componentKey = slug(value); }],
        ["#regionResponsiveOrder", (value) => { region.responsive.order = nullableNumber(value); }],
        ["#regionReplacementKey", (value) => { region.responsive.replacementKey = slug(value); }],
        ["#regionResponsiveNotes", (value) => { region.responsive.notes = value; }],
      ];
      bindings.forEach(([selector, apply]) => document.querySelector(selector)?.addEventListener("input", (event) => {
        apply(event.target.value);
        commitWorkbenchChange(false);
      }));
      document.querySelector("#regionResponsiveHidden")?.addEventListener("change", (event) => {
        region.responsive.hidden = event.target.checked;
        commitWorkbenchChange(false);
      });
    }
    document.querySelector("#autoLinkComponentsBtn")?.addEventListener("click", autoLinkComponentsByName);
    document.querySelector("#recalculateScoresBtn")?.addEventListener("click", async () => {
      await recalculateComparisonScores();
      renderResponsivePanel();
      commitWorkbenchChange(false);
    });
  }

  function renderTypographyPanel() {
    const panel = document.querySelector('[data-workbench-panel="typography"]');
    const detected = aggregateDetectedTypography();
    const confirmed = core.state.project.typeStyles.filter((style) => style.locked || style.source);
    panel.innerHTML = `
      <div class="workbench-section">
        <div class="workbench-section-heading"><div><h3>PDF typography detection</h3><p>PDF text objects are analysed during import. Outlined or flattened text cannot be recovered and must be confirmed manually.</p></div></div>
        <div class="notice-card">
          <strong>Detection is evidence, not proof.</strong>
          <p>Subset names such as <code>ABCDEF+Onest-Bold</code> are cleaned, font size is estimated from the PDF text transform, and confidence is shown. Confirm every important style before export.</p>
        </div>
        ${detected.length ? `<div class="detected-font-list">${detected.map(detectedFontCard).join("")}</div>` : emptyPrompt("No PDF text detected", "Import the original PDF again. If the text was converted to outlines, add typography manually in the main Tokens tab.")}
      </div>
      <div class="workbench-grid two-column">
        <div class="workbench-section">
          <div class="workbench-section-heading"><div><h3>Locked font sources</h3><p>Confirmed sources are written into fonts.css and the coding prompt.</p></div><button id="addFontSourceBtn" class="button button-small button-quiet" type="button">Add font source</button></div>
          ${fontSourceList()}
        </div>
        <div class="workbench-section">
          <div class="workbench-section-heading"><div><h3>Confirmed typography styles</h3><p>These styles are treated as non-negotiable unless the source cannot be licensed or loaded.</p></div></div>
          ${confirmed.length ? `<div class="confirmed-type-list">${confirmed.map(confirmedTypeCard).join("")}</div>` : emptyPrompt("No styles locked", "Confirm detected styles or add exact styles in the Tokens tab.")}
        </div>
      </div>
      <div class="workbench-section">
        <div class="workbench-section-heading"><div><h3>Generated font setup</h3><p>Google Fonts links, Adobe Fonts embeds and local @font-face templates are kept separate from the main token file.</p></div></div>
        <pre class="code-preview">${escape(generateFontsCss())}</pre>
      </div>
      ${fontSourceEditorMarkup()}`;
    bindTypographyPanel(detected);
  }

  function detectedFontCard(candidate, index) {
    const google = suggestGoogleFont(candidate.family);
    const status = runtime.googleChecks.get(candidate.family);
    return `<article class="detected-font-card">
      <div class="detected-font-summary">
        <div><span class="confidence-badge" data-confidence="${candidate.confidence.toLowerCase()}">${candidate.confidence}</span><strong>${escape(candidate.family)}</strong></div>
        <span>${candidate.size}px · weight ${candidate.weight} · ${candidate.count} run${candidate.count === 1 ? "" : "s"}</span>
      </div>
      <p class="detected-font-sample">${escape(candidate.sample || "No sample text")}</p>
      <p class="workbench-helper">Raw PDF name: ${escape(candidate.rawFamily || "Unknown")}${google ? ` · Google Fonts candidate: ${escape(google)}` : ""}${status ? ` · ${escape(status)}` : ""}</p>
      <div class="card-actions">
        <button class="button button-small button-primary" type="button" data-confirm-font="${index}">Confirm style</button>
        ${google ? `<button class="button button-small button-quiet" type="button" data-check-google-font="${index}">Check Google Fonts</button>` : ""}
        <button class="text-button" type="button" data-ignore-font="${index}">Ignore</button>
      </div>
    </article>`;
  }

  function confirmedTypeCard(style) {
    return `<article class="confirmed-type-card"><strong>${escape(style.name)}</strong><span>${escape(style.family)} · ${style.size}px · ${style.weight}</span><small>${style.locked ? "Locked" : "Detected"} · ${escape(style.source || "manual")}</small></article>`;
  }

  function fontSourceList() {
    const sources = core.state.project.fontSources;
    if (!sources.length) return emptyPrompt("No font source selected", "Add Google Fonts, Adobe Fonts, a licensed local webfont reference or a system font.");
    return `<div class="font-source-list">${sources.map((source) => `<article class="font-source-card">
      <div><strong>${escape(source.family)}</strong><span>${escape(titleCase(source.type))}</span></div>
      <p>${escape(source.embedUrl || source.projectUrl || source.filePattern || source.fallback || "No embed detail supplied")}</p>
      <button type="button" class="small-delete" data-remove-font-source="${source.id}" aria-label="Remove ${escapeAttribute(source.family)}">×</button>
    </article>`).join("")}</div>`;
  }

  function fontSourceEditorMarkup() {
    return `<dialog id="fontSourceDialog" class="modal workbench-small-dialog">
      <form method="dialog" id="fontSourceForm">
        <div class="modal-header"><h2>Add font source</h2><button class="icon-button" value="cancel" type="submit" aria-label="Close">×</button></div>
        <div class="modal-body">
          <label class="field"><span>Font family</span><input id="fontSourceFamily" required placeholder="Onest"></label>
          <label class="field"><span>Source type</span><select id="fontSourceType">
            <option value="google">Google Fonts</option><option value="adobe">Adobe Fonts</option><option value="local">Licensed local webfont</option><option value="system">System font</option>
          </select></label>
          <label class="field"><span>Weights</span><input id="fontSourceWeights" placeholder="400, 500, 700"></label>
          <label class="field"><span>Embed URL, Adobe project URL or expected file pattern</span><input id="fontSourceDetail" placeholder="Generated automatically for Google Fonts"></label>
          <label class="field"><span>Fallback stack</span><input id="fontSourceFallback" value="Arial, sans-serif"></label>
          <p class="workbench-helper">Font binaries are not embedded by this tool. Supply licensed local font files directly to the website project.</p>
        </div>
        <div class="modal-actions"><button class="button button-quiet" value="cancel" type="submit">Cancel</button><button id="saveFontSourceBtn" class="button button-primary" value="default" type="submit">Add source</button></div>
      </form>
    </dialog>`;
  }

  function bindTypographyPanel(detected) {
    document.querySelectorAll("[data-confirm-font]").forEach((button) => {
      button.addEventListener("click", () => confirmDetectedFont(detected[Number(button.dataset.confirmFont)]));
    });
    document.querySelectorAll("[data-check-google-font]").forEach((button) => {
      button.addEventListener("click", async () => {
        const candidate = detected[Number(button.dataset.checkGoogleFont)];
        button.disabled = true;
        button.textContent = "Checking…";
        const result = await checkGoogleFont(candidate.family, [candidate.weight]);
        runtime.googleChecks.set(candidate.family, result.message);
        renderTypographyPanel();
      });
    });
    document.querySelectorAll("[data-ignore-font]").forEach((button) => {
      button.addEventListener("click", () => {
        const candidate = detected[Number(button.dataset.ignoreFont)];
        core.state.documents.forEach((doc) => {
          doc.detectedTypography.forEach((entry) => {
            if (normaliseFontFamily(entry.family) === normaliseFontFamily(candidate.family) && Number(entry.size) === Number(candidate.size)) entry.ignored = true;
          });
        });
        commitWorkbenchChange();
      });
    });
    document.querySelectorAll("[data-remove-font-source]").forEach((button) => {
      button.addEventListener("click", () => {
        core.state.project.fontSources = core.state.project.fontSources.filter((source) => source.id !== button.dataset.removeFontSource);
        commitWorkbenchChange();
      });
    });
    document.querySelector("#addFontSourceBtn")?.addEventListener("click", () => document.querySelector("#fontSourceDialog")?.showModal());
    document.querySelector("#fontSourceForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (event.submitter?.id === "saveFontSourceBtn") {
        const family = document.querySelector("#fontSourceFamily").value.trim();
        if (!family) return;
        const type = document.querySelector("#fontSourceType").value;
        const weights = parseWeights(document.querySelector("#fontSourceWeights").value);
        let detail = document.querySelector("#fontSourceDetail").value.trim();
        if (type === "google" && !detail) detail = googleFontsCssUrl(family, weights.length ? weights : [400, 700]);
        core.state.project.fontSources.push({
          id: core.uid(), family, type, weights, fallback: document.querySelector("#fontSourceFallback").value.trim(),
          embedUrl: type === "google" ? detail : "",
          projectUrl: type === "adobe" ? detail : "",
          filePattern: type === "local" ? detail : "",
        });
        commitWorkbenchChange();
      }
      document.querySelector("#fontSourceDialog")?.close();
    });
  }

  function renderStructurePanel() {
    const panel = document.querySelector('[data-workbench-panel="structure"]');
    const doc = core.activeDocument();
    const analysis = doc?.layoutAnalysis;
    panel.innerHTML = `
      <div class="workbench-grid two-column">
        <div class="workbench-section">
          <div class="workbench-section-heading"><div><h3>Layout and spacing analysis</h3><p>Analyses measured regions and image transitions. Results are suggestions that must be reviewed.</p></div><button id="analyseLayoutBtn" class="button button-small button-primary" type="button"${doc ? "" : " disabled"}>Analyse current reference</button></div>
          ${analysis ? layoutAnalysisSummary(doc, analysis) : emptyPrompt("No analysis yet", "Measure major regions first, then run analysis to detect alignments, gaps, margins and possible sections.")}
        </div>
        <div class="workbench-section">
          <div class="workbench-section-heading"><div><h3>Repeated component recognition</h3><p>Groups similar measured boxes by type and dimensions.</p></div><button id="applyComponentGroupsBtn" class="button button-small button-quiet" type="button"${analysis?.componentGroups?.length ? "" : " disabled"}>Apply component keys</button></div>
          ${analysis?.componentGroups?.length ? componentGroupList(analysis.componentGroups) : emptyPrompt("No repeated groups detected", "Mark repeated cards or content blocks, then run the analysis.")}
        </div>
      </div>
      <div class="workbench-section">
        <div class="workbench-section-heading"><div><h3>Suggested regions and guides</h3><p>Horizontal image changes can suggest major page sections. Existing measured alignments can suggest guides.</p></div><div class="card-actions"><button id="applySuggestedGuidesBtn" class="button button-small button-quiet" type="button"${analysis ? "" : " disabled"}>Apply guides</button><button id="applySuggestedRegionsBtn" class="button button-small button-quiet" type="button"${analysis?.suggestedRegions?.length ? "" : " disabled"}>Add section suggestions</button></div></div>
        ${analysis ? suggestedLayoutList(analysis) : emptyPrompt("Nothing to review", "Run the layout analysis on the current reference.")}
      </div>
      <div class="workbench-section">
        <div class="workbench-section-heading"><div><h3>Detected design system</h3><p>Add useful gaps to the spacing token list. Do not add every incidental measurement.</p></div><button id="applySpacingTokensBtn" class="button button-small button-quiet" type="button"${analysis?.spacing?.length ? "" : " disabled"}>Add spacing tokens</button></div>
        ${analysis ? detectedSystemSummary(analysis) : emptyPrompt("No detected system", "The result will show likely margins, alignments, grid columns and repeated gaps.")}
      </div>`;

    document.querySelector("#analyseLayoutBtn")?.addEventListener("click", async () => {
      if (!doc) return;
      const button = document.querySelector("#analyseLayoutBtn");
      button.disabled = true;
      button.textContent = "Analysing…";
      doc.layoutAnalysis = await analyseLayout(doc);
      commitWorkbenchChange();
    });
    document.querySelector("#applySuggestedGuidesBtn")?.addEventListener("click", () => applySuggestedGuides(doc));
    document.querySelector("#applySuggestedRegionsBtn")?.addEventListener("click", () => applySuggestedRegions(doc));
    document.querySelector("#applySpacingTokensBtn")?.addEventListener("click", () => applySpacingTokens(doc));
    document.querySelector("#applyComponentGroupsBtn")?.addEventListener("click", () => applyComponentGroups(doc));
  }

  function layoutAnalysisSummary(doc, analysis) {
    return `<div class="metric-grid">
      ${metricCard("Regions measured", doc.annotations.length)}
      ${metricCard("Likely vertical alignments", analysis.alignmentsX.length)}
      ${metricCard("Likely horizontal alignments", analysis.alignmentsY.length)}
      ${metricCard("Repeated groups", analysis.componentGroups.length)}
    </div>
    <p class="workbench-helper">Analysis generated ${formatDate(analysis.generatedAt)}. Re-run after major annotation changes.</p>`;
  }

  function componentGroupList(groups) {
    return `<div class="component-group-list">${groups.map((group) => `<article><strong>${escape(group.suggestedKey)}</strong><span>${escape(group.type)} · ${group.regionIds.length} instances</span><small>Approx. ${group.width} × ${group.height}px CSS</small></article>`).join("")}</div>`;
  }

  function suggestedLayoutList(analysis) {
    return `<div class="suggestion-grid">
      <article><strong>Vertical guides</strong><p>${analysis.alignmentsX.length ? analysis.alignmentsX.join(", ") + "px" : "None detected"}</p></article>
      <article><strong>Horizontal guides</strong><p>${analysis.alignmentsY.length ? analysis.alignmentsY.join(", ") + "px" : "None detected"}</p></article>
      <article><strong>Possible sections</strong><p>${analysis.suggestedRegions.length ? analysis.suggestedRegions.length + " full-width bands" : "None detected"}</p></article>
      <article><strong>Possible outer margins</strong><p>${analysis.outerMargins ? `${analysis.outerMargins.left}px left · ${analysis.outerMargins.right}px right` : "Insufficient measured regions"}</p></article>
    </div>`;
  }

  function detectedSystemSummary(analysis) {
    return `<div class="token-analysis">
      <div><strong>Likely spacing values</strong><div class="token-chips">${analysis.spacing.length ? analysis.spacing.map((value) => `<span class="token-chip">${value}px</span>`).join("") : "None"}</div></div>
      <div><strong>Likely grid</strong><p>${analysis.grid ? `${analysis.grid.columns} columns · ${analysis.grid.gutter}px gutter · confidence ${analysis.grid.confidence}` : "No stable column grid detected"}</p></div>
    </div>`;
  }

  function renderAssetsPanel() {
    const panel = document.querySelector('[data-workbench-panel="assets"]');
    const region = core.selectedRegion();
    if (region) ensureRegionModel(region);
    panel.innerHTML = `
      <div class="workbench-grid two-column">
        <div class="workbench-section">
          <div class="workbench-section-heading"><div><h3>Selected region asset instruction</h3><p>Make asset ownership and extraction explicit before coding begins.</p></div></div>
          ${region ? assetEditor(region) : emptyPrompt("No region selected", "Select an image, media, logo, icon or decorative region on the canvas.")}
        </div>
        <div class="workbench-section">
          <div class="workbench-section-heading"><div><h3>Accessibility annotation</h3><p>Define semantics and reading order without changing the approved visual layout.</p></div></div>
          ${region ? accessibilityEditor(region) : emptyPrompt("No region selected", "Select a region to set semantic role, heading level, alt text and keyboard notes.")}
        </div>
      </div>
      <div class="workbench-section">
        <div class="workbench-section-heading"><div><h3>Asset manifest</h3><p>Every visual region that needs a separate production asset should have an instruction and filename.</p></div></div>
        ${assetManifestTable()}
      </div>
      <div class="workbench-section">
        <div class="workbench-section-heading"><div><h3>Reading order and semantics</h3><p>Review page structure across all references, especially when mobile ordering differs from desktop.</p></div></div>
        ${accessibilityManifestTable()}
      </div>`;
    bindAssetsPanel(region);
  }

  function assetEditor(region) {
    return `
      <p class="selected-region-title"><strong>${escape(region.name)}</strong> <span>${escape(region.type)}</span></p>
      <label class="field"><span>Asset instruction</span><select id="assetInstruction">${ASSET_INSTRUCTIONS.map(([value, label]) => `<option value="${value}"${region.asset.instruction === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
      <div class="field-row"><label class="field"><span>Asset filename or ID</span><input id="assetName" value="${escapeAttribute(region.asset.name)}" placeholder="hero-portrait.webp"></label><label class="field"><span>Preferred format</span><input id="assetFormat" value="${escapeAttribute(region.asset.preferredFormat)}" placeholder="WebP, SVG, MP4"></label></div>
      <label class="field"><span>Asset and crop notes</span><textarea id="assetNotes" rows="4" placeholder="Keep focal point on the face. Provide 2x source. Transparent background required…">${escape(region.asset.notes || "")}</textarea></label>`;
  }

  function accessibilityEditor(region) {
    return `
      <label class="field"><span>Semantic role</span><select id="accessibilityRole">${SEMANTIC_ROLES.map(([value, label]) => `<option value="${value}"${region.accessibility.role === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
      <div class="field-row"><label class="field"><span>Heading level</span><select id="headingLevel"><option value="">Not a heading</option>${[1,2,3,4,5,6].map((level) => `<option value="h${level}"${region.accessibility.headingLevel === `h${level}` ? " selected" : ""}>H${level}</option>`).join("")}</select></label><label class="field"><span>Reading order</span><input id="readingOrder" type="number" min="1" value="${region.accessibility.readingOrder ?? ""}" placeholder="Auto"></label></div>
      <label class="field"><span>Alt text or accessible name</span><textarea id="altText" rows="3" placeholder="Describe meaning, not appearance. Leave blank only when decorative.">${escape(region.accessibility.altText || "")}</textarea></label>
      <label class="field checkbox-field"><input id="decorativeToggle" type="checkbox"${region.accessibility.decorative ? " checked" : ""}><span>Decorative and hidden from assistive technology</span></label>
      <label class="field"><span>Keyboard or interaction notes</span><textarea id="keyboardNotes" rows="3" placeholder="Enter opens lightbox. Escape closes. Focus returns to trigger…">${escape(region.accessibility.keyboardNotes || "")}</textarea></label>`;
  }

  function bindAssetsPanel(region) {
    if (!region) return;
    const valueBindings = [
      ["#assetInstruction", (value) => { region.asset.instruction = value; }],
      ["#assetName", (value) => { region.asset.name = value; }],
      ["#assetFormat", (value) => { region.asset.preferredFormat = value; }],
      ["#assetNotes", (value) => { region.asset.notes = value; }],
      ["#accessibilityRole", (value) => { region.accessibility.role = value; }],
      ["#headingLevel", (value) => { region.accessibility.headingLevel = value; }],
      ["#readingOrder", (value) => { region.accessibility.readingOrder = nullableNumber(value); }],
      ["#altText", (value) => { region.accessibility.altText = value; }],
      ["#keyboardNotes", (value) => { region.accessibility.keyboardNotes = value; }],
    ];
    valueBindings.forEach(([selector, apply]) => document.querySelector(selector)?.addEventListener("input", (event) => {
      apply(event.target.value);
      commitWorkbenchChange(false);
    }));
    document.querySelector("#decorativeToggle")?.addEventListener("change", (event) => {
      region.accessibility.decorative = event.target.checked;
      if (event.target.checked) region.accessibility.role = "presentation";
      commitWorkbenchChange();
    });
  }

  function assetManifestTable() {
    const rows = allRegions().filter(({ region }) => region.asset.instruction !== "not-applicable");
    if (!rows.length) return emptyPrompt("No asset instructions", "Select image and decorative regions and define whether assets are supplied, extracted or placeholders.");
    return `<div class="workbench-table-wrap"><table class="workbench-table"><thead><tr><th>Reference</th><th>Region</th><th>Instruction</th><th>Filename</th><th>Format</th></tr></thead><tbody>${rows.map(({ doc, region }) => `<tr><td>${escape(doc.viewport.label || doc.name)}</td><td>${escape(region.name)}</td><td>${escape(labelFor(ASSET_INSTRUCTIONS, region.asset.instruction))}</td><td>${escape(region.asset.name || "Missing")}</td><td>${escape(region.asset.preferredFormat || "Not specified")}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function accessibilityManifestTable() {
    const rows = allRegions().filter(({ region }) => region.accessibility.role !== "auto" || region.accessibility.headingLevel || region.accessibility.readingOrder || region.accessibility.altText);
    if (!rows.length) return emptyPrompt("No accessibility annotations", "Add semantics to navigation, headings, buttons, links, images and interactive regions.");
    return `<div class="workbench-table-wrap"><table class="workbench-table"><thead><tr><th>Reference</th><th>Region</th><th>Role</th><th>Heading</th><th>Order</th><th>Accessible name</th></tr></thead><tbody>${rows.map(({ doc, region }) => `<tr><td>${escape(doc.viewport.label || doc.name)}</td><td>${escape(region.name)}</td><td>${escape(region.accessibility.role)}</td><td>${escape(region.accessibility.headingLevel || "")}</td><td>${region.accessibility.readingOrder ?? "Auto"}</td><td>${escape(region.accessibility.decorative ? "Decorative" : region.accessibility.altText || "Missing")}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function renderRequirementsPanel() {
    const panel = document.querySelector('[data-workbench-panel="requirements"]');
    const req = core.state.project.buildRequirements;
    panel.innerHTML = `
      <div class="workbench-section">
        <div class="workbench-section-heading"><div><h3>Page and route plan</h3><p>Define what must exist before a coding agent begins generating routes and templates.</p></div><button id="addRouteBtn" class="button button-small button-quiet" type="button">Add route</button></div>
        ${routePlanner()}
      </div>
      <div class="workbench-grid two-column">
        ${requirementField("CMS and editing workflow", "requirementsCms", req.cms, "Static files, Storyblok, Sanity, custom CMS…")}
        ${requirementField("Content owner and approval", "requirementsContentOwner", req.contentOwner, "Who supplies copy, images and final approval?")}
        ${requirementField("Interactions and motion", "requirementsInteractions", req.interactions, "Menus, sliders, lightboxes, scroll behaviour, animation constraints…")}
        ${requirementField("Forms, search and data", "requirementsForms", req.formsAndData, "Contact forms, search, filters, APIs, validation and data retention…")}
        ${requirementField("Browser and device targets", "requirementsBrowsers", req.browserTargets, "Include signage hardware, embedded browsers and minimum widths.")}
        ${requirementField("Performance requirements", "requirementsPerformance", req.performance, "Image budgets, video strategy, lazy loading, Core Web Vitals…")}
        ${requirementField("SEO and indexing", "requirementsSeo", req.seoAndIndexing, "Public indexing, metadata, structured data, redirects, noindex…")}
        ${requirementField("Analytics, cookies and privacy", "requirementsAnalytics", req.analyticsAndPrivacy, "Analytics platform, cookie consent, privacy requirements…")}
        ${requirementField("Deployment and environments", "requirementsDeployment", req.deployment, "GitHub Pages, Vercel, Cloudflare, domains, staging and production…")}
        ${requirementField("Accessibility target", "requirementsAccessibility", req.accessibilityTarget, "Target standard and known visual constraints.")}
      </div>`;
    bindRequirementsPanel();
  }

  function requirementField(label, id, value, placeholder) {
    return `<div class="workbench-section compact"><label class="field"><span>${label}</span><textarea id="${id}" rows="5" placeholder="${escapeAttribute(placeholder)}">${escape(value || "")}</textarea></label></div>`;
  }

  function routePlanner() {
    const routes = core.state.project.buildRequirements.routes;
    if (!routes.length) return emptyPrompt("No routes defined", "Add the homepage and each unique page template or tool route.");
    return `<div class="route-list">${routes.map((route, index) => `<article class="route-card">
      <div class="route-card-main"><input data-route-field="path" data-route-index="${index}" value="${escapeAttribute(route.path)}" aria-label="Route path"><input data-route-field="name" data-route-index="${index}" value="${escapeAttribute(route.name)}" aria-label="Route name"><select data-route-field="status" data-route-index="${index}"><option value="designed"${route.status === "designed" ? " selected" : ""}>Designed</option><option value="partial"${route.status === "partial" ? " selected" : ""}>Partial design</option><option value="missing"${route.status === "missing" ? " selected" : ""}>Design missing</option></select></div>
      <textarea data-route-field="notes" data-route-index="${index}" rows="2" placeholder="Template, content and interaction notes">${escape(route.notes || "")}</textarea>
      <button class="small-delete" type="button" data-remove-route="${index}" aria-label="Remove route">×</button>
    </article>`).join("")}</div>`;
  }

  function bindRequirementsPanel() {
    const req = core.state.project.buildRequirements;
    const bindings = [
      ["#requirementsCms", "cms"], ["#requirementsContentOwner", "contentOwner"], ["#requirementsInteractions", "interactions"],
      ["#requirementsForms", "formsAndData"], ["#requirementsBrowsers", "browserTargets"], ["#requirementsPerformance", "performance"],
      ["#requirementsSeo", "seoAndIndexing"], ["#requirementsAnalytics", "analyticsAndPrivacy"], ["#requirementsDeployment", "deployment"],
      ["#requirementsAccessibility", "accessibilityTarget"],
    ];
    bindings.forEach(([selector, key]) => document.querySelector(selector)?.addEventListener("input", (event) => {
      req[key] = event.target.value;
      commitWorkbenchChange(false);
    }));
    document.querySelector("#addRouteBtn")?.addEventListener("click", () => {
      req.routes.push({ id: core.uid(), path: req.routes.length ? `/page-${req.routes.length + 1}` : "/", name: req.routes.length ? `Page ${req.routes.length + 1}` : "Home", status: "partial", notes: "" });
      commitWorkbenchChange();
    });
    document.querySelectorAll("[data-route-field]").forEach((control) => {
      control.addEventListener("input", () => {
        req.routes[Number(control.dataset.routeIndex)][control.dataset.routeField] = control.value;
        commitWorkbenchChange(false);
      });
    });
    document.querySelectorAll("[data-remove-route]").forEach((button) => {
      button.addEventListener("click", () => {
        req.routes.splice(Number(button.dataset.removeRoute), 1);
        commitWorkbenchChange();
      });
    });
  }

  function renderAuditPanel() {
    runtime.audit = runAudit({ silent: true });
    const panel = document.querySelector('[data-workbench-panel="audit"]');
    panel.innerHTML = `
      <div class="audit-score-card" data-level="${runtime.audit.blocking.length ? "error" : runtime.audit.warnings.length ? "warning" : "ready"}">
        <div class="audit-score-ring"><strong>${runtime.audit.score}%</strong><span>ready</span></div>
        <div><h3>${runtime.audit.blocking.length ? "Resolve blocking gaps before export" : runtime.audit.warnings.length ? "Usable, with unresolved assumptions" : "Design package is ready for coding"}</h3><p>${runtime.audit.summary}</p></div>
        <button id="rerunAuditBtn" class="button button-small button-primary" type="button">Run audit again</button>
      </div>
      <div class="workbench-grid two-column">
        <div class="workbench-section"><div class="workbench-section-heading"><div><h3>Blocking</h3><p>These prevent a reliable coding handoff.</p></div><span class="count-badge">${runtime.audit.blocking.length}</span></div>${auditIssueList(runtime.audit.blocking, "No blocking issues")}</div>
        <div class="workbench-section"><div class="workbench-section-heading"><div><h3>Warnings</h3><p>These will force the coding agent to make assumptions.</p></div><span class="count-badge">${runtime.audit.warnings.length}</span></div>${auditIssueList(runtime.audit.warnings, "No warnings")}</div>
      </div>
      <div class="workbench-section"><div class="workbench-section-heading"><div><h3>Checks passed</h3><p>Positive evidence included in the exported audit report.</p></div><span class="count-badge">${runtime.audit.passed.length}</span></div><div class="passed-check-grid">${runtime.audit.passed.map((item) => `<div>✓ ${escape(item)}</div>`).join("")}</div></div>`;
    document.querySelector("#rerunAuditBtn")?.addEventListener("click", () => {
      runtime.audit = runAudit({ silent: false });
      renderAuditPanel();
      updateHeaderStatus();
    });
  }

  function auditIssueList(items, emptyText) {
    if (!items.length) return `<div class="audit-empty">✓ ${emptyText}</div>`;
    return `<div class="audit-issue-list">${items.map((item) => `<article data-severity="${item.severity}"><strong>${escape(item.title)}</strong><p>${escape(item.detail)}</p><span>${escape(item.area)}</span></article>`).join("")}</div>`;
  }

  function runAudit({ silent = false } = {}) {
    ensureProjectModel(core.state.project);
    core.state.documents.forEach(ensureDocumentModel);
    const blocking = [];
    const warnings = [];
    const passed = [];
    const add = (severity, area, title, detail) => (severity === "error" ? blocking : warnings).push({ severity, area, title, detail });

    const docs = core.state.documents;
    const profiles = responsiveProfiles();
    const kinds = new Set(profiles.map((doc) => doc.viewport.kind));
    const regions = allRegions();
    const imageRegions = regions.filter(({ region }) => ["image", "hero", "decoration"].includes(region.type));
    const interactiveRegions = regions.filter(({ region }) => ["button", "navigation", "form"].includes(region.type));
    const detectedFonts = aggregateDetectedTypography();
    const lockedFamilies = new Set(core.state.project.typeStyles.filter((style) => style.locked).map((style) => normaliseFontFamily(style.family)));

    if (!docs.length) add("error", "References", "No design references", "Import at least one image or PDF reference."); else passed.push(`${docs.length} reference${docs.length === 1 ? "" : "s"} imported`);
    if (docs.some((doc) => doc.viewport.kind === "unassigned")) add("warning", "Responsive", "Unassigned references", "Assign Desktop, Tablet, Mobile or Custom to every reference."); else if (docs.length) passed.push("Every reference has a responsive role");
    if (!kinds.has("desktop")) add("error", "Responsive", "Desktop reference missing", "Assign at least one desktop reference before building the primary layout."); else passed.push("Desktop reference supplied");
    if (!kinds.has("mobile")) add("warning", "Responsive", "Mobile reference missing", "A mobile reference at about 390px removes major reflow assumptions."); else passed.push("Mobile reference supplied");
    if (!kinds.has("tablet")) add("warning", "Responsive", "Tablet reference missing", "A tablet reference at 834px or 1024px clarifies the desktop-to-mobile transition."); else passed.push("Tablet reference supplied");
    if (docs.some((doc) => !doc.notes.trim() && !doc.viewport.notes.trim())) add("warning", "References", "Page behaviour notes missing", "Describe interactions, sticky elements, crop changes and any behaviour not visible in the static reference."); else if (docs.length) passed.push("Reference behaviour notes supplied");
    if (!regions.length) add("error", "Measurements", "No measured regions", "Mark major layout regions, repeated components, images and text blocks."); else passed.push(`${regions.length} measured region${regions.length === 1 ? "" : "s"}`);
    if (regions.some(({ region }) => !region.notes.trim())) add("warning", "Measurements", "Region notes incomplete", "At least one measured region has no implementation note."); else if (regions.length) passed.push("Every measured region has implementation notes");
    if (regions.some(({ region }) => region.repeat && !region.componentKey)) add("warning", "Components", "Repeated regions are not linked", "Give repeated components a component key across responsive references."); else if (regions.some(({ region }) => region.repeat)) passed.push("Repeated regions linked to component keys");
    if (imageRegions.some(({ region }) => ["not-applicable", "supply-separately"].includes(region.asset.instruction) && !region.asset.name)) add("warning", "Assets", "Asset manifest incomplete", "Name every image, logo, icon or media asset that must be supplied separately."); else if (imageRegions.length) passed.push("Visual asset instructions recorded");
    if (imageRegions.some(({ region }) => !region.accessibility.decorative && !region.accessibility.altText.trim())) add("warning", "Accessibility", "Image alt text missing", "Provide meaning-based alt text or mark the image decorative."); else if (imageRegions.length) passed.push("Image accessibility intent recorded");
    if (interactiveRegions.some(({ region }) => region.accessibility.role === "auto" || !region.accessibility.keyboardNotes.trim())) add("warning", "Accessibility", "Interactive semantics incomplete", "Confirm roles and keyboard behaviour for navigation, buttons and forms."); else if (interactiveRegions.length) passed.push("Interactive semantics and keyboard notes recorded");
    if (!core.state.project.typeStyles.length) add("error", "Typography", "No typography styles", "Add or confirm display, heading, body and interface styles."); else passed.push(`${core.state.project.typeStyles.length} typography style${core.state.project.typeStyles.length === 1 ? "" : "s"}`);
    if (detectedFonts.some((candidate) => !lockedFamilies.has(normaliseFontFamily(candidate.family)))) add("warning", "Typography", "Detected fonts are unconfirmed", "Confirm or ignore every material font candidate detected in the PDF."); else if (detectedFonts.length) passed.push("Detected PDF fonts resolved");
    if (!core.state.project.fontSources.length && core.state.project.typeStyles.length) add("warning", "Typography", "Font source not recorded", "Choose Google Fonts, Adobe Fonts, licensed local webfont or system font for each family."); else if (core.state.project.fontSources.length) passed.push("Font source and embed strategy recorded");
    if (!core.state.project.brief.trim()) add("error", "Project", "Purpose is missing", "Describe audience, objective and required outcome."); else passed.push("Project purpose supplied");
    if (!core.state.project.missingContent.trim()) add("warning", "Content", "Missing-content scope is unclear", "List what the coding agent may fill in and what must remain a labelled placeholder."); else passed.push("Missing-content scope supplied");
    if (!core.state.project.buildRequirements.routes.length) add("warning", "Routes", "No route plan", "List the homepage and every unique page or tool route."); else passed.push(`${core.state.project.buildRequirements.routes.length} route${core.state.project.buildRequirements.routes.length === 1 ? "" : "s"} planned`);
    if (!core.state.project.buildRequirements.cms.trim()) add("warning", "CMS", "Editing workflow not decided", "Record whether the result is static or uses a CMS, and who maintains content."); else passed.push("CMS or editing workflow recorded");
    if (!core.state.project.buildRequirements.deployment.trim()) add("warning", "Deployment", "Hosting plan not recorded", "Record hosting, domain, staging and production expectations."); else passed.push("Deployment requirements recorded");
    const comparisonNeeded = profiles.filter((doc) => ["desktop", "tablet", "mobile"].includes(doc.viewport.kind));
    if (comparisonNeeded.length && comparisonNeeded.some((doc) => doc.comparisonScore == null)) add("warning", "Visual QA", "Comparison scores missing", "Load implementation screenshots and calculate scores for each supplied responsive reference."); else if (comparisonNeeded.length) passed.push("Responsive visual comparisons calculated");

    const weightedProblems = blocking.length * 12 + warnings.length * 3;
    const score = Math.max(0, Math.min(100, 100 - weightedProblems));
    const issues = [...blocking, ...warnings];
    const summary = `${blocking.length} blocking issue${blocking.length === 1 ? "" : "s"}, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}, ${passed.length} checks passed.`;
    if (!silent) core.showToast(issues.length ? `Preflight found ${issues.length} issue${issues.length === 1 ? "" : "s"}.` : "Preflight passed.");
    return { generatedAt: new Date().toISOString(), score, blocking, warnings, issues, passed, summary };
  }

  async function analysePdfPage(page, renderScale) {
    try {
      const content = await page.getTextContent({ includeMarkedContent: true, disableNormalization: false });
      const styles = content.styles || {};
      const runs = [];
      for (const item of content.items || []) {
        if (!item?.str?.trim || !item.str.trim()) continue;
        const style = styles[item.fontName] || {};
        const rawFamily = style.fontFamily || item.fontName || "Unknown";
        const family = cleanPdfFontName(rawFamily);
        const baseSize = Math.max(1, Math.abs(Number(item.height) || matrixFontSize(item.transform)));
        const sourceSize = round(baseSize * renderScale, 1);
        const weight = guessFontWeight(rawFamily);
        const confidence = fontConfidence(rawFamily, style.fontFamily);
        runs.push({
          text: item.str.trim(), rawFamily, family, fontName: item.fontName || "", weight, confidence,
          pdfSize: round(baseSize, 2), sourceSize,
          x: round((item.transform?.[4] || 0) * renderScale, 1),
          y: round((item.transform?.[5] || 0) * renderScale, 1),
          width: round((item.width || 0) * renderScale, 1),
          height: sourceSize,
        });
      }
      const groups = new Map();
      for (const run of runs) {
        const size = round(run.sourceSize, 1);
        const key = `${normaliseFontFamily(run.family)}|${size}|${run.weight}`;
        const group = groups.get(key) || { family: run.family, rawFamily: run.rawFamily, size, weight: run.weight, count: 0, samples: [], confidence: run.confidence };
        group.count += 1;
        if (group.samples.length < 4 && !group.samples.includes(run.text)) group.samples.push(run.text);
        group.confidence = higherConfidence(group.confidence, run.confidence);
        groups.set(key, group);
      }
      return {
        pdfTextRuns: runs,
        detectedTypography: [...groups.values()].sort((a, b) => b.size - a.size || b.count - a.count).map((group) => ({ ...group, sample: group.samples.join(" · "), ignored: false })),
      };
    } catch (error) {
      console.warn("PDF typography analysis failed", error);
      return { pdfTextRuns: [], detectedTypography: [], pdfAnalysisError: error.message };
    }
  }

  function aggregateDetectedTypography() {
    const groups = new Map();
    core.state.documents.forEach((doc) => {
      ensureDocumentModel(doc);
      doc.detectedTypography.filter((entry) => !entry.ignored).forEach((entry) => {
        const cssSize = round(Number(entry.size) * (doc.cssWidth / doc.width), 1);
        const key = `${normaliseFontFamily(entry.family)}|${cssSize}|${entry.weight}`;
        const group = groups.get(key) || { family: entry.family, rawFamily: entry.rawFamily, size: cssSize, weight: entry.weight, count: 0, samples: [], confidence: entry.confidence || "Medium", docs: new Set() };
        group.count += entry.count || 1;
        if (entry.sample && group.samples.length < 4) group.samples.push(entry.sample);
        group.docs.add(doc.id);
        group.confidence = higherConfidence(group.confidence, entry.confidence || "Medium");
        groups.set(key, group);
      });
    });
    return [...groups.values()].map((group) => ({ ...group, sample: group.samples.join(" · "), docs: [...group.docs] })).sort((a, b) => b.size - a.size || b.count - a.count);
  }

  function confirmDetectedFont(candidate) {
    const styleName = candidate.size >= 52 ? "Display" : candidate.size >= 32 ? "Heading" : candidate.size >= 20 ? "Subheading" : candidate.size <= 14 ? "Caption" : "Body";
    const existing = core.state.project.typeStyles.find((style) => normaliseFontFamily(style.family) === normaliseFontFamily(candidate.family) && Number(style.size) === Number(candidate.size) && Number(style.weight) === Number(candidate.weight));
    if (existing) {
      existing.locked = true;
      existing.source = "pdf-detected-confirmed";
    } else {
      core.state.project.typeStyles.push({
        id: core.uid(), name: uniqueStyleName(styleName), family: candidate.family, size: candidate.size, weight: candidate.weight,
        lineHeight: candidate.size >= 40 ? 1.05 : candidate.size >= 24 ? 1.15 : 1.45,
        letterSpacing: candidate.size >= 40 ? round(candidate.size * -0.018, 1) : 0,
        colour: "#1C1B1C", locked: true, source: "pdf-detected-confirmed", confidence: candidate.confidence,
      });
    }
    const google = suggestGoogleFont(candidate.family);
    if (google && !core.state.project.fontSources.some((source) => normaliseFontFamily(source.family) === normaliseFontFamily(google))) {
      core.state.project.fontSources.push({ id: core.uid(), family: google, type: "google", weights: [candidate.weight], fallback: "Arial, sans-serif", embedUrl: googleFontsCssUrl(google, [candidate.weight]) });
    }
    core.renderTypeStyles();
    commitWorkbenchChange();
    core.showToast(`${candidate.family} confirmed and locked.`);
  }

  async function checkGoogleFont(family, weights) {
    const suggested = suggestGoogleFont(family) || family;
    const url = googleFontsCssUrl(suggested, weights);
    try {
      const response = await fetch(url, { mode: "cors", cache: "no-store" });
      const css = await response.text();
      if (response.ok && /font-family\s*:/i.test(css)) {
        if (!core.state.project.fontSources.some((source) => normaliseFontFamily(source.family) === normaliseFontFamily(suggested))) {
          core.state.project.fontSources.push({ id: core.uid(), family: suggested, type: "google", weights: uniqueNumbers(weights), fallback: "Arial, sans-serif", embedUrl: url });
        }
        commitWorkbenchChange(false);
        return { available: true, message: `Google Fonts match confirmed: ${suggested}`, url };
      }
      return { available: false, message: "No exact Google Fonts match returned", url };
    } catch {
      return { available: null, message: "Google Fonts check unavailable; candidate retained for manual confirmation", url };
    }
  }

  async function analyseLayout(doc) {
    ensureDocumentModel(doc);
    const scale = doc.cssWidth / doc.width;
    const tolerance = Math.max(3, Math.round(8 / scale));
    const annotations = doc.annotations;
    const alignmentsX = clusteredValues(annotations.flatMap((region) => [region.x, region.x + region.w, region.x + region.w / 2]), tolerance)
      .filter((cluster) => cluster.count >= 2).map((cluster) => round(cluster.value * scale, 1));
    const alignmentsY = clusteredValues(annotations.flatMap((region) => [region.y, region.y + region.h]), tolerance)
      .filter((cluster) => cluster.count >= 2).map((cluster) => round(cluster.value * scale, 1));
    const spacing = detectRegionSpacing(annotations, scale);
    const componentGroups = detectComponentGroups(doc);
    const outerMargins = detectOuterMargins(annotations, doc, scale);
    const imageSections = await detectImageSections(doc);
    const grid = inferGrid(annotations, doc, scale, spacing);
    return {
      generatedAt: new Date().toISOString(),
      alignmentsX: uniqueNumbers(alignmentsX).slice(0, 24),
      alignmentsY: uniqueNumbers(alignmentsY).slice(0, 40),
      spacing,
      componentGroups,
      outerMargins,
      suggestedRegions: imageSections,
      grid,
    };
  }

  function detectRegionSpacing(regions, scale) {
    const gaps = [];
    const sortedX = [...regions].sort((a, b) => a.x - b.x);
    const sortedY = [...regions].sort((a, b) => a.y - b.y);
    for (let i = 0; i < sortedX.length; i += 1) {
      for (let j = i + 1; j < sortedX.length; j += 1) {
        const overlapY = Math.min(sortedX[i].y + sortedX[i].h, sortedX[j].y + sortedX[j].h) - Math.max(sortedX[i].y, sortedX[j].y);
        const gap = sortedX[j].x - (sortedX[i].x + sortedX[i].w);
        if (overlapY > Math.min(sortedX[i].h, sortedX[j].h) * 0.3 && gap > 0 && gap * scale <= 240) gaps.push(round(gap * scale));
      }
    }
    for (let i = 0; i < sortedY.length; i += 1) {
      for (let j = i + 1; j < sortedY.length; j += 1) {
        const overlapX = Math.min(sortedY[i].x + sortedY[i].w, sortedY[j].x + sortedY[j].w) - Math.max(sortedY[i].x, sortedY[j].x);
        const gap = sortedY[j].y - (sortedY[i].y + sortedY[i].h);
        if (overlapX > Math.min(sortedY[i].w, sortedY[j].w) * 0.3 && gap > 0 && gap * scale <= 320) gaps.push(round(gap * scale));
      }
    }
    return clusteredValues(gaps, 3).filter((cluster) => cluster.count >= 2 || gaps.length < 8).sort((a, b) => b.count - a.count).slice(0, 12).map((cluster) => Math.max(1, round(cluster.value)));
  }

  function detectComponentGroups(doc) {
    const groups = [];
    const used = new Set();
    doc.annotations.forEach((region, index) => {
      if (used.has(region.id)) return;
      const matches = doc.annotations.slice(index).filter((candidate) => {
        if (used.has(candidate.id) || candidate.type !== region.type) return false;
        const widthRatio = Math.abs(candidate.w - region.w) / Math.max(region.w, 1);
        const heightRatio = Math.abs(candidate.h - region.h) / Math.max(region.h, 1);
        return widthRatio <= 0.08 && heightRatio <= 0.08;
      });
      if (matches.length >= 2) {
        matches.forEach((match) => used.add(match.id));
        const scale = doc.cssWidth / doc.width;
        groups.push({
          suggestedKey: slug(commonName(matches.map((match) => match.name)) || `${region.type}-${groups.length + 1}`),
          type: region.type,
          regionIds: matches.map((match) => match.id),
          width: round(average(matches.map((match) => match.w)) * scale),
          height: round(average(matches.map((match) => match.h)) * scale),
        });
      }
    });
    return groups;
  }

  function detectOuterMargins(regions, doc, scale) {
    if (!regions.length) return null;
    const candidate = regions.filter((region) => region.w * scale > doc.cssWidth * 0.35);
    if (!candidate.length) return null;
    const left = round(median(candidate.map((region) => region.x * scale)));
    const right = round(median(candidate.map((region) => (doc.width - region.x - region.w) * scale)));
    return { left, right };
  }

  async function detectImageSections(doc) {
    const maxWidth = 220;
    const scale = Math.min(1, maxWidth / doc.width);
    const width = Math.max(2, Math.round(doc.width * scale));
    const height = Math.max(2, Math.round(doc.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(doc.image, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height).data;
    const rowColours = [];
    for (let y = 0; y < height; y += 1) {
      let r = 0, g = 0, b = 0;
      const stride = Math.max(1, Math.floor(width / 80));
      let count = 0;
      for (let x = 0; x < width; x += stride) {
        const index = (y * width + x) * 4;
        r += data[index]; g += data[index + 1]; b += data[index + 2]; count += 1;
      }
      rowColours.push([r / count, g / count, b / count]);
    }
    const changes = [];
    const windowSize = Math.max(2, Math.round(height * 0.008));
    for (let y = windowSize; y < height - windowSize; y += 1) {
      const before = averageColour(rowColours.slice(y - windowSize, y));
      const after = averageColour(rowColours.slice(y, y + windowSize));
      const difference = Math.hypot(before[0] - after[0], before[1] - after[1], before[2] - after[2]);
      if (difference > 34) changes.push({ y, difference });
    }
    changes.sort((a, b) => b.difference - a.difference);
    const selected = [];
    const minDistance = Math.max(10, height * 0.07);
    for (const candidate of changes) {
      if (selected.every((item) => Math.abs(item.y - candidate.y) > minDistance)) selected.push(candidate);
      if (selected.length >= 10) break;
    }
    const boundaries = [0, ...selected.map((item) => item.y).sort((a, b) => a - b), height];
    return boundaries.slice(0, -1).map((start, index) => {
      const end = boundaries[index + 1];
      const sourceY = Math.round(start / scale);
      const sourceEnd = Math.round(end / scale);
      return { x: 0, y: sourceY, w: doc.width, h: Math.max(1, sourceEnd - sourceY), confidence: "Suggested", name: `Possible section ${index + 1}` };
    }).filter((region) => region.h > doc.height * 0.04);
  }

  function inferGrid(regions, doc, scale, spacing) {
    if (regions.length < 3) return null;
    const leftEdges = clusteredValues(regions.map((region) => round(region.x * scale)), 6).filter((cluster) => cluster.count >= 2);
    if (leftEdges.length < 2) return null;
    const columns = Math.min(12, leftEdges.length);
    const gutter = spacing.find((value) => value >= 12 && value <= 64) || 24;
    return { columns, gutter, confidence: leftEdges.length >= 4 ? "Medium" : "Low" };
  }

  function applySuggestedGuides(doc) {
    if (!doc?.layoutAnalysis) return;
    const scale = doc.cssWidth / doc.width;
    doc.layoutAnalysis.alignmentsX.forEach((value) => addUniqueGuide(doc.guidesX, Math.round(value / scale), 4 / scale));
    doc.layoutAnalysis.alignmentsY.forEach((value) => addUniqueGuide(doc.guidesY, Math.round(value / scale), 4 / scale));
    core.renderAll();
    commitWorkbenchChange();
    core.showToast("Suggested guides added. Remove any that are not meaningful.");
  }

  function applySuggestedRegions(doc) {
    if (!doc?.layoutAnalysis?.suggestedRegions) return;
    const existing = doc.annotations.filter((region) => region.autoSuggested);
    if (existing.length && !confirm("Replace the existing auto-suggested sections?")) return;
    doc.annotations = doc.annotations.filter((region) => !region.autoSuggested);
    doc.layoutAnalysis.suggestedRegions.forEach((suggestion) => {
      const region = { id: core.uid(), name: suggestion.name, type: "section", x: suggestion.x, y: suggestion.y, w: suggestion.w, h: suggestion.h, notes: "Automatically suggested from a strong horizontal image transition. Confirm or delete.", repeat: false, autoSuggested: true };
      ensureRegionModel(region);
      doc.annotations.push(region);
    });
    core.renderAll();
    commitWorkbenchChange();
    core.showToast("Suggested sections added for review.");
  }

  function applySpacingTokens(doc) {
    if (!doc?.layoutAnalysis?.spacing) return;
    doc.layoutAnalysis.spacing.forEach((value) => {
      if (!core.state.project.spacing.includes(value)) core.state.project.spacing.push(value);
    });
    core.renderSpacing();
    commitWorkbenchChange();
    core.showToast("Detected spacing values added to the token list.");
  }

  function applyComponentGroups(doc) {
    if (!doc?.layoutAnalysis?.componentGroups) return;
    doc.layoutAnalysis.componentGroups.forEach((group) => {
      group.regionIds.forEach((id) => {
        const region = doc.annotations.find((item) => item.id === id);
        if (region) { region.componentKey = group.suggestedKey; region.repeat = true; }
      });
    });
    core.renderAll();
    commitWorkbenchChange();
    core.showToast("Component keys applied to detected repeated regions.");
  }

  function autoLinkComponentsByName() {
    const byName = new Map();
    allRegions().forEach(({ region }) => {
      const key = slug(region.name.replace(/\b(desktop|tablet|mobile|large|small)\b/gi, "").trim());
      if (!key) return;
      const entries = byName.get(key) || [];
      entries.push(region);
      byName.set(key, entries);
    });
    let linked = 0;
    byName.forEach((regions, key) => {
      if (regions.length < 2) return;
      regions.forEach((region) => { region.componentKey = key; });
      linked += regions.length;
    });
    commitWorkbenchChange();
    core.showToast(linked ? `Linked ${linked} regions by normalised name.` : "No matching region names found across references.");
  }

  async function recalculateComparisonScores() {
    for (const doc of responsiveProfiles()) {
      if (!doc.compare?.image) { doc.comparisonScore = null; continue; }
      doc.comparisonScore = await calculateComparisonScore(doc);
    }
  }

  async function calculateComparisonScore(doc) {
    const maxDimension = 420;
    const scale = Math.min(1, maxDimension / Math.max(doc.width, doc.height));
    const width = Math.max(1, Math.round(doc.width * scale));
    const height = Math.max(1, Math.round(doc.height * scale));
    const base = document.createElement("canvas");
    const compare = document.createElement("canvas");
    base.width = compare.width = width;
    base.height = compare.height = height;
    const baseContext = base.getContext("2d", { willReadFrequently: true });
    const compareContext = compare.getContext("2d", { willReadFrequently: true });
    baseContext.drawImage(doc.image, 0, 0, width, height);
    compareContext.drawImage(doc.compare.image, 0, 0, width, height);
    const a = baseContext.getImageData(0, 0, width, height).data;
    const b = compareContext.getImageData(0, 0, width, height).data;
    let difference = 0;
    let count = 0;
    for (let index = 0; index < a.length; index += 4) {
      difference += Math.abs(a[index] - b[index]) + Math.abs(a[index + 1] - b[index + 1]) + Math.abs(a[index + 2] - b[index + 2]);
      count += 3;
    }
    const normalised = difference / (count * 255);
    return round(Math.max(0, (1 - normalised) * 100), 1);
  }

  function comparisonDashboard() {
    const docs = responsiveProfiles();
    if (!docs.length) return emptyPrompt("No responsive references", "Assign responsive roles before comparing widths.");
    return `<div class="comparison-dashboard">${docs.map((doc) => `<article><div><span class="viewport-badge" data-kind="${doc.viewport.kind}">${titleCase(doc.viewport.kind)}</span><strong>${escape(doc.viewport.label || doc.name)}</strong><small>${Math.round(doc.cssWidth)}px</small></div><div class="comparison-score">${doc.comparisonScore == null ? "Not scored" : `${doc.comparisonScore}%`}<small>${doc.compare ? "Screenshot loaded" : "Load screenshot in workspace"}</small></div></article>`).join("")}</div>`;
  }

  function componentLinkSummary() {
    const groups = linkedComponents();
    if (!groups.length) return emptyPrompt("No linked components", "Give equivalent regions the same component key, or use Auto-link names.");
    return `<div class="linked-component-list">${groups.map((group) => `<article><strong>${escape(group.key)}</strong><span>${group.entries.length} regions · ${[...new Set(group.entries.map(({ doc }) => titleCase(doc.viewport.kind)))].join(", ")}</span></article>`).join("")}</div>`;
  }

  function linkedComponents() {
    const map = new Map();
    allRegions().forEach((entry) => {
      if (!entry.region.componentKey) return;
      const items = map.get(entry.region.componentKey) || [];
      items.push(entry);
      map.set(entry.region.componentKey, items);
    });
    return [...map.entries()].map(([key, entries]) => ({ key, entries })).sort((a, b) => a.key.localeCompare(b.key));
  }

  function generateResponsiveCss() {
    const profiles = responsiveProfiles().sort((a, b) => b.cssWidth - a.cssWidth);
    const groups = linkedComponents();
    const lines = [
      "/* Generated responsive guidance. Validate against every supplied reference. */",
      ":root {",
      ...profiles.map((doc) => `  --reference-${slug(doc.viewport.label || doc.viewport.kind)}-width: ${Math.round(doc.cssWidth)}px;`),
      "}",
      "",
    ];
    groups.forEach((group) => {
      lines.push(`/* Component: ${group.key} */`, `.${group.key} {}`, "");
      group.entries.sort((a, b) => b.doc.cssWidth - a.doc.cssWidth).forEach(({ doc, region }) => {
        const max = doc.viewport.maxWidth ?? Math.round(doc.cssWidth);
        const declarations = [];
        if (region.responsive.hidden || region.responsive.behaviour === "hide") declarations.push("display: none;");
        if (region.responsive.order != null) declarations.push(`order: ${region.responsive.order};`);
        if (region.responsive.behaviour === "stack") declarations.push("flex-direction: column;");
        if (region.responsive.behaviour === "wrap") declarations.push("flex-wrap: wrap;");
        if (region.responsive.behaviour === "fixed") declarations.push(`width: ${round(region.w * (doc.cssWidth / doc.width), 1)}px;`);
        if (region.responsive.behaviour === "fluid") declarations.push(`width: min(100%, ${round(region.w * (doc.cssWidth / doc.width), 1)}px);`);
        if (declarations.length) lines.push(`@media (max-width: ${max}px) {`, `  .${group.key} { ${declarations.join(" ")} }`, "}", "");
      });
    });
    if (!groups.length) lines.push("/* Link measured regions with component keys to generate component-specific guidance. */");
    return lines.join("\n");
  }

  function generateFontsCss() {
    const lines = ["/* Confirm licensing and include only the weights used by the approved design. */"];
    core.state.project.fontSources.forEach((source) => {
      const family = source.family;
      if (source.type === "google") {
        lines.push(`/* HTML <head>: <link rel="preconnect" href="https://fonts.googleapis.com"> */`, `/* HTML <head>: <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin> */`, `/* HTML <head>: <link href="${source.embedUrl || googleFontsCssUrl(family, source.weights)}" rel="stylesheet"> */`, "");
      } else if (source.type === "adobe") {
        lines.push(`/* Adobe Fonts project: ${source.projectUrl || "Add project URL"} */`, "");
      } else if (source.type === "local") {
        const weights = source.weights?.length ? source.weights : [400];
        weights.forEach((weight) => lines.push(`@font-face {`, `  font-family: "${family}";`, `  src: url("../fonts/${source.filePattern || `${slug(family)}-${weight}.woff2`}") format("woff2");`, `  font-style: normal;`, `  font-weight: ${weight};`, `  font-display: swap;`, `}`, ""));
      } else if (source.type === "system") {
        lines.push(`/* System font: ${family}; fallback ${source.fallback || "sans-serif"} */`, "");
      }
    });
    if (!core.state.project.fontSources.length) lines.push("/* No font sources confirmed. */");
    return lines.join("\n");
  }

  function augmentPrompt(base, spec) {
    ensureProjectModel(spec.project);
    const responsive = spec.documents.map((doc) => {
      const viewport = doc.viewport || {};
      const components = doc.annotations.filter((region) => region.componentKey).map((region) => `${region.componentKey}: ${region.responsive?.behaviour || "fluid"}${region.responsive?.hidden ? ", hidden" : ""}${region.responsive?.order ? `, order ${region.responsive.order}` : ""}`).join("; ") || "No component links.";
      return `- ${viewport.label || doc.name}: ${titleCase(viewport.kind || "unassigned")} at ${doc.cssWidth}px; breakpoint ${viewport.minWidth ?? "auto"}–${viewport.maxWidth ?? "open"}; ${viewport.notes || "No responsive note."}; components: ${components}`;
    }).join("\n");
    const fonts = spec.project.fontSources.length ? spec.project.fontSources.map((source) => `- ${source.family}: ${source.type}; weights ${(source.weights || []).join(", ") || "not specified"}; ${source.embedUrl || source.projectUrl || source.filePattern || source.fallback || "no source detail"}`).join("\n") : "- No font source confirmed.";
    const requirements = spec.project.buildRequirements;
    const routes = requirements.routes.length ? requirements.routes.map((route) => `- ${route.path}: ${route.name}; ${route.status}; ${route.notes || "No note"}`).join("\n") : "- No route plan supplied.";
    return `${base}\n\n## Responsive reference system\n${responsive}\n\nUse the exact supplied desktop, tablet and mobile references. Do not treat mobile as a uniformly scaled desktop. Follow each region's reflow behaviour and component key.\n\n## Locked font sources\n${fonts}\n\nDo not substitute a locked font silently. Record any licensing or technical blocker before changing typography.\n\n## Route and build requirements\n${routes}\n\n- CMS/editing: ${requirements.cms || "Not decided"}\n- Content owner: ${requirements.contentOwner || "Not supplied"}\n- Interactions: ${requirements.interactions || "Not supplied"}\n- Forms/data: ${requirements.formsAndData || "Not supplied"}\n- Browser/device targets: ${requirements.browserTargets || "Not supplied"}\n- Performance: ${requirements.performance || "Not supplied"}\n- SEO/indexing: ${requirements.seoAndIndexing || "Not supplied"}\n- Analytics/privacy: ${requirements.analyticsAndPrivacy || "Not supplied"}\n- Deployment: ${requirements.deployment || "Not supplied"}\n- Accessibility target: ${requirements.accessibilityTarget || "Not supplied"}\n\n## Additional package files\nRead RESPONSIVE_SPEC.md, FONT_SETUP.md, ASSET_MANIFEST.md, ACCESSIBILITY_NOTES.md, BUILD_REQUIREMENTS.md, AUDIT_REPORT.md, responsive-rules.css and fonts.css before implementation.`;
  }

  function augmentMarkdown(base, spec) {
    return `${base}\n\n${generateResponsiveMarkdown(spec)}\n\n${generateFontSetupMarkdown(spec)}\n\n${generateBuildRequirementsMarkdown(spec)}`;
  }

  function generateAdditionalFiles(spec) {
    const audit = runAudit({ silent: true });
    return {
      "RESPONSIVE_SPEC.md": generateResponsiveMarkdown(spec),
      "responsive-rules.css": generateResponsiveCss(),
      "FONT_SETUP.md": generateFontSetupMarkdown(spec),
      "fonts.css": generateFontsCss(),
      "ASSET_MANIFEST.md": generateAssetManifestMarkdown(spec),
      "ACCESSIBILITY_NOTES.md": generateAccessibilityMarkdown(spec),
      "BUILD_REQUIREMENTS.md": generateBuildRequirementsMarkdown(spec),
      "AUDIT_REPORT.md": generateAuditMarkdown(audit),
      "layout-analysis.json": JSON.stringify(spec.documents.map((doc) => ({ id: doc.id, name: doc.name, viewport: doc.viewport, layoutAnalysis: doc.layoutAnalysis, comparisonScore: doc.comparisonScore })), null, 2),
    };
  }

  async function restoreAdditionalFiles() {
    ensureProjectModel(core.state.project);
    core.state.documents.forEach(ensureDocumentModel);
    refresh();
  }

  function generateResponsiveMarkdown(spec = core.serialiseProject()) {
    const lines = ["# Responsive specification", "", "## Practical design reference guidance", "", "- Desktop: 1800px primary for this design; verify at 1440px and 1280px.", "- Tablet: 834px portrait; also verify 1024px landscape and 768px compact.", "- Mobile: 390px primary; verify 430px large, 375px compact and 360px minimum QA.", "", "These are reference widths, not rigid breakpoints. Implement fluid behaviour between them.", "", "## References", ""];
    spec.documents.forEach((doc) => {
      const viewport = doc.viewport || {};
      lines.push(`### ${viewport.label || doc.name}`, "", `- Role: ${titleCase(viewport.kind || "unassigned")}`, `- Implementation width: ${doc.cssWidth}px`, `- Breakpoint range: ${viewport.minWidth ?? "Auto"} to ${viewport.maxWidth ?? "Open"}`, `- Notes: ${viewport.notes || "None"}`, "", "| Region | Component key | Behaviour | Order | Hidden | Notes |", "|---|---|---|---:|---|---|");
      doc.annotations.forEach((region) => lines.push(`| ${escapeTable(region.name)} | ${region.componentKey || ""} | ${region.responsive?.behaviour || "fluid"} | ${region.responsive?.order ?? ""} | ${region.responsive?.hidden ? "Yes" : "No"} | ${escapeTable(region.responsive?.notes || "")} |`));
      lines.push("");
    });
    lines.push("## Visual comparison", "", "| Reference | Width | Match score |", "|---|---:|---:|");
    spec.documents.forEach((doc) => lines.push(`| ${(doc.viewport?.label || doc.name)} | ${doc.cssWidth}px | ${doc.comparisonScore == null ? "Not measured" : `${doc.comparisonScore}%`} |`));
    return lines.join("\n");
  }

  function generateFontSetupMarkdown(spec = core.serialiseProject()) {
    const lines = ["# Font setup", "", "## Confirmed sources", ""];
    if (!spec.project.fontSources.length) lines.push("No font source confirmed.");
    spec.project.fontSources.forEach((source) => lines.push(`- **${source.family}**: ${titleCase(source.type)}; weights ${(source.weights || []).join(", ") || "not specified"}; ${source.embedUrl || source.projectUrl || source.filePattern || source.fallback || "no detail"}`));
    lines.push("", "## Locked styles", "", "| Style | Family | Size | Weight | Source | Locked |", "|---|---|---:|---:|---|---|");
    spec.project.typeStyles.forEach((style) => lines.push(`| ${style.name} | ${style.family} | ${style.size}px | ${style.weight} | ${style.source || "manual"} | ${style.locked ? "Yes" : "No"} |`));
    lines.push("", "Font detection from PDF is provisional until confirmed. Outlined text cannot be detected. Licensed local or Adobe font files must be supplied through the website project's normal licensed workflow.");
    return lines.join("\n");
  }

  function generateAssetManifestMarkdown(spec = core.serialiseProject()) {
    const lines = ["# Asset manifest", "", "| Reference | Region | Instruction | Filename / ID | Format | Notes |", "|---|---|---|---|---|---|"];
    spec.documents.forEach((doc) => doc.annotations.filter((region) => region.asset?.instruction && region.asset.instruction !== "not-applicable").forEach((region) => lines.push(`| ${escapeTable(doc.viewport?.label || doc.name)} | ${escapeTable(region.name)} | ${labelFor(ASSET_INSTRUCTIONS, region.asset.instruction)} | ${escapeTable(region.asset.name || "Missing")} | ${escapeTable(region.asset.preferredFormat || "Not specified")} | ${escapeTable(region.asset.notes || "")} |`)));
    if (lines.length === 2) lines.push("No asset instructions supplied.");
    return lines.join("\n");
  }

  function generateAccessibilityMarkdown(spec = core.serialiseProject()) {
    const lines = ["# Accessibility and interaction notes", "", `Target: ${spec.project.buildRequirements?.accessibilityTarget || "Not supplied"}`, "", "| Reference | Region | Role | Heading | Order | Decorative | Alt text / accessible name | Keyboard notes |", "|---|---|---|---|---:|---|---|---|"];
    spec.documents.forEach((doc) => doc.annotations.forEach((region) => {
      const a11y = region.accessibility || {};
      if (a11y.role !== "auto" || a11y.headingLevel || a11y.readingOrder || a11y.altText || a11y.keyboardNotes) lines.push(`| ${escapeTable(doc.viewport?.label || doc.name)} | ${escapeTable(region.name)} | ${a11y.role || "auto"} | ${a11y.headingLevel || ""} | ${a11y.readingOrder ?? "Auto"} | ${a11y.decorative ? "Yes" : "No"} | ${escapeTable(a11y.altText || "")} | ${escapeTable(a11y.keyboardNotes || "")} |`);
    }));
    return lines.join("\n");
  }

  function generateBuildRequirementsMarkdown(spec = core.serialiseProject()) {
    const req = spec.project.buildRequirements || {};
    const lines = ["# Build requirements", "", "## Routes", ""];
    if (req.routes?.length) req.routes.forEach((route) => lines.push(`- \`${route.path}\` - ${route.name}; ${route.status}; ${route.notes || "No notes"}`)); else lines.push("No routes supplied.");
    lines.push("", "## Delivery decisions", "", `- CMS and editing: ${req.cms || "Not decided"}`, `- Content owner: ${req.contentOwner || "Not supplied"}`, `- Interactions and motion: ${req.interactions || "Not supplied"}`, `- Forms, search and data: ${req.formsAndData || "Not supplied"}`, `- Browser and device targets: ${req.browserTargets || "Not supplied"}`, `- Performance: ${req.performance || "Not supplied"}`, `- SEO and indexing: ${req.seoAndIndexing || "Not supplied"}`, `- Analytics, cookies and privacy: ${req.analyticsAndPrivacy || "Not supplied"}`, `- Deployment: ${req.deployment || "Not supplied"}`, `- Accessibility target: ${req.accessibilityTarget || "Not supplied"}`);
    return lines.join("\n");
  }

  function generateAuditMarkdown(audit) {
    const lines = ["# Design package preflight audit", "", `Generated: ${new Date(audit.generatedAt).toLocaleString("en-AU")}`, `Readiness score: **${audit.score}%**`, "", "## Blocking issues", ""];
    if (audit.blocking.length) audit.blocking.forEach((item) => lines.push(`- **${item.title}** (${item.area}): ${item.detail}`)); else lines.push("None.");
    lines.push("", "## Warnings", "");
    if (audit.warnings.length) audit.warnings.forEach((item) => lines.push(`- **${item.title}** (${item.area}): ${item.detail}`)); else lines.push("None.");
    lines.push("", "## Checks passed", "", ...audit.passed.map((item) => `- ${item}`));
    return lines.join("\n");
  }

  function commitWorkbenchChange(rerender = true) {
    ensureProjectModel(core.state.project);
    core.state.documents.forEach(ensureDocumentModel);
    core.updatePromptPreview();
    if (rerender) renderActiveWorkbenchPanel();
    updateHeaderStatus();
  }

  function setDocumentCssWidth(doc, value) {
    doc.cssWidth = core.clamp(Number(value) || core.state.project.targetWidth, 320, 10000);
    if (doc.id === core.state.activeDocumentId) {
      core.els.pageCssWidth.value = doc.cssWidth;
      core.els.pageCssWidth.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function applyDevicePreset(doc, preset) {
    doc.viewport.kind = preset.kind;
    doc.viewport.presetId = preset.id;
    doc.viewport.minWidth = preset.min;
    doc.viewport.maxWidth = preset.max;
    doc.viewport.label ||= preset.label;
    setDocumentCssWidth(doc, preset.width);
  }

  function responsiveProfiles() {
    return core.state.documents.filter((doc) => {
      ensureDocumentModel(doc);
      return doc.viewport.kind !== "unassigned";
    }).sort((a, b) => b.cssWidth - a.cssWidth);
  }

  function allRegions() {
    return core.state.documents.flatMap((doc) => {
      ensureDocumentModel(doc);
      return doc.annotations.map((region) => { ensureRegionModel(region); return { doc, region }; });
    });
  }

  function recommendedPreset(kind) {
    return DEVICE_PRESETS.find((preset) => (kind === "desktop" && preset.id === "desktop-large") || (kind === "tablet" && preset.id === "tablet-portrait") || (kind === "mobile" && preset.id === "mobile-standard"));
  }

  function defaultViewportLabel(doc) {
    return `${titleCase(doc.viewport.kind)} · ${Math.round(doc.cssWidth)}px`;
  }

  function deviceGuidanceCard(title, primary, secondary, detail) {
    return `<article><span>${title}</span><strong>${primary}</strong><small>${secondary}</small><p>${detail}</p></article>`;
  }

  function metricCard(label, value) {
    return `<article><strong>${value}</strong><span>${label}</span></article>`;
  }

  function emptyPrompt(title, detail) {
    return `<div class="workbench-empty"><strong>${escape(title)}</strong><p>${escape(detail)}</p></div>`;
  }

  function labelFor(options, value) {
    return options.find(([key]) => key === value)?.[1] || value;
  }

  function semanticRoleForType(type) {
    return ({ navigation: "nav", footer: "footer", form: "form", button: "button", image: "image", decoration: "presentation", section: "section" })[type] || "auto";
  }

  function inferViewportKind(width) {
    const value = Number(width) || 1440;
    if (value <= 640) return "mobile";
    if (value <= 1199) return "tablet";
    return "desktop";
  }

  function cleanPdfFontName(value = "") {
    let name = String(value).replace(/^['"]|['"]$/g, "").replace(/^[A-Z]{6}\+/i, "").replace(/^g_[a-z0-9_]+$/i, "Unknown font");
    name = name.replace(/PSMT$/i, "").replace(/MT$/i, "").replace(/[-_](BoldItalic|BoldOblique|SemiBold|DemiBold|ExtraBold|Black|Medium|Regular|Book|Light|Thin|Italic|Oblique)$/i, "").replace(/[-_]+/g, " ").trim();
    return name || "Unknown font";
  }

  function normaliseFontFamily(value = "") {
    return cleanPdfFontName(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function guessFontWeight(value = "") {
    const lower = value.toLowerCase();
    if (/thin/.test(lower)) return 100;
    if (/extra.?light|ultra.?light/.test(lower)) return 200;
    if (/light/.test(lower)) return 300;
    if (/medium/.test(lower)) return 500;
    if (/semi.?bold|demi.?bold/.test(lower)) return 600;
    if (/extra.?bold|ultra.?bold/.test(lower)) return 800;
    if (/black|heavy/.test(lower)) return 900;
    if (/bold/.test(lower)) return 700;
    return 400;
  }

  function fontConfidence(rawFamily, styledFamily) {
    if (styledFamily && !/^g_/i.test(styledFamily) && !/sans-serif|serif|monospace/i.test(styledFamily)) return "High";
    if (/^[A-Z]{6}\+/i.test(rawFamily) || /[-_](bold|regular|medium|light)/i.test(rawFamily)) return "Medium";
    return "Low";
  }

  function higherConfidence(a, b) {
    const rank = { Low: 1, Medium: 2, High: 3 };
    return rank[b] > rank[a] ? b : a;
  }

  function matrixFontSize(transform = []) {
    const a = Number(transform[0]) || 0;
    const b = Number(transform[1]) || 0;
    const c = Number(transform[2]) || 0;
    const d = Number(transform[3]) || 0;
    return Math.max(Math.hypot(a, b), Math.hypot(c, d), 1);
  }

  function suggestGoogleFont(family) {
    const normalised = normaliseFontFamily(family);
    const exact = COMMON_GOOGLE_FONTS.find((candidate) => normaliseFontFamily(candidate) === normalised);
    if (exact) return exact;
    const contained = COMMON_GOOGLE_FONTS.find((candidate) => normaliseFontFamily(candidate).includes(normalised) || normalised.includes(normaliseFontFamily(candidate)));
    return contained || "";
  }

  function googleFontsCssUrl(family, weights = [400, 700]) {
    const familyValue = family.trim().replace(/\s+/g, "+");
    const validWeights = uniqueNumbers(weights.map(Number).filter((value) => value >= 100 && value <= 900));
    return `https://fonts.googleapis.com/css2?family=${familyValue}${validWeights.length ? `:wght@${validWeights.join(";")}` : ""}&display=swap`;
  }

  function parseWeights(value) {
    return uniqueNumbers(String(value).split(/[^0-9]+/).map(Number).filter((weight) => weight >= 100 && weight <= 900));
  }

  function uniqueStyleName(base) {
    let name = base;
    let index = 2;
    while (core.state.project.typeStyles.some((style) => style.name === name)) { name = `${base} ${index}`; index += 1; }
    return name;
  }

  function clusteredValues(values, tolerance) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    const clusters = [];
    sorted.forEach((value) => {
      const cluster = clusters.find((item) => Math.abs(item.value - value) <= tolerance);
      if (cluster) { cluster.values.push(value); cluster.count += 1; cluster.value = average(cluster.values); }
      else clusters.push({ value, values: [value], count: 1 });
    });
    return clusters;
  }

  function addUniqueGuide(list, value, tolerance) {
    if (!list.some((existing) => Math.abs(existing - value) <= tolerance)) list.push(value);
  }

  function commonName(names) {
    const words = names.map((name) => name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
    if (!words.length) return "";
    return words[0].filter((word) => words.every((set) => set.includes(word))).join("-");
  }

  function average(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
  function median(values) { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : average([sorted[middle - 1], sorted[middle]]); }
  function averageColour(values) { return [average(values.map((value) => value[0])), average(values.map((value) => value[1])), average(values.map((value) => value[2]))]; }
  function uniqueNumbers(values) { return [...new Set(values.map((value) => Number(value)).filter(Number.isFinite))].sort((a, b) => a - b); }
  function nullableNumber(value) { const number = Number(value); return value === "" || !Number.isFinite(number) ? null : number; }
  function slug(value = "") { return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  function titleCase(value = "") { return String(value).replace(/[-_]/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
  function formatDate(value) { try { return new Date(value).toLocaleString("en-AU"); } catch { return value; } }
  function escape(value = "") { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
  function escapeAttribute(value = "") { return escape(value).replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function escapeTable(value = "") { return String(value).replace(/\s+/g, " ").trim().replaceAll("|", "\\|"); }
}
