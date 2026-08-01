const PDFJS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.min.mjs";
const PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.worker.min.mjs";
const JSZIP_URL = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
const JSZIP_INTEGRITY = "sha512-XMVd28F1oH/O71fzwBnV7HucLxVwtxf26XV8P4wPk26EDxuGZ91N8bsOttmnomcCD3CS5ZMRL50H0GgOHvegtg==";

let pdfJsPromise = null;
let jsZipPromise = null;

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import(PDFJS_URL).then((module) => {
      module.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return module;
    });
  }
  return pdfJsPromise;
}

function loadJsZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (!jsZipPromise) {
    jsZipPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = JSZIP_URL;
      script.integrity = JSZIP_INTEGRITY;
      script.crossOrigin = "anonymous";
      script.onload = () => window.JSZip ? resolve(window.JSZip) : reject(new Error("JSZip loaded without exposing its browser API."));
      script.onerror = () => reject(new Error("The ZIP library could not be loaded. Check the internet connection and try again."));
      document.head.append(script);
    });
  }
  return jsZipPromise;
}

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, places = 0) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};
const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const DEFAULT_HARD_RULES = `Do not redesign or modernise the supplied artwork.
Match spacing, scale, alignment, crop and typography before adding enhancements.
Use the reference image and measured specification as the source of truth.
Do not invent gradients, rounded cards, shadows or decorative UI patterns that are absent from the reference.
Build the desktop reference first, then derive responsive behaviour.`;

const state = {
  project: createDefaultProject(),
  documents: [],
  activeDocumentId: null,
  selectedRegionId: null,
  tool: "select",
  zoom: 1,
  showGrid: false,
  showLabels: true,
  drawing: null,
  drag: null,
  pointer: { x: 0, y: 0 },
  toastTimer: null,
};

const els = {
  projectName: $("#projectName"),
  targetWidth: $("#targetWidth"),
  targetHeight: $("#targetHeight"),
  frameworkSelect: $("#frameworkSelect"),
  referenceInput: $("#referenceInput"),
  emptyReferenceInput: $("#emptyReferenceInput"),
  openPackageInput: $("#openPackageInput"),
  dropZone: $("#dropZone"),
  documentList: $("#documentList"),
  documentCount: $("#documentCount"),
  exportBtn: $("#exportBtn"),
  newProjectBtn: $("#newProjectBtn"),
  autoPaletteBtn: $("#autoPaletteBtn"),
  baseCanvas: $("#baseCanvas"),
  compareCanvas: $("#compareCanvas"),
  overlayCanvas: $("#overlayCanvas"),
  canvasStage: $("#canvasStage"),
  workspaceViewport: $("#workspaceViewport"),
  emptyState: $("#emptyState"),
  activeDocumentLabel: $("#activeDocumentLabel"),
  cursorStatus: $("#cursorStatus"),
  zoomOutBtn: $("#zoomOutBtn"),
  zoomInBtn: $("#zoomInBtn"),
  zoomLabel: $("#zoomLabel"),
  fitBtn: $("#fitBtn"),
  gridToggle: $("#gridToggle"),
  labelsToggle: $("#labelsToggle"),
  compareInput: $("#compareInput"),
  compareOpacity: $("#compareOpacity"),
  compareOpacityWrap: $("#compareOpacityWrap"),
  differenceToggle: $("#differenceToggle"),
  differenceToggleWrap: $("#differenceToggleWrap"),
  clearCompareBtn: $("#clearCompareBtn"),
  selectionEmpty: $("#selectionEmpty"),
  selectionEditor: $("#selectionEditor"),
  regionName: $("#regionName"),
  regionType: $("#regionType"),
  regionX: $("#regionX"),
  regionY: $("#regionY"),
  regionW: $("#regionW"),
  regionH: $("#regionH"),
  regionNotes: $("#regionNotes"),
  regionRepeat: $("#regionRepeat"),
  regionCssReadout: $("#regionCssReadout"),
  deleteRegionBtn: $("#deleteRegionBtn"),
  pageNotes: $("#pageNotes"),
  pageCssWidth: $("#pageCssWidth"),
  pageCssHeight: $("#pageCssHeight"),
  pageScaleLabel: $("#pageScaleLabel"),
  paletteList: $("#paletteList"),
  clearPaletteBtn: $("#clearPaletteBtn"),
  manualColour: $("#manualColour"),
  addColourBtn: $("#addColourBtn"),
  spacingList: $("#spacingList"),
  spacingValue: $("#spacingValue"),
  addSpacingBtn: $("#addSpacingBtn"),
  typeStyleList: $("#typeStyleList"),
  addTypeStyleBtn: $("#addTypeStyleBtn"),
  typeStyleDialog: $("#typeStyleDialog"),
  typeStyleForm: $("#typeStyleForm"),
  typeName: $("#typeName"),
  typeFamily: $("#typeFamily"),
  typeSize: $("#typeSize"),
  typeWeight: $("#typeWeight"),
  typeLineHeight: $("#typeLineHeight"),
  typeLetterSpacing: $("#typeLetterSpacing"),
  typeColour: $("#typeColour"),
  projectBrief: $("#projectBrief"),
  missingContent: $("#missingContent"),
  hardRules: $("#hardRules"),
  responsiveNotes: $("#responsiveNotes"),
  copyPromptBtn: $("#copyPromptBtn"),
  promptPreview: $("#promptPreview"),
  saveStatus: $("#saveStatus"),
  toast: $("#toast"),
};

function createDefaultProject() {
  return {
    name: "Website design",
    targetWidth: 1440,
    targetHeight: 1200,
    framework: "html-css-js",
    brief: "",
    missingContent: "",
    hardRules: DEFAULT_HARD_RULES,
    responsiveNotes: "",
    palette: [],
    spacing: [4, 8, 12, 16, 24, 32, 48, 64, 96],
    typeStyles: [],
  };
}

function activeDocument() {
  return state.documents.find((doc) => doc.id === state.activeDocumentId) ?? null;
}

function documentCssScale(doc = activeDocument()) {
  if (!doc?.width) return 1;
  return (Number(doc.cssWidth) || doc.width) / doc.width;
}

function toCssPixels(value, doc = activeDocument()) {
  return round(value * documentCssScale(doc), 1);
}

function documentCssHeight(doc = activeDocument()) {
  return doc ? round(doc.height * documentCssScale(doc), 1) : 0;
}

function selectedRegion() {
  const doc = activeDocument();
  return doc?.annotations.find((region) => region.id === state.selectedRegionId) ?? null;
}

function safeFileName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "") || "design";
}

function uniqueSourceFile(path) {
  if (!state.documents.some((doc) => doc.sourceFile === path)) return path;
  const dot = path.lastIndexOf(".");
  const base = dot > path.lastIndexOf("/") ? path.slice(0, dot) : path;
  const extension = dot > path.lastIndexOf("/") ? path.slice(dot) : "";
  let index = 2;
  let candidate = `${base}-${index}${extension}`;
  while (state.documents.some((doc) => doc.sourceFile === candidate)) {
    index += 1;
    candidate = `${base}-${index}${extension}`;
  }
  return candidate;
}

function formatFramework(value) {
  return {
    "html-css-js": "HTML, CSS and JavaScript",
    "react-vite": "React with Vite",
    nextjs: "Next.js",
    astro: "Astro",
  }[value] ?? value;
}

function showToast(message, duration = 2600) {
  clearTimeout(state.toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  state.toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), duration);
}

function setBusy(isBusy, message = "Working…") {
  els.saveStatus.textContent = isBusy ? message : "Local only";
  els.exportBtn.disabled = isBusy || state.documents.length === 0;
  els.autoPaletteBtn.disabled = isBusy || !activeDocument();
}

