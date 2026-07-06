import {
  ANCHOR_ORDER,
  DEFAULTS,
  SOIL_ORDER,
  analyzeArray,
  analyzeSite,
  anchorDistribution,
  formatMoney,
  formatNumber,
  parametricStudy,
  scanCsvRows
} from "./engine.js";
import { downloadText, parseCsv, toCsv } from "./csv.js";

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

const colors = {
  GA: "#2978a0",
  DPA: "#5b5fd6",
  SA: "#2e9f6e",
  DEA: "#c9802f",
  VLA: "#bd3f32",
  "No feasible": "#6f747b",
  "Very Soft Clay": "#2a6fbb",
  "Medium Clay": "#c56a37",
  "Hard Clay": "#2f9d55",
  Sand: "#caa52d",
  Rock: "#6c6f73"
};

let csvRows = [];
let scanRows = [];
let paramRows = [];
let lastSiteResult = null;
let lastArrayResult = null;
let lastCsvSummary = null;
let lastParamSummary = null;
let lastReportHtml = "";
let siteRunButtonTimer = 0;
let lastSiteSignature = "";
let siteInputsDirty = false;

const DEFAULT_HELP = "Hover or focus an option to see guidance.";

const HELP_TEXT = {
  "mooring-system": "Select the global mooring behavior. Catenary, taut, and TLP change load angle handling and mooring length assumptions.",
  "mooring-angle": "Angle between the load and seabed in degrees. Higher angles penalize or exclude anchor types that cannot take vertical load.",
  "design-load": "Design line load in kN before anchor safety factor is applied.",
  "water-depth": "Water depth at the site in meters. This affects mooring length, CSV filtering, and cost intensity.",
  "rated-power": "Rated power per device in kW. Used to normalize system cost to USD/kW and LCOE contribution.",
  "soil-type": "Dominant seabed class used by the anchor selector. CSV scans infer this from sediment columns.",
  "site-lat": "Latitude for the single-site run and nearest-site CSV search.",
  "site-lon": "Longitude for the single-site run and nearest-site CSV search.",
  "use-mooring": "Include mooring line cost in total system cost. Disable to inspect anchor-only economics.",
  "include-mooring-ranking": "When enabled, the best anchor is ranked by anchor plus mooring cost. Disable to rank anchor cost only.",
  "mooring-material": "Material used for mooring cost and mass estimates.",
  "num-lines": "Number of mooring lines per device for total per-device cost.",
  "mbl-factor": "Multiplier applied to design load when estimating required minimum breaking load for mooring lines.",
  "safety-factor": "Anchor safety factor applied to design load when checking required holding capacity.",
  "length-model": "Depth model estimates line length from water depth; fixed model uses the fixed length field.",
  "fixed-length": "Mooring length in meters when Length model is set to Fixed.",
  "cat-factor": "Catenary length multiplier applied to water depth for estimated line length.",
  "chain-grade": "Cost and capacity multiplier for chain grade assumptions.",
  "taut-slack": "Taut-line slack multiplier. Values near 1 represent tighter taut mooring geometry.",
  "taut-min-angle": "Minimum assumed load angle for taut mooring checks.",
  "fx": "USD per EUR exchange rate used to convert anchor, fabrication, installation, and mooring cost.",
  "enforce-crane": "When enabled, candidates can be rejected if anchor mass exceeds vessel crane capacity.",
  "csv-crane": "Crane capacity in tonnes for construction support vessel installation checks.",
  "ahv-crane": "Crane capacity in tonnes for anchor handling vessel installation checks.",
  "phi-deg": "Optional friction angle override in degrees. Leave blank to use soil defaults.",
  "rho-water": "Water density in kg/m3 for calculations that depend on submerged weight.",
  "chain-diameter": "Nominal chain diameter in millimeters for chain mass and cost assumptions.",
  "angle-tol": "Tolerance in degrees when checking whether a candidate can handle the requested load angle.",
  "soil-quotient": "Optional soil strength quotient override. Leave blank to use the selected soil class default.",
  "use-mid-install": "Use midpoint installation durations from the MATLAB-style install-time ranges.",
  "vla-coeff-a": "Optional VLA holding-capacity coefficient a. Leave blank to use the built-in default.",
  "vla-coeff-b": "Optional VLA holding-capacity coefficient b. Leave blank to use the built-in default.",
  "compute-lcoe": "Calculate mooring and anchoring contribution to LCOE in USD/MWh.",
  "lcoe-fcr": "Fixed charge rate used for annualizing capital cost in LCOE calculations.",
  "lcoe-cf": "Net capacity factor used to estimate annual energy production.",
  "lcoe-opex": "Annual operating cost adder in USD per kW-year for the LCOE contribution.",
  "out-prefix": "Filename prefix used when downloading site, CSV, or parametric results.",
  "plot-map": "Show or hide the CSV map-style visualization area.",
  "plot-cost": "Keep cost-map display enabled for CSV scan views.",
  "plot-kw": "Keep USD/kW display enabled for CSV scan views.",
  "plot-box": "Show or hide distribution-style summary plots.",
  "plot-soil": "Keep soil display enabled for CSV scan views.",
  "plot-share": "Show or hide cost-share style distribution output.",
  "run-site": "Run the single-site anchor selection with the current controls.",
  "run-site-top": "Run the single-site anchor selection from the top of the control panel.",
  "open-report-top": "Open the report workspace for the current analysis.",
  "open-help-top": "Open the Help page with tutorial steps and the Ask Guide assistant.",
  "download-site": "Download the latest single-site result as JSON.",
  "csv-file": "Upload a CSV with site coordinates, water depth, and sediment columns. Data stays in this browser session.",
  "load-sample": "Load the bundled sample CSV so you can test the scan workflow immediately.",
  "run-csv": "Run the CSV scan using the current filters and shared load-case settings.",
  "download-csv": "Download the latest CSV scan table as a CSV file.",
  "csv-source-mode": "Map scan evaluates retained rows; nearest site keeps the closest retained row to the current latitude and longitude.",
  "bbox-lat-min": "Southern latitude bound for CSV map scan filtering.",
  "bbox-lat-max": "Northern latitude bound for CSV map scan filtering.",
  "bbox-lon-min": "Western longitude bound for CSV map scan filtering.",
  "bbox-lon-max": "Eastern longitude bound for CSV map scan filtering.",
  "min-depth": "Minimum water depth retained during CSV filtering.",
  "max-depth": "Maximum water depth retained during CSV filtering.",
  "max-rows": "Maximum number of CSV rows to retain after filtering. Use smaller values for faster public demos.",
  "run-array": "Run the farm-level array comparison for non-shared and shared anchoring.",
  "site-length": "Usable project length in kilometers for estimating array device count.",
  "site-width": "Usable project width in kilometers for estimating array device count.",
  "spacing-mode": "User mode uses the spacing field; geometry mode derives spacing from the site footprint.",
  "device-spacing": "Nominal center-to-center device spacing in meters.",
  "array-count-model": "Floor counts complete rows and columns. Plus one includes endpoints in the count.",
  "lines-per-device": "Mooring lines per device used in the array cost comparison.",
  "compute-shared": "Enable shared anchoring estimates where adjacent devices can share anchor points.",
  "min-shared-spacing": "Minimum spacing required for shared anchoring. Leave blank to use the device spacing.",
  "run-parametric": "Run the sensitivity study for the selected variable and range.",
  "download-parametric": "Download the latest parametric study table as a CSV file.",
  "param-variable": "Select the variable to sweep: load, angle, depth, or combined load plus angle.",
  "param-start": "Start value for the primary parametric sweep.",
  "param-step": "Increment for the primary parametric sweep.",
  "param-end": "End value for the primary parametric sweep.",
  "param-angle-start": "Start angle for combined load-angle sweeps.",
  "param-angle-step": "Angle increment for combined load-angle sweeps.",
  "param-angle-end": "End angle for combined load-angle sweeps.",
  "param-baseline-depth": "Water depth used as the baseline when the sweep variable is not water depth.",
  "param-max-points": "Maximum sampled points per sweep to keep charts responsive in the browser.",
  "scenario-baseline": "Set a conservative catenary baseline for quick single-site screening.",
  "scenario-taut": "Set a taut mooring case with inclined loading for deeper-water comparison.",
  "scenario-tlp": "Set a high-angle TLP case to exercise vertical-load anchor behavior.",
  "scenario-array": "Set a practical array demonstration with shared anchoring enabled.",
  "build-report": "Generate an executive summary from the latest site, CSV, array, and study results.",
  "download-report": "Download the generated executive report as a self-contained HTML file.",
  "download-report-pdf": "Download a PDF summary of the current executive report.",
  "ask-guide-input": "Ask a question about how to use the app, interpret results, export reports, or connect to GPT.",
  "ask-guide-run": "Answer the question using the built-in app guide.",
  "copy-gpt-prompt": "Copy a detailed ChatGPT prompt with the current app context.",
  "open-chatgpt": "Open ChatGPT in a new tab. Paste the copied prompt there for a full LLM answer."
};

