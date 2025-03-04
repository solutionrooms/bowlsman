#!/bin/bash

# Script to fix axios import paths across the frontend application

# Map of directories to their correct import paths
declare -A import_paths=(
  ["frontend/app/club/"]="../../../src/lib/axios"
  ["frontend/app/competition/"]="../../../src/lib/axios"
  ["frontend/app/components/"]="../../src/lib/axios"
  ["frontend/app/home/"]="../../src/lib/axios"
  ["frontend/app/admin/"]="../../src/lib/axios"
  ["frontend/app/profile/"]="../../src/lib/axios"
  ["frontend/app/"]="../src/lib/axios"
)

# Fix import paths in files
for dir in "${!import_paths[@]}"; do
  correct_path="${import_paths[$dir]}"
  echo "Fixing imports in $dir..."
  
  # Find files with api imports in this directory
  files=$(grep -r "import api from .*src/lib/axios" --include="*.tsx" --include="*.ts" "$dir")
  
  if [ -z "$files" ]; then
    echo "No files with axios imports found in $dir"
  else
    echo "Found files with axios imports:"
    echo "$files"
    echo ""
    
    # Update import paths
    find "$dir" -type f -name "*.tsx" -o -name "*.ts" | xargs sed -i '' -E "s|import api from ['\"].*src/lib/axios['\"]|import api from '$correct_path'|g"
  fi
  
  echo ""
done

echo "All import paths have been updated." 