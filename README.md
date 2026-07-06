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
- Array non-shared vs shared anchoring comparison
- Parametric sweeps for design load, load angle, and water depth
- CSV result downloads
- Fully static frontend with no server-side data handling

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
  data/
    us9_sample.csv
  js/
    app.js
    csv.js
    engine.js
```

## GitHub Status

`C:\Users\babak\OneDrive\Desktop\Neda` is not currently a Git repository, and no GitHub remote is configured there.

To publish this app later:

```powershell
cd C:\Users\babak\OneDrive\Desktop\Neda\anchor-web-app
git init
git add .
git commit -m "Create anchor selection web app"
```

Then create a GitHub repository and add it as `origin`.

## Validation Status

This is a JavaScript port of the MATLAB calculation logic intended for public-facing screening use. Before final engineering release, create golden test cases from MATLAB and compare:

- best anchor type
- variant and vessel
- mass and geometry
- fabrication, installation, mooring, total cost
- CSV soil mapping and filtering
- array shared/non-shared outputs

The app includes the same core formulas and selection rules, but it has not yet been certified against a MATLAB regression suite.
