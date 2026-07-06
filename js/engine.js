const DEG = Math.PI / 180;
const EPS = Number.EPSILON;

const K = {
  cFab: { GA: 0.15, DPA: 10.0, SA: 10.0, DEA: 6.5, VLA: 5.2 },
  vesselRate: { CSV: 110, AHV: 80 },
  install: {
    mid: { DPA: 12.5, SA: 12.5, DEA: 8.5, VLA: 9.5 },
    full: { DPA: 13.0, SA: 13.0, DEA: 9.0, VLA: 10.0 },
    GA: 8.0
  },
  A1Spread: {
    VSC: { L: [2.1697, 0.3447], D: [0.1049, 0.3016], T: [0.6722, 0.4694] },
    MC: { L: [1.2976, 0.3733], D: [0.0529, 0.3452], T: [1.0531, 0.4042] },
    SHC: { L: [2.5296, 0.2907], D: [0.0219, 0.37], T: [1.1185, 0.3889] }
  },
  A2Spread: {
    VSC: { L: [1.1161, 0.3442], D: [0.3095, 0.2798], T: [2.058, 0.2803] },
    MC: { L: [0.5166, 0.3995], D: [0.126, 0.3561], T: [0.8398, 0.3561] }
  },
  A1Tlp: {
    VSC: { L: [3.2744, 0.3374], D: [0.0655, 0.3375], T: [1.639, 0.3373] },
    MC: { L: [2.0402, 0.3602], D: [0.0407, 0.3604], T: [1.0197, 0.3603] },
    SAND: { L: [2.1555, 0.3333], D: [0.0431, 0.3334], T: [1.0787, 0.3332] }
  },
  A2Tlp: {
    VSC: { L: [1.1037, 0.3621], D: [0.2475, 0.32], T: [1.65, 0.32] },
    MC: { L: [0.5082, 0.4181], D: [0.1509, 0.3487], T: [1.0057, 0.3487] }
  },
  dea: {
    Stevin_MK3: { VSC: [161.23, 0.92], MC: [229.19, 0.92], SHC: [324.42, 0.9] },
    Stevpris_MK5: { VSC: [392.28, 0.92], MC: [552.53, 0.92], SHC: [686.49, 0.93] },
    Stevpris_MK6: { VSC: [509.96, 0.93], MC: [701.49, 0.93], SHC: [904.21, 0.93] }
  },
  vlaCoeffs: {
    "1p25": [0.003581, -0.1094],
    "1p75": [0.002461, -0.2847],
    "2p25": [0.001857, -0.3259],
    "2p75": [0.001489, -0.3176]
  },
  vlaTable: [
    [5, 172, 3075],
    [8, 217, 3890],
    [10, 243, 4349],
    [12, 266, 4764],
    [15, 298, 5326],
    [17, 317, 5670],
    [20, 344, 6150]
  ]
};

const SOIL_ORDER = ["Very Soft Clay", "Medium Clay", "Hard Clay", "Sand", "Rock"];
const ANCHOR_ORDER = ["GA", "DPA", "SA", "DEA", "VLA", "No feasible"];

const DEFAULTS = {
  mooringSystem: "catenary",
  mooringAngle_deg: 0,
  designLoad_kN: 1000,
  waterDepth_m: 80,
  soilType: "Medium Clay",
  latitude: 35,
  longitude: -75,
  safetyFactor: 1.1,
  mblFactor: 1.0,
  phi_deg: NaN,
  rhoWater: 1025,
  soilQuotient: NaN,
  vlaCoeffA: NaN,
  vlaCoeffB: NaN,
  useMidInstallTimes: true,
  angleTol_deg: 1.0,
  useMooringCost: true,
  includeMooringInRanking: true,
  mooringMaterial: "chain",
  numMooringLines: 3,
  chainGradeFactor: 1.0,
  chainDiameter_mm: 76,
  mooringLengthModel: "depth",
  mooringLength_m: 400,
  catenaryLengthFactor: 4.0,
  tautSlackFactor: 1.02,
  tautMinAngle_deg: 5,
  enforceCraneCapacity: true,
  csvCraneCapacity_tonnes: 1000,
  ahvCraneCapacity_tonnes: 250,
  ratedPowerPerDevice_kW: 500,
  fxUsdPerEur: 1.1,
  computeLCOE: false,
  lcoeFcr: 0.108,
  lcoeNetCapacityFactor: 0.28,
  lcoeAnnualOpex_USD_per_kW_yr: 0,
  computeSharedAnchoring: true,
  minimumRequiredSpacing_m: NaN
};

function finiteNumber(value, fallback = NaN) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function lowerClean(value) {
  return String(value ?? "").trim().toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ");
}

function sind(deg) {
  return Math.sin(deg * DEG);
}

function cosd(deg) {
  return Math.cos(deg * DEG);
}

function tand(deg) {
  return Math.tan(deg * DEG);
}

function atan2d(y, x) {
  return Math.atan2(y, x) / DEG;
}

function installCostEUR(hours, rateKEURDay) {
  return rateKEURDay * 1000 * (hours / 24);
}

function evalPowerLaw(c, uhcKN) {
  return {
    L_m: c.L[0] * Math.pow(uhcKN, c.L[1]),
    D_m: c.D[0] * Math.pow(uhcKN, c.D[1]),
    T_mm: c.T[0] * Math.pow(uhcKN, c.T[1])
  };
}

function checkPileGeometry(L_m, D_m, T_mm) {
  const T_m = T_mm / 1000;
  const ok = D_m > 2 * T_m && L_m > 0 && D_m > 0 && T_m > 0;
  return { ok, message: ok ? "" : `Invalid pile geometry: L=${L_m.toFixed(3)} m, D=${D_m.toFixed(3)} m, T=${T_mm.toFixed(2)} mm` };
}

