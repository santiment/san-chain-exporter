#!/bin/bash
set -eo pipefail

srcDir="src"
destDir="built"

copyFiltered() {
  mapfile -d '' filesToBeCopied < <(find "$srcDir" \( -type f \( -name "*.csv" -o -name "*.json" \) \) -print0)

  for path in "${filesToBeCopied[@]}"; do
    destPath="${path/$srcDir/$destDir}"
    mkdir -p "$(dirname "$destPath")"
    cp "$path" "$destPath"
  done
}

copyFiltered

echo "Selective copy completed!"
