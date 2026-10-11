# Contributor instructions

## Animation policy

Keep the full animation experience by default on web, PWA, desktop, and mobile.
Users may explicitly choose Low, Balanced, or High graphics in Settings.
Low uses static visuals and removes costly effects; Balanced keeps gameplay
animations with simpler decoration; High preserves the full experience.
Ignore OS/browser reduced-motion preferences and any legacy `reducedMotion`
value in saved preferences. Do not introduce `prefers-reduced-motion` rules,
`motion-reduce`/`motion-safe` utilities, motion preference detection, or a
reduced-motion toggle unless the user explicitly changes this policy.
Keep graphics quality, animation timing, view transitions, decorative effects,
and result reveal delays independent of device motion settings. Only the user's
explicit graphics choice may change them.
See [README.md](README.md#animation-policy) for the project policy; browser
audits should verify that full animations remain enabled with the device
preference set to `reduce`.