function checkSuctionGeometry(L_m, D_m, T_mm) {
  const T_m = T_mm / 1000;
  const ok = D_m > 2 * T_m && L_m > T_m && L_m > 0 && D_m > 0 && T_m > 0;
  return { ok, message: ok ? "" : `Invalid suction geometry: L=${L_m.toFixed(3)} m, D=${D_m.toFixed(3)} m, T=${T_mm.toFixed(2)} mm` };
}

function massSteelPipe(rhoSteel, L_m, D_m, T_mm) {
  const T_m = T_mm / 1000;
  const volume = (Math.PI / 4) * (D_m ** 2 - (D_m - 2 * T_m) ** 2) * L_m;
  return rhoSteel * volume;
}

function massSteelSuction(rhoSteel, L_m, D_m, T_mm) {
  const T_m = T_mm / 1000;
  const volume = (Math.PI / 4) * ((D_m ** 2 - (D_m - 2 * T_m) ** 2) * (L_m - T_m) + D_m ** 2 * T_m);
  return rhoSteel * volume;
}

function parseMooringSystem(mooringSystem) {
  const s = lowerClean(mooringSystem);
  if (["catenary", "spread", "cat"].includes(s)) return { key: "CAT", isTLP: false };
  if (["taut", "tautened"].includes(s)) return { key: "TAUT", isTLP: false };
  if (s.includes("tlp") || s.includes("tendon") || s.includes("tension leg")) return { key: "TAUT", isTLP: true };
  throw new Error(`Unknown mooring system "${mooringSystem}".`);
}

function normalizeSoilKey(soilType) {
  const s = lowerClean(soilType);
  if (s.includes("very") && s.includes("soft") && s.includes("clay")) return "VSC";
  if (s.includes("medium") && s.includes("clay")) return "MC";
  if (s.includes("hard") && s.includes("clay")) return "SHC";
  if (s === "sand" || s.includes("sand") || s.includes("coarse") || s.includes("gravel")) return "SAND";
  if (s.includes("rock") || s.includes("bedrock") || s.includes("boulder") || s.includes("hardground") || s.includes("outcrop") || s.includes("reef")) return "GR";
  throw new Error(`Unknown soil type "${soilType}".`);
}

function normalizeSoilCompatKey(soilType) {
  const s = lowerClean(soilType);
  if (s.includes("very") && s.includes("soft") && s.includes("clay")) return "VSC";
  if (s.includes("medium") && s.includes("clay")) return "MC";
  if (s.includes("hard") && s.includes("clay")) return "HC";
  if (s === "sand" || s.includes("sand") || s.includes("coarse") || s.includes("gravel")) return "SAND";
  if (s.includes("rock") || s.includes("bedrock") || s.includes("boulder") || s.includes("hardground") || s.includes("outcrop") || s.includes("reef")) return "ROCK";
  throw new Error(`Unknown soil type "${soilType}".`);
}

function allowedAnchorsForSoil(compat) {
  switch (String(compat).toUpperCase()) {
    case "VSC": return ["DPA", "SA", "DEA", "VLA"];
    case "MC": return ["GA", "DPA", "SA", "DEA", "VLA"];
    case "HC": return ["GA", "DPA", "DEA"];
    case "SAND": return ["GA", "DPA", "DEA"];
    case "ROCK": return ["GA"];
    default: return ["GA", "DPA", "SA", "DEA", "VLA"];
  }
}

function isAnchorAllowed(compat, anchorType) {
  return allowedAnchorsForSoil(compat).includes(String(anchorType).toUpperCase());
}

function diameterFromMBL(material, mblRequiredKN, fgChain = 1) {
  const m = lowerClean(material);
  if (m === "chain") {
    const peakD = 44 / 0.12;
    const capacity = d => fgChain * d ** 2 * (44 - 0.08 * d);
    if (mblRequiredKN > capacity(peakD)) {
      throw new Error(`Chain MBL requirement is outside the fitted diameter range (${mblRequiredKN.toFixed(2)} kN).`);
    }
    let lo = 0;
    let hi = peakD;
    for (let i = 0; i < 80; i += 1) {
      const mid = (lo + hi) / 2;
      if (capacity(mid) < mblRequiredKN) lo = mid;
      else hi = mid;
    }
    return hi;
  }
  if (m === "nylon") return Math.pow(mblRequiredKN / 0.2117, 1 / 2.001);
  if (m === "polyester") return Math.pow(mblRequiredKN / 0.1529, 1 / 2.115);
  if (["steel wire", "wire", "steelwire"].includes(m)) return Math.sqrt(mblRequiredKN / 0.9);
  throw new Error(`Unknown mooring material "${material}".`);
}

function mooringFromTable(material, dMM, rhoWater = 1025, fg = 1) {
  const m = lowerClean(material);
  if (m === "chain") {
    const term = 44 - 0.08 * dMM;
    if (term <= 0) throw new Error(`Chain MBL invalid for d=${dMM.toFixed(2)} mm.`);
    return {
      MBL_kN: fg * dMM ** 2 * term,
      linearDensity_kgpm: 0.0219 * dMM ** 2,
      unitCost_EURkg: 2.5
    };
  }
  if (m === "nylon") {
    return {
      MBL_kN: 0.2117 * dMM ** 2.001,
      linearDensity_kgpm: 0.6071e-3 * dMM ** 1.994,
      unitCost_EURkg: 18
    };
  }
  if (m === "polyester") {
    return {
      MBL_kN: 0.1529 * dMM ** 2.115,
      linearDensity_kgpm: 0.4514e-3 * dMM ** 2.068,
      unitCost_EURkg: 11
    };
  }
  if (["steel wire", "wire", "steelwire"].includes(m)) {
    return {
      MBL_kN: 0.9 * dMM ** 2,
      linearDensity_kgpm: (0.043 / 9.81) * dMM ** 2 + rhoWater * 1e-6 * Math.PI * dMM ** 2 / 4,
      unitCost_EURkg: 5.5
    };
  }
  throw new Error(`Unknown mooring material "${material}".`);
}

