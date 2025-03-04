#!/bin/bash

echo "=== Creating a script to fix localStorage access in all pages ==="

# List of files to check and fix
FILES=$(grep -r "localStorage" frontend/app/ --include="*.tsx" | grep -v "mounted" | grep -v "components" | cut -d':' -f1 | sort | uniq)

echo "Files that need to be fixed:"
echo "$FILES"

# Create a temporary directory for modified files
mkdir -p temp_fixed_files

for file in $FILES; do
  echo "Processing $file..."
  
  # Check if the file already has a mounted state
  if grep -q "const \[mounted, setMounted\] = useState(false);" "$file"; then
    echo "  File already has mounted state"
  else
    echo "  Adding mounted state to $file"
    # Add mounted state after the first useState
    sed -i.bak '/useState/a\
  const [mounted, setMounted] = useState(false);' "$file"
  fi
  
  # Check if the file already has a useEffect for mounted
  if grep -q "useEffect(() => {\n    setMounted(true);" "$file"; then
    echo "  File already has useEffect for mounted"
  else
    echo "  Adding useEffect for mounted to $file"
    # Add useEffect after the router declaration
    sed -i.bak '/const router/a\
\
  useEffect(() => {\
    setMounted(true);\
  }, []);' "$file"
  fi
  
  # Update all localStorage access to check for mounted state
  echo "  Updating localStorage access in $file"
  sed -i.bak 's/localStorage\.getItem/if (mounted) localStorage.getItem/g' "$file"
  sed -i.bak 's/localStorage\.setItem/if (mounted) localStorage.setItem/g' "$file"
  sed -i.bak 's/localStorage\.removeItem/if (mounted) localStorage.removeItem/g' "$file"
  
  # Clean up backup files
  rm -f "$file.bak"
done

echo "=== Done! ==="
echo "Please review the changes manually to ensure they are correct." 