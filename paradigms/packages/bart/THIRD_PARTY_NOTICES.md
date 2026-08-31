# BART package notices

This teaching package was adapted from the public Pavlovia BART demo:

- Source: https://gitlab.pavlovia.org/demos/bart
- Source commit: `512afc3d86db22c3a357c21728d4947f31bbac14`
- The source repository did not contain a standalone root license file when this package was prepared. Pavlovia documents its public demos as materials users may download, fork, and modify. This notice records provenance without claiming that the demo code itself is MIT-licensed.

Local changes include removing the participant dialog and Pavlovia result-save flow, translating learner-facing text, loading all runtime assets locally, and sending per-balloon results to the teaching platform with the `cognition-lab:complete` event. The source repository's `data/` directory and historical result files were not included.

The package manifest records a reviewed network exception because the unmodified PsychoJS runtime bundle contains dormant server-management methods that trigger the platform's static scanner. The adapted BART task uses those APIs only to load files from this local package and does not call the PsychoJS upload or save flow.

Bundled runtime libraries retain their own licenses:

- PsychoJS 2023.2.2 — MIT License; see `vendor/licenses/PSYCHOJS-LICENSE.md`.
- jQuery 3.6.0 — MIT License; see `vendor/licenses/JQUERY-LICENSE.txt`.
- jQuery UI 1.12.1 — MIT License; see `vendor/licenses/JQUERY-UI-LICENSE.txt`.
- PreloadJS 1.0.1 — MIT License; see `vendor/licenses/PRELOADJS-LICENSE.txt`.

The BART task is based on Lejuez et al. (2002), DOI: 10.1037/1076-898X.8.2.75.