async function imageFromBlob(blob) {
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("The image could not be decoded."));
    image.src = objectUrl;
  });
  return { image, objectUrl };
}

async function addDocumentFromBlob(blob, options = {}) {
  const { image, objectUrl } = await imageFromBlob(blob);
  const sourceName = options.sourceName ?? `reference-${state.documents.length + 1}.png`;
  const restored = options.restored ?? {};
  const requestedSourceFile = options.sourceFile ?? `references/${safeFileName(sourceName)}`;
  const sourceFile = options.restored ? requestedSourceFile : uniqueSourceFile(requestedSourceFile);
  const doc = {
    id: restored.id ?? uid(),
    name: restored.name ?? options.displayName ?? sourceName,
    sourceName,
    sourceFile,
    mimeType: blob.type || "image/png",
    width: image.naturalWidth,
    height: image.naturalHeight,
    imageBlob: blob,
    image,
    objectUrl,
    annotations: Array.isArray(restored.annotations) ? restored.annotations : [],
    guidesX: Array.isArray(restored.guidesX) ? restored.guidesX : [],
    guidesY: Array.isArray(restored.guidesY) ? restored.guidesY : [],
    notes: restored.notes ?? "",
    cssWidth: Number(restored.cssWidth) || Number(options.cssWidth) || state.project.targetWidth,
    compare: null,
  };
  state.documents.push(doc);
  state.activeDocumentId = doc.id;
  state.selectedRegionId = null;
  return doc;
}

async function processReferenceFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  setBusy(true, "Importing");
  try {
    for (const file of files) {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        await importPdf(file);
      } else if (file.type.startsWith("image/")) {
        await addDocumentFromBlob(file, {
          sourceName: file.name,
          displayName: file.name,
          sourceFile: `references/${safeFileName(file.name)}`,
        });
      } else {
        showToast(`Skipped unsupported file: ${file.name}`);
      }
    }
    renderAll();
    requestAnimationFrame(fitToViewport);
    showToast(`${files.length} reference file${files.length === 1 ? "" : "s"} imported.`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "The reference could not be imported.", 4200);
  } finally {
    setBusy(false);
    els.referenceInput.value = "";
    els.emptyReferenceInput.value = "";
  }
}

async function importPdf(file) {
  const pdfjsLib = await loadPdfJs();
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pageLimit = Math.min(pdf.numPages, 50);
  const baseName = file.name.replace(/\.pdf$/i, "");

  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    els.saveStatus.textContent = `PDF ${pageNumber}/${pageLimit}`;
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const renderScale = clamp(2600 / Math.max(baseViewport.width, 1), 1, 2);
    const viewport = page.getViewport({ scale: renderScale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("PDF page conversion failed.")), "image/png");
    });
    const pageSuffix = String(pageNumber).padStart(2, "0");
    const sourceName = `${safeFileName(baseName)}-page-${pageSuffix}.png`;
    await addDocumentFromBlob(blob, {
      sourceName,
      displayName: `${baseName} · Page ${pageNumber}`,
      sourceFile: `references/${sourceName}`,
    });
  }

  if (pdf.numPages > pageLimit) {
    showToast(`Imported the first ${pageLimit} pages. Split very large PDFs before importing.`, 5000);
  }
}

function removeDocument(id) {
  const index = state.documents.findIndex((doc) => doc.id === id);
  if (index < 0) return;
  URL.revokeObjectURL(state.documents[index].objectUrl);
  if (state.documents[index].compare?.objectUrl) URL.revokeObjectURL(state.documents[index].compare.objectUrl);
  state.documents.splice(index, 1);
  if (state.activeDocumentId === id) {
    const next = state.documents[index] ?? state.documents[index - 1] ?? null;
    state.activeDocumentId = next?.id ?? null;
    state.selectedRegionId = null;
  }
  renderAll();
  if (activeDocument()) requestAnimationFrame(fitToViewport);
}

function renderAll() {
  syncProjectControls();
  renderDocumentList();
  renderActiveDocument();
  renderSelectionEditor();
  renderPalette();
  renderSpacing();
  renderTypeStyles();
  updatePromptPreview();
  els.documentCount.textContent = String(state.documents.length);
  els.exportBtn.disabled = state.documents.length === 0;
  els.autoPaletteBtn.disabled = !activeDocument();
}

function syncProjectControls() {
  els.projectName.value = state.project.name;
  els.targetWidth.value = state.project.targetWidth;
  els.targetHeight.value = state.project.targetHeight;
  els.frameworkSelect.value = state.project.framework;
  els.projectBrief.value = state.project.brief;
  els.missingContent.value = state.project.missingContent;
  els.hardRules.value = state.project.hardRules;
  els.responsiveNotes.value = state.project.responsiveNotes;
}

function renderDocumentList() {
  els.documentList.innerHTML = "";
  state.documents.forEach((doc) => {
    const item = document.createElement("div");
    item.className = `document-item${doc.id === state.activeDocumentId ? " is-active" : ""}`;
    item.dataset.documentId = doc.id;
    item.innerHTML = `
      <img class="document-thumb" alt="" src="${doc.objectUrl}">
      <div class="document-meta">
        <strong title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</strong>
        <span>${doc.width} × ${doc.height} · ${doc.annotations.length} regions</span>
      </div>
      <button class="document-remove" type="button" title="Remove reference" aria-label="Remove ${escapeHtml(doc.name)}">×</button>
    `;
    item.addEventListener("click", (event) => {
      if (event.target.closest(".document-remove")) return;
      state.activeDocumentId = doc.id;
      state.selectedRegionId = null;
      renderAll();
      requestAnimationFrame(fitToViewport);
    });
    item.querySelector(".document-remove").addEventListener("click", (event) => {
      event.stopPropagation();
      removeDocument(doc.id);
    });
    els.documentList.append(item);
  });
}

function renderActiveDocument() {
  const doc = activeDocument();
  if (!doc) {
    els.emptyState.hidden = false;
    els.canvasStage.hidden = true;
    els.activeDocumentLabel.textContent = "No reference selected";
    els.pageNotes.value = "";
    els.pageCssWidth.value = "";
    els.pageCssHeight.value = "";
    els.pageScaleLabel.textContent = "";
    clearCanvas(els.baseCanvas);
    clearCanvas(els.compareCanvas);
    clearCanvas(els.overlayCanvas);
    updateCompareControls();
    return;
  }

  els.emptyState.hidden = true;
  els.canvasStage.hidden = false;
  const widthChanged = els.baseCanvas.width !== doc.width || els.baseCanvas.height !== doc.height;
  if (widthChanged) {
    els.baseCanvas.width = doc.width;
    els.baseCanvas.height = doc.height;
    els.compareCanvas.width = doc.width;
    els.compareCanvas.height = doc.height;
    els.overlayCanvas.width = doc.width;
    els.overlayCanvas.height = doc.height;
  }
  const baseContext = els.baseCanvas.getContext("2d", { alpha: false, willReadFrequently: true });
  baseContext.clearRect(0, 0, doc.width, doc.height);
  baseContext.drawImage(doc.image, 0, 0, doc.width, doc.height);
  els.pageNotes.value = doc.notes;
  els.pageCssWidth.value = doc.cssWidth;
  els.pageCssHeight.value = documentCssHeight(doc);
  els.pageScaleLabel.textContent = `Source ${doc.width} × ${doc.height}px → CSS ${round(doc.cssWidth, 1)} × ${documentCssHeight(doc)}px · scale ${round(documentCssScale(doc) * 100, 2)}%`;
  els.activeDocumentLabel.textContent = `${doc.name} · source ${doc.width} × ${doc.height} · CSS width ${round(doc.cssWidth, 1)}`;
  applyZoom();
  renderCompare();
  updateCompareControls();
  drawOverlay();
}

function clearCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

async function loadCompareScreenshot(file) {
  const doc = activeDocument();
  if (!doc || !file) return;
  try {
    if (doc.compare?.objectUrl) URL.revokeObjectURL(doc.compare.objectUrl);
    const { image, objectUrl } = await imageFromBlob(file);
    doc.compare = {
      image,
      objectUrl,
      name: file.name,
      width: image.naturalWidth,
      height: image.naturalHeight,
      opacity: 50,
      difference: false,
    };
    renderCompare();
    updateCompareControls();
    const dimensionNote = image.naturalWidth === doc.width && image.naturalHeight === doc.height
      ? "Dimensions match the reference."
      : `Screenshot is ${image.naturalWidth} × ${image.naturalHeight}; it has been scaled to ${doc.width} × ${doc.height} for comparison.`;
    showToast(dimensionNote, 4800);
  } catch (error) {
    console.error(error);
    showToast("The comparison screenshot could not be loaded.", 4200);
  } finally {
    els.compareInput.value = "";
  }
}

function updateCompareControls() {
  const compare = activeDocument()?.compare ?? null;
  const hidden = !compare;
  els.compareOpacityWrap.hidden = hidden;
  els.differenceToggleWrap.hidden = hidden;
  els.clearCompareBtn.hidden = hidden;
  if (!compare) return;
  els.compareOpacity.value = compare.opacity;
  els.differenceToggle.checked = compare.difference;
}

function renderCompare() {
  const doc = activeDocument();
  const canvas = els.compareCanvas;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!doc?.compare) return;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.drawImage(doc.compare.image, 0, 0, doc.width, doc.height);
  ctx.restore();

  if (doc.compare.difference) {
    const baseData = els.baseCanvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, doc.width, doc.height);
    const compareData = ctx.getImageData(0, 0, doc.width, doc.height);
    const output = compareData.data;
    const base = baseData.data;
    for (let index = 0; index < output.length; index += 4) {
      output[index] = Math.min(255, Math.abs(base[index] - output[index]) * 3);
      output[index + 1] = Math.min(255, Math.abs(base[index + 1] - output[index + 1]) * 3);
      output[index + 2] = Math.min(255, Math.abs(base[index + 2] - output[index + 2]) * 3);
      output[index + 3] = 255;
    }
    ctx.putImageData(compareData, 0, 0);
    canvas.style.opacity = "1";
  } else {
    canvas.style.opacity = String(clamp(doc.compare.opacity / 100, 0, 1));
  }
}

function clearCompare() {
  const doc = activeDocument();
  if (!doc?.compare) return;
  if (doc.compare.objectUrl) URL.revokeObjectURL(doc.compare.objectUrl);
  doc.compare = null;
  clearCanvas(els.compareCanvas);
  els.compareCanvas.style.opacity = "1";
  updateCompareControls();
}

function applyZoom() {
  const doc = activeDocument();
  if (!doc) return;
  state.zoom = clamp(state.zoom, 0.05, 4);
  els.canvasStage.style.width = `${doc.width * state.zoom}px`;
  els.canvasStage.style.height = `${doc.height * state.zoom}px`;
  els.baseCanvas.style.width = `${doc.width * state.zoom}px`;
  els.baseCanvas.style.height = `${doc.height * state.zoom}px`;
  els.compareCanvas.style.width = `${doc.width * state.zoom}px`;
  els.compareCanvas.style.height = `${doc.height * state.zoom}px`;
  els.overlayCanvas.style.width = `${doc.width * state.zoom}px`;
  els.overlayCanvas.style.height = `${doc.height * state.zoom}px`;
  els.canvasStage.classList.toggle("has-grid", state.showGrid);
  els.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  drawOverlay();
}

function fitToViewport() {
  const doc = activeDocument();
  if (!doc) return;
  const padding = 84;
  const availableWidth = Math.max(120, els.workspaceViewport.clientWidth - padding);
  const availableHeight = Math.max(120, els.workspaceViewport.clientHeight - padding);
  state.zoom = clamp(Math.min(availableWidth / doc.width, availableHeight / doc.height), 0.05, 2);
  applyZoom();
  els.workspaceViewport.scrollTo({ left: 0, top: 0, behavior: "instant" });
}

function setZoom(nextZoom, anchor = null) {
  const doc = activeDocument();
  if (!doc) return;
  const oldZoom = state.zoom;
  const viewport = els.workspaceViewport;
  const anchorX = anchor?.x ?? viewport.clientWidth / 2;
  const anchorY = anchor?.y ?? viewport.clientHeight / 2;
  const contentX = (viewport.scrollLeft + anchorX - 42) / oldZoom;
  const contentY = (viewport.scrollTop + anchorY - 42) / oldZoom;
  state.zoom = clamp(nextZoom, 0.05, 4);
  applyZoom();
  viewport.scrollLeft = contentX * state.zoom - anchorX + 42;
  viewport.scrollTop = contentY * state.zoom - anchorY + 42;
}

function setTool(tool) {
  state.tool = tool;
  state.drawing = null;
  state.drag = null;
  $$(".tool-button[data-tool]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tool === tool);
  });
  const cursors = {
    select: "default",
    region: "crosshair",
    colour: "crosshair",
    "guide-x": "col-resize",
    "guide-y": "row-resize",
  };
  els.overlayCanvas.style.cursor = cursors[tool] ?? "default";
  drawOverlay();
}

