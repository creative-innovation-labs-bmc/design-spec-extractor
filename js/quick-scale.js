(() => {
  const WIDTH_PRESETS = [1440, 1600, 1800, 1920, 2400];

  function ready() {
    const widthInput = document.getElementById('pageCssWidth');
    const baseCanvas = document.getElementById('baseCanvas');
    const headerActions = document.querySelector('.header-actions');

    if (!widthInput || !baseCanvas || !headerActions || document.getElementById('quickScaleBtn')) return;

    const style = document.createElement('style');
    style.textContent = `
      .quick-scale-wrap { position: relative; }
      .quick-scale-button { min-width: 132px; justify-content: center; }
      .quick-scale-button strong { margin-left: 6px; font-variant-numeric: tabular-nums; }
      .quick-scale-popover {
        position: absolute;
        z-index: 1000;
        top: calc(100% + 10px);
        right: 0;
        width: min(360px, calc(100vw - 28px));
        padding: 18px;
        border: 1px solid rgba(255,255,255,.16);
        border-radius: 14px;
        background: #242622;
        color: #fff;
        box-shadow: 0 18px 60px rgba(0,0,0,.35);
      }
      .quick-scale-popover[hidden] { display: none; }
      .quick-scale-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:14px; }
      .quick-scale-head h2 { margin:0; font-size:1rem; }
      .quick-scale-head p { margin:5px 0 0; color:rgba(255,255,255,.66); font-size:.78rem; line-height:1.35; }
      .quick-scale-close { border:0; background:transparent; color:#fff; font-size:1.35rem; cursor:pointer; padding:0 2px; }
      .quick-scale-readout { padding:12px; margin-bottom:12px; border-radius:10px; background:rgba(255,255,255,.06); font-size:.86rem; line-height:1.45; font-variant-numeric:tabular-nums; }
      .quick-scale-presets { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:12px; }
      .quick-scale-preset { border:1px solid rgba(255,255,255,.18); border-radius:9px; background:transparent; color:#fff; padding:9px 7px; cursor:pointer; }
      .quick-scale-preset:hover, .quick-scale-preset.is-active { border-color:#89C925; background:rgba(137,201,37,.13); }
      .quick-scale-custom { display:grid; grid-template-columns:1fr auto; gap:8px; }
      .quick-scale-custom input { width:100%; border:1px solid rgba(255,255,255,.2); border-radius:9px; background:#171815; color:#fff; padding:10px 11px; }
      .quick-scale-apply { border:0; border-radius:9px; background:#89C925; color:#1c1b1c; font-weight:700; padding:0 15px; cursor:pointer; }
      .quick-scale-feature { grid-column:1/-1; border-color:rgba(137,201,37,.55); }
      @media (max-width: 760px) {
        .quick-scale-button { min-width: auto; }
        .quick-scale-button .quick-scale-word { display:none; }
        .quick-scale-popover { position:fixed; top:78px; right:14px; }
      }
    `;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.className = 'quick-scale-wrap';
    wrap.innerHTML = `
      <button id="quickScaleBtn" class="button button-quiet quick-scale-button" type="button" aria-haspopup="dialog" aria-expanded="false">
        <span class="quick-scale-word">Scale</span><strong id="quickScaleButtonValue">Set</strong>
      </button>
      <div id="quickScalePopover" class="quick-scale-popover" role="dialog" aria-label="Quick scale" hidden>
        <div class="quick-scale-head">
          <div><h2>Quick scale</h2><p>Change the implementation width without opening Page scale and notes.</p></div>
          <button id="quickScaleClose" class="quick-scale-close" type="button" aria-label="Close">×</button>
        </div>
        <div id="quickScaleReadout" class="quick-scale-readout">Add a reference to calculate its scale.</div>
        <div id="quickScalePresets" class="quick-scale-presets"></div>
        <div class="quick-scale-custom">
          <input id="quickScaleCustomWidth" type="number" min="320" max="10000" step="1" inputmode="numeric" aria-label="Custom implementation width" placeholder="Custom width">
          <button id="quickScaleApply" class="quick-scale-apply" type="button">Apply</button>
        </div>
      </div>
    `;

    headerActions.insertBefore(wrap, headerActions.firstChild);

    const button = document.getElementById('quickScaleBtn');
    const buttonValue = document.getElementById('quickScaleButtonValue');
    const popover = document.getElementById('quickScalePopover');
    const closeButton = document.getElementById('quickScaleClose');
    const readout = document.getElementById('quickScaleReadout');
    const presets = document.getElementById('quickScalePresets');
    const customWidth = document.getElementById('quickScaleCustomWidth');
    const applyButton = document.getElementById('quickScaleApply');

    function sourceWidth() {
      return Number(baseCanvas.width) || 0;
    }

    function currentWidth() {
      return Math.round(Number(widthInput.value) || 0);
    }

    function applyWidth(value) {
      const next = Math.round(Number(value));
      if (!Number.isFinite(next) || next < 320 || next > 10000) {
        customWidth.focus();
        return;
      }
      widthInput.value = String(next);
      widthInput.dispatchEvent(new Event('input', { bubbles: true }));
      widthInput.dispatchEvent(new Event('change', { bubbles: true }));
      update();
      close();
    }

    function addPreset(label, value, className = '') {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `quick-scale-preset ${className}`.trim();
      item.dataset.width = String(value);
      item.textContent = label;
      item.addEventListener('click', () => applyWidth(value));
      presets.appendChild(item);
    }

    function renderPresets() {
      presets.innerHTML = '';
      const source = sourceWidth();
      if (source === 2400) addPreset('2400 → 1800 · 75%', 1800, 'quick-scale-feature');
      WIDTH_PRESETS.forEach((width) => addPreset(`${width}px`, width));
    }

    function update() {
      const source = sourceWidth();
      const target = currentWidth();
      const percent = source > 0 && target > 0 ? (target / source) * 100 : 0;
      buttonValue.textContent = target ? `${target}px` : 'Set';
      customWidth.value = target || '';
      readout.textContent = source > 0
        ? `Source ${source}px → implementation ${target}px · multiplier ${(target / source).toFixed(4)} · ${percent.toFixed(percent % 1 ? 1 : 0)}%`
        : `Implementation width ${target || 'not set'}px. Add a reference to calculate the multiplier.`;
      presets.querySelectorAll('[data-width]').forEach((item) => {
        item.classList.toggle('is-active', Number(item.dataset.width) === target);
      });
    }

    function open() {
      renderPresets();
      update();
      popover.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      customWidth.select();
    }

    function close() {
      popover.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    }

    button.addEventListener('click', () => popover.hidden ? open() : close());
    closeButton.addEventListener('click', close);
    applyButton.addEventListener('click', () => applyWidth(customWidth.value));
    customWidth.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') applyWidth(customWidth.value);
      if (event.key === 'Escape') close();
    });
    widthInput.addEventListener('input', update);
    widthInput.addEventListener('change', update);

    document.addEventListener('pointerdown', (event) => {
      if (!popover.hidden && !wrap.contains(event.target)) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !popover.hidden) close();
    });

    const observer = new MutationObserver(update);
    observer.observe(baseCanvas, { attributes: true, attributeFilter: ['width', 'height'] });
    setInterval(update, 1200);
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready, { once: true });
  } else {
    ready();
  }
})();
