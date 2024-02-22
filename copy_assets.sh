#!/bin/bash

# Define source and destination directories
srcDir="src"
destDir="built"

# Function to copy .csv and .json files
copyFiltered() {
  local srcDir="$1"
  local destDir="$2"

  # Create destination directory if it does not exist
  mkdir -p "$destDir"

  # Read all files and directories within current directory
  local filesAndDirs=("$srcDir"/*)

  for path in "${filesAndDirs[@]}"; do
    if [ -d "$path" ]; then
      # If it's a directory, get basename for the new directory in destination
      local baseDir
      baseDir=$(basename "$path")
      # Create corresponding directory in destination and recurse
      copyFiltered "$path" "$destDir/$baseDir"
    else
      # Check file extension
      case $(basename "$path") in
        *.csv|*.json)
          # Copy matched file
          cp "$path" "$destDir"
          ;;
        *)
          # Ignore file
          ;;
      esac
    fi
  done
}

# Start the copy process
copyFiltered "$srcDir" "$destDir"

echo "Selective copy completed!"