function value(id) {
  return $(`#${id}`)?.value;
}

function numberValue(id, fallback = NaN) {
  const n = Number(value(id));
  return Number.isFinite(n) ? n : fallback;
}

function checked(id) {
  return Boolean($(`#${id}`)?.checked);
}

function nullableNumber(id) {
  const raw = value(id);
  if (raw === undefined || raw === null || String(raw).trim() === "") return NaN;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setInputValue(id, nextValue) {
  const el = document.getElementById(id);
  if (el) el.value = nextValue;
}

function setInputChecked(id, nextValue) {
  const el = document.getElementById(id);
  if (el) el.checked = Boolean(nextValue);
}

function setStatus(message, tone = "ok") {
  const el = $("#status-line");
  el.textContent = message;
  el.dataset.tone = tone;
}

function runStamp() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function siteConfigSignature(cfg = readBaseConfig()) {
  return JSON.stringify(cfg);
}

function updateSiteRunFeedback(message, tone = "ok") {
  const feedback = $("#site-run-feedback");
  if (!feedback) return;
  feedback.textContent = message;
  feedback.dataset.tone = tone;
  feedback.dataset.pulse = "false";
  feedback.offsetHeight;
  feedback.dataset.pulse = tone === "ok" ? "true" : "false";
}

function setSiteRunButtons(text, disabled = false) {
  ["#run-site", "#run-site-top"].forEach(selector => {
    const button = $(selector);
    if (button) {
      button.textContent = text;
      button.disabled = disabled;
    }
  });
}

function resetSiteRunButtons() {
  const main = $("#run-site");
  const top = $("#run-site-top");
  if (main) {
    main.textContent = "Run";
    main.disabled = false;
  }
  if (top) {
    top.textContent = "Run Site";
    top.disabled = false;
  }
}

function markSiteButtonState(text, disabled = false) {
  setSiteRunButtons(text, disabled);
  clearTimeout(siteRunButtonTimer);
  siteRunButtonTimer = window.setTimeout(() => {
    resetSiteRunButtons();
  }, 1100);
}

function markSiteInputsDirty() {
  if (!lastSiteSignature) return;
  const changed = siteConfigSignature() !== lastSiteSignature;
  siteInputsDirty = changed;
  resetSiteRunButtons();
  if (changed) {
    setStatus("Inputs changed. Run Site to update results.");
    updateSiteRunFeedback("Inputs changed. Run Site to refresh the recommendation and costs.");
  }
}

function requestSiteRun() {
  const signature = siteConfigSignature();
  if (lastSiteResult && signature === lastSiteSignature && !siteInputsDirty) {
    const message = `Analysis is already up to date as of ${runStamp()}. Change an input, then click Run Site to update.`;
    setStatus(message);
    updateSiteRunFeedback(message);
    markSiteButtonState("Up to date");
    return;
  }
  clearTimeout(siteRunButtonTimer);
  setSiteRunButtons("Running...", true);
  setStatus("Running single-site analysis...");
  updateSiteRunFeedback("Running single-site analysis with the current inputs.");
  window.setTimeout(() => runSite("manual"), 0);
}

function setupHelp() {
  const helpText = $("#help-text");
  const showHelp = text => {
    if (helpText) helpText.textContent = text;
  };
  const resetHelp = () => {
    if (helpText) helpText.textContent = DEFAULT_HELP;
  };

  Object.entries(HELP_TEXT).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const label = el.closest("label");
    const show = () => showHelp(text);
    el.title = text;
    el.setAttribute("aria-describedby", "context-help");
    el.addEventListener("mouseenter", show);
    el.addEventListener("focus", show);
    el.addEventListener("focusin", show);
    el.addEventListener("click", show);
    el.addEventListener("input", show);
    el.addEventListener("mouseleave", () => {
      if (!label || !label.matches(":hover")) resetHelp();
    });
    el.addEventListener("blur", resetHelp);

    if (label) {
      label.classList.add("has-help");
      label.title = text;
      label.addEventListener("mouseenter", show);
      label.addEventListener("focusin", show);
      label.addEventListener("click", show);
      label.addEventListener("mouseleave", resetHelp);
      label.addEventListener("focusout", resetHelp);
    }
  });
}

function readBaseConfig() {
  return {
    mooringSystem: value("mooring-system"),
    mooringAngle_deg: numberValue("mooring-angle", DEFAULTS.mooringAngle_deg),
    designLoad_kN: numberValue("design-load", DEFAULTS.designLoad_kN),
    waterDepth_m: numberValue("water-depth", DEFAULTS.waterDepth_m),
    soilType: value("soil-type"),
    latitude: numberValue("site-lat", DEFAULTS.latitude),
    longitude: numberValue("site-lon", DEFAULTS.longitude),
    safetyFactor: numberValue("safety-factor", DEFAULTS.safetyFactor),
    mblFactor: numberValue("mbl-factor", DEFAULTS.mblFactor),
    phi_deg: nullableNumber("phi-deg"),
    rhoWater: numberValue("rho-water", DEFAULTS.rhoWater),
    chainDiameter_mm: numberValue("chain-diameter", DEFAULTS.chainDiameter_mm),
    angleTol_deg: numberValue("angle-tol", DEFAULTS.angleTol_deg),
    soilQuotient: nullableNumber("soil-quotient"),
    vlaCoeffA: nullableNumber("vla-coeff-a"),
    vlaCoeffB: nullableNumber("vla-coeff-b"),
    useMidInstallTimes: checked("use-mid-install"),
    fxUsdPerEur: numberValue("fx", DEFAULTS.fxUsdPerEur),
    ratedPowerPerDevice_kW: numberValue("rated-power", DEFAULTS.ratedPowerPerDevice_kW),
    computeLCOE: checked("compute-lcoe"),
    lcoeFcr: numberValue("lcoe-fcr", DEFAULTS.lcoeFcr),
    lcoeNetCapacityFactor: numberValue("lcoe-cf", DEFAULTS.lcoeNetCapacityFactor),
    lcoeAnnualOpex_USD_per_kW_yr: numberValue("lcoe-opex", DEFAULTS.lcoeAnnualOpex_USD_per_kW_yr),
    useMooringCost: checked("use-mooring"),
    includeMooringInRanking: checked("include-mooring-ranking"),
    mooringMaterial: value("mooring-material"),
    numMooringLines: numberValue("num-lines", DEFAULTS.numMooringLines),
    chainGradeFactor: numberValue("chain-grade", DEFAULTS.chainGradeFactor),
    mooringLengthModel: value("length-model"),
    mooringLength_m: numberValue("fixed-length", DEFAULTS.mooringLength_m),
    catenaryLengthFactor: numberValue("cat-factor", DEFAULTS.catenaryLengthFactor),
    tautSlackFactor: numberValue("taut-slack", DEFAULTS.tautSlackFactor),
    tautMinAngle_deg: numberValue("taut-min-angle", DEFAULTS.tautMinAngle_deg),
    enforceCraneCapacity: checked("enforce-crane"),
    csvCraneCapacity_tonnes: numberValue("csv-crane", DEFAULTS.csvCraneCapacity_tonnes),
    ahvCraneCapacity_tonnes: numberValue("ahv-crane", DEFAULTS.ahvCraneCapacity_tonnes)
  };
}

function outPrefix() {
  return String(value("out-prefix") || "anchor_selection").trim().replace(/[^A-Za-z0-9_-]+/g, "_") || "anchor_selection";
}

function rankedCost(candidate, cfg) {
  const key = cfg.includeMooringInRanking ? "TotalSystemCost_EUR" : "AnchorCost_EUR";
  return candidate[key] * cfg.fxUsdPerEur;
}

function decisionReadiness(flags) {
  if (flags.some(flag => flag.tone === "bad")) return { tone: "bad", label: "Needs Input Fix" };
  if (flags.some(flag => flag.tone === "review")) return { tone: "review", label: "Engineering Review" };
  return { tone: "ok", label: "Screening Ready" };
}

function validationFlags(cfg, res) {
  const flags = [];
  if (res.candidates.length >= 3) {
    flags.push({ tone: "ok", text: `${res.candidates.length} feasible anchor candidates available for comparison.` });
  } else {
    flags.push({ tone: "review", text: `Only ${res.candidates.length} feasible candidate${res.candidates.length === 1 ? "" : "s"} returned; review assumptions and site constraints.` });
  }
  if (res.rejected.length) {
    flags.push({ tone: "review", text: `${res.rejected.length} candidate checks were rejected by soil, angle, geometry, or vessel rules.` });
  } else {
    flags.push({ tone: "ok", text: "No candidate rejection checks were triggered." });
  }
  if (cfg.enforceCraneCapacity) {
    flags.push({ tone: "ok", text: "Vessel crane capacity limits are enforced." });
  } else {
    flags.push({ tone: "review", text: "Vessel crane capacity limits are disabled." });
  }
  if (cfg.computeLCOE) {
    flags.push({ tone: "ok", text: "LCOE contribution is enabled for finance-normalized comparison." });
  } else {
    flags.push({ tone: "review", text: "LCOE contribution is disabled; outputs are cost-only." });
  }
  flags.push({ tone: "review", text: "Screening model: final release should be checked against golden MATLAB regression cases and project geotechnical review." });
  return flags;
}

