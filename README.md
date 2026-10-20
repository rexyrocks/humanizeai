# HumanizeAI — BYOK beta

Fast academic rewriting with exact checks, optional detailed review, and browser-local drafts. Bring your own supported provider key. The hosted beta preserves its existing owner-private audience.

## Start

1. Open Writing settings, choose a provider and model, and enter your own key. Keys are session-only.
2. Paste your own passage or load the synthetic example.
3. Read the sharing consent. Fast mode uses one model call; detailed mode uses three. Fully protected passages can return unchanged without calls.
4. Compare the proposal with your original before accepting. Export project backups regularly.

Your passage, context and optional sample pass through this app to your selected provider after consent. Drafts/history remain unencrypted in this browser and are not synced. Search queries go to the selected scholarly service. Provider costs, quotas and retention apply. No detector-bypass, plagiarism or factual-accuracy guarantee is offered.

## Original implementation notes — Academic Research Studio

A functional, single-user MVP with real scholarly API adapters and a real, credential-configured LLM pipeline. No model response is simulated in the application. Read [research and architecture](docs/RESEARCH.md) before extending it.

## Run locally
Requires Node.js 22 or newer. There are no package dependencies and no local model.

```sh
npm run dev
```

Open http://127.0.0.1:4173. The server binds only to loopback. First launch starts with an empty manuscript, not invented research.

1. Create a research project and record the research question under Context.
2. Discover research using Crossref (no key required), OpenAlex or Semantic Scholar. Save actual records to the project library and read their linked publications.
3. Write or paste supplied research into a section. Formatting, tables and literal `$LaTeX$` expressions are supported; equations are not rendered.
4. In Writing settings, click **Use free GPT-OSS 120B**, create a free OpenRouter API key through the provided link, paste it, and apply settings. The free preset runs the open-weight `openai/gpt-oss-120b:free` remotely, with no local model download. Free quotas and provider availability apply. Requests enforce zero-price endpoints and never substitute a paid model. You can also supply an OpenAI or OpenRouter API key and a custom model ID that supports strict JSON-schema Chat Completions. Keys and optional writing samples stay in page memory and disappear on reload.
5. Select a passage or refine the current section. Select a mode and explicitly consent to sharing it with the provider.
6. Review the word diff, semantic ledger and verification notes. Acceptance is blocked for detected changes, uncertainty, omitted terms or missing protected spans. Manual proposal edits must be revalidated. Acceptance affects the selected passage or section; full-section replacement converts that section to plain text.
7. Export Markdown, formatted HTML, a complete JSON backup or BibTeX. The source library also exports an evidence inventory CSV with abstract/metadata scope and your own reading notes.

Fast rewriting uses one model call with exact preservation checks. Optional detailed review uses three sequential calls: analysis, revision, and same-model semantic review. Validating an edited proposal uses two calls. Model provider availability, fees and retention policies are external. No authorship detector or undetectability claim is used.

## Optional server environment

| Variable | Purpose |
|---|---|
| `PORT` | Local port (default 4173) |
| `LLM_API_KEY` | Reserved for private direct-engine integrations; hosted API requires a session key |
| `LLM_MODEL` | Server default model for API clients |
| `OPENALEX_API_KEY` | Scholarly service key when required |
| `SEMANTIC_SCHOLAR_API_KEY` | Scholarly service key / quota |
| `CROSSREF_MAILTO` | Operator email for Crossref polite pool |

The hosted browser/API workflow requires the user’s session key and does not draw on a shared server secret. Use an OS secret manager or hosting secret store. Do not put secrets in project JSON, source files or the hosting manifest. Model destinations are allowlisted (OpenAI, OpenRouter, and the fixed owner Qwen Lounge relay); add new provider adapters deliberately rather than allowing arbitrary proxy URLs.

## Verification

```sh
npm test
npm run build
npm run validate
```

17 deterministic tests use controlled API responses. They cover protected tokens, math, code, repeated citations, omission, negation/causality review gates, consent, structured response validation, bibliographic adapters, BibTeX escaping and server protections. They are contract tests, not editorial-quality benchmarks. No live LLM evaluation was run without credentials.

Browser QA exercised project creation, draft editing, real Crossref search, source saving, citation insertion, history, persistence, responsive navigation and export. See [QA record](docs/QA.md) for verified scope and limitations.

## Data, privacy and retention
Documents, source notes and up to 40 history snapshots per project persist unencrypted in this browser. Export JSON backups; clearing browser storage can erase drafts. Deleting a project removes its local drafts, sources and history. History restoration first saves the current draft. The server holds manuscripts only in request memory and does not log or cache them. Search metadata is cached for five minutes (at most roughly 100 queries per process). Providers receive search queries; a model receives passage, semantic ledger, project question, notes and bounded section context only with consent. Researcher Voice additionally sends the optional writing sample.

External providers control their own retention; local deletion does not erase a provider's records. The hosted app is owner-private. Local deployment has no built-in user authentication and must remain loopback-only. Per-isolate rate limiting is a best-effort guard, not a distributed production quota. Production multi-user release requires authorization, durable storage, distributed limits, spend caps, monitoring and provider-policy review.

