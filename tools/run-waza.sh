#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-}"
FILTER="${2:-${WAZA_SKILL:-}}"

case "$MODE" in
  local|ci)
    ;;
  *)
    printf 'Unsupported or missing mode: %s\n' "$MODE" >&2
    printf 'Expected local or ci.\n' >&2
    exit 2
    ;;
esac

if [[ "$#" -gt 2 ]]; then
  printf 'Usage: %s <local|ci> [skill-or-agent-id]\n' "$0" >&2
  exit 2
fi

WAZA_BIN="${WAZA_BIN:-waza}"
RESULTS_DIR="${WAZA_RESULTS_DIR:-$ROOT_DIR/.work/waza/results}"

if ! command -v "$WAZA_BIN" >/dev/null 2>&1; then
  printf 'Waza executable not found: %s\n' "$WAZA_BIN" >&2
  exit 1
fi

mkdir -p "$RESULTS_DIR"
eval_failed=0
eval_count=0

while IFS= read -r eval_spec; do
  if [[ -n "$FILTER" && "$eval_spec" != *"/tests/$FILTER/waza/eval.yaml" && "$eval_spec" != *"/waza/$FILTER/eval.yaml" && "$eval_spec" != *"/skills/$FILTER/waza/eval.yaml" ]]; then
    continue
  fi
  eval_count=$((eval_count + 1))
  printf 'Running Waza eval: %s\n' "$eval_spec"
  waza_args=(run "$eval_spec" --no-cache --output-dir "$RESULTS_DIR")
  if [[ "$eval_spec" == *"/tests/dotnet-quality/waza/"* ]]; then
    waza_args+=(--context-dir "$ROOT_DIR/.github/agents")
  fi
  if ! WAZA_NO_UPDATE_CHECK=1 "$WAZA_BIN" "${waza_args[@]}"; then
    eval_failed=1
  fi
done < <(find "$ROOT_DIR/tests" -type f \( -path '*/waza/eval.yaml' -o -path '*/waza/*/eval.yaml' \) -print | sort)

if [[ "$eval_count" -eq 0 ]]; then
  if [[ -n "$FILTER" ]]; then
    printf 'No Waza eval found for: %s\n' "$FILTER" >&2
  else
    printf 'No Waza eval files found under tests/.\n' >&2
  fi
  exit 2
fi

exit "$eval_failed"