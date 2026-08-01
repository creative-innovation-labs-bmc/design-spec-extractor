# Design Spec Extractor

A local-first browser tool for turning Illustrator exports, screenshots and PDF references into a structured design-to-code handoff.

It does not attempt to generate a website from a screenshot in one uncontrolled pass. Instead, it removes ambiguity before the coding model starts:

- Import PNG, JPG, WebP or PDF references.
- Draw exact regions around layout areas, components, media and text blocks.
- Record pixel coordinates, dimensions, page behaviour and repeated components.
- Sample exact colours and maintain spacing and typography tokens.
- Add a content brief for sections the model needs to complete.
- Compare an implementation screenshot against the reference using blend and pixel-difference modes.
- Export a ZIP containing reference images, machine-readable JSON, a human-readable report, CSS tokens, a strict AI build prompt and starter files.

## Why this workflow

Coding models are generally better at implementing explicit constraints than inferring a full layout system from a flattened Illustrator or PDF design. The exported package gives the model both the artwork and the measurements.

## Use it

1. Open the site in a modern desktop browser.
2. Export the Illustrator artwork as a high-resolution PNG, or load the PDF directly.
3. Set the intended desktop viewport size.
4. Use **Region** to mark the major page sections first, then repeated components, media and text blocks.
5. Use **Colour** for important brand colours. Use **Palette** only as a starting point and remove irrelevant image colours.
6. Add spacing and typography values from Illustrator.
7. Complete the **Handoff** tab, especially the hard rules and the scope of missing content.
8. Export the handoff package and give the entire ZIP contents to the coding model.
9. Capture the generated website at the target viewport and load it through **Compare screenshot**. Use Difference mode to locate mismatches.

## Illustrator export guidance

For the best measurements:

- Export each desktop page or artboard separately when possible.
- Export at the intended CSS width when possible. When using a 2x export or a PDF rasterised at another width, set each page's **Implementation width** so every guide and region is normalised to CSS pixels.
- Keep the full page width consistent across artboards.
- Include the exact font names and provide licensed webfont files separately.
- Keep photographs and illustrations as separate source assets when the final website needs them independently.

PDF pages are rasterised in the browser. Very large PDFs are limited to the first 50 pages per import.

## Exported package

| File | Purpose |
|---|---|
| `AI_BUILD_PROMPT.md` | Strict instructions for the coding model |
| `design-spec.json` | Machine-readable project, token and region data |
| `DESIGN_SPEC.md` | Human-readable measurements and page notes |
| `tokens.css` | CSS custom properties generated from the supplied tokens |
| `references/` | Raster reference pages used for implementation |
| `starter/` | Minimal HTML and CSS starting point |

Exported packages can be reopened in the tool using **Open package**.

## Privacy

Reference files and annotations remain in browser memory. They are not uploaded by this application. PDF import and ZIP export load pinned open-source libraries from jsDelivr when those features are first used.

The project includes `noindex`, `nofollow`, `noarchive` metadata and a restrictive `robots.txt`. That discourages indexing but does not make a public GitHub Pages site private.

## Deploy to GitHub Pages

The included workflow tests the static files and deploys the repository through GitHub Pages whenever `main` is updated.

1. Create a new public repository.
2. Upload this project to the repository root.
3. In **Settings > Pages**, set **Source** to **GitHub Actions**.
4. Push to `main` or run the workflow manually.

The expected URL is:

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/
```

## Local use

Because JavaScript modules and service workers require HTTP, start a simple local server instead of opening `index.html` directly.

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Tests

```bash
npm test
```

The smoke test checks required files, duplicate IDs, JavaScript-to-HTML references, pinned dependencies, noindex metadata and JavaScript syntax.

## Current limits

- The tool does not read Illustrator `.ai` layer data directly.
- Typography is entered manually because flattened artwork does not reliably expose font metadata.
- Automatic palette extraction includes image colours and needs human cleanup.
- Pixel comparison expects the implementation screenshot to use the same source-pixel dimensions as the loaded reference. Export a matching screenshot or use the normal blend view.
- There is no hosted AI call in this version. Static GitHub Pages cannot safely store a private model API key.

## Licence

MIT.
