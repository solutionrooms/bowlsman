# Frontend Standards

This document outlines the standards and best practices for the frontend codebase.

## Navigation Component

The Navigation component has been standardized across all pages to ensure consistent user experience and functionality.

### Usage

```tsx
<Navigation onLogout={handleLogout} />
```

### Implementation

Every page that includes the Navigation component should:

1. Import the Navigation component:
   ```tsx
   import Navigation from '../components/Navigation';
   ```

2. Implement a `handleLogout` function:
   ```tsx
   const handleLogout = () => {
     if (mounted) {
       localStorage.removeItem('token');
       router.push('/');
     }
   };
   ```

3. Pass the `handleLogout` function to the Navigation component:
   ```tsx
   <Navigation onLogout={handleLogout} />
   ```

## LocalStorage Access

To prevent errors during server-side rendering, all localStorage access should be guarded by a mounted state check.

### Implementation

1. Add a mounted state to your component:
   ```tsx
   const [mounted, setMounted] = useState(false);
   ```

2. Set the mounted state to true after the component mounts:
   ```tsx
   useEffect(() => {
     setMounted(true);
   }, []);
   ```

3. Guard all localStorage access with the mounted state:
   ```tsx
   if (mounted) {
     const token = localStorage.getItem('token');
     // Use token...
   }
   ```

4. Include mounted in useEffect dependencies when accessing localStorage:
   ```tsx
   useEffect(() => {
     if (!mounted) return;
     
     const token = localStorage.getItem('token');
     // Use token...
   }, [mounted]);
   ```

## API Calls

API calls should use the standardized axios instance from `src/lib/axios.ts`.

### Usage

```tsx
import api from '../../src/lib/axios';

// Example API call
const response = await api.get('/endpoint', {
  headers: { Authorization: `Token ${token}` }
});
```

## Error Handling

All API calls should include proper error handling:

```tsx
try {
  // API call
} catch (error) {
  console.error('Error description:', error);
  setError('User-friendly error message');
}
```

## Loading States

Pages should display a loading indicator while data is being fetched:

```tsx
if (loading) {
  return (
    <div className="flex justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );
}
```

## Routing

Use the Next.js router for navigation:

```tsx
import { useRouter } from 'next/navigation';

const router = useRouter();

// Navigate to a page
router.push('/path');
```

## Form Handling

Forms should prevent default submission and include proper validation:

```tsx
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  // Validation and submission logic
};
```

## Maintenance Scripts

The repository includes several maintenance scripts to help maintain code quality:

- `check_navigation.sh`: Checks for consistent Navigation component usage
- `fix_localstorage.sh`: Fixes localStorage access to prevent SSR errors
- `standardize_axios.sh`: Standardizes axios imports and configurations

Run these scripts periodically to ensure code consistency. 