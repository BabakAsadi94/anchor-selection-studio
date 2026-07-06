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
  "param-max-points": "Maximum sampled points per sweep to keep charts responsive in the browser."
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

function setStatus(message, tone = "ok") {
  const el = $("#status-line");
  el.textContent = message;
  el.dataset.tone = tone;
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

function applyPlotToggles() {
  const mapLayout = document.querySelector(".map-layout");
  if (mapLayout) mapLayout.style.display = checked("plot-map") || checked("plot-cost") || checked("plot-kw") || checked("plot-soil") ? "" : "none";
  const distribution = $("#distribution-chart")?.closest(".panel");
  if (distribution) distribution.style.display = checked("plot-box") || checked("plot-share") ? "" : "none";
}

function renderMetrics(container, metrics) {
  container.innerHTML = metrics.map(item => `
    <div class="metric">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
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
        <span class="bar-label">${candidate.Type}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${width}%; background:${colors[candidate.Type] || "#555"}"></div>
        </div>
        <span class="bar-value">${formatMoney(valueUSD)}</span>
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
      <thead><tr>${columns.map(c => `<th>${c.label}</th>`).join("")}</tr></thead>
      <tbody>
        ${view.map(row => `
          <tr>${columns.map(c => `<td>${c.format ? c.format(row[c.key], row) : row[c.key]}</td>`).join("")}</tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function runSite() {
  try {
    const cfg = readBaseConfig();
    const res = analyzeSite(cfg);
    lastSiteResult = { config: cfg, result: res };
    setStatus("Single-site analysis complete.");
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
    renderCandidateBars($("#candidate-chart"), res.candidates, cfg.fxUsdPerEur, Math.max(1, Math.round(cfg.numMooringLines)));
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
  } catch (error) {
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
    renderDistribution($("#distribution-chart"), scan.distribution);
    renderMap($("#map-svg"), scanRows);
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
  } catch (error) {
    setStatus(error.message, "bad");
  }
}

function renderDistribution(container, distribution) {
  const max = Math.max(...distribution.map(d => d.count), 1);
  container.innerHTML = distribution.map(d => `
    <div class="bar-row">
      <span class="bar-label">${d.type}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.max(2, 100 * d.count / max)}%; background:${colors[d.type] || "#555"}"></div>
      </div>
      <span class="bar-value">${d.count} (${formatNumber(d.percent, 1)}%)</span>
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
  const sx = lon => pad + (lon - minLon) / Math.max(maxLon - minLon, 1e-9) * (width - 2 * pad);
  const sy = lat => height - pad - (lat - minLat) / Math.max(maxLat - minLat, 1e-9) * (height - 2 * pad);

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

  rows.forEach(row => {
    const point = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    point.setAttribute("cx", sx(row.Lon));
    point.setAttribute("cy", sy(row.Lat));
    point.setAttribute("r", rows.length > 2500 ? 2.2 : 3.7);
    point.setAttribute("fill", colors[row.BestAnchorType] || "#333");
    point.setAttribute("opacity", row.Status === "OK" ? "0.82" : "0.45");
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${row.Lat.toFixed(4)}, ${row.Lon.toFixed(4)} | ${row.SoilType} | ${row.BestAnchorType} | ${formatMoney(row.TotalSystemCost_USD)}`;
    point.appendChild(title);
    svg.appendChild(point);
  });
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
    renderArrayBars($("#array-chart"), res);
  } catch (error) {
    setStatus(error.message, "bad");
  }
}

function renderArrayBars(container, res) {
  const rows = [
    { label: `Non-shared ${res.nonShared.anchorType}`, value: res.nonShared.total_USD_per_kW, color: "#2978a0" },
    { label: `Shared ${res.shared.anchorType}`, value: res.shared.total_USD_per_kW, color: "#2e9f6e" }
  ];
  const max = Math.max(...rows.map(r => Number.isFinite(r.value) ? r.value : 0), 1);
  container.innerHTML = rows.map(row => `
    <div class="bar-row tall">
      <span class="bar-label">${row.label}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Number.isFinite(row.value) ? Math.max(3, 100 * row.value / max) : 0}%; background:${row.color}"></div>
      </div>
      <span class="bar-value">${formatMoney(row.value, 2)}/kW</span>
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
    setStatus("Parametric study complete.");
    renderParametricChart($("#param-chart"), rows, variable);
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
  }

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

async function loadSampleCsv() {
  const response = await fetch("./data/us9_sample.csv");
  const text = await response.text();
  csvRows = parseCsv(text);
  $("#csv-file-name").textContent = `Sample loaded: ${csvRows.length} rows`;
  setStatus("Sample CSV loaded.");
}

function setupTabs() {
  $$(".tab-button").forEach(button => {
    button.addEventListener("click", () => {
      $$(".tab-button").forEach(b => b.classList.remove("active"));
      $$(".workspace").forEach(p => p.classList.remove("active"));
      button.classList.add("active");
      $(`#${button.dataset.target}`).classList.add("active");
    });
  });
}

function setup() {
  setupTabs();
  setupHelp();
  $("#run-site").addEventListener("click", runSite);
  $("#run-csv").addEventListener("click", runCsvScan);
  $("#run-array").addEventListener("click", runArray);
  $("#run-parametric").addEventListener("click", runParametric);
  $("#load-sample").addEventListener("click", loadSampleCsv);
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
  $$("#mooring-system, #length-model, #use-mooring").forEach(el => el.addEventListener("change", runSite));
  $$("#plot-map, #plot-cost, #plot-kw, #plot-box, #plot-soil, #plot-share").forEach(el => el.addEventListener("change", applyPlotToggles));
  runSite();
}

setup();