## Implemented and deferred
Implemented: five rewriting modes, sample conditioning, structured three-stage pipeline, hard preservation gate, separate semantic reviewer, side-by-side word diff, accept/reject/edit/revalidate, selected-text rewriting, project/section organization, basic rich formatting, draft history, local autosave, contextual notes, real Crossref/OpenAlex/Semantic Scholar search, saved papers, citation insertion, simplified APA/IEEE references, BibTeX, Markdown/HTML/JSON exports, CSV evidence inventory, plain text/Markdown and backup import, diagnostics, themes and focus mode.

Not implemented: full-text retrieval and automated literature synthesis, PDF/DOCX ingestion or export, rendered equations, full CSL citation formatting, BibTeX import, calibrated embedding/NLI models, reusable trained author profiles, PostgreSQL/pgvector, cloud synchronization, collaborative editing and cross-document research reasoning. The evidence table is an inventory plus user notes, not automated extraction of methods/findings. No original experiments or contributions are generated. These are Version 2/3 roadmap items, not placeholder endpoints.

## Source layout
- `src/core.js`: preservation, prompts, schemas, model and scholarly adapters.
- `src/app.js`, `src/page.html`: editor, projects, review and sources.
- `src/server.js`: same-origin API routing and safe errors.
- `scripts/assemble.mjs`: packages source into a self-contained Worker.
- `scripts/dev.mjs`: dependency-free Node preview.
- `worker/index.js`: generated deployable module; edit `src/` then rebuild.
- `.openai/hosting.json`: private Site identity.

Architecture deliberately uses a small Worker and browser persistence rather than the suggested Next.js/FastAPI/PostgreSQL stack for this first increment. The research report documents the migration path and trade-offs.

## Model benchmarking

See [benchmark instructions](benchmarks/README.md). `npm run benchmark` creates a plan without calling models. The pilot compares three synthetic passages across four free-model candidates using the production pipeline. Run `bash benchmarks/run-local.command` to enter an OpenRouter key at a hidden local prompt and begin a capped live run. Output includes exact checks, latency/errors, model-review decisions and blinded human review forms. No scientific-accuracy winner is reported without independent review. Live benchmarking is currently blocked by missing credentials; zero live model requests have been made.

## Conservative preservation update (20 October 2026)

Display equations and literal dollar-sign replacement sequences now restore verbatim. Recognized sentences containing negation, uncertainty, confounding, equivalence, or sensitivity/specificity definitions are masked as complete spans and checked verbatim after rewriting. Ordinary surrounding prose remains editable. This deliberately trades editing freedom for preservation; sentence recognition is an English heuristic and does not establish semantic accuracy for every claim. Independent review and live quality benchmarking remain necessary.

## Owner Qwen relay

Writing settings now supports **Qwen Lounge (owner relay)** with fixed model `@cf/qwen/qwen3.8-27b`. This calls only `https://qwen-lounge.piyochoudhary.workers.dev`, via authenticated jobs and polling; it does not use an Alibaba/DashScope key. The existing relay chooses its backend. No inference fallback is used. JSON is requested in the prompt and validated locally; the relay does not enforce constrained decoding. Its 768-token completion cap can truncate complex responses. Keep the private relay key out of public builds and use session-only settings or a server secret. The relay's free quota is shared with other projects.

Run the three-case synthetic pilot with `QWEN_API_KEY_FILE` pointing to the existing private key file and `node benchmarks/relay-pilot.mjs --live --out <new-results-directory>`. Omit `--live` for a plan with zero calls. At most nine generation jobs are submitted; it stops at the first failure. Results do not contain credentials.

## Repetition reduction and comparison (20 October 2026)

Passages consisting entirely of protected markers and punctuation return the original text locally, with `review_source: local_identity`, an explicit no-model-review notice, and zero provider calls. This is preservation, not an improved rewrite. For other passages, the rewrite instruction explicitly prohibits expanding, reconstructing or restating protected content. The UI distinguishes local identity preservation from model review.

`benchmarks/compare-relay.mjs` compares three synthetic passages with a one-call plain Qwen rewrite using the same model and rewrite instructions but no protection, analysis or verification pipeline. It is a controlled baseline, not a ChatGPT product comparison. Set `COMPARISON_OUT` to a fresh directory for a plan; add `COMPARISON_LIVE=1` and a private `QWEN_API_KEY_FILE` to run at most nine generation jobs. It creates randomized anonymous pairs and a separate identity map for real-reader review. No preference ratings are fabricated.

## Release verification — 20 October 2026

34 automated checks passed. Browser QA covered project creation, sample loading, consent rejection, missing-key setup, provider selection, draft persistence, key clearing on reload, and history. A real Qwen fast rewrite completed in one generation (about 4.2 seconds), with zero exact-check issues. The production build and generated Worker validate. This is a small BYOK beta, not a funded shared inference service or a proven superior humanizer. Public audience expansion is a separate choice; this release preserves existing access.
