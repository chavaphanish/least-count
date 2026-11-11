# YAYDU artwork

`yaydu-original.png` is the supplied `Yaydu.png`, unchanged. The source is 292×340, with a thin external image frame. `scripts/generate-branding.py` removes that frame, maps the monochrome symbol to existing theme gold (`#e9cd91`), and pads to a square without stretching, rotating or redrawing it. Its binary mask removes source tonal variation; resized edges use alpha antialiasing only. Install icons have solid `#0c2e26` backgrounds, sharp square canvases, no text and mask-safe padding. Android launchers may apply their own platform mask.

Run `python scripts/generate-branding.py` with ImageMagick 7 installed to regenerate web/native artwork. This tool is not required for normal development or deployment.
