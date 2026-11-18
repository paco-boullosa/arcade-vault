#!/bin/bash
# PostToolUse hook: Prettier + ESLint sobre el archivo creado/editado (solo Arcade Vault).
f=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')
[ -z "$f" ] && exit 0
[ -f "$f" ] || exit 0
root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
case "$f" in
  "$root"/node_modules/*|"$root"/.next/*|"$root"/references/*|"$root"/demos/*) exit 0 ;;
  "$root"/*) ;;
  *) exit 0 ;;
esac
cd "$root" || exit 0
npx prettier --write --ignore-unknown "$f" >/dev/null 2>&1
case "$f" in
  *.js|*.jsx|*.ts|*.tsx|*.mjs|*.cjs)
    out=$(npx eslint --fix "$f" 2>&1) || { echo "$out" >&2; exit 2; }
    ;;
esac
exit 0
