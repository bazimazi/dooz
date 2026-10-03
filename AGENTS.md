# Contributor instructions

## Animation policy

Always keep the full animation experience on web, PWA, desktop, and mobile.
Ignore OS/browser reduced-motion preferences and any legacy `reducedMotion`
value in saved preferences. Do not introduce `prefers-reduced-motion` rules,
`motion-reduce`/`motion-safe` utilities, motion preference detection, or a
reduced-motion toggle unless the user explicitly changes this policy.
Keep animation timing, view transitions, decorative effects, and result
reveal delays consistent regardless of device motion settings.
See [README.md](README.md#animation-policy) for the project policy; browser
audits should verify that full animations remain enabled with the device
preference set to `reduce`.