function mooringLengthFromOptions(options) {
  const opt = { ...DEFAULTS, ...options };
  const sys = lowerClean(opt.mooringSystem);
  const lenModel = lowerClean(opt.mooringLengthModel);
  if (lenModel === "fixed") return finiteNumber(opt.mooringLength_m, 0);
  if (sys.includes("cat") || sys.includes("catenary")) return opt.catenaryLengthFactor * opt.waterDepth_m;
  const angle = Math.max(opt.mooringAngle_deg, opt.tautMinAngle_deg);
  return opt.tautSlackFactor * opt.waterDepth_m / Math.max(sind(angle), 1e-6);
}

function makeMooring(options, mblRequiredKN, uhcKN) {
  const opt = { ...DEFAULTS, ...options };
  const mooring = {
    enabled: false,
    material: "",
    length_m: NaN,
    numLines: opt.numMooringLines,
    Tmax_kN: opt.designLoad_kN,
    MBL_required_kN: mblRequiredKN,
    UHC_kN: uhcKN,
    d_mm: NaN,
    MBL_kN: NaN,
    linearDensity_kgpm: NaN,
    unitCost_EURkg: NaN,
    cost_per_m_EURpm: NaN,
    mass_total_kg: NaN,
    cost_total_EUR: NaN,
    UHC_over_MBL: NaN
  };
  if (!opt.useMooringCost) return mooring;
  const dMM = diameterFromMBL(opt.mooringMaterial, mblRequiredKN, opt.chainGradeFactor);
  const tbl = mooringFromTable(opt.mooringMaterial, dMM, opt.rhoWater, opt.chainGradeFactor);
  const length = mooringLengthFromOptions(opt);
  mooring.enabled = true;
  mooring.material = opt.mooringMaterial;
  mooring.length_m = length;
  mooring.d_mm = dMM;
  mooring.MBL_kN = tbl.MBL_kN;
  mooring.linearDensity_kgpm = tbl.linearDensity_kgpm;
  mooring.unitCost_EURkg = tbl.unitCost_EURkg;
  mooring.cost_per_m_EURpm = tbl.linearDensity_kgpm * tbl.unitCost_EURkg;
  mooring.mass_total_kg = tbl.linearDensity_kgpm * length * opt.numMooringLines;
  mooring.cost_total_EUR = mooring.mass_total_kg * tbl.unitCost_EURkg;
  mooring.UHC_over_MBL = uhcKN / tbl.MBL_kN;
  return mooring;
}

function addCandidateFactory(candidates, rejected, context) {
  return function addCandidate(candidate) {
    if (!isAnchorAllowed(context.soilCompat, candidate.Type)) {
      rejected.push({
        AnchorType: candidate.Type,
        Reason: "Rejected by anchor-seabed compatibility",
        Details: `Soil ${context.soilCompat} allows ${allowedAnchorsForSoil(context.soilCompat).join(", ")}.`
      });
      return;
    }
    if (context.enforceCraneCapacity) {
      const cap = candidate.Vessel === "CSV" ? context.csvCap : candidate.Vessel === "AHV" ? context.ahvCap : NaN;
      if (Number.isFinite(cap)) {
        if (!Number.isFinite(candidate.Mass_kg) || candidate.Mass_kg <= 0) {
          rejected.push({ AnchorType: candidate.Type, Reason: "Invalid mass", Details: "Mass is non-finite or <= 0." });
          return;
        }
        const req = candidate.Mass_kg / 1000;
        if (req > cap) {
          rejected.push({
            AnchorType: candidate.Type,
            Reason: "Exceeds vessel crane capacity",
            Details: `${candidate.Vessel} cap=${cap.toFixed(1)} t, required=${req.toFixed(1)} t`
          });
          return;
        }
      }
    }
    const mooringCost = context.mooring.enabled ? context.mooring.cost_total_EUR : NaN;
    const mooringForTotal = context.mooring.enabled ? context.mooring.cost_total_EUR : 0;
    candidates.push({
      ...candidate,
      MooringCost_EUR: mooringCost,
      TotalSystemCost_EUR: candidate.AnchorCost_EUR + (context.includeMooringInRanking ? mooringForTotal : 0)
    });
  };
}

