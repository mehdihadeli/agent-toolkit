#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${VALLY_ENV_FILE:-$ROOT_DIR/.env}"
EXECUTOR="${1:-}"
MODE="${2:-}"

if [[ "$#" -gt 0 ]]; then
  shift
fi
if [[ "$#" -gt 0 ]]; then
  shift
fi

case "$MODE" in
  ci)
    printf 'CI mode; using exported variables.\n'
    ;;
  local)
    if [[ ! -f "$ENV_FILE" ]]; then
      printf 'Missing environment file: %s\n' "$ENV_FILE" >&2
      printf 'Create .env locally or set VALLY_ENV_FILE.\n' >&2
      exit 1
    fi
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
    ;;
  *)
    printf 'Unsupported or missing mode: %s\n' "$MODE" >&2
    printf 'Expected local or ci.\n' >&2
    exit 2
    ;;
esac

case "$EXECUTOR" in
  copilot-sdk)
    if [[ -z "${COPILOT_GITHUB_TOKEN:-}" && -z "${OPENAI_API_KEY:-}" ]]; then
      printf 'One Copilot credential is required: COPILOT_GITHUB_TOKEN or OPENAI_API_KEY\n' >&2
      exit 1
    fi
    ;;
  claude-cli)
    if [[ -z "${ANTHROPIC_API_KEY:-}" && -z "${ANTHROPIC_AUTH_TOKEN:-}" ]]; then
      printf 'One Claude credential is required: ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN\n' >&2
      exit 1
    fi
    ;;
  *)
    printf 'Unsupported or missing executor: %s\n' "$EXECUTOR" >&2
    printf 'Expected copilot-sdk or claude-cli.\n' >&2
    exit 2
    ;;
esac

if [[ "$#" -ne 0 ]]; then
  printf 'Usage: %s <executor> <local|ci>\n' "$0" >&2
  exit 2
fi

VALLY_COMMAND="${VALLY:-node ./node_modules/@microsoft/vally-cli/dist/index.js}"
read -r -a VALLY_ARGS <<< "$VALLY_COMMAND"
VALLY_SUITE="${VALLY_SUITE:-plugin-evals}"
VALLY_RUNS="${VALLY_RUNS:-1}"
VALLY_WORKERS="${VALLY_WORKERS:-1}"
VALLY_PROCESSES="${VALLY_PROCESSES:-4}"
if [[ "$EXECUTOR" == "claude-cli" ]]; then
  OUTPUT_DIR=.work/vally/results/claude
else
  OUTPUT_DIR=.work/vally/results/copilot
fi

if [[ "$EXECUTOR" == "copilot-sdk" && -z "${COPILOT_CLI_PATH:-}" ]]; then
  if [[ -f "$ROOT_DIR/node_modules/@github/copilot-win32-x64/copilot.exe" ]]; then
    COPILOT_CLI_PATH="$ROOT_DIR/node_modules/@github/copilot-win32-x64/copilot.exe"
  elif [[ -x "$ROOT_DIR/node_modules/@github/copilot-linux-x64/copilot" ]]; then
    COPILOT_CLI_PATH="$ROOT_DIR/node_modules/@github/copilot-linux-x64/copilot"
  elif [[ -x "$ROOT_DIR/node_modules/@github/copilot-darwin-arm64/copilot" ]]; then
    COPILOT_CLI_PATH="$ROOT_DIR/node_modules/@github/copilot-darwin-arm64/copilot"
  fi
  export COPILOT_CLI_PATH
fi

run_eval() {
  local eval_spec="$1"
  local output_dir="$2"
  local arguments=(eval --executor "$EXECUTOR")

  if [[ "$EXECUTOR" == "claude-cli" ]]; then
    arguments+=(--executor-plugin "$ROOT_DIR/tools/vally-executor-claude")
  fi

  if [[ -n "$eval_spec" ]]; then
    arguments+=(--eval-spec "$eval_spec")
  else
    arguments+=(--suite "$VALLY_SUITE")
  fi

  arguments+=(--output-dir "$output_dir" --runs "$VALLY_RUNS" --workers "$VALLY_WORKERS")
  "${VALLY_ARGS[@]}" "${arguments[@]}"
}

if [[ "$EXECUTOR" == "copilot-sdk" && -z "${VALLY_EVAL_SPEC:-}" && "$VALLY_SUITE" == "plugin-evals" ]]; then
  run_eval_spec() {
    local eval_spec="$1"
    local eval_id
    eval_id="$(printf '%s' "$eval_spec" | sed 's#[/\\\\]#_#g; s#\.yaml$##')"
    run_eval "$eval_spec" "$OUTPUT_DIR/$eval_id"
  }

  pids=()
  while IFS= read -r eval_spec; do
    run_eval_spec "$eval_spec" & pids+=("$!")
    while [[ "${#pids[@]}" -ge "$VALLY_PROCESSES" ]]; do
      wait "${pids[0]}"
      pids=("${pids[@]:1}")
    done
  done < <(find "$ROOT_DIR/tests" -type f -name eval.yaml -print | sort)
  for pid in "${pids[@]}"; do wait "$pid"; done
else
  run_eval "${VALLY_EVAL_SPEC:-}" "$OUTPUT_DIR"
fi
