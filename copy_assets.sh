#!/bin/bash
set -eo pipefail

srcDir="src"
destDir="built"

copyFiltered() {
  # macOS ships Bash 3.2, which does not support `mapfile`.
  # Use a null-delimited read loop instead so the script works on both macOS and Linux.
  while IFS= read -r -d '' path; do
    destPath="${path/$srcDir/$destDir}"
    mkdir -p "$(dirname "$destPath")"
    cp "$path" "$destPath"
  done < <(find "$srcDir" \( -type f \( -name "*.csv" -o -name "*.json" \) \) -print0)
}

copyFiltered

echo "Selective copy completed!"