function selectAnchorMinCost(options) {
  const opt = { ...DEFAULTS, ...options };
  if (!(opt.designLoad_kN > 0)) throw new Error("Design load must be > 0 kN.");
  if (!(opt.waterDepth_m >= 0)) throw new Error("Water depth must be >= 0 m.");
  const { key: moorKey, isTLP } = parseMooringSystem(opt.mooringSystem);
  const ang = finiteNumber(opt.mooringAngle_deg, NaN);
  if (ang < 0 || ang > 90) throw new Error("Mooring angle must be within [0, 90] degrees.");
  if (moorKey !== "CAT" && ang <= 0) throw new Error("Taut/TLP systems require angle > 0 degrees.");

  const soilKey = normalizeSoilKey(opt.soilType);
  const soilCompat = normalizeSoilCompatKey(opt.soilType);
  const Tmax_kN = opt.designLoad_kN;
  const MBL_required_kN = opt.mblFactor * Tmax_kN;
  const UHC_kN = opt.safetyFactor * MBL_required_kN;
  const mooring = makeMooring(opt, MBL_required_kN, UHC_kN);

  const candidates = [];
  const rejected = [];
  const rates = K.vesselRate;
  const installTimes = opt.useMidInstallTimes === false ? K.install.full : K.install.mid;
  const rhoSteel = 7850;
  const rhoConcrete = 2400;
  const rhoWater = opt.rhoWater;
  const nan = NaN;
  const addCandidate = addCandidateFactory(candidates, rejected, {
    soilCompat,
    mooring,
    includeMooringInRanking: opt.includeMooringInRanking,
    enforceCraneCapacity: opt.enforceCraneCapacity,
    csvCap: opt.csvCraneCapacity_tonnes,
    ahvCap: opt.ahvCraneCapacity_tonnes
  });

  const isAngleLE40 = ang <= 40 + opt.angleTol_deg;
  let pileRegime = "NONE";
  if (moorKey === "CAT") pileRegime = isAngleLE40 ? "SPREAD" : "NONE";
  else if (isTLP) pileRegime = "TLP";
  else pileRegime = isAngleLE40 ? "SPREAD" : "TLP";

  const phiDeg = finiteNumber(opt.phi_deg, soilKey === "VSC" ? 15 : soilKey === "MC" ? 20 : soilKey === "GR" ? 35 : 30);
  if (phiDeg <= 5) throw new Error("Phi angle must be > 5 degrees for gravity anchor sizing.");

  const H_N = UHC_kN * 1000 * cosd(ang);
  const V_N = UHC_kN * 1000 * sind(ang);
  const massGA = (rhoConcrete / (rhoConcrete - rhoWater)) * (H_N / (9.81 * tand(phiDeg - 5)) + V_N / 9.81);
  const fabGA = K.cFab.GA * massGA;
  const instGA = installCostEUR(K.install.GA, rates.CSV);
  addCandidate({
    Type: "GA",
    Variant: `Gravity (angle=${ang.toFixed(1)} deg)`,
    Vessel: "CSV",
    Mass_kg: massGA,
    InstallHours_h: K.install.GA,
    FabCost_EUR: fabGA,
    InstallCost_EUR: instGA,
    AnchorCost_EUR: fabGA + instGA,
    L_m: nan,
    D_m: nan,
    T_mm: nan,
    Area_m2: nan
  });

  const soilClass = soilKey === "SHC" ? "SAND" : soilKey;
  if (soilKey === "GR") {
    rejected.push({ AnchorType: "DPA", Reason: "Rejected by soil rule", Details: "DPA excluded for Gravel/Rock sizing bucket." });
  } else {
    const soilOK = ["VSC", "MC", "SAND"].includes(soilClass);
    if (pileRegime === "NONE") {
      rejected.push({ AnchorType: "DPA", Reason: "Excluded by angle/system rule", Details: `Pile anchors not allowed for ${opt.mooringSystem}, angle=${ang.toFixed(1)}.` });
    } else if (!soilOK) {
      rejected.push({ AnchorType: "DPA", Reason: "Rejected by soil rule", Details: `DPA allowed only in VSC/MC/SAND. soil=${soilKey}` });
    } else {
      const table = pileRegime === "SPREAD" ? K.A1Spread : K.A1Tlp;
      let key = soilKey;
      if (pileRegime === "SPREAD" && key === "SAND") key = "SHC";
      if (pileRegime === "TLP" && key === "SHC") key = "SAND";
      const coeff = table[key];
      if (!coeff) {
        rejected.push({ AnchorType: "DPA", Reason: `No ${pileRegime} coefficients`, Details: `No DPA coeffs for soil=${soilKey}` });
      } else {
        const geom = evalPowerLaw(coeff, UHC_kN);
        const chk = checkPileGeometry(geom.L_m, geom.D_m, geom.T_mm);
        if (!chk.ok) rejected.push({ AnchorType: "DPA", Reason: "Geometric infeasible", Details: chk.message });
        else {
          const mass = massSteelPipe(rhoSteel, geom.L_m, geom.D_m, geom.T_mm);
          const hours = installTimes.DPA * (opt.waterDepth_m / 100);
          const fab = K.cFab.DPA * mass;
          const inst = installCostEUR(hours, rates.CSV);
          addCandidate({
            Type: "DPA",
            Variant: `Driven pile (${pileRegime === "SPREAD" ? "Spread" : "TLP"} table)`,
            Vessel: "CSV",
            Mass_kg: mass,
            InstallHours_h: hours,
            FabCost_EUR: fab,
            InstallCost_EUR: inst,
            AnchorCost_EUR: fab + inst,
            ...geom,
            Area_m2: nan
          });
        }
      }
    }
  }

  if (soilKey === "GR") {
    rejected.push({ AnchorType: "SA", Reason: "Rejected by soil rule", Details: "SA excluded for Gravel/Rock sizing bucket." });
  } else {
    const soilOK = ["VSC", "MC"].includes(soilClass);
    if (pileRegime === "NONE") {
      rejected.push({ AnchorType: "SA", Reason: "Excluded by angle/system rule", Details: `Pile anchors not allowed for ${opt.mooringSystem}, angle=${ang.toFixed(1)}.` });
    } else if (!soilOK) {
      rejected.push({ AnchorType: "SA", Reason: "Rejected by soil rule", Details: `SA allowed only in VSC/MC. soil=${soilKey}` });
    } else {
      const table = pileRegime === "SPREAD" ? K.A2Spread : K.A2Tlp;
      const coeff = table[soilKey];
      if (!coeff) {
        rejected.push({ AnchorType: "SA", Reason: `No ${pileRegime} coefficients`, Details: `No SA coeffs for soil=${soilKey}` });
      } else {
        const geom = evalPowerLaw(coeff, UHC_kN);
        const chk = checkSuctionGeometry(geom.L_m, geom.D_m, geom.T_mm);
        if (!chk.ok) rejected.push({ AnchorType: "SA", Reason: "Geometric infeasible", Details: chk.message });
        else {
          const mass = massSteelSuction(rhoSteel, geom.L_m, geom.D_m, geom.T_mm);
          const hours = installTimes.SA * (opt.waterDepth_m / 100);
          const fab = K.cFab.SA * mass;
          const inst = installCostEUR(hours, rates.CSV);
          addCandidate({
            Type: "SA",
            Variant: `Suction pile (${pileRegime === "SPREAD" ? "Spread" : "TLP"} table)`,
            Vessel: "CSV",
            Mass_kg: mass,
            InstallHours_h: hours,
            FabCost_EUR: fab,
            InstallCost_EUR: inst,
            AnchorCost_EUR: fab + inst,
            ...geom,
            Area_m2: nan
          });
        }
      }
    }
  }

  if (soilKey === "GR") {
    rejected.push({ AnchorType: "DEA", Reason: "Rejected by soil rule", Details: "DEA excluded for Gravel/Rock sizing bucket." });
  } else if (moorKey === "CAT" && ang <= 5) {
    let deaKey = soilKey === "SAND" ? "SHC" : soilKey;
    Object.entries(K.dea).forEach(([modelName, model]) => {
      const ab = model[deaKey];
      if (!ab) return;
      const mass = 1000 * Math.pow(UHC_kN / ab[0], 1 / ab[1]);
      const hours = installTimes.DEA * (opt.waterDepth_m / 100);
      const fab = K.cFab.DEA * mass;
      const inst = installCostEUR(hours, rates.AHV);
      addCandidate({
        Type: "DEA",
        Variant: modelName.replaceAll("_", " "),
        Vessel: "AHV",
        Mass_kg: mass,
        InstallHours_h: hours,
        FabCost_EUR: fab,
        InstallCost_EUR: inst,
        AnchorCost_EUR: fab + inst,
        L_m: nan,
        D_m: nan,
        T_mm: nan,
        Area_m2: nan
      });
    });
  } else {
    rejected.push({ AnchorType: "DEA", Reason: "Excluded by rule", Details: "DEA only for catenary with near-horizontal angle <= 5 deg." });
  }

  const vlaAllowed = moorKey === "TAUT" && ang >= 80;
  if (soilKey === "GR") {
    rejected.push({ AnchorType: "VLA", Reason: "Rejected by soil rule", Details: "VLA excluded for Gravel/Rock sizing bucket." });
  } else if (vlaAllowed) {
    let coeff = null;
    if (Number.isFinite(opt.vlaCoeffA) && Number.isFinite(opt.vlaCoeffB)) {
      coeff = [opt.vlaCoeffA, opt.vlaCoeffB];
    } else if (Array.isArray(opt.vlaCoeffs) && opt.vlaCoeffs.length === 2) {
      coeff = opt.vlaCoeffs;
    } else {
      const sq = finiteNumber(opt.soilQuotient, soilKey === "VSC" ? 1.75 : soilKey === "MC" ? 2.75 : NaN);
      const key = Number.isFinite(sq) ? sq.toFixed(2).replace(".", "p") : "";
      coeff = K.vlaCoeffs[key] || null;
    }
    if (!coeff) {
      rejected.push({ AnchorType: "VLA", Reason: "Excluded by rule", Details: "VLA not available for selected coefficients/soil quotient." });
    } else {
      const reqArea = Math.max(coeff[0] * UHC_kN + coeff[1], 0);
      const row = K.vlaTable.find(r => r[0] >= reqArea) || K.vlaTable[K.vlaTable.length - 1];
      const area = row[0];
      const F_m = row[1] / 1000;
      const E0_m = row[2] / 1000;
      const rhoChain = 0.0219 * opt.chainDiameter_mm ** 2;
      const mass = 0.4 * rhoSteel * (area * F_m) + 8 * rhoChain * E0_m;
      const hours = installTimes.VLA * (opt.waterDepth_m / 100);
      const fab = K.cFab.VLA * mass;
      const inst = installCostEUR(hours, rates.AHV);
      addCandidate({
        Type: "VLA",
        Variant: `Stevmanta (A=${area.toFixed(0)} m2)`,
        Vessel: "AHV",
        Mass_kg: mass,
        InstallHours_h: hours,
        FabCost_EUR: fab,
        InstallCost_EUR: inst,
        AnchorCost_EUR: fab + inst,
        L_m: nan,
        D_m: nan,
        T_mm: nan,
        Area_m2: area
      });
    }
  } else {
    rejected.push({ AnchorType: "VLA", Reason: "Excluded by rule", Details: "VLA allowed only for taut/TLP vertical loading with angle >= 80 deg." });
  }

  if (candidates.length === 0) {
    throw new Error("No feasible anchor candidates were generated.");
  }

  candidates.sort((a, b) => {
    const col = opt.includeMooringInRanking ? "TotalSystemCost_EUR" : "AnchorCost_EUR";
    return a[col] - b[col];
  });

  const best = {
    ...candidates[0],
    Tmax_kN,
    MBL_required_kN,
    UHC_kN,
    DesignLoad_kN: opt.designLoad_kN,
    SoilType: opt.soilType,
    MooringSystem: opt.mooringSystem,
    MooringAngle_deg: ang,
    WaterDepth_m: opt.waterDepth_m
  };
  return { best, candidates, rejected, mooring };
}

