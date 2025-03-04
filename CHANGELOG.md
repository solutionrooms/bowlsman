# Changelog

## [Unreleased]

### Added
- Created `FRONTEND_STANDARDS.md` with documentation on frontend coding standards
- Added maintenance scripts:
  - `check_navigation.sh`: Checks for consistent Navigation component usage
  - `fix_localstorage.sh`: Fixes localStorage access to prevent SSR errors
  - `standardize_axios.sh`: Standardizes axios imports and configurations
- Added placeholder pages for upcoming features:
  - `/bowlers`: Placeholder for bowler profiles and management
- Added "Create Competition" button to the competition management page
- Added club selection dropdown to the competition creation form
- Added club selector to the competition management page for multi-club users
- Added alternative backend endpoint for club switching

### Changed
- Standardized Navigation component across all pages:
  - Updated to use `onLogout` prop instead of `isStaff`
  - Added proper logout functionality to all pages
- Fixed localStorage access to prevent errors during server-side rendering:
  - Added mounted state to all components that access localStorage
  - Guarded all localStorage access with mounted state checks
- Fixed axios import paths across the codebase
- Created dashboard page that redirects to home page
- Updated navigation links to point to home instead of dashboard
- Changed "Games" menu option to "Competitions" and linked it to the competition management page
- Fixed backend URL configuration to properly include all API endpoints
- Improved axios interceptor to handle API URL prefixes correctly
- Simplified backend API routing structure
- Improved competition creation workflow to include club selection
- Improved club-based filtering to only show club-specific competitions and players
- Enhanced club switching with graceful fallback when API requests fail
- Improved club switching robustness with multiple API endpoints

### Fixed
- Fixed "Module not found" error related to axios imports
- Fixed server-side rendering errors related to localStorage access
- Fixed 404 error when accessing dashboard link
- Fixed 404 error when accessing games and bowlers pages
- Fixed Navigation component props to use onLogout consistently 
- Fixed login API endpoint connection reset error by correcting import paths
- Fixed club management page 404 error by properly registering club API endpoints
- Fixed login API request error caused by duplicate 'api/' prefix in URLs
- Fixed missing LogoutView implementation in backend API
- Fixed backend startup errors related to URL configuration
- Fixed the "Delete Schedule" functionality for competitions by properly registering the API endpoint
- Fixed "Failed to create competition" error by including club ID in the request
- Fixed "Failed to create schedule" error by correcting URL configuration
- Fixed club switching functionality by correcting HTTP method in API endpoint
- Fixed club switching in all components (Navigation, Login, Profile) to use the correct HTTP method
- Fixed corrupted Navigation component that was causing compilation errors
- Fixed "Not Found" error when changing clubs by implementing client-side fallback
- Fixed club switching backend with dedicated endpoint implementation 