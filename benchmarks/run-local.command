#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
read -r -s -p 'OpenRouter API key (hidden; used only for this process): ' OPENROUTER_API_KEY
printf '\n'
export OPENROUTER_API_KEY
node benchmarks/run.mjs --live --max-requests 40
unset OPENROUTER_API_KEY