function lcoeFromCostPerKW(costUSDPerKW, options) {
  const opt = { ...DEFAULTS, ...options };
  if (!opt.computeLCOE || !Number.isFinite(costUSDPerKW)) return NaN;
  const energyMWhPerKWYr = 8.766 * opt.lcoeNetCapacityFactor;
  if (!(energyMWhPerKWYr > 0)) return NaN;
  return (costUSDPerKW * opt.lcoeFcr + opt.lcoeAnnualOpex_USD_per_kW_yr) / energyMWhPerKWYr;
}

function analyzeSite(options) {
  const opt = { ...DEFAULTS, ...options };
  const result = selectAnchorMinCost(opt);
  const nLines = Math.max(1, Math.round(opt.numMooringLines));
  const anchorCostEUR = nLines * result.best.AnchorCost_EUR;
  const fabEUR = nLines * result.best.FabCost_EUR;
  const installEUR = nLines * result.best.InstallCost_EUR;
  const mooringEUR = Number.isFinite(result.best.MooringCost_EUR) ? result.best.MooringCost_EUR : NaN;
  const totalEUR = anchorCostEUR + (Number.isFinite(mooringEUR) ? mooringEUR : 0);
  const fx = opt.fxUsdPerEur;
  const rated = finiteNumber(opt.ratedPowerPerDevice_kW, NaN);
  return {
    ...result,
    perDevice: {
      anchorCost_EUR: anchorCostEUR,
      fabCost_EUR: fabEUR,
      installCost_EUR: installEUR,
      mooringCost_EUR: mooringEUR,
      totalSystemCost_EUR: totalEUR,
      anchorCost_USD: anchorCostEUR * fx,
      fabCost_USD: fabEUR * fx,
      installCost_USD: installEUR * fx,
      mooringCost_USD: mooringEUR * fx,
      totalSystemCost_USD: totalEUR * fx,
      totalCost_USD_per_kW: Number.isFinite(rated) && rated > 0 ? totalEUR * fx / rated : NaN,
      mooringAnchorLCOE_USD_per_MWh: lcoeFromCostPerKW(Number.isFinite(rated) && rated > 0 ? totalEUR * fx / rated : NaN, opt)
    }
  };
}

function toNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return NaN;
  const x = Number(String(value).trim());
  return x === -99 ? NaN : x;
}

function mapRowToAnchorSoil(G0, S0, M0, C0, folk0) {
  let G = Number.isNaN(G0) ? 0 : G0;
  let S = Number.isNaN(S0) ? 0 : S0;
  let M = Number.isNaN(M0) ? 0 : M0;
  let C = Number.isNaN(C0) ? 0 : C0;
  const ftxt = lowerClean(folk0);
  const hasAnyFrac = [G, S, M, C].some(Number.isFinite) && !(G === 0 && S === 0 && M === 0 && C === 0);
  const sumGSM = G + S + M;
  const sumGSMC = G + S + M + C;
  let mud = Math.abs(sumGSM - 100) <= Math.abs(sumGSMC - 100) ? M : M + C;
  G = Math.max(0, Math.min(100, G));
  S = Math.max(0, Math.min(100, S));
  C = Math.max(0, Math.min(100, C));
  mud = Math.max(0, Math.min(100, mud));

  const rockKeys = ["rock", "bedrock", "hardground", "outcrop", "reef", "boulder", "rck"];
  if (rockKeys.some(k => ftxt.includes(k))) return "Rock";
  if (!hasAnyFrac) {
    if (ftxt.includes("coarse") || ftxt.includes("gravel") || ftxt.includes("sand")) return "Sand";
    if (ftxt.includes("mixed")) return "Hard Clay";
    if (ftxt.includes("mud") || ftxt.includes("clay") || ftxt.includes("silt")) return "Medium Clay";
    return "Unknown";
  }
  if (G >= 80 || (G >= 5 && S >= 90)) return "Sand";
  if (S >= 90) return "Sand";
  if (mud >= 10 && mud <= 95 && S < 90 && G >= 5) return "Hard Clay";
  if (mud >= 10 && mud <= 100 && S < 90 && G < 5) return mud >= 70 && S <= 30 ? "Very Soft Clay" : "Medium Clay";
  if (S >= 70 || ftxt.includes("sand") || ftxt.includes("coarse") || ftxt.includes("gravel")) return "Sand";
  if (ftxt.includes("mixed")) return "Hard Clay";
  if (mud >= 70 && S <= 30) return "Very Soft Clay";
  return "Medium Clay";
}

function csvRowToSite(row) {
  const lat = toNumber(row.Latitude);
  const lon = toNumber(row.Longitude);
  let waterDepth = toNumber(row.WaterDepth);
  if (waterDepth < 0) waterDepth = Math.abs(waterDepth);
  const gravel = toNumber(row.Gravel);
  const sand = toNumber(row.Sand);
  const mud = toNumber(row.Mud);
  const clay = toNumber(row.Clay);
  const soilType = mapRowToAnchorSoil(gravel, sand, mud, clay, row.FolkCde);
  return { lat, lon, waterDepth, gravel, sand, mud, clay, folk: row.FolkCde ?? "", soilType };
}