function renderValidation(container, flags) {
  if (!container) return;
  const readiness = decisionReadiness(flags);
  container.innerHTML = `
    <h3>Decision Readiness</h3>
    <span class="status-pill ${readiness.tone === "ok" ? "" : readiness.tone}">${escapeHtml(readiness.label)}</span>
    <ul class="validation-list">
      ${flags.map(flag => `<li class="${flag.tone}">${escapeHtml(flag.text)}</li>`).join("")}
    </ul>
  `;
}

function renderDecisionSummary(container, res, cfg, flags) {
  if (!container) return;
  const readiness = decisionReadiness(flags);
  const best = res.best;
  const second = res.candidates[1];
  const bestCost = rankedCost(res.candidates[0], cfg);
  const secondCost = second ? rankedCost(second, cfg) : NaN;
  const gap = Number.isFinite(secondCost) && bestCost > 0 ? 100 * (secondCost - bestCost) / bestCost : NaN;
  const gapText = Number.isFinite(gap) ? `${formatNumber(gap, 1)}% gap to next` : "single feasible candidate";
  container.innerHTML = `
    <h3>Recommended Anchor</h3>
    <div class="decision-title">
      <strong>${escapeHtml(best.Type)}</strong>
      <span class="status-pill ${readiness.tone === "ok" ? "" : readiness.tone}">${escapeHtml(gapText)}</span>
    </div>
    <p class="decision-detail">${escapeHtml(best.Variant)} using ${escapeHtml(best.Vessel)} installation. ${escapeHtml(readiness.label)} for screening-level comparison.</p>
    <div class="decision-facts">
      <div class="decision-fact"><span>Total System</span><strong>${escapeHtml(formatMoney(res.perDevice.totalSystemCost_USD))}</strong></div>
      <div class="decision-fact"><span>Cost Intensity</span><strong>${escapeHtml(formatMoney(res.perDevice.totalCost_USD_per_kW, 2))}/kW</strong></div>
      <div class="decision-fact"><span>Mass</span><strong>${escapeHtml(formatNumber(best.Mass_kg / 1000, 2))} t</strong></div>
    </div>
  `;
}

function renderLegend(container, keys) {
  if (!container) return;
  container.innerHTML = keys.map(key => `
    <span class="legend-item"><span class="legend-swatch" style="background:${colors[key] || "#555"}"></span>${escapeHtml(key)}</span>
  `).join("");
}

function renderCostBreakdown(container, res) {
  if (!container) return;
  const components = [
    { label: "Fabrication", value: res.perDevice.fabCost_USD, color: "#0f6b7e" },
    { label: "Installation", value: res.perDevice.installCost_USD, color: "#cc0000" },
    { label: "Mooring", value: Number.isFinite(res.perDevice.mooringCost_USD) ? res.perDevice.mooringCost_USD : 0, color: "#2e9f6e" }
  ];
  const total = components.reduce((sum, item) => sum + (Number.isFinite(item.value) ? item.value : 0), 0);
  if (!(total > 0)) {
    container.innerHTML = `<div class="empty">No cost breakdown available.</div>`;
    return;
  }
  container.innerHTML = components.map(item => {
    const width = Math.max(0, 100 * item.value / total);
    return `
      <div class="breakdown-row">
        <span class="breakdown-label">${escapeHtml(item.label)}</span>
        <div class="breakdown-track">
          <span class="breakdown-fill" style="width:${width}%; background:${item.color}"></span>
        </div>
        <span class="breakdown-value">${escapeHtml(formatMoney(item.value))} (${escapeHtml(formatNumber(width, 1))}%)</span>
      </div>
    `;
  }).join("") + `
    <div class="breakdown-row">
      <span class="breakdown-label">Total</span>
      <div class="breakdown-track"><span class="breakdown-fill" style="width:100%; background:#48545d"></span></div>
      <span class="breakdown-value">${escapeHtml(formatMoney(total))}</span>
    </div>
  `;
}

function applyPlotToggles() {
  const mapLayout = document.querySelector(".map-layout");
  if (mapLayout) mapLayout.style.display = checked("plot-map") || checked("plot-cost") || checked("plot-kw") || checked("plot-soil") ? "" : "none";
  const distribution = $("#distribution-chart")?.closest(".panel");
  if (distribution) distribution.style.display = checked("plot-box") || checked("plot-share") ? "" : "none";
}

function renderMetrics(container, metrics) {
  container.innerHTML = metrics.map(item => `
    <div class="metric">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
    </div>
  `).join("");
}

function renderCandidateBars(container, candidates, fx, lines) {
  if (!candidates.length) {
    container.innerHTML = `<div class="empty">No feasible candidates.</div>`;
    return;
  }
  const values = candidates.map(c => c.AnchorCost_EUR * fx * lines);
  const max = Math.max(...values, 1);
  container.innerHTML = candidates.map((candidate, index) => {
    const valueUSD = values[index];
    const width = Math.max(4, 100 * valueUSD / max);
    return `
      <div class="bar-row">
        <span class="bar-label">${escapeHtml(candidate.Type)}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${width}%; background:${colors[candidate.Type] || "#555"}"></div>
        </div>
        <span class="bar-value">${escapeHtml(formatMoney(valueUSD))}</span>
      </div>
    `;
  }).join("");
}

