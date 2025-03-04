#!/bin/bash

echo "=== Checking for Navigation component usage ==="
grep -r "import Navigation from" frontend/app/ --include="*.tsx"

echo -e "\n=== Checking for pages using <Navigation> without onLogout ==="
grep -r "<Navigation" frontend/app/ --include="*.tsx" | grep -v "onLogout"

echo -e "\n=== Checking for direct localStorage access without mounted state ==="
grep -r "localStorage" frontend/app/ --include="*.tsx" | grep -v "mounted" | grep -v "components"

echo -e "\n=== Checking for useEffect without dependency on mounted ==="
grep -r "useEffect" frontend/app/ --include="*.tsx" | grep -v "mounted" | grep -v "components" | grep -v "Dashboard"

echo -e "\n=== Done! ==="
echo "Fix any pages that use Navigation without onLogout or access localStorage without checking mounted state first" 