function scanCsvRows(rows, options) {
  const opt = { ...DEFAULTS, ...options };
  const bbox = opt.bbox || [24, 46, -82, -60];
  const minDepth = finiteNumber(opt.minWaterDepth_m, 0);
  const maxDepth = finiteNumber(opt.maxWaterDepth_m, Infinity);
  const maxRows = finiteNumber(opt.maxRows, Infinity);
  const out = [];
  const removed = { missingPosition: 0, missingDepth: 0, unknownSoil: 0, shallow: 0, deep: 0, bbox: 0, noFeasible: 0 };

  for (const row of rows) {
    if (out.length >= maxRows) break;
    const site = csvRowToSite(row);
    if (!Number.isFinite(site.lat) || !Number.isFinite(site.lon)) {
      removed.missingPosition += 1;
      continue;
    }
    if (site.lat < bbox[0] || site.lat > bbox[1] || site.lon < bbox[2] || site.lon > bbox[3]) {
      removed.bbox += 1;
      continue;
    }
    if (!Number.isFinite(site.waterDepth)) {
      removed.missingDepth += 1;
      continue;
    }
    if (site.soilType === "Unknown") {
      removed.unknownSoil += 1;
      continue;
    }
    if (site.waterDepth < minDepth) {
      removed.shallow += 1;
      continue;
    }
    if (site.waterDepth > maxDepth) {
      removed.deep += 1;
      continue;
    }
    try {
      const result = analyzeSite({ ...opt, waterDepth_m: site.waterDepth, soilType: site.soilType, latitude: site.lat, longitude: site.lon });
      out.push({
        Lat: site.lat,
        Lon: site.lon,
        WaterDepth_m: site.waterDepth,
        SoilType: site.soilType,
        BestAnchorType: result.best.Type,
        BestVariant: result.best.Variant,
        BestVessel: result.best.Vessel,
        BestMass_kg: result.best.Mass_kg,
        AnchorFabCost_USD: result.perDevice.fabCost_USD,
        AnchorInstallCost_USD: result.perDevice.installCost_USD,
        AnchorCost_USD: result.perDevice.anchorCost_USD,
        MooringCost_USD: result.perDevice.mooringCost_USD,
        TotalSystemCost_USD: result.perDevice.totalSystemCost_USD,
        TotalCost_USD_per_kW: result.perDevice.totalCost_USD_per_kW,
        MooringAnchorLCOE_USD_per_MWh: result.perDevice.mooringAnchorLCOE_USD_per_MWh,
        Status: "OK",
        Message: ""
      });
    } catch (error) {
      removed.noFeasible += 1;
      out.push({
        Lat: site.lat,
        Lon: site.lon,
        WaterDepth_m: site.waterDepth,
        SoilType: site.soilType,
        BestAnchorType: "No feasible",
        BestVariant: "",
        BestVessel: "",
        BestMass_kg: NaN,
        AnchorFabCost_USD: NaN,
        AnchorInstallCost_USD: NaN,
        AnchorCost_USD: NaN,
        MooringCost_USD: NaN,
        TotalSystemCost_USD: NaN,
        TotalCost_USD_per_kW: NaN,
        MooringAnchorLCOE_USD_per_MWh: NaN,
        Status: "No feasible",
        Message: error.message
      });
    }
  }
  return { rows: out, removed, distribution: anchorDistribution(out) };
}

function anchorDistribution(rows) {
  const counts = Object.fromEntries(ANCHOR_ORDER.map(k => [k, 0]));
  rows.forEach(row => {
    const key = row.BestAnchorType || "No feasible";
    counts[key] = (counts[key] || 0) + 1;
  });
  const total = rows.length || 1;
  return ANCHOR_ORDER.map(type => ({ type, count: counts[type] || 0, percent: 100 * (counts[type] || 0) / total }));
}

function estimateArrayNxNy(lengthKm, widthKm, spacingM, model = "floor") {
  const L = 1000 * lengthKm;
  const W = 1000 * widthKm;
  const plus = String(model).toLowerCase() === "plus1" ? 1 : 0;
  const Nx = Math.max(1, Math.floor(L / spacingM) + plus);
  const Ny = Math.max(1, Math.floor(W / spacingM) + plus);
  return { Nx, Ny, Ndev: Nx * Ny };
}

function sharedAnchorCount(Nx, Ny, linesPerDevice) {
  const a3 = Math.ceil((3 * Nx * Ny + Nx + Ny + 4) / 3);
  return linesPerDevice === 3 ? a3 : Math.ceil(a3 * linesPerDevice / 3);
}

function representativeSpacing(options) {
  const opt = { ...DEFAULTS, ...options };
  const Lm = mooringLengthFromOptions(opt);
  const { key } = parseMooringSystem(opt.mooringSystem);
  if (!Number.isFinite(Lm) || Lm <= 0) return NaN;
  if (key === "CAT") return Math.sqrt(3) * Math.max(Lm - opt.waterDepth_m, 0);
  return Math.sqrt(3) * Lm * cosd(Math.max(opt.mooringAngle_deg, opt.tautMinAngle_deg));
}

function sharedAnchorResultantLoad(lineKN, lineAngleDeg, mooringSystem, nSharedLines) {
  const n = Math.max(1, Math.round(finiteNumber(nSharedLines, 1)));
  const { key } = parseMooringSystem(mooringSystem);
  const ang = Math.max(0, Math.min(90, lineAngleDeg));
  const H1 = lineKN * cosd(ang);
  const V1 = lineKN * sind(ang);
  if (key === "CAT") return { Tshared_kN: H1, angShared_deg: 0, Hshared_kN: H1, Vshared_kN: 0, nSharedLines: 1 };
  const H = H1;
  const V = n * V1;
  return { Tshared_kN: Math.hypot(H, V), angShared_deg: atan2d(V, Math.max(H, 1e-12)), Hshared_kN: H, Vshared_kN: V, nSharedLines: n };
}

