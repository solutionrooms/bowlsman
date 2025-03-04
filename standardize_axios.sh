#!/bin/bash

# Script to standardize axios imports across the frontend application

# Find files with direct axios imports and local configurations
echo "Finding files with local axios configurations..."
files=$(grep -r "axios.create" --include="*.tsx" --include="*.ts" ./frontend/app)

if [ -z "$files" ]; then
  echo "No more files with local axios configurations found."
else
  echo "Found files with local axios configurations:"
  echo "$files"
  echo ""
  echo "Please update these files manually to use the shared axios module."
fi

# Find files with incorrect import paths
echo "Finding files with incorrect import paths..."
incorrect_imports=$(grep -r "import api from .*src/lib/axios" --include="*.tsx" --include="*.ts" ./frontend)

if [ -z "$incorrect_imports" ]; then
  echo "No files with incorrect import paths found."
else
  echo "Found files with incorrect import paths:"
  echo "$incorrect_imports"
  echo ""
  echo "Please verify that these import paths are correct relative to the file location."
fi

# Detect duplicate axios.ts files
echo "Checking for duplicate axios configuration files..."
axios_files=$(find ./frontend -path "*/src/lib/axios.ts")
count=$(echo "$axios_files" | wc -l)

if [ "$count" -gt 1 ]; then
  echo "Warning: Found multiple axios configuration files:"
  echo "$axios_files"
  echo ""
  echo "You should consolidate these into a single shared module."
else
  echo "Good: Only one axios configuration file found."
  echo "$axios_files"
fi

echo ""
echo "Standardization check complete." 