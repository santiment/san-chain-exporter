#!/bin/bash
set -eo pipefail

srcDir="src"
destDir="built"

copyFiltered() {
  local srcDir="$1"
  local destDir="$2"

  # Find and copy .csv and .json files
  find "$srcDir" -type f -name "*.csv" -exec cp {} "$destDir" \;
  find "$srcDir" -type f -name "*.json" -exec cp {} "$destDir" \;
}

# Start the copy process
copyFiltered "$srcDir" "$destDir"

echo "Selective copy completed!"