function analyzeArray(options) {
  const opt = { ...DEFAULTS, ...options };
  const base = analyzeSite(opt);
  const lines = Math.max(1, Math.round(finiteNumber(opt.linesPerDevice, opt.numMooringLines)));
  const spacing = opt.deviceSpacingMode === "based_on_geometry" ? representativeSpacing(opt) : finiteNumber(opt.deviceSpacing_m, 500);
  const { Nx, Ny, Ndev } = estimateArrayNxNy(opt.siteLength_km, opt.siteWidth_km, spacing, opt.arrayCountModel);
  const rated = opt.ratedPowerPerDevice_kW;
  const totalPower = rated * Ndev;
  const anchorsNonShared = Ndev * lines;
  const anchorsShared = opt.computeSharedAnchoring ? sharedAnchorCount(Nx, Ny, lines) : NaN;
  const minimumSpacing = Number.isFinite(opt.minimumRequiredSpacing_m) ? opt.minimumRequiredSpacing_m : spacing;
  const sharedSpacingFeasible = spacing >= minimumSpacing;
  const moorPerDeviceEUR = Number.isFinite(base.perDevice.mooringCost_EUR) ? base.perDevice.mooringCost_EUR : 0;
  const mooringArrayEUR = Ndev * moorPerDeviceEUR;
  const nonSharedAnchorEUR = anchorsNonShared * base.best.AnchorCost_EUR;

  const sharedLoad = sharedAnchorResultantLoad(opt.designLoad_kN, opt.mooringAngle_deg, opt.mooringSystem, lines);
  let sharedBest = null;
  try {
    if (!opt.computeSharedAnchoring || !sharedSpacingFeasible) throw new Error("Shared anchoring disabled or spacing infeasible.");
    const shared = selectAnchorMinCost({
      ...opt,
      designLoad_kN: sharedLoad.Tshared_kN,
      mooringAngle_deg: sharedLoad.angShared_deg,
      useMooringCost: false,
      includeMooringInRanking: false
    });
    const candidates = shared.candidates.filter(c => c.Type !== "DEA").sort((a, b) => a.AnchorCost_EUR - b.AnchorCost_EUR);
    sharedBest = candidates[0] || null;
  } catch {
    sharedBest = null;
  }
  const sharedAnchorEUR = sharedBest ? anchorsShared * sharedBest.AnchorCost_EUR : NaN;
  const fx = opt.fxUsdPerEur;
  return {
    base,
    Nx,
    Ny,
    Ndev,
    spacing_m: spacing,
    totalPower_kW: totalPower,
    anchorsNonShared,
    anchorsShared,
    minimumRequiredSpacing_m: minimumSpacing,
    sharedSpacingFeasible,
    sharedLoad,
    nonShared: {
      anchorType: base.best.Type,
      anchorCostArray_USD: nonSharedAnchorEUR * fx,
      mooringCostArray_USD: mooringArrayEUR * fx,
      totalCostArray_USD: (nonSharedAnchorEUR + mooringArrayEUR) * fx,
      total_USD_per_kW: (nonSharedAnchorEUR + mooringArrayEUR) * fx / totalPower,
      lcoe_USD_per_MWh: lcoeFromCostPerKW((nonSharedAnchorEUR + mooringArrayEUR) * fx / totalPower, opt)
    },
    shared: {
      anchorType: opt.computeSharedAnchoring ? (sharedBest ? sharedBest.Type : (sharedSpacingFeasible ? "No feasible" : "Spacing infeasible")) : "Not computed",
      anchorCostArray_USD: sharedAnchorEUR * fx,
      mooringCostArray_USD: mooringArrayEUR * fx,
      totalCostArray_USD: Number.isFinite(sharedAnchorEUR) ? (sharedAnchorEUR + mooringArrayEUR) * fx : NaN,
      total_USD_per_kW: Number.isFinite(sharedAnchorEUR) ? (sharedAnchorEUR + mooringArrayEUR) * fx / totalPower : NaN,
      lcoe_USD_per_MWh: lcoeFromCostPerKW(Number.isFinite(sharedAnchorEUR) ? (sharedAnchorEUR + mooringArrayEUR) * fx / totalPower : NaN, opt)
    }
  };
}

function parametricStudy(options) {
  const opt = { ...DEFAULTS, ...options };
  const variable = opt.parametricVariable || "DesignLoad";
  const soils = opt.parametricSoils || ["Very Soft Clay", "Medium Clay", "Hard Clay", "Sand"];
  const values = opt.parametricValues || [500, 750, 1000, 1500, 2000, 3000, 4000, 5000];
  const angleValues = opt.parametricAngleValues || [5, 10, 15, 20, 25, 30, 40, 60, 80, 90];
  const rows = [];
  for (const soil of soils) {
    const outerValues = variable === "DesignLoadAngle" ? angleValues : [null];
    for (const angleValue of outerValues) {
    for (const value of values) {
      const cfg = { ...opt, soilType: soil };
      if (variable === "WaterDepth") cfg.waterDepth_m = value;
      if (variable === "LoadAngle") cfg.mooringAngle_deg = value;
      if (variable === "DesignLoad") cfg.designLoad_kN = value;
      if (variable === "DesignLoadAngle") {
        cfg.designLoad_kN = value;
        cfg.mooringAngle_deg = angleValue;
      }
      try {
        const res = analyzeSite(cfg);
        rows.push({
          ParametricVariable: variable,
          SweepValue: value,
          MooringAngle_deg: cfg.mooringAngle_deg,
          DesignLoad_kN: cfg.designLoad_kN,
          WaterDepth_m: cfg.waterDepth_m,
          SoilType: soil,
          BestAnchorType: res.best.Type,
          TotalSystemCost_USD: res.perDevice.totalSystemCost_USD,
          TotalCost_USD_per_kW: res.perDevice.totalCost_USD_per_kW,
          MooringAnchorLCOE_USD_per_MWh: res.perDevice.mooringAnchorLCOE_USD_per_MWh,
          Status: "OK",
          Message: ""
        });
      } catch (error) {
        rows.push({
          ParametricVariable: variable,
          SweepValue: value,
          MooringAngle_deg: cfg.mooringAngle_deg,
          DesignLoad_kN: cfg.designLoad_kN,
          WaterDepth_m: cfg.waterDepth_m,
          SoilType: soil,
          BestAnchorType: "No feasible",
          TotalSystemCost_USD: NaN,
          TotalCost_USD_per_kW: NaN,
          MooringAnchorLCOE_USD_per_MWh: NaN,
          Status: "No feasible",
          Message: error.message
        });
      }
    }
    }
  }
  return rows;
}

function formatMoney(value, digits = 0) {
  if (!Number.isFinite(value)) return "N/A";
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "N/A";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export {
  DEFAULTS,
  SOIL_ORDER,
  ANCHOR_ORDER,
  analyzeSite,
  analyzeArray,
  anchorDistribution,
  csvRowToSite,
  formatMoney,
  formatNumber,
  mapRowToAnchorSoil,
  parametricStudy,
  scanCsvRows,
  selectAnchorMinCost
};
