# Anchor Selection Studio

A static web app that ports the MATLAB anchor-selection workflow into browser-side JavaScript. It runs without MATLAB and can be hosted on GitHub Pages, Netlify, Vercel static hosting, or any ordinary web server.

## Run Locally

From this folder:

```powershell
python .\serve.py
```

Open:

```text
http://127.0.0.1:8765/
```

## What Is Included

- Single-site anchor selection
- Mooring cost calculation
- US9-style CSV upload and map scan
- Soil classification from Gravel/Sand/Mud/Clay/FolkCde
- Per-device USD and USD/kW reporting
- Mooring + anchoring LCOE contribution
- Array non-shared vs shared anchoring comparison
- Parametric sweeps for design load, load angle, and water depth
- Combined design-load/load-angle parametric sweep
- Advanced selector overrides: phi, water density, soil quotient, VLA coefficients, chain diameter, install-time mode, angle tolerance
- MATLAB-style plot/display toggles and output prefix
- CSV result downloads
- NC State-branded header and in-app hover/focus guidance
- Help tab with tutorial steps, example questions, and Ask Guide
- ChatGPT handoff prompt for deeper LLM-based guidance without exposing API keys
- Scenario presets for baseline catenary, taut, TLP, and array cases
- Decision-readiness summary with validation notes and ranking gap
- Per-device cost breakdown and richer chart legends
- Methodology & QA workspace for model scope, cost logic, CSV soil mapping, and responsible-use notes
- Executive report builder with downloadable HTML and PDF summaries
- Fully static frontend with no server-side data handling

## Help and LLM Guidance

The Help tab includes a static Ask Guide that answers common workflow questions in the browser. It can also copy a detailed prompt with the current app context for ChatGPT.

A true in-app GPT assistant should use a secure backend endpoint. Do not place an OpenAI API key in this static GitHub Pages frontend, because browser JavaScript is public.

## Expected CSV Columns

```text
Latitude, Longitude, WaterDepth, Gravel, Sand, Mud, Clay, FolkCde
```

## Project Layout

```text
anchor-web-app/
  index.html
  styles.css
  serve.py
  assets/
    ncstate-brick-4x1-red.png
  data/
    us9_sample.csv
  js/
    app.js
    csv.js
    engine.js
```

## GitHub Status

The web app is published from this repository:

```text
https://github.com/BabakAsadi94/anchor-selection-studio
```

The public GitHub Pages site is:

```text
https://babakasadi94.github.io/anchor-selection-studio/
```

## Brand Asset Note

The NC State logo in `assets/ncstate-brick-4x1-red.png` was downloaded from the official NC State Brand downloads page:

```text
https://brand.ncsu.edu/downloads/
```

NC State's brand guidance says those assets are for official university communications, and the logo is a registered trademark. Confirm the appropriate university authorization or trademark permission before using the logo in a public institutional release.

## Validation Status

This is a JavaScript port of the MATLAB calculation logic intended for public-facing screening use. The interface exposes the MATLAB calculation options in browser form. MATLAB-only behaviors such as figure windows and `SaveOutputs` artifact folders are represented as browser display toggles and downloads.

Before final engineering release, create golden test cases from MATLAB and compare:

- best anchor type
- variant and vessel
- mass and geometry
- fabrication, installation, mooring, total cost
- CSV soil mapping and filtering
- array shared/non-shared outputs

The app includes the same core formulas and selection rules, but it has not yet been certified against a MATLAB regression suite.

## Public App QA

The repository includes a smoke test suite for the JavaScript engine:

```powershell
node .\tests\engine-smoke.mjs
```

Current browser verification covers:

- default single-site analysis
- scenario preset loading
- option hover/focus help
- executive report build
- CSV sample scan, map legend, and map note
- array shared/non-shared recommendation
- parametric study chart legend and note
- mobile layout with no horizontal overflow