function renderTable(container, rows, columns, limit = 20) {
  if (!rows.length) {
    container.innerHTML = `<div class="empty">No rows.</div>`;
    return;
  }
  const view = rows.slice(0, limit);
  container.innerHTML = `
    <table>
      <thead><tr>${columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join("")}</tr></thead>
      <tbody>
        ${view.map(row => `
          <tr>${columns.map(c => `<td>${escapeHtml(c.format ? c.format(row[c.key], row) : row[c.key])}</td>`).join("")}</tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function runSite(source = "auto") {
  try {
    const cfg = readBaseConfig();
    const res = analyzeSite(cfg);
    lastSiteResult = { config: cfg, result: res };
    lastSiteSignature = siteConfigSignature(cfg);
    siteInputsDirty = false;
    const flags = validationFlags(cfg, res);
    const stamp = runStamp();
    const runMessage = source === "manual" ? `Results updated at ${stamp}.` : `Results ready at ${stamp}.`;
    setStatus(runMessage);
    updateSiteRunFeedback(`${runMessage} Best anchor: ${res.best.Type}; total system: ${formatMoney(res.perDevice.totalSystemCost_USD)}.`);
    markSiteButtonState(source === "manual" ? "Updated" : "Ready");
    renderDecisionSummary($("#decision-summary"), res, cfg, flags);
    renderValidation($("#validation-panel"), flags);
    const metrics = [
      { label: "Best anchor", value: res.best.Type },
      { label: "Variant", value: res.best.Variant },
      { label: "Total system", value: formatMoney(res.perDevice.totalSystemCost_USD) },
      { label: "Cost intensity", value: `${formatMoney(res.perDevice.totalCost_USD_per_kW, 2)}/kW` },
      { label: "Anchor mass", value: `${formatNumber(res.best.Mass_kg / 1000, 2)} t` },
      { label: "Mooring length", value: `${formatNumber(res.mooring.length_m, 1)} m` },
      { label: "MBL required", value: `${formatNumber(res.best.MBL_required_kN, 1)} kN` },
      { label: "UHC", value: `${formatNumber(res.best.UHC_kN, 1)} kN` }
    ];
    if (cfg.computeLCOE) metrics.push({ label: "M&A LCOE", value: `${formatMoney(res.perDevice.mooringAnchorLCOE_USD_per_MWh, 2)}/MWh` });
    renderMetrics($("#site-metrics"), metrics);
    renderLegend($("#candidate-legend"), ANCHOR_ORDER.filter(type => res.candidates.some(candidate => candidate.Type === type)));
    renderCandidateBars($("#candidate-chart"), res.candidates, cfg.fxUsdPerEur, Math.max(1, Math.round(cfg.numMooringLines)));
    renderCostBreakdown($("#cost-breakdown"), res);
    renderTable($("#candidate-table"), res.candidates, [
      { key: "Type", label: "Type" },
      { key: "Variant", label: "Variant" },
      { key: "Vessel", label: "Vessel" },
      { key: "Mass_kg", label: "Mass t", format: v => formatNumber(v / 1000, 2) },
      { key: "AnchorCost_EUR", label: "Anchor USD", format: v => formatMoney(v * cfg.fxUsdPerEur) },
      { key: "FabCost_EUR", label: "Fab USD", format: v => formatMoney(v * cfg.fxUsdPerEur) },
      { key: "InstallCost_EUR", label: "Install USD", format: v => formatMoney(v * cfg.fxUsdPerEur) }
    ], 10);
    renderTable($("#rejected-table"), res.rejected, [
      { key: "AnchorType", label: "Type" },
      { key: "Reason", label: "Reason" },
      { key: "Details", label: "Details" }
    ], 12);
    renderReportPreview();
  } catch (error) {
    renderDecisionError(error.message);
    siteInputsDirty = true;
    resetSiteRunButtons();
    updateSiteRunFeedback(`Site run failed at ${runStamp()}: ${error.message}`, "bad");
    setStatus(error.message, "bad");
  }
}

function bboxFromInputs() {
  return [
    numberValue("bbox-lat-min", 24),
    numberValue("bbox-lat-max", 46),
    numberValue("bbox-lon-min", -82),
    numberValue("bbox-lon-max", -60)
  ];
}

function runCsvScan() {
  if (!csvRows.length) {
    setStatus("Load a CSV first.", "bad");
    return;
  }
  try {
    const cfg = {
      ...readBaseConfig(),
      bbox: bboxFromInputs(),
      minWaterDepth_m: numberValue("min-depth", 0),
      maxWaterDepth_m: numberValue("max-depth", Infinity),
      maxRows: numberValue("max-rows", Infinity)
    };
    const scan = scanCsvRows(csvRows, cfg);
    scanRows = scan.rows;
    if (value("csv-source-mode") === "nearest_csv_site" && scanRows.length) {
      const targetLat = cfg.latitude;
      const targetLon = cfg.longitude;
      const nearest = scanRows.reduce((best, row) => {
        const d = Math.hypot((row.Lat - targetLat) * 111, (row.Lon - targetLon) * 111 * Math.cos(targetLat * Math.PI / 180));
        return !best || d < best.d ? { row, d } : best;
      }, null);
      scanRows = nearest ? [{ ...nearest.row, NearestDistance_km: nearest.d }] : [];
    }
    const ok = scanRows.filter(r => r.Status === "OK");
    const averageCost = ok.reduce((s, r) => s + r.TotalSystemCost_USD, 0) / Math.max(ok.length, 1);
    const distribution = anchorDistribution(scanRows);
    lastCsvSummary = {
      retained: scanRows.length,
      feasible: ok.length,
      averageCost,
      mode: value("csv-source-mode") === "nearest_csv_site" ? "Nearest" : "Map scan",
      removed: scan.removed
    };
    setStatus(`CSV scan complete: ${scanRows.length} retained rows.`);
    renderMetrics($("#csv-metrics"), [
      { label: "Used sites", value: scanRows.length.toLocaleString() },
      { label: "Feasible", value: ok.length.toLocaleString() },
      { label: "Average system", value: formatMoney(averageCost) },
      { label: "BBox removed", value: scan.removed.bbox.toLocaleString() },
      { label: "Depth removed", value: (scan.removed.shallow + scan.removed.deep + scan.removed.missingDepth).toLocaleString() },
      { label: "Unknown soil", value: scan.removed.unknownSoil.toLocaleString() },
      { label: "Source mode", value: value("csv-source-mode") === "nearest_csv_site" ? "Nearest" : "Map scan" }
    ]);
    renderDistribution($("#distribution-chart"), distribution);
    renderLegend($("#map-legend"), ANCHOR_ORDER.filter(type => distribution.some(item => item.type === type && item.count > 0)));
    renderMap($("#map-svg"), scanRows);
    renderMapNote(scanRows);
    applyPlotToggles();
    renderTable($("#csv-table"), scanRows, [
      { key: "Lat", label: "Lat", format: v => formatNumber(v, 4) },
      { key: "Lon", label: "Lon", format: v => formatNumber(v, 4) },
      { key: "WaterDepth_m", label: "Depth", format: v => formatNumber(v, 1) },
      { key: "SoilType", label: "Soil" },
      { key: "BestAnchorType", label: "Best" },
      { key: "TotalSystemCost_USD", label: "Total USD", format: v => formatMoney(v) },
      { key: "TotalCost_USD_per_kW", label: "USD/kW", format: v => formatMoney(v, 2) },
      { key: "MooringAnchorLCOE_USD_per_MWh", label: "LCOE", format: v => formatMoney(v, 2) }
    ], 50);
    renderReportPreview();
  } catch (error) {
    setStatus(error.message, "bad");
  }
}

function renderDistribution(container, distribution) {
  const max = Math.max(...distribution.map(d => d.count), 1);
  container.innerHTML = distribution.map(d => `
    <div class="bar-row">
      <span class="bar-label">${escapeHtml(d.type)}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.max(2, 100 * d.count / max)}%; background:${colors[d.type] || "#555"}"></div>
      </div>
      <span class="bar-value">${escapeHtml(d.count)} (${escapeHtml(formatNumber(d.percent, 1))}%)</span>
    </div>
  `).join("");
}

function renderMap(svg, rows) {
  const width = 820;
  const height = 470;
  const pad = 38;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";
  if (!rows.length) return;
  const lats = rows.map(r => r.Lat).filter(Number.isFinite);
  const lons = rows.map(r => r.Lon).filter(Number.isFinite);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const costs = rows.map(r => r.TotalCost_USD_per_kW).filter(Number.isFinite);
  const minCost = costs.length ? Math.min(...costs) : NaN;
  const maxCost = costs.length ? Math.max(...costs) : NaN;
  const sx = lon => pad + (lon - minLon) / Math.max(maxLon - minLon, 1e-9) * (width - 2 * pad);
  const sy = lat => height - pad - (lat - minLat) / Math.max(maxLat - minLat, 1e-9) * (height - 2 * pad);
  const addText = (text, x, y, cls, anchor = "middle") => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "text");
    el.textContent = text;
    el.setAttribute("x", x);
    el.setAttribute("y", y);
    el.setAttribute("class", cls);
    el.setAttribute("text-anchor", anchor);
    svg.appendChild(el);
  };

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", width);
  bg.setAttribute("height", height);
  bg.setAttribute("class", "map-bg");
  svg.appendChild(bg);

  for (let i = 0; i < 6; i += 1) {
    const x = pad + i * (width - 2 * pad) / 5;
    const y = pad + i * (height - 2 * pad) / 5;
    const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    vLine.setAttribute("x1", x);
    vLine.setAttribute("x2", x);
    vLine.setAttribute("y1", pad);
    vLine.setAttribute("y2", height - pad);
    vLine.setAttribute("class", "grid-line");
    svg.appendChild(vLine);
    const hLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    hLine.setAttribute("x1", pad);
    hLine.setAttribute("x2", width - pad);
    hLine.setAttribute("y1", y);
    hLine.setAttribute("y2", y);
    hLine.setAttribute("class", "grid-line");
    svg.appendChild(hLine);
  }

  addText(`${formatNumber(minLon, 2)} lon`, pad, height - 10, "axis-text", "start");
  addText(`${formatNumber(maxLon, 2)} lon`, width - pad, height - 10, "axis-text", "end");
  addText(`${formatNumber(minLat, 2)} lat`, 8, height - pad, "axis-text", "start");
  addText(`${formatNumber(maxLat, 2)} lat`, 8, pad + 4, "axis-text", "start");
  addText("Point color = best anchor; point size = USD/kW", width / 2, 20, "axis-title");

  rows.forEach(row => {
    const point = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    const cost = row.TotalCost_USD_per_kW;
    const norm = Number.isFinite(cost) && Number.isFinite(minCost) && maxCost > minCost ? (cost - minCost) / (maxCost - minCost) : 0.35;
    const radius = rows.length > 2500 ? 2.1 : 2.8 + 3.8 * norm;
    point.setAttribute("cx", sx(row.Lon));
    point.setAttribute("cy", sy(row.Lat));
    point.setAttribute("r", radius);
    point.setAttribute("fill", colors[row.BestAnchorType] || "#333");
    point.setAttribute("opacity", row.Status === "OK" ? "0.82" : "0.45");
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${row.Lat.toFixed(4)}, ${row.Lon.toFixed(4)} | ${row.SoilType} | ${row.BestAnchorType} | ${formatMoney(row.TotalSystemCost_USD)}`;
    point.appendChild(title);
    svg.appendChild(point);
  });
}

function renderMapNote(rows) {
  const note = $("#map-note");
  if (!note) return;
  const ok = rows.filter(row => row.Status === "OK" && Number.isFinite(row.TotalCost_USD_per_kW));
  if (!ok.length) {
    note.textContent = "No feasible cost-intensity points available for the current scan.";
    return;
  }
  const costs = ok.map(row => row.TotalCost_USD_per_kW);
  note.textContent = `Cost intensity range: ${formatMoney(Math.min(...costs), 2)}/kW to ${formatMoney(Math.max(...costs), 2)}/kW across ${ok.length.toLocaleString()} feasible site${ok.length === 1 ? "" : "s"}.`;
}

function runArray() {
  try {
    const cfg = {
      ...readBaseConfig(),
      siteLength_km: numberValue("site-length", 5),
      siteWidth_km: numberValue("site-width", 3),
      deviceSpacingMode: value("spacing-mode"),
      deviceSpacing_m: numberValue("device-spacing", 500),
      arrayCountModel: value("array-count-model"),
      linesPerDevice: numberValue("lines-per-device", numberValue("num-lines", 3)),
      computeSharedAnchoring: checked("compute-shared"),
      minimumRequiredSpacing_m: nullableNumber("min-shared-spacing")
    };
    const res = analyzeArray(cfg);
    lastArrayResult = { config: cfg, result: res };
    setStatus("Array analysis complete.");
    renderMetrics($("#array-metrics"), [
      { label: "Devices", value: res.Ndev.toLocaleString() },
      { label: "Layout", value: `${res.Nx} x ${res.Ny}` },
      { label: "Spacing", value: `${formatNumber(res.spacing_m, 1)} m` },
      { label: "Total power", value: `${formatNumber(res.totalPower_kW, 0)} kW` },
      { label: "Non-shared", value: `${formatMoney(res.nonShared.total_USD_per_kW, 2)}/kW` },
      { label: "Shared", value: `${formatMoney(res.shared.total_USD_per_kW, 2)}/kW` },
      { label: "Non-shared anchors", value: res.anchorsNonShared.toLocaleString() },
      { label: "Shared anchors", value: Number.isFinite(res.anchorsShared) ? res.anchorsShared.toLocaleString() : "N/A" },
      { label: "Spacing check", value: res.sharedSpacingFeasible ? "Pass" : "Fail" },
      { label: "Non-shared LCOE", value: `${formatMoney(res.nonShared.lcoe_USD_per_MWh, 2)}/MWh` },
      { label: "Shared LCOE", value: `${formatMoney(res.shared.lcoe_USD_per_MWh, 2)}/MWh` }
    ]);
    renderArrayReadiness($("#array-readiness"), res);
    renderArrayBars($("#array-chart"), res);
    renderReportPreview();
  } catch (error) {
    setStatus(error.message, "bad");
  }
}

function renderArrayReadiness(container, res) {
  if (!container) return;
  const sharedSavings = Number.isFinite(res.shared.total_USD_per_kW)
    ? 100 * (res.nonShared.total_USD_per_kW - res.shared.total_USD_per_kW) / Math.max(res.nonShared.total_USD_per_kW, 1e-9)
    : NaN;
  const tone = !res.sharedSpacingFeasible || !Number.isFinite(res.shared.total_USD_per_kW) ? "review" : sharedSavings > 0 ? "ok" : "review";
  container.innerHTML = `
    <div class="decision-summary">
      <h3>Array Recommendation</h3>
      <div class="decision-title">
        <strong>${escapeHtml(Number.isFinite(sharedSavings) && sharedSavings > 0 ? "Shared" : "Non-shared")}</strong>
        <span class="status-pill ${tone === "ok" ? "" : tone}">${escapeHtml(Number.isFinite(sharedSavings) ? `${formatNumber(Math.abs(sharedSavings), 1)}% ${sharedSavings >= 0 ? "lower" : "higher"}` : "review shared case")}</span>
      </div>
      <p class="decision-detail">Layout ${escapeHtml(res.Nx)} x ${escapeHtml(res.Ny)} with ${escapeHtml(res.Ndev.toLocaleString())} devices and ${escapeHtml(formatNumber(res.spacing_m, 1))} m spacing.</p>
    </div>
    <div class="validation-panel">
      <h3>Array Checks</h3>
      <ul class="validation-list">
        <li class="${res.sharedSpacingFeasible ? "ok" : "bad"}">Shared spacing ${escapeHtml(res.sharedSpacingFeasible ? "passes" : "fails")} the minimum spacing rule.</li>
        <li class="${Number.isFinite(res.shared.total_USD_per_kW) ? "ok" : "review"}">Shared anchor case ${escapeHtml(Number.isFinite(res.shared.total_USD_per_kW) ? "returned a feasible estimate" : "needs review or is not feasible")}.</li>
        <li class="ok">Non-shared baseline uses ${escapeHtml(res.anchorsNonShared.toLocaleString())} anchors.</li>
      </ul>
    </div>
  `;
}

function renderArrayBars(container, res) {
  const rows = [
    { label: `Non-shared ${res.nonShared.anchorType}`, value: res.nonShared.total_USD_per_kW, color: "#2978a0" },
    { label: `Shared ${res.shared.anchorType}`, value: res.shared.total_USD_per_kW, color: "#2e9f6e" }
  ];
  const max = Math.max(...rows.map(r => Number.isFinite(r.value) ? r.value : 0), 1);
  container.innerHTML = rows.map(row => `
    <div class="bar-row tall">
      <span class="bar-label">${escapeHtml(row.label)}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Number.isFinite(row.value) ? Math.max(3, 100 * row.value / max) : 0}%; background:${row.color}"></div>
      </div>
      <span class="bar-value">${escapeHtml(formatMoney(row.value, 2))}/kW</span>
    </div>
  `).join("");
}

function valuesFromRange() {
  return rangeValues("param-start", "param-step", "param-end", numberValue("param-max-points", 41), 500, 250, 5000);
}

function rangeValues(startId, stepId, endId, maxPoints, defStart, defStep, defEnd) {
  const start = numberValue(startId, defStart);
  const step = numberValue(stepId, defStep);
  const end = numberValue(endId, defEnd);
  const values = [];
  if (!(step > 0)) return [start];
  for (let v = start; v <= end + step / 1000; v += step) values.push(Number(v.toFixed(8)));
  if (values.length <= maxPoints) return values;
  const sampled = [];
  for (let i = 0; i < maxPoints; i += 1) {
    const idx = Math.round(i * (values.length - 1) / (maxPoints - 1));
    sampled.push(values[idx]);
  }
  return Array.from(new Set(sampled));
}

function runParametric() {
  try {
    const variable = value("param-variable");
    const rows = parametricStudy({
      ...readBaseConfig(),
      parametricVariable: variable,
      parametricValues: valuesFromRange(),
      parametricAngleValues: rangeValues("param-angle-start", "param-angle-step", "param-angle-end", numberValue("param-max-points", 41), 5, 5, 90),
      waterDepth_m: numberValue("param-baseline-depth", numberValue("water-depth", DEFAULTS.waterDepth_m)),
      parametricSoils: SOIL_ORDER.filter(s => s !== "Rock")
    });
    paramRows = rows;
    lastParamSummary = {
      variable,
      rows: rows.length,
      feasible: rows.filter(row => row.Status === "OK").length
    };
    setStatus("Parametric study complete.");
    renderLegend($("#param-legend"), SOIL_ORDER.filter(soil => soil !== "Rock"));
    renderParametricChart($("#param-chart"), rows, variable);
    renderParametricNote(rows, variable);
    renderTable($("#param-table"), rows, [
      { key: "SweepValue", label: variable, format: v => formatNumber(v, 1) },
      { key: "MooringAngle_deg", label: "Angle", format: v => formatNumber(v, 1) },
      { key: "DesignLoad_kN", label: "Load", format: v => formatNumber(v, 0) },
      { key: "WaterDepth_m", label: "Depth", format: v => formatNumber(v, 1) },
      { key: "SoilType", label: "Soil" },
      { key: "BestAnchorType", label: "Best" },
      { key: "TotalSystemCost_USD", label: "Total USD", format: v => formatMoney(v) },
      { key: "TotalCost_USD_per_kW", label: "USD/kW", format: v => formatMoney(v, 2) },
      { key: "MooringAnchorLCOE_USD_per_MWh", label: "LCOE", format: v => formatMoney(v, 2) },
      { key: "Status", label: "Status" }
    ], 80);
    renderReportPreview();
  } catch (error) {
    setStatus(error.message, "bad");
  }
}

function renderParametricChart(svg, rows, variable) {
  const width = 820;
  const height = 450;
  const pad = 48;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";
  const okRows = rows.filter(r => Number.isFinite(r.TotalCost_USD_per_kW));
  if (!okRows.length) return;
  const xs = okRows.map(r => r.SweepValue);
  const ys = okRows.map(r => r.TotalCost_USD_per_kW);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys) * 0.94;
  const yMax = Math.max(...ys) * 1.06;
  const sx = x => pad + (x - xMin) / Math.max(xMax - xMin, 1e-9) * (width - 2 * pad);
  const sy = y => height - pad - (y - yMin) / Math.max(yMax - yMin, 1e-9) * (height - 2 * pad);
  const addText = (text, x, y, cls, anchor = "middle") => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "text");
    el.textContent = text;
    el.setAttribute("x", x);
    el.setAttribute("y", y);
    el.setAttribute("class", cls);
    el.setAttribute("text-anchor", anchor);
    svg.appendChild(el);
  };

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", width);
  bg.setAttribute("height", height);
  bg.setAttribute("class", "map-bg");
  svg.appendChild(bg);

  for (let i = 0; i < 6; i += 1) {
    const y = pad + i * (height - 2 * pad) / 5;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", pad);
    line.setAttribute("x2", width - pad);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
    line.setAttribute("class", "grid-line");
    svg.appendChild(line);
    const value = yMax - i * (yMax - yMin) / 5;
    addText(formatMoney(value, 0), pad - 8, y + 4, "axis-text", "end");
  }

  addText(`${variable} sweep`, width / 2, height - 10, "axis-title");
  addText("USD/kW", 12, pad, "axis-title", "start");
  addText(formatNumber(xMin, 1), pad, height - pad + 22, "axis-text");
  addText(formatNumber(xMax, 1), width - pad, height - pad + 22, "axis-text");

  SOIL_ORDER.filter(s => s !== "Rock").forEach(soil => {
    const group = okRows.filter(r => r.SoilType === soil).sort((a, b) => a.SweepValue - b.SweepValue);
    if (!group.length) return;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", group.map((row, i) => `${i ? "L" : "M"} ${sx(row.SweepValue)} ${sy(row.TotalCost_USD_per_kW)}`).join(" "));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", colors[soil]);
    path.setAttribute("stroke-width", "2.5");
    svg.appendChild(path);
    group.forEach(row => {
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("cx", sx(row.SweepValue));
      dot.setAttribute("cy", sy(row.TotalCost_USD_per_kW));
      dot.setAttribute("r", "4");
      dot.setAttribute("fill", colors[row.BestAnchorType] || colors[soil]);
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = `${soil} | ${variable}: ${row.SweepValue} | ${row.BestAnchorType} | ${formatMoney(row.TotalCost_USD_per_kW, 2)}/kW`;
      dot.appendChild(title);
      svg.appendChild(dot);
    });
  });
}

function renderParametricNote(rows, variable) {
  const note = $("#param-note");
  if (!note) return;
  const ok = rows.filter(row => row.Status === "OK" && Number.isFinite(row.TotalCost_USD_per_kW));
  if (!ok.length) {
    note.textContent = "No feasible parametric points for the current sweep.";
    return;
  }
  const costs = ok.map(row => row.TotalCost_USD_per_kW);
  const types = Array.from(new Set(ok.map(row => row.BestAnchorType))).join(", ");
  note.textContent = `${variable} sweep produced ${ok.length.toLocaleString()} feasible point${ok.length === 1 ? "" : "s"} across ${types}. Cost range: ${formatMoney(Math.min(...costs), 2)}/kW to ${formatMoney(Math.max(...costs), 2)}/kW.`;
}

async function loadSampleCsv() {
  const response = await fetch("./data/us9_sample.csv");
  const text = await response.text();
  csvRows = parseCsv(text);
  $("#csv-file-name").textContent = `Sample loaded: ${csvRows.length} rows`;
  setStatus("Sample CSV loaded.");
}

function renderDecisionError(message) {
  const summary = $("#decision-summary");
  const validation = $("#validation-panel");
  if (summary) {
    summary.innerHTML = `
      <h3>Recommended Anchor</h3>
      <div class="decision-title">
        <strong>No Result</strong>
        <span class="status-pill bad">Input Review</span>
      </div>
      <p class="decision-detail">${escapeHtml(message)}</p>
    `;
  }
  if (validation) {
    validation.innerHTML = `
      <h3>Decision Readiness</h3>
      <span class="status-pill bad">Needs Input Fix</span>
      <ul class="validation-list">
        <li class="bad">${escapeHtml(message)}</li>
      </ul>
    `;
  }
}

function activateWorkspace(target) {
  $$(".tab-button").forEach(button => {
    button.classList.toggle("active", button.dataset.target === target);
  });
  $$(".workspace").forEach(panel => {
    panel.classList.toggle("active", panel.id === target);
  });
}

function applyScenario(name) {
  const scenarios = {
    baseline: {
      "mooring-system": "catenary",
      "mooring-angle": 0,
      "design-load": 1000,
      "water-depth": 80,
      "soil-type": "Medium Clay",
      "rated-power": 500,
      "num-lines": 3,
      "mooring-material": "chain",
      "compute-lcoe": true
    },
    taut: {
      "mooring-system": "taut",
      "mooring-angle": 25,
      "design-load": 1500,
      "water-depth": 120,
      "soil-type": "Medium Clay",
      "rated-power": 1000,
      "num-lines": 3,
      "mooring-material": "polyester",
      "compute-lcoe": true
    },
    tlp: {
      "mooring-system": "tlp",
      "mooring-angle": 85,
      "design-load": 1800,
      "water-depth": 160,
      "soil-type": "Medium Clay",
      "rated-power": 1000,
      "num-lines": 4,
      "mooring-material": "steel wire",
      "compute-lcoe": true
    },
    array: {
      "mooring-system": "catenary",
      "mooring-angle": 0,
      "design-load": 1000,
      "water-depth": 80,
      "soil-type": "Medium Clay",
      "rated-power": 500,
      "site-length": 5,
      "site-width": 3,
      "device-spacing": 500,
      "lines-per-device": 3,
      "compute-shared": true,
      "compute-lcoe": true
    }
  };
  const scenario = scenarios[name];
  if (!scenario) return;
  Object.entries(scenario).forEach(([id, next]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") setInputChecked(id, next);
    else setInputValue(id, next);
  });
  runSite();
  if (name === "array") {
    activateWorkspace("array-workspace");
    runArray();
  } else {
    activateWorkspace("site-workspace");
  }
  setStatus(`${name[0].toUpperCase()}${name.slice(1)} scenario loaded.`);
}

function currentGuideContext() {
  const cfg = readBaseConfig();
  const lines = [
    "Current app context:",
    `- Mooring system: ${cfg.mooringSystem}`,
    `- Load: ${formatNumber(cfg.designLoad_kN, 0)} kN`,
    `- Angle: ${formatNumber(cfg.mooringAngle_deg, 1)} deg`,
    `- Depth: ${formatNumber(cfg.waterDepth_m, 1)} m`,
    `- Soil: ${cfg.soilType}`,
    `- Rated power: ${formatNumber(cfg.ratedPowerPerDevice_kW, 0)} kW`
  ];
  if (lastSiteResult) {
    const res = lastSiteResult.result;
    lines.push(
      `- Latest best anchor: ${res.best.Type} (${res.best.Variant})`,
      `- Total system cost: ${formatMoney(res.perDevice.totalSystemCost_USD)}`,
      `- Cost intensity: ${formatMoney(res.perDevice.totalCost_USD_per_kW, 2)}/kW`,
      `- Feasible candidates: ${res.candidates.length}`,
      `- Rejected checks: ${res.rejected.length}`
    );
  } else {
    lines.push("- Latest best anchor: not run yet");
  }
  if (lastCsvSummary) lines.push(`- CSV scan: ${lastCsvSummary.feasible}/${lastCsvSummary.retained} feasible rows`);
  if (lastArrayResult) lines.push(`- Array: ${lastArrayResult.result.Ndev.toLocaleString()} devices`);
  if (lastParamSummary) lines.push(`- Study: ${lastParamSummary.feasible}/${lastParamSummary.rows} feasible points`);
  return lines.join("\n");
}

function guidePrompt(question) {
  return [
    "You are helping a user understand Anchor Selection Studio, a browser-based screening tool for mooring and anchor selection.",
    "Use the current app context and explain step-by-step. Be clear that this is screening-level and needs engineering validation for final design.",
    "",
    currentGuideContext(),
    "",
    `User question: ${question || "How do I use this app and interpret the results?"}`
  ].join("\n");
}

function answerGuideQuestion(rawQuestion) {
  const q = String(rawQuestion || "").trim();
  const text = q.toLowerCase();
  const context = currentGuideContext();
  if (!q) {
    return "Ask a question first, or click one of the example question buttons.";
  }
  if (/(work|worked|valid|correct|know|success|happened|nothing)/.test(text)) {
    return [
      "How to know it worked:",
      "- The status line should say Results updated, Results ready, or Analysis is already up to date.",
      "- The Recommended Anchor card should show a best anchor type and variant.",
      "- Decision Readiness should list feasibility and review notes.",
      "- Candidate Cost Ranking should show feasible candidates and costs.",
      "- Rejected Checks explains why some anchor types were not allowed.",
      "",
      "If you changed inputs, click Run Site again. If nothing changed, the previous result is already the current result."
    ].join("\n");
  }
  if (/(run|start|analysis|analyze|analyse|site)/.test(text)) {
    return [
      "To run a single-site analysis:",
      "1. Set the Load Case inputs on the left: mooring system, angle, load, depth, power, soil, latitude, and longitude.",
      "2. Adjust Mooring, Economics, Advanced Selector, and LCOE options if needed.",
      "3. Click the red Run Site button.",
      "4. The Site panel updates the recommended anchor, decision-readiness checks, metrics, candidate ranking, rejected checks, and cost breakdown.",
      "5. If the app says the analysis is already up to date, the current results already match the current inputs.",
      "",
      context
    ].join("\n");
  }
  if (/(pdf|report|download|export)/.test(text)) {
    return [
      "To create a report:",
      "1. Run Site first so the latest inputs have results.",
      "2. Open the Report tab.",
      "3. Click Build.",
      "4. Click Download PDF for a PDF summary, or Download HTML for a browser-readable report.",
      "",
      "The PDF includes recommendation, design case, top candidates, workflow status, validation notes, and responsible-use language."
    ].join("\n");
  }
  if (/(dea|dpa|sa|vla|ga|anchor|recommended|best)/.test(text)) {
    return [
      "The Recommended Anchor is the lowest-cost feasible candidate under the current ranking settings.",
      "- GA: gravity anchor",
      "- DPA: driven pile anchor",
      "- SA: suction anchor",
      "- DEA: drag embedment anchor",
      "- VLA: vertical load anchor",
      "",
      "The app checks soil compatibility, load angle, holding capacity, geometry, vessel crane limits, fabrication/install cost, and optional mooring cost.",
      "",
      context
    ].join("\n");
  }
  if (/(csv|map|upload|sample|regional|site scan)/.test(text)) {
    return [
      "For CSV scans:",
      "1. Open the CSV tab.",
      "2. Upload a CSV or click Sample.",
      "3. Use the bounding box and depth filters.",
      "4. Click Run.",
      "5. Review map, anchor distribution, and result table.",
      "",
      "Expected columns: Latitude, Longitude, WaterDepth, Gravel, Sand, Mud, Clay, FolkCde."
    ].join("\n");
  }
  if (/(array|shared|farm|spacing)/.test(text)) {
    return [
      "For array analysis:",
      "1. Open the Array tab.",
      "2. Set site length, width, spacing, count model, and lines per device.",
      "3. Choose whether shared anchoring is enabled.",
      "4. Click Run.",
      "5. Compare non-shared and shared anchoring cost intensity and spacing feasibility."
    ].join("\n");
  }
  if (/(study|parametric|sweep|sensitivity)/.test(text)) {
    return [
      "For a parametric study:",
      "1. Open the Study tab.",
      "2. Choose Design load, Load angle, Water depth, or Load + angle.",
      "3. Set start, step, end, and max points.",
      "4. Click Run.",
      "5. Review cost intensity lines and the study results table."
    ].join("\n");
  }
  if (/(gpt|chatgpt|llm|ai|openai|api|key|assistant)/.test(text)) {
    return [
      "About connecting to GPT:",
      "This GitHub Pages app is static, so it should not contain an OpenAI API key. A key in browser JavaScript would be visible to the public.",
      "",
      "Safe options:",
      "1. Use Copy GPT Prompt, then paste it into ChatGPT.",
      "2. Use Open ChatGPT to open ChatGPT in a new tab.",
      "3. For a true in-app GPT assistant, add a small secure backend endpoint that stores the API key server-side and returns answers to this page.",
      "",
      "I added the static Ask Guide now so users can get immediate help without accounts or API keys."
    ].join("\n");
  }
  return [
    "I can help with running Site analysis, CSV scans, Array analysis, Study sweeps, interpreting anchors, reports/PDFs, and GPT connection options.",
    "",
    "Try asking one of these:",
    "- How do I run a single-site analysis?",
    "- How do I know the result worked?",
    "- How do I download a PDF report?",
    "- What does the recommended anchor mean?",
    "- Can this app use ChatGPT directly?",
    "",
    context
  ].join("\n");
}

async function copyGuidePrompt() {
  const question = value("ask-guide-input") || "How do I use this app and interpret the result?";
  const prompt = guidePrompt(question);
  try {
    await navigator.clipboard.writeText(prompt);
    setStatus("GPT prompt copied.");
    $("#ask-guide-answer").textContent = "Copied a detailed GPT prompt with the current app context. Open ChatGPT and paste it there.";
  } catch {
    $("#ask-guide-answer").textContent = prompt;
    setStatus("Clipboard blocked. Prompt shown in Ask Guide.", "bad");
  }
}

function runAskGuide() {
  const question = value("ask-guide-input");
  $("#ask-guide-answer").textContent = answerGuideQuestion(question);
  setStatus("Help answer generated.");
}

function reportFragment() {
  if (!lastSiteResult) {
    return `
      <h3>Executive Report</h3>
      <p>Run a single-site analysis first, then build the report.</p>
    `;
  }
  const { config: cfg, result: res } = lastSiteResult;
  const flags = validationFlags(cfg, res);
  const readiness = decisionReadiness(flags);
  const topCandidates = res.candidates.slice(0, 5);
  return `
    <h3>Anchor Selection Studio Report</h3>
    <p>Generated ${escapeHtml(new Date().toLocaleString())}. Screening-level comparison for anchor selection, mooring cost, and cost intensity.</p>
    <h4>Recommendation</h4>
    <dl>
      <dt>Best anchor</dt><dd>${escapeHtml(res.best.Type)} - ${escapeHtml(res.best.Variant)}</dd>
      <dt>Readiness</dt><dd>${escapeHtml(readiness.label)}</dd>
      <dt>Total system cost</dt><dd>${escapeHtml(formatMoney(res.perDevice.totalSystemCost_USD))}</dd>
      <dt>Cost intensity</dt><dd>${escapeHtml(formatMoney(res.perDevice.totalCost_USD_per_kW, 2))}/kW</dd>
      <dt>Anchor mass</dt><dd>${escapeHtml(formatNumber(res.best.Mass_kg / 1000, 2))} t</dd>
      <dt>Vessel</dt><dd>${escapeHtml(res.best.Vessel)}</dd>
    </dl>
    <h4>Design Case</h4>
    <dl>
      <dt>Mooring system</dt><dd>${escapeHtml(cfg.mooringSystem)}</dd>
      <dt>Load and angle</dt><dd>${escapeHtml(formatNumber(cfg.designLoad_kN, 0))} kN at ${escapeHtml(formatNumber(cfg.mooringAngle_deg, 1))} deg</dd>
      <dt>Water depth</dt><dd>${escapeHtml(formatNumber(cfg.waterDepth_m, 1))} m</dd>
      <dt>Soil</dt><dd>${escapeHtml(cfg.soilType)}</dd>
      <dt>Rated power</dt><dd>${escapeHtml(formatNumber(cfg.ratedPowerPerDevice_kW, 0))} kW</dd>
      <dt>Mooring</dt><dd>${escapeHtml(cfg.numMooringLines)} lines, ${escapeHtml(cfg.mooringMaterial)}</dd>
    </dl>
    <h4>Top Candidates</h4>
    <table>
      <thead><tr><th>Type</th><th>Variant</th><th>Vessel</th><th>Mass t</th><th>Anchor USD</th></tr></thead>
      <tbody>
        ${topCandidates.map(candidate => `
          <tr>
            <td>${escapeHtml(candidate.Type)}</td>
            <td>${escapeHtml(candidate.Variant)}</td>
            <td>${escapeHtml(candidate.Vessel)}</td>
            <td>${escapeHtml(formatNumber(candidate.Mass_kg / 1000, 2))}</td>
            <td>${escapeHtml(formatMoney(candidate.AnchorCost_EUR * cfg.fxUsdPerEur * Math.max(1, Math.round(cfg.numMooringLines))))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <h4>Workflow Status</h4>
    <dl>
      <dt>CSV scan</dt><dd>${escapeHtml(lastCsvSummary ? `${lastCsvSummary.feasible}/${lastCsvSummary.retained} feasible, ${lastCsvSummary.mode}` : "Not run")}</dd>
      <dt>Array analysis</dt><dd>${escapeHtml(lastArrayResult ? `${lastArrayResult.result.Ndev.toLocaleString()} devices, shared ${lastArrayResult.result.shared.anchorType}` : "Not run")}</dd>
      <dt>Parametric study</dt><dd>${escapeHtml(lastParamSummary ? `${lastParamSummary.feasible}/${lastParamSummary.rows} feasible points, ${lastParamSummary.variable}` : "Not run")}</dd>
    </dl>
    <h4>Validation Notes</h4>
    <ul class="validation-list">
      ${flags.map(flag => `<li class="${flag.tone}">${escapeHtml(flag.text)}</li>`).join("")}
    </ul>
  `;
}

function reportDocument(fragment) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Anchor Selection Studio Report</title>
  <style>
    body { margin: 0; padding: 32px; color: #172026; font: 14px/1.5 Arial, sans-serif; background: #f4f7f9; }
    main { max-width: 960px; margin: 0 auto; padding: 28px; background: #fff; border: 1px solid #d7dde4; border-top: 5px solid #cc0000; }
    h3 { margin: 0 0 8px; font-size: 24px; }
    h4 { margin: 24px 0 8px; font-size: 16px; }
    p { color: #5c6670; }
    dl { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 8px 14px; }
    dt { color: #5c6670; font-weight: 700; }
    dd { margin: 0; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { padding: 8px 10px; border-bottom: 1px solid #d7dde4; text-align: left; }
    th { background: #eef3f6; }
    .validation-list { display: grid; gap: 7px; padding-left: 18px; }
  </style>
</head>
<body><main>${fragment}</main></body>
</html>`;
}

function pdfEscape(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function wrapPdfText(text, maxChars = 92) {
  const words = String(text ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach(word => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function reportPdfLines() {
  if (!lastSiteResult) runSite();
  const { config: cfg, result: res } = lastSiteResult;
  const flags = validationFlags(cfg, res);
  const lines = [
    { text: "Anchor Selection Studio Report", size: 18, bold: true, gap: 8 },
    { text: `Generated ${new Date().toLocaleString()}`, size: 10 },
    { text: "Screening-level anchor and mooring decision-support summary.", size: 10, gap: 12 },
    { text: "Recommendation", size: 14, bold: true, gap: 6 },
    { text: `Best anchor: ${res.best.Type} - ${res.best.Variant}`, bold: true },
    { text: `Vessel: ${res.best.Vessel}` },
    { text: `Total system cost: ${formatMoney(res.perDevice.totalSystemCost_USD)}` },
    { text: `Cost intensity: ${formatMoney(res.perDevice.totalCost_USD_per_kW, 2)}/kW` },
    { text: `Anchor mass: ${formatNumber(res.best.Mass_kg / 1000, 2)} t` },
    { text: `MBL required: ${formatNumber(res.best.MBL_required_kN, 1)} kN` },
    { text: `UHC: ${formatNumber(res.best.UHC_kN, 1)} kN`, gap: 12 },
    { text: "Design Case", size: 14, bold: true, gap: 6 },
    { text: `Mooring system: ${cfg.mooringSystem}` },
    { text: `Load and angle: ${formatNumber(cfg.designLoad_kN, 0)} kN at ${formatNumber(cfg.mooringAngle_deg, 1)} deg` },
    { text: `Water depth: ${formatNumber(cfg.waterDepth_m, 1)} m` },
    { text: `Soil: ${cfg.soilType}` },
    { text: `Rated power: ${formatNumber(cfg.ratedPowerPerDevice_kW, 0)} kW` },
    { text: `Mooring: ${cfg.numMooringLines} lines, ${cfg.mooringMaterial}`, gap: 12 },
    { text: "Top Candidates", size: 14, bold: true, gap: 6 }
  ];
  res.candidates.slice(0, 6).forEach((candidate, index) => {
    lines.push({
      text: `${index + 1}. ${candidate.Type} | ${candidate.Variant} | ${candidate.Vessel} | ${formatNumber(candidate.Mass_kg / 1000, 2)} t | ${formatMoney(candidate.AnchorCost_EUR * cfg.fxUsdPerEur * Math.max(1, Math.round(cfg.numMooringLines)))}`
    });
  });
  lines.push(
    { text: "Workflow Status", size: 14, bold: true, gap: 12 },
    { text: `CSV scan: ${lastCsvSummary ? `${lastCsvSummary.feasible}/${lastCsvSummary.retained} feasible, ${lastCsvSummary.mode}` : "Not run"}` },
    { text: `Array analysis: ${lastArrayResult ? `${lastArrayResult.result.Ndev.toLocaleString()} devices, shared ${lastArrayResult.result.shared.anchorType}` : "Not run"}` },
    { text: `Parametric study: ${lastParamSummary ? `${lastParamSummary.feasible}/${lastParamSummary.rows} feasible points, ${lastParamSummary.variable}` : "Not run"}`, gap: 12 },
    { text: "Validation Notes", size: 14, bold: true, gap: 6 }
  );
  flags.forEach(flag => lines.push({ text: `- ${flag.text}` }));
  lines.push(
    { text: "Responsible Use", size: 14, bold: true, gap: 12 },
    { text: "Use this report for screening, comparison, and research planning. Detailed design should include site investigation, geotechnical review, project-specific installation constraints, and independent engineering validation." }
  );
  return lines;
}

function makePdf(lines) {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 54;
  const bottom = 54;
  const pages = [];
  let current = [];
  let y = pageHeight - margin;

  const pushLine = item => {
    const size = item.size || 10;
    const lineHeight = size + 5;
    if (y - lineHeight < bottom && current.length) {
      pages.push(current);
      current = [];
      y = pageHeight - margin;
    }
    current.push({ ...item, y });
    y -= lineHeight + (item.gap || 0);
  };

  lines.forEach(item => {
    wrapPdfText(item.text, item.size && item.size > 12 ? 64 : 92).forEach((line, index) => {
      pushLine({ ...item, text: line, gap: index === 0 ? item.gap : 0 });
    });
  });
  if (current.length) pages.push(current);

  const objects = [];
  const addObject = content => {
    objects.push(content);
    return objects.length;
  };

  const catalogId = addObject("PLACEHOLDER_CATALOG");
  const pagesId = addObject("PLACEHOLDER_PAGES");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds = [];

  pages.forEach((page, pageIndex) => {
    const content = page.map(item => {
      const font = item.bold ? "F2" : "F1";
      const size = item.size || 10;
      return `BT /${font} ${size} Tf ${margin} ${item.y.toFixed(1)} Td (${pdfEscape(item.text)}) Tj ET`;
    }).join("\n") + `\nBT /F1 9 Tf ${pageWidth - margin - 70} 30 Td (Page ${pageIndex + 1} of ${pages.length}) Tj ET`;
    const contentId = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

function renderReportPreview() {
  const preview = $("#report-preview");
  if (!preview) return;
  const fragment = reportFragment();
  lastReportHtml = reportDocument(fragment);
  preview.innerHTML = fragment;
}

function setupTabs() {
  $$(".tab-button").forEach(button => {
    button.addEventListener("click", () => {
      activateWorkspace(button.dataset.target);
      if (button.dataset.target === "report-workspace") renderReportPreview();
    });
  });
}

function setup() {
  setupTabs();
  setupHelp();
  $("#run-site").addEventListener("click", requestSiteRun);
  $("#run-site-top").addEventListener("click", requestSiteRun);
  $("#open-report-top").addEventListener("click", () => {
    activateWorkspace("report-workspace");
    renderReportPreview();
  });
  $("#open-help-top").addEventListener("click", () => {
    activateWorkspace("guide-workspace");
    setStatus("Help opened.");
  });
  $("#run-csv").addEventListener("click", runCsvScan);
  $("#run-array").addEventListener("click", runArray);
  $("#run-parametric").addEventListener("click", runParametric);
  $("#load-sample").addEventListener("click", loadSampleCsv);
  $$(".preset-button").forEach(button => {
    button.addEventListener("click", () => applyScenario(button.dataset.scenario));
  });
  $("#build-report").addEventListener("click", () => {
    if (!lastSiteResult) runSite();
    renderReportPreview();
    setStatus("Executive report built.");
  });
  $("#download-report").addEventListener("click", () => {
    if (!lastReportHtml) renderReportPreview();
    downloadText(`${outPrefix()}_executive_report.html`, lastReportHtml, "text/html");
    setStatus("Executive report downloaded.");
  });
  $("#download-report-pdf").addEventListener("click", () => {
    const pdf = makePdf(reportPdfLines());
    downloadText(`${outPrefix()}_executive_report.pdf`, pdf, "application/pdf");
    setStatus("PDF report downloaded.");
  });
  $("#ask-guide-run").addEventListener("click", runAskGuide);
  $("#copy-gpt-prompt").addEventListener("click", copyGuidePrompt);
  $("#open-chatgpt").addEventListener("click", () => {
    window.open("https://chatgpt.com/", "_blank", "noopener");
    setStatus("ChatGPT opened in a new tab.");
  });
  $$(".question-chip").forEach(button => {
    button.addEventListener("click", () => {
      setInputValue("ask-guide-input", button.dataset.question);
      runAskGuide();
    });
  });
  $("#download-csv").addEventListener("click", () => {
    if (!scanRows.length) return setStatus("No CSV scan results to download.", "bad");
    downloadText(`${outPrefix()}_scan_results.csv`, toCsv(scanRows), "text/csv");
    setStatus("CSV results downloaded.");
  });
  $("#download-site").addEventListener("click", () => {
    if (!lastSiteResult) runSite();
    downloadText(`${outPrefix()}_site_result.json`, JSON.stringify(lastSiteResult, null, 2), "application/json");
    setStatus("Site result downloaded.");
  });
  $("#download-parametric").addEventListener("click", () => {
    if (!paramRows.length) return setStatus("No parametric results to download.", "bad");
    downloadText(`${outPrefix()}_parametric_results.csv`, toCsv(paramRows), "text/csv");
    setStatus("Parametric results downloaded.");
  });
  $("#csv-file").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    const text = await file.text();
    csvRows = parseCsv(text);
    $("#csv-file-name").textContent = `${file.name}: ${csvRows.length.toLocaleString()} rows`;
    setStatus("CSV loaded.");
  });
  $$(".control-panel input, .control-panel select").forEach(el => {
    if (el.id.startsWith("plot-")) return;
    el.addEventListener("input", markSiteInputsDirty);
    el.addEventListener("change", markSiteInputsDirty);
  });
  $$("#plot-map, #plot-cost, #plot-kw, #plot-box, #plot-soil, #plot-share").forEach(el => el.addEventListener("change", applyPlotToggles));
  runSite();
}

setup();
