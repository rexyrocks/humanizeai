# QA record — 14 October 2026

## Verified
- All 16 automated contract tests passed on Node.js 22.20.0.
- The deployable artifact is valid ES-module JavaScript and exports `default.fetch`.
- Local server health returned `{ "ok": true }`.
- Browser: created a project with a research question, edited an adversarial draft containing a percentage, p-value, negation, LaTeX and citation marker.
- Real Crossref search returned 12 records for explainable artificial intelligence in healthcare. Returned metadata and DOI links were displayed, with unavailable abstracts explicitly labeled.
- Saved a returned source, inserted a simplified APA citation and opened manuscript history.
- Reload confirmed that the draft and library source remained in local persistence.
- JSON project backup downloaded. Its content was checked against the persisted test manuscript and one saved source.
- Narrow browser layout showed section navigation and writing settings after a responsive fix. Desktop layout and settings dialog were inspected. No model key was entered.

## Limits
Model integration was exercised with controlled responses only. No paid live LLM calls, editorial-quality comparison, clinical/scientific accuracy benchmark or undetectability evaluation was run. The model review is not a calibrated NLI model. OpenAlex and Semantic Scholar adapters passed fixture tests; live service availability and credentials were not validated. Download initiation and JSON content were verified; Word/PDF round-tripping is outside the MVP. Source claims were not validated against full publications.

## Human evaluation protocol for a future release
Use consenting researchers' passages or appropriately licensed academic samples. Have two blinded editors independently label omitted propositions, changed numerical relationships, uncertainty changes and unsupported additions; adjudicate disagreements. Evaluate exact-span preservation separately from semantic accuracy. Record mode, model identifier, provider, prompts and source version. Include equations, code, abbreviations, repeated references, conflicting findings and mismatched populations. Report precision/recall for detected semantic changes and actual editorial outcomes, with sample sizes and uncertainty. Do not infer scientific safety from a passing unit suite.

## Free model update
Added a default GPT-OSS 120B free OpenRouter preset and an API-key setup link. The 17-test suite verifies that free requests include `max_price` of zero for both prompt and completion tokens and require structured-output-compatible endpoints. Build validation passed. No live model call was made without credentials.
