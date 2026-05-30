# OCTG Hub — Landing Site

Marketing landing page for **OCTG Hub**, the parent company behind **OCTG.ai** — an engineering-first AI platform for well tubular (OCTG) design.

> *Engineering-first AI, not AI-first engineering. AI proposes; deterministic math decides.*

## Highlights
- **Live triaxial design-limit plot** in the hero — drag the operating point and the safety factor recomputes against the von Mises (VME) envelope.
- **Platform Module Map** — the five-module suite (CatalogIQ → TubularIQ → PipelineIQ → YardIQ → WellRecordIQ) shown as one continuous lifecycle record.
- **AI Non-Authority Boundary** diagram, roadmap, target customers, and an early-access waitlist.
- **Tweaks panel** (toggle in the corner) to switch brand accent, signal color, and display font live.

## Files
| File | Purpose |
|------|---------|
| `index.html` | The page (entry point) |
| `octg.css` | Design system + all styles |
| `octg.js` | Nav, scroll reveals, and the interactive design-limit plot |
| `tweaks-panel.jsx` | In-page Tweaks control panel |

`OCTG Hub.html` is kept as a duplicate of `index.html` for convenience; you can delete it if you only need the GitHub Pages entry point.

## Run locally
It's a static site — no build step. Either open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

A local server is recommended so the relative `octg.css` / `octg.js` / `tweaks-panel.jsx` files load reliably.

## Deploy with GitHub Pages
1. Push these files to a repository.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Choose your branch and the `/ (root)` folder, then save.
4. Your site goes live at `https://<user>.github.io/<repo>/`.

## Notes
- Fonts (Space Grotesk, Sora, IBM Plex Sans/Mono) load from Google Fonts; React/Babel for the Tweaks panel load from a CDN. All require an internet connection at runtime.
- The waitlist form is front-end only — wire it to your email/CRM backend before going live.
- Engineering figures (design factors, plot values, validation diffs) are illustrative placeholders. Replace with certified data.

© 2026 OCTG Hub.
