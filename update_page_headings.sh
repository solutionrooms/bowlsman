#!/bin/bash

# This script helps identify pages that need to be updated with the new PageHeading component

echo "Searching for page headings in the codebase..."
echo "=============================================="

# Find all h1 and h2 tags with className containing "text-2xl font-bold"
grep -r "className=\"text-2xl font-bold" --include="*.tsx" frontend/app/

echo ""
echo "To update these pages, you need to:"
echo "1. Import the PageHeading component: import PageHeading from '../components/PageHeading';"
echo "2. Import page descriptions: import pageDescriptions from '../utils/pageDescriptions';"
echo "3. Replace the heading tag with the PageHeading component"
echo ""
echo "Example:"
echo "Before: <h1 className=\"text-2xl font-bold\">Page Title</h1>"
echo "After:  <PageHeading title=\"Page Title\" infoText={pageDescriptions.pageKey} />"
echo ""
echo "Make sure to adjust the relative paths for imports based on the file location." 