function canvasPoint(event) {
  const rect = els.overlayCanvas.getBoundingClientRect();
  const doc = activeDocument();
  if (!doc || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
  return {
    x: clamp((event.clientX - rect.left) * (doc.width / rect.width), 0, doc.width),
    y: clamp((event.clientY - rect.top) * (doc.height / rect.height), 0, doc.height),
  };
}

function normaliseRect(start, end) {
  return {
    x: Math.round(Math.min(start.x, end.x)),
    y: Math.round(Math.min(start.y, end.y)),
    w: Math.round(Math.abs(end.x - start.x)),
    h: Math.round(Math.abs(end.y - start.y)),
  };
}

function regionAtPoint(point) {
  const doc = activeDocument();
  if (!doc) return null;
  return [...doc.annotations].reverse().find((region) => (
    point.x >= region.x && point.x <= region.x + region.w && point.y >= region.y && point.y <= region.y + region.h
  )) ?? null;
}

function handleAtPoint(region, point) {
  if (!region) return null;
  const radius = 9 / state.zoom;
  const handles = {
    nw: { x: region.x, y: region.y },
    ne: { x: region.x + region.w, y: region.y },
    se: { x: region.x + region.w, y: region.y + region.h },
    sw: { x: region.x, y: region.y + region.h },
  };
  return Object.entries(handles).find(([, pos]) => Math.hypot(point.x - pos.x, point.y - pos.y) <= radius)?.[0] ?? null;
}

function onPointerDown(event) {
  const doc = activeDocument();
  if (!doc) return;
  const point = canvasPoint(event);
  state.pointer = point;
  els.overlayCanvas.setPointerCapture?.(event.pointerId);

  if (state.tool === "region") {
    state.drawing = { start: point, current: point };
    drawOverlay();
    return;
  }

  if (state.tool === "colour") {
    sampleColour(point);
    return;
  }

  if (state.tool === "guide-x") {
    doc.guidesX.push(Math.round(point.x));
    drawOverlay();
    updatePromptPreview();
    return;
  }

  if (state.tool === "guide-y") {
    doc.guidesY.push(Math.round(point.y));
    drawOverlay();
    updatePromptPreview();
    return;
  }

  const current = selectedRegion();
  const handle = handleAtPoint(current, point);
  if (current && handle) {
    state.drag = {
      mode: "resize",
      handle,
      start: point,
      original: { x: current.x, y: current.y, w: current.w, h: current.h },
    };
    return;
  }

  const hit = regionAtPoint(point);
  if (hit) {
    state.selectedRegionId = hit.id;
    state.drag = {
      mode: "move",
      start: point,
      original: { x: hit.x, y: hit.y, w: hit.w, h: hit.h },
    };
  } else {
    state.selectedRegionId = null;
    state.drag = null;
  }
  renderSelectionEditor();
  drawOverlay();
}

function onPointerMove(event) {
  const doc = activeDocument();
  if (!doc) return;
  const point = canvasPoint(event);
  state.pointer = point;
  els.cursorStatus.textContent = `Source X ${Math.round(point.x)} · Y ${Math.round(point.y)} · CSS X ${toCssPixels(point.x, doc)} · Y ${toCssPixels(point.y, doc)}`;

  if (state.drawing) {
    state.drawing.current = point;
    const rect = normaliseRect(state.drawing.start, point);
    els.cursorStatus.textContent += ` · Source W ${rect.w} · H ${rect.h} · CSS W ${toCssPixels(rect.w, doc)} · H ${toCssPixels(rect.h, doc)}`;
    drawOverlay();
    return;
  }

  if (state.drag) {
    const region = selectedRegion();
    if (!region) return;
    const dx = point.x - state.drag.start.x;
    const dy = point.y - state.drag.start.y;
    const original = state.drag.original;

    if (state.drag.mode === "move") {
      region.x = Math.round(clamp(original.x + dx, 0, doc.width - original.w));
      region.y = Math.round(clamp(original.y + dy, 0, doc.height - original.h));
    } else {
      const left = original.x;
      const top = original.y;
      const right = original.x + original.w;
      const bottom = original.y + original.h;
      let nextLeft = left;
      let nextTop = top;
      let nextRight = right;
      let nextBottom = bottom;
      if (state.drag.handle.includes("w")) nextLeft = clamp(point.x, 0, right - 2);
      if (state.drag.handle.includes("e")) nextRight = clamp(point.x, left + 2, doc.width);
      if (state.drag.handle.includes("n")) nextTop = clamp(point.y, 0, bottom - 2);
      if (state.drag.handle.includes("s")) nextBottom = clamp(point.y, top + 2, doc.height);
      region.x = Math.round(nextLeft);
      region.y = Math.round(nextTop);
      region.w = Math.round(nextRight - nextLeft);
      region.h = Math.round(nextBottom - nextTop);
    }
    syncSelectionFields();
    drawOverlay();
    return;
  }

  if (state.tool === "select") {
    const current = selectedRegion();
    const handle = handleAtPoint(current, point);
    const cursor = {
      nw: "nwse-resize",
      se: "nwse-resize",
      ne: "nesw-resize",
      sw: "nesw-resize",
    }[handle];
    els.overlayCanvas.style.cursor = cursor ?? (regionAtPoint(point) ? "move" : "default");
  }
}

function onPointerUp(event) {
  if (state.drawing) {
    const doc = activeDocument();
    const rect = normaliseRect(state.drawing.start, state.drawing.current);
    state.drawing = null;
    if (doc && rect.w >= 3 && rect.h >= 3) {
      const region = {
        id: uid(),
        name: `Region ${doc.annotations.length + 1}`,
        type: "section",
        ...rect,
        notes: "",
        repeat: false,
      };
      doc.annotations.push(region);
      state.selectedRegionId = region.id;
      renderDocumentList();
      renderSelectionEditor();
      updatePromptPreview();
    }
    drawOverlay();
  }
  if (state.drag) {
    state.drag = null;
    renderDocumentList();
    updatePromptPreview();
  }
  els.overlayCanvas.releasePointerCapture?.(event.pointerId);
}

function drawOverlay() {
  const doc = activeDocument();
  const canvas = els.overlayCanvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!doc) return;

  const line = 1.5 / state.zoom;
  const fontSize = clamp(12 / state.zoom, 8, 32);
  const labelPadding = 4 / state.zoom;

  ctx.save();
  ctx.lineWidth = line;

  doc.guidesX.forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, doc.height);
    ctx.strokeStyle = "rgba(226, 57, 120, 0.9)";
    ctx.stroke();
  });
  doc.guidesY.forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(doc.width, y);
    ctx.strokeStyle = "rgba(226, 57, 120, 0.9)";
    ctx.stroke();
  });

  doc.annotations.forEach((region, index) => {
    const selected = region.id === state.selectedRegionId;
    ctx.fillStyle = selected ? "rgba(137, 201, 37, 0.15)" : "rgba(46, 108, 246, 0.08)";
    ctx.strokeStyle = selected ? "rgba(93, 148, 19, 1)" : "rgba(46, 108, 246, 0.92)";
    ctx.setLineDash(selected ? [] : [5 / state.zoom, 4 / state.zoom]);
    ctx.fillRect(region.x, region.y, region.w, region.h);
    ctx.strokeRect(region.x, region.y, region.w, region.h);

    if (state.showLabels) {
      const text = `${index + 1}. ${region.name} · ${region.w}×${region.h}`;
      ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
      ctx.textBaseline = "top";
      const textWidth = ctx.measureText(text).width;
      const labelHeight = fontSize + labelPadding * 2;
      const labelY = region.y - labelHeight >= 0 ? region.y - labelHeight : region.y;
      ctx.fillStyle = selected ? "rgba(93, 148, 19, 0.98)" : "rgba(46, 108, 246, 0.95)";
      ctx.fillRect(region.x, labelY, textWidth + labelPadding * 2, labelHeight);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(text, region.x + labelPadding, labelY + labelPadding);
    }

    if (selected) drawHandles(ctx, region);
  });

  if (state.drawing) {
    const rect = normaliseRect(state.drawing.start, state.drawing.current);
    ctx.setLineDash([6 / state.zoom, 4 / state.zoom]);
    ctx.strokeStyle = "rgba(93, 148, 19, 1)";
    ctx.fillStyle = "rgba(137, 201, 37, 0.16)";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }

  ctx.restore();
}

function drawHandles(ctx, region) {
  const size = 8 / state.zoom;
  const positions = [
    [region.x, region.y],
    [region.x + region.w, region.y],
    [region.x + region.w, region.y + region.h],
    [region.x, region.y + region.h],
  ];
  ctx.setLineDash([]);
  positions.forEach(([x, y]) => {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#5d9413";
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    ctx.strokeRect(x - size / 2, y - size / 2, size, size);
  });
}

function sampleColour(point) {
  const doc = activeDocument();
  if (!doc) return;
  const ctx = els.baseCanvas.getContext("2d", { willReadFrequently: true });
  const radius = 2;
  const x = clamp(Math.round(point.x) - radius, 0, doc.width - 1);
  const y = clamp(Math.round(point.y) - radius, 0, doc.height - 1);
  const width = Math.min(radius * 2 + 1, doc.width - x);
  const height = Math.min(radius * 2 + 1, doc.height - y);
  const data = ctx.getImageData(x, y, width, height).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count += 1;
  }
  if (!count) return;
  addPaletteColour(rgbToHex(Math.round(r / count), Math.round(g / count), Math.round(b / count)));
  showToast(`Sampled ${state.project.palette.at(-1)?.hex ?? "colour"}.`);
}

