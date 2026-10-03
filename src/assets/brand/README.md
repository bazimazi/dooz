# dooz artwork

The icon family keeps the game's pink cross, amber ring, and indigo background.
The larger mark adds restrained shading; the favicon is an optical reduction
without shadows so it stays readable at 16 pixels. Game pieces and animated
in-app illustrations remain theme-aware SVG components.

Animated in-app artwork follows the project's
[animation policy](../../../README.md#animation-policy): keep full animation
timing and effects enabled regardless of OS/browser reduced-motion settings
or legacy saved preferences. Do not add motion-based alternatives or suppression
unless the project owner changes that policy.

## Sources and exports

| Asset            | Location / size                                                  | Use                                                            |
| ---------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| Editable master  | `mark.svg`, 1024 square                                          | Transparent cross and ring                                     |
| Original key art | `key-art.png`, 1536 × 1024                                       | Promotional illustration                                       |
| Web assets       | `../../apps/web/public/brand/`                                   | Browser, PWA, sharing                                          |
| App icons        | `icon-192.png`, `icon-512.png`, `icon-1024.png`, `app-icon.svg`  | Rounded desktop / general use                                  |
| Maskable icon    | `icon-512-maskable.png`                                          | Opaque background; essential artwork inside central 80% circle |
| Apple touch icon | `apple-touch-icon.png`, 180 square                               | Full bleed, no alpha channel                                   |
| Store source     | `store-icon-1024.png`                                            | Full bleed, no alpha channel                                   |
| Favicons         | `favicon.svg`, `favicon.ico`, `favicon-16.png`, `favicon-32.png` | Browser tabs; ICO contains 16/32/48 pixel frames               |
| Standalone mark  | `mark.svg`, `mark-1024.png` in public/brand                      | Transparent branding                                           |
| Sharing card     | `social-card.jpg`, 1200 × 630                                    | Open Graph and Twitter card                                    |
| Web illustration | `key-art.webp`, 1200 × 800                                       | Lightweight promotional image                                  |
| Native set       | `../../apps/native/src-tauri/icons/dooz/`                        | ICO, ICNS, PNG, Windows tiles, iOS, Android                    |

Native exports include a separate Android background, transparent foreground,
and monochrome layer for themed icons. iOS exports use the full-bleed source,
with no baked-in rounded corners or alpha channel. Old asset files are retained;
the app configuration references the new `brand/` and `icons/dooz/` sets.

## Regeneration

From `src/`, run `npm run icons`. This renders web assets with Sharp, builds
native formats with the installed Tauri CLI, then finishes iOS exports and
copies launcher resources into existing `gen/android` and `gen/apple` projects.
The mobile initialization scripts already run this command after scaffolding.
Normal builds use committed exports and do not generate images or require AI.

Use `npm run icons --workspace @dooz/web` to refresh only the web outputs.
Edit `mark.svg` for the main artwork. Background composition, the optical
favicon, monochrome geometry, and export sizes live in
`../../apps/web/scripts/generate-icons.mjs`.

Set the existing `VITE_PUBLIC_URL` build variable to the public web app address
for absolute social-preview URLs. Without it, local development uses a relative
image URL. Promotional images and large source exports are not precached for
offline gameplay.

## Review findings addressed

- The root icon command previously consumed an existing 512px web PNG without
  regenerating it. It now rebuilds web and native assets in sequence from the
  editable source and uses a 1024px native master.
- Browser favicons and the raster icon generator previously diverged. One
  command now exports both, with an intentional simplification at tiny sizes.
- Android adaptive artwork now has separate foreground/background and themed
  monochrome assets. Existing scaffolded mobile projects are explicitly synced.
- Sharing metadata now references a dedicated landscape illustration rather
  than relying on a launcher icon or having no preview image.

## Image provenance

Icons are authored SVG, matching the repository's existing vector artwork.
The promotional illustration was generated with the built-in ImageGen tool;
the exact prompt is in [key-art-prompt.txt](key-art-prompt.txt). JPEG/WebP exports
are deterministic resizes of that source. No external stock assets were used.
