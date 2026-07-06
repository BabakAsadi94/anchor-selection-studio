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
