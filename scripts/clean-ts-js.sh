#!/usr/bin/env bash
set -euo pipefail

# Find all .ts files (except .d.ts) and delete matching .js and .js.map
find . -type f -name '*.ts' ! -name '*.d.ts' -print0 |
  while IFS= read -r -d '' tsfile; do
    jsfile="${tsfile%.ts}.js"
    mapfile="${tsfile%.ts}.js.map"

    if [[ -f "$jsfile" ]]; then
      echo "Deleting $jsfile"
      rm "$jsfile"
    fi

    if [[ -f "$mapfile" ]]; then
      echo "Deleting $mapfile"
      rm "$mapfile"
    fi
  done