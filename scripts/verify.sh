#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo ">>> Backend: gradle compile + test"
./gradlew --no-daemon compileJava compileTestJava test

echo ">>> Frontend: vue-tsc + vitest"
pushd frontend >/dev/null
npx vue-tsc --noEmit
npx vitest run
popd >/dev/null

echo "verify passed"
