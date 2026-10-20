# Academic rewriting benchmark

This evaluates the actual `rewritePassage` production engine. The corpus has 12 original synthetic fixtures covering statistical relationships, equations, code, citations, negation, hedging, units, conflicting claims, definitions, absent experimental evidence, sample conditioning and prompt injection. It contains no real research findings or bibliographic claims. The first three cases form a small screening pilot, not a representative quality benchmark.

## Run

From the HumanizeAI repository (Node.js 22+):

```sh
node benchmarks/run.mjs
```

This writes a plan with **zero model calls**. To run live, either open `benchmarks/run-local.command` (the key prompt is hidden), or set `OPENROUTER_API_KEY` securely in your terminal and run:

```sh
node benchmarks/run.mjs --live --max-requests 40
```

Do not paste credentials into chat, commit them, or put them in project backups. Only synthetic fixtures go to OpenRouter. The default pilot uses 3 passages × 4 models × 3 stages = up to 36 initial requests; retries can consume more. A hard cap limits network requests in this invocation, not cumulative account usage. Free quotas and structured-output-compatible endpoints may prevent completion. Failed/unsupported models remain failures in the report rather than being silently replaced.

The suite restricts model IDs to explicit `:free` variants, uses the application's zero-price provider constraints, and never selects paid fallbacks. The default models reflect our shortlist, not a promise of current free-endpoint availability. To test one at a time:

```sh
node benchmarks/run.mjs --live --models openai/gpt-oss-120b:free --out benchmarks/results/gpt-oss
```

Full 12-case run (up to 144 initial requests):

```sh
node benchmarks/run.mjs --live --full --max-requests 150 --out benchmarks/results/full
```

Use a separate output directory for a different corpus/engine or a deliberate repeat. Resuming skips recorded attempts, including failures; choose another output directory to retry failures. A model/engine/corpus combination has a stable trial ID. No fixed seed is sent because the benchmark intentionally preserves the application's actual generation settings. Record independent repeats to measure variability.

## Report interpretation

- `plan.json`: corpus/engine hashes, selected models, request budget and limits.
- `results.json`: actual outputs, HTTP outcomes, stage latency, token usage when returned, requested and served model identifiers, and system acceptance decisions. Keys and authorization headers are never recorded.
- `report.md`: completion counts, exact recognized-span preservation, gate acceptance, median completed latency, and errors. Gate acceptance is **not** factual-accuracy measurement. Failed cases do not disappear from completion denominators.
- `review.md`: anonymized original/revision pairs with invariants for editorial review. Does not show model verdicts.
- `human-labels.json`: pending independent annotations. Existing annotations are not overwritten on resume; newly added trials may need to be appended manually.

Have two editors label meaning, qualifications, scientific values/code/math, citations, and unsupported additions as pass/fail/uncertain; label clarity as improved/unchanged/worse. Compare judgments and adjudicate disagreements before unblinding model identities. Never infer fluency improvement from changed word count or a model approving its own output. Same-model verification has correlated errors. Readability/semantic accuracy have **no reported scores** until independently evaluated.

This benchmark compares the full production pipeline under each model. It is not a pure unguarded model-writing comparison: protected spans and the acceptance gate contribute to outcomes. An unchanged response may pass exact checks while providing no editorial value. The small pilot cannot establish a winner or support broad statistical claims.

## Owner Qwen relay pilot

`node benchmarks/relay-pilot.mjs --out <new-directory>` prepares a zero-call plan. Add `--live` with `QWEN_API_KEY_FILE` set to the owner's private relay-key file to run three synthetic passages through the production engine's Qwen Lounge adapter. It uses the fixed owner endpoint, submits at most nine generation jobs, and stops after the first pipeline failure. No key is written to results. Each pipeline requests JSON in the prompt and validates it locally; constrained decoding is not provided by the relay. Repeated pilots overwrite files in the selected directory, so use a fresh directory for each run.

The conservative engine intentionally keeps recognized sensitive sentences verbatim. Report unchanged outputs separately from useful edits. Passing exact checks and same-model verification does not demonstrate independent semantic accuracy.
