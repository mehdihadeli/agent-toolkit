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
      printf 'Environment file not found: %s; using exported variables.\n' "$ENV_FILE"
    else
      while IFS= read -r env_line || [[ -n "$env_line" ]]; do
        if [[ "$env_line" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*= ]]; then
          env_name="${BASH_REMATCH[2]}"
          if [[ ! -v "$env_name" ]]; then
            env_value="${env_line#*=}"
            env_value="${env_value#"${env_value%%[![:space:]]*}"}"
            env_value="${env_value%"${env_value##*[![:space:]]}"}"
            if [[ "${env_value:0:1}" == '"' && "${env_value: -1}" == '"' ]] ||
              [[ "${env_value:0:1}" == "'" && "${env_value: -1}" == "'" ]]; then
              env_value="${env_value:1:${#env_value}-2}"
            fi
            printf -v "$env_name" '%s' "$env_value"
            export "$env_name"
          fi
        fi
      done < "$ENV_FILE"
    fi
    ;;
  *)
    printf 'Unsupported or missing mode: %s\n' "$MODE" >&2
    printf 'Expected local or ci.\n' >&2
    exit 2
    ;;
esac

export LOG_LEVEL="${LOG_LEVEL:-debug}"

case "$EXECUTOR" in
  copilot-sdk)
    if [[ -z "${COPILOT_GITHUB_TOKEN:-}" && -z "${OPENAI_API_KEY:-}" ]]; then
      printf 'One Copilot credential is required: COPILOT_GITHUB_TOKEN or OPENAI_API_KEY\n' >&2
      exit 1
    fi
    ;;
  claude-cli|claude-cli-default)
    if [[ -z "${ANTHROPIC_API_KEY:-}" && -z "${ANTHROPIC_AUTH_TOKEN:-}" ]]; then
      printf 'One Claude credential is required: ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN\n' >&2
      exit 1
    fi
    if [[ -z "${ANTHROPIC_BASE_URL:-}" ]]; then
      printf 'ANTHROPIC_BASE_URL is required for Claude evaluations.\n' >&2
      exit 1
    fi
    if [[ -z "${ANTHROPIC_MODEL:-}" ]]; then
      printf 'ANTHROPIC_MODEL is required for Claude evaluations.\n' >&2
      exit 1
    fi
    ;;
  *)
    printf 'Unsupported or missing executor: %s\n' "$EXECUTOR" >&2
    printf 'Expected copilot-sdk or claude-cli.\n' >&2
    exit 2
    ;;
esac

if [[ "$EXECUTOR" == "copilot-sdk" ]]; then
  printf 'Copilot preflight: mode=%s, OPENAI_API_KEY=%s, COPILOT_GITHUB_TOKEN=%s\n' \
    "$MODE" \
    "$(if [[ -n "${OPENAI_API_KEY:-}" ]]; then printf present; else printf absent; fi)" \
    "$(if [[ -n "${COPILOT_GITHUB_TOKEN:-}" ]]; then printf present; else printf absent; fi)"
  if [[ -n "${COPILOT_CLI_PATH:-}" && ! -f "$COPILOT_CLI_PATH" ]]; then
    printf 'COPILOT_CLI_PATH does not exist: %s\n' "$COPILOT_CLI_PATH" >&2
    exit 1
  fi
  if [[ "${VALLY_PREFLIGHT_ONLY:-0}" == "1" ]]; then
    printf 'Copilot preflight: passed.\n'
    exit 0
  fi
fi

if [[ "$#" -ne 0 ]]; then
  printf 'Usage: %s <executor> <local|ci>\n' "$0" >&2
  exit 2
fi

VALLY_COMMAND="${VALLY:-node ./node_modules/@microsoft/vally-cli/dist/index.js}"
read -r -a VALLY_ARGS <<< "$VALLY_COMMAND"
VALLY_SUITE="${VALLY_SUITE:-plugin-evals}"
VALLY_RUNS="${VALLY_RUNS:-1}"
VALLY_WORKERS="${VALLY_WORKERS:-1}"
VALLY_PROCESSES=1
if [[ "$EXECUTOR" == "claude-cli" || "$EXECUTOR" == "claude-cli-default" ]]; then
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
  local arguments=(eval)

  if [[ "$EXECUTOR" == "claude-cli" || "$EXECUTOR" == "claude-cli-default" ]]; then
    arguments+=(--executor-plugin "$ROOT_DIR/tools/vally-executor-claude")
  fi

  if [[ "$EXECUTOR" != "claude-cli-default" ]]; then
    arguments+=(--executor "$EXECUTOR")
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

  eval_failed=0
  while IFS= read -r eval_spec; do
    if ! run_eval_spec "$eval_spec"; then
      eval_failed=1
    fi
  done < <(find "$ROOT_DIR/tests" -type f -name eval.yaml -print | sort)
  if [[ "$eval_failed" -ne 0 ]]; then
    exit 1
  fi
else
  run_eval "${VALLY_EVAL_SPEC:-}" "$OUTPUT_DIR"
fi