function extractDominantPalette() {
  const doc = activeDocument();
  if (!doc) return;
  const maxDimension = 240;
  const scale = Math.min(1, maxDimension / Math.max(doc.width, doc.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(doc.width * scale));
  canvas.height = Math.max(1, Math.round(doc.height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(doc.image, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const buckets = new Map();

  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 180) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const item = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    item.count += 1;
    item.r += r;
    item.g += g;
    item.b += b;
    buckets.set(key, item);
  }

  const candidates = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .map((item) => ({
      count: item.count,
      r: Math.round(item.r / item.count),
      g: Math.round(item.g / item.count),
      b: Math.round(item.b / item.count),
    }));

  const selected = [];
  for (const candidate of candidates) {
    if (selected.every((colour) => colourDistance(candidate, colour) > 44)) {
      selected.push(candidate);
    }
    if (selected.length >= 10) break;
  }

  selected.forEach((colour) => addPaletteColour(rgbToHex(colour.r, colour.g, colour.b), false));
  renderPalette();
  updatePromptPreview();
  showToast(`Added ${selected.length} dominant colours. Remove any that are not meaningful design tokens.`);
}

function colourDistance(a, b) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => clamp(value, 0, 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function hexToRgb(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function addPaletteColour(value, rerender = true) {
  const rgb = hexToRgb(value);
  if (!rgb) {
    showToast("Use a six-digit hexadecimal colour, for example #373A36.");
    return;
  }
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  if (state.project.palette.some((item) => item.hex === hex)) {
    showToast(`${hex} is already in the palette.`);
    return;
  }
  state.project.palette.push({ id: uid(), name: `Colour ${state.project.palette.length + 1}`, hex });
  if (rerender) {
    renderPalette();
    updatePromptPreview();
  }
}

function renderPalette() {
  els.paletteList.innerHTML = "";
  if (!state.project.palette.length) {
    els.paletteList.innerHTML = '<div class="palette-empty">Use the Colour tool to sample exact pixels, or run Palette to extract dominant colours.</div>';
    return;
  }
  state.project.palette.forEach((colour, index) => {
    const rgb = hexToRgb(colour.hex);
    const item = document.createElement("div");
    item.className = "palette-item";
    item.innerHTML = `
      <span class="colour-swatch" style="background:${colour.hex}"></span>
      <div class="palette-values">
        <strong>${escapeHtml(colour.name || `Colour ${index + 1}`)}</strong>
        <span>${colour.hex} · RGB ${rgb.r}, ${rgb.g}, ${rgb.b}</span>
      </div>
      <button class="small-delete" type="button" aria-label="Remove ${colour.hex}">×</button>
    `;
    item.querySelector(".palette-values").addEventListener("dblclick", () => {
      const next = prompt("Colour token name", colour.name);
      if (next?.trim()) {
        colour.name = next.trim();
        renderPalette();
        updatePromptPreview();
      }
    });
    item.querySelector(".small-delete").addEventListener("click", () => {
      state.project.palette = state.project.palette.filter((entry) => entry.id !== colour.id);
      renderPalette();
      updatePromptPreview();
    });
    els.paletteList.append(item);
  });
}

function renderSpacing() {
  els.spacingList.innerHTML = "";
  [...state.project.spacing].sort((a, b) => a - b).forEach((value) => {
    const chip = document.createElement("span");
    chip.className = "token-chip";
    chip.innerHTML = `${value}px <button type="button" aria-label="Remove ${value} pixels">×</button>`;
    chip.querySelector("button").addEventListener("click", () => {
      state.project.spacing = state.project.spacing.filter((entry) => entry !== value);
      renderSpacing();
      updatePromptPreview();
    });
    els.spacingList.append(chip);
  });
}

function renderTypeStyles() {
  els.typeStyleList.innerHTML = "";
  if (!state.project.typeStyles.length) {
    els.typeStyleList.innerHTML = '<div class="type-empty">Add the key styles from Illustrator: display, heading, body, caption and button text.</div>';
    return;
  }
  state.project.typeStyles.forEach((style) => {
    const item = document.createElement("div");
    item.className = "type-style-item";
    item.innerHTML = `
      <div class="type-style-head">
        <strong>${escapeHtml(style.name)}</strong>
        <button class="small-delete" type="button" aria-label="Remove ${escapeHtml(style.name)}">×</button>
      </div>
      <p>${escapeHtml(style.family)} · ${style.size}px / ${style.lineHeight} · ${style.weight} · ${style.letterSpacing}px · ${style.colour}</p>
    `;
    item.querySelector(".small-delete").addEventListener("click", () => {
      state.project.typeStyles = state.project.typeStyles.filter((entry) => entry.id !== style.id);
      renderTypeStyles();
      updatePromptPreview();
    });
    els.typeStyleList.append(item);
  });
}

function renderSelectionEditor() {
  const region = selectedRegion();
  const doc = activeDocument();
  els.selectionEmpty.hidden = Boolean(region);
  els.selectionEditor.hidden = !region;
  els.pageNotes.disabled = !doc;
  if (!region) return;
  syncSelectionFields();
}

function syncSelectionFields() {
  const region = selectedRegion();
  if (!region) return;
  els.regionName.value = region.name;
  els.regionType.value = region.type;
  els.regionX.value = region.x;
  els.regionY.value = region.y;
  els.regionW.value = region.w;
  els.regionH.value = region.h;
  els.regionNotes.value = region.notes;
  els.regionRepeat.checked = region.repeat;
  els.regionCssReadout.textContent = `CSS x ${toCssPixels(region.x)}, y ${toCssPixels(region.y)}, width ${toCssPixels(region.w)}, height ${toCssPixels(region.h)}`;
}

function updateSelectedRegionFromControls() {
  const region = selectedRegion();
  const doc = activeDocument();
  if (!region || !doc) return;
  region.name = els.regionName.value.trim() || "Unnamed region";
  region.type = els.regionType.value;
  region.x = Math.round(clamp(Number(els.regionX.value) || 0, 0, doc.width - 1));
  region.y = Math.round(clamp(Number(els.regionY.value) || 0, 0, doc.height - 1));
  region.w = Math.round(clamp(Number(els.regionW.value) || 1, 1, doc.width - region.x));
  region.h = Math.round(clamp(Number(els.regionH.value) || 1, 1, doc.height - region.y));
  region.notes = els.regionNotes.value;
  region.repeat = els.regionRepeat.checked;
  drawOverlay();
  renderDocumentList();
  updatePromptPreview();
}

function deleteSelectedRegion() {
  const doc = activeDocument();
  if (!doc || !state.selectedRegionId) return;
  doc.annotations = doc.annotations.filter((region) => region.id !== state.selectedRegionId);
  state.selectedRegionId = null;
  renderSelectionEditor();
  renderDocumentList();
  drawOverlay();
  updatePromptPreview();
}

function serialiseProject() {
  return {
    format: "design-spec-extractor",
    version: 2,
    generatedAt: new Date().toISOString(),
    project: structuredClone(state.project),
    documents: state.documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      sourceName: doc.sourceName,
      sourceFile: doc.sourceFile,
      mimeType: doc.mimeType,
      width: doc.width,
      height: doc.height,
      guidesX: [...doc.guidesX],
      guidesY: [...doc.guidesY],
      notes: doc.notes,
      cssWidth: doc.cssWidth,
      cssHeight: documentCssHeight(doc),
      cssScale: documentCssScale(doc),
      cssGuidesX: doc.guidesX.map((value) => toCssPixels(value, doc)),
      cssGuidesY: doc.guidesY.map((value) => toCssPixels(value, doc)),
      annotations: doc.annotations.map((region) => ({
        ...structuredClone(region),
        css: {
          x: toCssPixels(region.x, doc),
          y: toCssPixels(region.y, doc),
          width: toCssPixels(region.w, doc),
          height: toCssPixels(region.h, doc),
        },
      })),
    })),
  };
}

function generatePrompt() {
  const spec = serialiseProject();
  const project = spec.project;
  const pages = spec.documents.map((doc, pageIndex) => {
    const regions = doc.annotations.length
      ? doc.annotations.map((region, index) => (
          `${index + 1}. ${region.name} [${region.type}] at CSS x:${region.css.x}, y:${region.css.y}, width:${region.css.width}, height:${region.css.height} (source x:${region.x}, y:${region.y}, width:${region.w}, height:${region.h})${region.repeat ? "; repeated component" : ""}${region.notes ? `; notes: ${singleLine(region.notes)}` : ""}`
        )).join("\n")
      : "No measured regions have been added yet.";
    return `### Reference ${pageIndex + 1}: ${doc.name}
File: ${doc.sourceFile}
Source size: ${doc.width} × ${doc.height}px
Implementation size: ${doc.cssWidth} × ${doc.cssHeight}px
Source-to-CSS scale: ${round(doc.cssScale * 100, 2)}%
Page notes: ${doc.notes || "None supplied."}
Vertical CSS guides: ${doc.cssGuidesX.length ? doc.cssGuidesX.join(", ") : "None"}
Horizontal CSS guides: ${doc.cssGuidesY.length ? doc.cssGuidesY.join(", ") : "None"}
Source vertical guides: ${doc.guidesX.length ? doc.guidesX.join(", ") : "None"}
Source horizontal guides: ${doc.guidesY.length ? doc.guidesY.join(", ") : "None"}
Measured regions:
${regions}`;
  }).join("\n\n");

  const palette = project.palette.length
    ? project.palette.map((colour) => `${colour.name}: ${colour.hex}`).join("\n")
    : "No palette tokens supplied. Sample colours from the references before implementation.";
  const typography = project.typeStyles.length
    ? project.typeStyles.map((style) => `${style.name}: ${style.family}; ${style.size}px; weight ${style.weight}; line-height ${style.lineHeight}; letter-spacing ${style.letterSpacing}px; colour ${style.colour}`).join("\n")
    : "No typography tokens supplied. Ask for the font files or exact font names rather than substituting silently.";

  return `# Design-to-code implementation brief

You are implementing a website from supplied visual references and a measured design specification. This is a reproduction task, not a redesign exercise.

## Project
Name: ${project.name}
Implementation target: ${formatFramework(project.framework)}
Primary target viewport: ${project.targetWidth} × ${project.targetHeight}px
Purpose: ${project.brief || "Not supplied."}

## Required process
1. Inspect every file in the references folder before writing layout code.
2. Build the primary desktop viewport first at exactly ${project.targetWidth}px wide.
3. Treat the reference artwork as the visual source of truth and the measured coordinates as explicit constraints.
4. Recreate the large layout regions and repeated components before polishing typography or animation.
5. Capture a screenshot at the target viewport after each major pass and compare it against the reference. Correct geometry, spacing, alignment and image crops before moving on.
6. Use reusable components only where the specification marks a repeated component or the visual pattern is clearly repeated.
7. Derive responsive behaviour from the supplied responsive notes. Do not simply stack every element.
8. Record any unavoidable font or asset substitutions in a short implementation note.

## Non-negotiable rules
${project.hardRules || DEFAULT_HARD_RULES}

## Content to complete
${project.missingContent || "Do not invent additional sections or copy. Use clearly labelled placeholders where content is absent."}

## Responsive approach
${project.responsiveNotes || "Preserve the visual hierarchy, image order and relative spacing. Establish breakpoints based on where the measured layout genuinely stops fitting."}

## Design tokens
### Colours
${palette}

### Spacing
${project.spacing.length ? [...project.spacing].sort((a, b) => a - b).map((value) => `${value}px`).join(", ") : "No spacing scale supplied."}

### Typography
${typography}

## Reference measurements
${pages || "No reference files supplied."}

## Completion criteria
- The page is visually faithful at the primary target viewport.
- Major region boundaries, gutters, alignments and media crops match the CSS-normalised measurements in the specification.
- The implementation is responsive without changing the art direction.
- No unsupported design flourishes have been introduced.
- Missing content is completed only within the scope described above.
- The final response lists files changed, substitutions made and any unresolved fidelity risks.`;
}

function generateMarkdown(spec = serialiseProject()) {
  const project = spec.project;
  const lines = [
    `# ${project.name}: Design Specification`,
    "",
    `Generated: ${new Date(spec.generatedAt).toLocaleString("en-AU")}`,
    "",
    "## Project",
    "",
    `- Target implementation: ${formatFramework(project.framework)}`,
    `- Primary viewport: ${project.targetWidth} × ${project.targetHeight}px`,
    `- Reference pages: ${spec.documents.length}`,
    "",
    "## Purpose",
    "",
    project.brief || "Not supplied.",
    "",
    "## Content to complete",
    "",
    project.missingContent || "No missing-content brief supplied.",
    "",
    "## Hard rules",
    "",
    project.hardRules || DEFAULT_HARD_RULES,
    "",
    "## Responsive notes",
    "",
    project.responsiveNotes || "Not supplied.",
    "",
    "## Colour tokens",
    "",
  ];

  if (project.palette.length) {
    lines.push("| Token | Value |", "|---|---|");
    project.palette.forEach((colour) => lines.push(`| ${colour.name} | ${colour.hex} |`));
  } else {
    lines.push("No colour tokens supplied.");
  }

  lines.push("", "## Spacing scale", "", project.spacing.length ? project.spacing.sort((a, b) => a - b).map((value) => `\`${value}px\``).join(", ") : "Not supplied.");
  lines.push("", "## Typography", "");
  if (project.typeStyles.length) {
    lines.push("| Style | Family | Size | Weight | Line height | Letter spacing | Colour |", "|---|---|---:|---:|---:|---:|---|");
    project.typeStyles.forEach((style) => lines.push(`| ${style.name} | ${style.family} | ${style.size}px | ${style.weight} | ${style.lineHeight} | ${style.letterSpacing}px | ${style.colour} |`));
  } else {
    lines.push("No typography tokens supplied.");
  }

  spec.documents.forEach((doc, pageIndex) => {
    lines.push(
      "",
      `## Reference ${pageIndex + 1}: ${doc.name}`,
      "",
      `![${doc.name}](${doc.sourceFile})`,
      "",
      `Source dimensions: **${doc.width} × ${doc.height}px**`,
      "",
      `Implementation dimensions: **${doc.cssWidth} × ${doc.cssHeight}px**`,
      "",
      `Source-to-CSS scale: **${round(doc.cssScale * 100, 2)}%**`,
      "",
      `Page notes: ${doc.notes || "None supplied."}`,
      "",
    );
    if (doc.guidesX.length || doc.guidesY.length) {
      lines.push(
        `Vertical CSS guides: ${doc.cssGuidesX.length ? doc.cssGuidesX.join(", ") : "None"}`,
        "",
        `Horizontal CSS guides: ${doc.cssGuidesY.length ? doc.cssGuidesY.join(", ") : "None"}`,
        "",
        `Source vertical guides: ${doc.guidesX.length ? doc.guidesX.join(", ") : "None"}`,
        "",
        `Source horizontal guides: ${doc.guidesY.length ? doc.guidesY.join(", ") : "None"}`,
        "",
      );
    }
    if (doc.annotations.length) {
      lines.push("| # | Region | Type | CSS X | CSS Y | CSS width | CSS height | Source box (x, y, w, h) | Repeated | Notes |", "|---:|---|---|---:|---:|---:|---:|---|---|---|");
      doc.annotations.forEach((region, index) => {
        lines.push(`| ${index + 1} | ${escapeTable(region.name)} | ${region.type} | ${region.css.x} | ${region.css.y} | ${region.css.width} | ${region.css.height} | ${region.x}, ${region.y}, ${region.w}, ${region.h} | ${region.repeat ? "Yes" : "No"} | ${escapeTable(singleLine(region.notes))} |`);
      });
    } else {
      lines.push("No measured regions supplied.");
    }
  });

  return lines.join("\n");
}

function generateCssTokens() {
  const project = state.project;
  const colourLines = project.palette.map((colour, index) => `  --colour-${safeCssName(colour.name || String(index + 1))}: ${colour.hex};`);
  const spacingLines = [...project.spacing].sort((a, b) => a - b).map((value, index) => `  --space-${index + 1}: ${value}px;`);
  const typeLines = project.typeStyles.flatMap((style) => {
    const name = safeCssName(style.name);
    return [
      `  --font-${name}: ${style.family};`,
      `  --font-${name}-size: ${style.size}px;`,
      `  --font-${name}-weight: ${style.weight};`,
      `  --font-${name}-line-height: ${style.lineHeight};`,
      `  --font-${name}-letter-spacing: ${style.letterSpacing}px;`,
      `  --font-${name}-colour: ${style.colour};`,
    ];
  });
  return `:root {
  --design-width: ${project.targetWidth}px;
  --design-height: ${project.targetHeight}px;
${colourLines.join("\n")}${colourLines.length ? "\n" : ""}${spacingLines.join("\n")}${spacingLines.length ? "\n" : ""}${typeLines.join("\n")}
}
`;
}

function generateHandoffReadme() {
  return `# Design handoff package

This package was generated by Design Spec Extractor.

## Start here

1. Open \`AI_BUILD_PROMPT.md\` and provide it to the coding model.
2. Keep the full \`references\` folder available to the model.
3. Use \`design-spec.json\` for exact machine-readable coordinates.
4. Use \`DESIGN_SPEC.md\` for a human-readable review.
5. Copy \`tokens.css\` into the implementation and rename tokens only when necessary.

## Recommended implementation loop

- Build the desktop page at ${state.project.targetWidth}px wide.
- Capture a screenshot at the same viewport.
- Compare against the reference and correct layout geometry first.
- Only after the desktop match is close, implement responsive layouts and interactions.

The package deliberately separates visual measurement from code generation. That reduces the amount of layout interpretation the coding model must guess.
`;
}

function generateStarterHtml() {
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(state.project.name)}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main id="app">
    <!-- Implement from the references and design specification. -->
  </main>
</body>
</html>
`;
}

function generateStarterCss() {
  return `${generateCssTokens()}
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body { font-family: system-ui, sans-serif; }
img, video, svg { display: block; max-width: 100%; }
`;
}

async function exportPackage() {
  if (!state.documents.length) return;
  setBusy(true, "Exporting");
  try {
    const JSZip = await loadJsZip();
    const spec = serialiseProject();
    const zip = new JSZip();
    zip.file("design-spec.json", JSON.stringify(spec, null, 2));
    zip.file("DESIGN_SPEC.md", generateMarkdown(spec));
    zip.file("AI_BUILD_PROMPT.md", generatePrompt());
    zip.file("tokens.css", generateCssTokens());
    zip.file("README.md", generateHandoffReadme());
    zip.file("starter/index.html", generateStarterHtml());
    zip.file("starter/styles.css", generateStarterCss());
    for (const doc of state.documents) {
      zip.file(doc.sourceFile, doc.imageBlob);
    }
    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    downloadBlob(blob, `${safeFileName(state.project.name)}-design-handoff.zip`);
    showToast("Handoff package exported.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "The package could not be exported.", 5000);
  } finally {
    setBusy(false);
  }
}

async function openPackage(file) {
  setBusy(true, "Opening");
  try {
    const JSZip = await loadJsZip();
    const zip = await JSZip.loadAsync(file);
    const specEntry = zip.file("design-spec.json");
    if (!specEntry) throw new Error("This ZIP does not contain design-spec.json.");
    const spec = JSON.parse(await specEntry.async("text"));
    if (spec.format !== "design-spec-extractor") throw new Error("This is not a Design Spec Extractor package.");
    clearProject(false);
    state.project = { ...createDefaultProject(), ...spec.project };
    state.project.palette = Array.isArray(spec.project?.palette) ? spec.project.palette : [];
    state.project.spacing = Array.isArray(spec.project?.spacing) ? spec.project.spacing : [];
    state.project.typeStyles = Array.isArray(spec.project?.typeStyles) ? spec.project.typeStyles : [];

    for (const restored of spec.documents ?? []) {
      const entry = zip.file(restored.sourceFile);
      if (!entry) continue;
      const type = restored.mimeType || mimeFromName(restored.sourceFile);
      const blob = await entry.async("blob");
      const typedBlob = blob.type ? blob : new Blob([blob], { type });
      await addDocumentFromBlob(typedBlob, {
        sourceName: restored.sourceName,
        sourceFile: restored.sourceFile,
        displayName: restored.name,
        restored,
      });
    }
    renderAll();
    requestAnimationFrame(fitToViewport);
    showToast("Project package opened.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "The project package could not be opened.", 5000);
  } finally {
    setBusy(false);
    els.openPackageInput.value = "";
  }
}

function mimeFromName(name) {
  if (/\.jpe?g$/i.test(name)) return "image/jpeg";
  if (/\.webp$/i.test(name)) return "image/webp";
  return "image/png";
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function clearProject(requireConfirmation = true) {
  if (requireConfirmation && state.documents.length && !confirm("Clear this project and all local annotations? Export first if you need to keep it.")) return false;
  state.documents.forEach((doc) => {
    URL.revokeObjectURL(doc.objectUrl);
    if (doc.compare?.objectUrl) URL.revokeObjectURL(doc.compare.objectUrl);
  });
  state.project = createDefaultProject();
  state.documents = [];
  state.activeDocumentId = null;
  state.selectedRegionId = null;
  state.tool = "select";
  state.zoom = 1;
  state.drawing = null;
  state.drag = null;
  renderAll();
  setTool("select");
  return true;
}

function updatePromptPreview() {
  els.promptPreview.textContent = state.documents.length ? generatePrompt() : "Add a reference to generate the handoff prompt.";
}

async function copyPrompt() {
  const text = generatePrompt();
  try {
    await navigator.clipboard.writeText(text);
    showToast("Prompt copied.");
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    showToast("Prompt copied.");
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function singleLine(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function escapeTable(value = "") {
  return singleLine(value).replaceAll("|", "\\|");
}

function safeCssName(value) {
  return safeFileName(value).replaceAll(".", "-");
}

function bindProjectInput(element, key, parser = (value) => value) {
  element.addEventListener("input", () => {
    state.project[key] = parser(element.value);
    updatePromptPreview();
  });
}

function bindEvents() {
  bindProjectInput(els.projectName, "name");
  bindProjectInput(els.targetWidth, "targetWidth", (value) => clamp(Number(value) || 1440, 320, 10000));
  bindProjectInput(els.targetHeight, "targetHeight", (value) => clamp(Number(value) || 1200, 320, 30000));
  bindProjectInput(els.frameworkSelect, "framework");
  bindProjectInput(els.projectBrief, "brief");
  bindProjectInput(els.missingContent, "missingContent");
  bindProjectInput(els.hardRules, "hardRules");
  bindProjectInput(els.responsiveNotes, "responsiveNotes");

  [els.referenceInput, els.emptyReferenceInput].forEach((input) => {
    input.addEventListener("change", () => processReferenceFiles(input.files));
  });
  els.openPackageInput.addEventListener("change", () => {
    const file = els.openPackageInput.files?.[0];
    if (file) openPackage(file);
  });

  ["dragenter", "dragover"].forEach((type) => {
    els.dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      els.dropZone.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    els.dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      els.dropZone.classList.remove("is-dragging");
    });
  });
  els.dropZone.addEventListener("drop", (event) => processReferenceFiles(event.dataTransfer.files));

  $$(".tool-button[data-tool]").forEach((button) => button.addEventListener("click", () => setTool(button.dataset.tool)));
  els.autoPaletteBtn.addEventListener("click", extractDominantPalette);
  els.overlayCanvas.addEventListener("pointerdown", onPointerDown);
  els.overlayCanvas.addEventListener("pointermove", onPointerMove);
  els.overlayCanvas.addEventListener("pointerup", onPointerUp);
  els.overlayCanvas.addEventListener("pointercancel", onPointerUp);

  els.zoomOutBtn.addEventListener("click", () => setZoom(state.zoom / 1.2));
  els.zoomInBtn.addEventListener("click", () => setZoom(state.zoom * 1.2));
  els.zoomLabel.addEventListener("click", () => setZoom(1));
  els.fitBtn.addEventListener("click", fitToViewport);
  els.gridToggle.addEventListener("change", () => {
    state.showGrid = els.gridToggle.checked;
    applyZoom();
  });
  els.labelsToggle.addEventListener("change", () => {
    state.showLabels = els.labelsToggle.checked;
    drawOverlay();
  });
  els.compareInput.addEventListener("change", () => {
    const file = els.compareInput.files?.[0];
    if (file) loadCompareScreenshot(file);
  });
  els.compareOpacity.addEventListener("input", () => {
    const compare = activeDocument()?.compare;
    if (!compare) return;
    compare.opacity = Number(els.compareOpacity.value);
    renderCompare();
  });
  els.differenceToggle.addEventListener("change", () => {
    const doc = activeDocument();
    const compare = doc?.compare;
    if (!doc || !compare) return;
    if (els.differenceToggle.checked && doc.width * doc.height > 20_000_000) {
      els.differenceToggle.checked = false;
      compare.difference = false;
      showToast("Difference mode is limited to 20 megapixels. Use a 1x reference or the blend view.");
      renderCompare();
      return;
    }
    compare.difference = els.differenceToggle.checked;
    renderCompare();
  });
  els.clearCompareBtn.addEventListener("click", clearCompare);
  els.workspaceViewport.addEventListener("wheel", (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    const rect = els.workspaceViewport.getBoundingClientRect();
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    setZoom(state.zoom * factor, { x: event.clientX - rect.left, y: event.clientY - rect.top });
  }, { passive: false });

  [els.regionName, els.regionType, els.regionX, els.regionY, els.regionW, els.regionH, els.regionNotes, els.regionRepeat]
    .forEach((control) => control.addEventListener("input", updateSelectedRegionFromControls));
  els.deleteRegionBtn.addEventListener("click", deleteSelectedRegion);
  els.pageNotes.addEventListener("input", () => {
    const doc = activeDocument();
    if (!doc) return;
    doc.notes = els.pageNotes.value;
    updatePromptPreview();
  });
  els.pageCssWidth.addEventListener("input", () => {
    const doc = activeDocument();
    if (!doc) return;
    doc.cssWidth = clamp(Number(els.pageCssWidth.value) || state.project.targetWidth, 320, 10000);
    els.pageCssHeight.value = documentCssHeight(doc);
    els.pageScaleLabel.textContent = `Source ${doc.width} × ${doc.height}px → CSS ${round(doc.cssWidth, 1)} × ${documentCssHeight(doc)}px · scale ${round(documentCssScale(doc) * 100, 2)}%`;
    syncSelectionFields();
    updatePromptPreview();
  });

  els.addColourBtn.addEventListener("click", () => {
    addPaletteColour(els.manualColour.value);
    els.manualColour.value = "";
  });
  els.manualColour.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      els.addColourBtn.click();
    }
  });
  els.clearPaletteBtn.addEventListener("click", () => {
    state.project.palette = [];
    renderPalette();
    updatePromptPreview();
  });

  els.addSpacingBtn.addEventListener("click", () => {
    const value = Math.round(Number(els.spacingValue.value));
    if (!value || value < 1) return;
    if (!state.project.spacing.includes(value)) state.project.spacing.push(value);
    els.spacingValue.value = "";
    renderSpacing();
    updatePromptPreview();
  });
  els.spacingValue.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      els.addSpacingBtn.click();
    }
  });

  els.addTypeStyleBtn.addEventListener("click", () => els.typeStyleDialog.showModal());
  els.typeStyleForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (event.submitter?.id === "saveTypeStyleBtn") {
      if (!els.typeStyleForm.reportValidity()) return;
      const colour = hexToRgb(els.typeColour.value) ? rgbToHex(...Object.values(hexToRgb(els.typeColour.value))) : "#1C1B1C";
      state.project.typeStyles.push({
        id: uid(),
        name: els.typeName.value.trim(),
        family: els.typeFamily.value.trim(),
        size: Number(els.typeSize.value),
        weight: Number(els.typeWeight.value),
        lineHeight: Number(els.typeLineHeight.value),
        letterSpacing: Number(els.typeLetterSpacing.value),
        colour,
      });
      els.typeStyleForm.reset();
      els.typeSize.value = 48;
      els.typeWeight.value = 700;
      els.typeLineHeight.value = 1.1;
      els.typeLetterSpacing.value = 0;
      els.typeColour.value = "#1C1B1C";
      renderTypeStyles();
      updatePromptPreview();
    }
    els.typeStyleDialog.close();
  });

  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((item) => item.classList.toggle("is-active", item === tab));
      $$(".tab-panel").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.tabPanel === tab.dataset.tab));
    });
  });

  els.copyPromptBtn.addEventListener("click", copyPrompt);
  els.exportBtn.addEventListener("click", exportPackage);
  els.newProjectBtn.addEventListener("click", () => clearProject(true));

  window.addEventListener("resize", () => {
    if (activeDocument()) drawOverlay();
  });

  document.addEventListener("keydown", (event) => {
    const tag = document.activeElement?.tagName;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
    const key = event.key.toLowerCase();
    if (key === "v") setTool("select");
    if (key === "r") setTool("region");
    if (key === "c") setTool("colour");
    if (key === "x") setTool("guide-x");
    if (key === "y") setTool("guide-y");
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelectedRegion();
    }
    if (event.key === "Escape") {
      state.drawing = null;
      state.drag = null;
      drawOverlay();
    }
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && selectedRegion()) {
      event.preventDefault();
      const region = selectedRegion();
      const doc = activeDocument();
      const step = event.shiftKey ? 10 : 1;
      if (event.key === "ArrowLeft") region.x = clamp(region.x - step, 0, doc.width - region.w);
      if (event.key === "ArrowRight") region.x = clamp(region.x + step, 0, doc.width - region.w);
      if (event.key === "ArrowUp") region.y = clamp(region.y - step, 0, doc.height - region.h);
      if (event.key === "ArrowDown") region.y = clamp(region.y + step, 0, doc.height - region.h);
      syncSelectionFields();
      drawOverlay();
      updatePromptPreview();
    }
  });
}

function initialise() {
  bindEvents();
  renderAll();
  setTool("select");
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("service-worker.js").catch((error) => console.warn("Service worker registration failed", error));
  }
}

initialise();
