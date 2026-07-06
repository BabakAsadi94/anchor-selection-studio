import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  analyzeArray,
  analyzeSite,
  parametricStudy,
  scanCsvRows
} from "../js/engine.js";
import { parseCsv } from "../js/csv.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const base = {
  designLoad_kN: 1000,
  waterDepth_m: 80,
  ratedPowerPerDevice_kW: 500,
  useMooringCost: true,
  includeMooringInRanking: true,
  numMooringLines: 3,
  mooringMaterial: "chain",
  fxUsdPerEur: 1.1,
  computeLCOE: true
};

for (const soilType of ["Very Soft Clay", "Medium Clay", "Hard Clay", "Sand", "Rock"]) {
  const result = analyzeSite({
    ...base,
    mooringSystem: "catenary",
    mooringAngle_deg: 0,
    soilType
  });
  assert.ok(result.best.Type, `expected best anchor for ${soilType}`);
  assert.ok(Number.isFinite(result.perDevice.totalSystemCost_USD), `expected finite total for ${soilType}`);
}

for (const mooringMaterial of ["chain", "nylon", "polyester", "steel wire"]) {
  const result = analyzeSite({
    ...base,
    mooringSystem: "taut",
    mooringAngle_deg: 25,
    soilType: "Medium Clay",
    mooringMaterial
  });
  assert.ok(result.best.Type, `expected best anchor for ${mooringMaterial}`);
  assert.ok(Number.isFinite(result.perDevice.mooringAnchorLCOE_USD_per_MWh), `expected finite LCOE for ${mooringMaterial}`);
}

const advanced = analyzeSite({
  ...base,
  mooringSystem: "tlp",
  mooringAngle_deg: 85,
  soilType: "Medium Clay",
  phi_deg: 22,
  rhoWater: 1030,
  chainDiameter_mm: 88,
  soilQuotient: 2.75,
  useMidInstallTimes: false,
  angleTol_deg: 2
});
assert.ok(advanced.candidates.length > 0, "expected advanced selector candidates");

const arrayShared = analyzeArray({
  ...base,
  mooringSystem: "catenary",
  mooringAngle_deg: 0,
  soilType: "Medium Clay",
  siteLength_km: 5,
  siteWidth_km: 3,
  deviceSpacing_m: 500,
  computeSharedAnchoring: true
});
assert.ok(arrayShared.Ndev > 0, "expected array devices");
assert.ok(Number.isFinite(arrayShared.shared.total_USD_per_kW), "expected shared USD/kW");

const arraySpacingFail = analyzeArray({
  ...base,
  mooringSystem: "catenary",
  mooringAngle_deg: 0,
  soilType: "Medium Clay",
  siteLength_km: 5,
  siteWidth_km: 3,
  deviceSpacing_m: 300,
  minimumRequiredSpacing_m: 800,
  computeSharedAnchoring: true
});
assert.equal(arraySpacingFail.sharedSpacingFeasible, false, "expected shared spacing failure");

assert.equal(parametricStudy({
  ...base,
  parametricVariable: "DesignLoad",
  parametricValues: [500, 1000],
  parametricSoils: ["Medium Clay"]
}).length, 2);

assert.equal(parametricStudy({
  ...base,
  parametricVariable: "LoadAngle",
  parametricValues: [5, 25, 85],
  parametricSoils: ["Medium Clay"]
}).length, 3);

assert.equal(parametricStudy({
  ...base,
  parametricVariable: "WaterDepth",
  parametricValues: [40, 80, 120],
  parametricSoils: ["Medium Clay"]
}).length, 3);

assert.equal(parametricStudy({
  ...base,
  parametricVariable: "DesignLoadAngle",
  parametricValues: [500, 1000],
  parametricAngleValues: [5, 30],
  parametricSoils: ["Medium Clay", "Sand"]
}).length, 8);

const csvText = await fs.readFile(path.join(root, "data", "us9_sample.csv"), "utf8");
const rows = parseCsv(csvText);
const scan = scanCsvRows(rows, {
  ...base,
  bbox: [24, 46, -82, -60],
  maxRows: 100
});
assert.equal(scan.rows.length, 12, "expected all sample rows retained");
assert.equal(scan.removed.noFeasible, 0, "expected no infeasible sample rows");

console.log("Engine smoke tests passed.");
