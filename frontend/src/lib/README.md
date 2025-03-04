# API Service

This directory contains standardized API service utilities for the application.

## axios.ts

The `axios.ts` file contains a configured axios instance for making HTTP requests to the backend API. This is the preferred way to make API calls in the application.

### Features

- Automatically sets the base URL from environment variables
- Adds default headers for content type
- Automatically handles authentication by adding the token from localStorage
- Normalizes URL paths to ensure proper API prefix
- Includes debugging logs for requests (useful during development)

### Usage

```typescript
import api from '../path/to/src/lib/axios';

// GET request
const response = await api.get('/endpoint');

// POST request with data
const response = await api.post('/endpoint', {
  key: 'value'
});

// PUT request
const response = await api.put('/endpoint/123', {
  key: 'newValue'
});

// DELETE request
const response = await api.delete('/endpoint/123');
```

### Import Paths

Use the correct relative path from your component to the axios module:

- From `frontend/app/` directory: `import api from '../src/lib/axios';`
- From `frontend/app/profile/` directory: `import api from '../../src/lib/axios';`
- From `frontend/app/club/` directory: `import api from '../../../src/lib/axios';`
- From `frontend/app/competition/` directory: `import api from '../../../src/lib/axios';`

## Best Practices

1. **Never create your own axios instance** - Always import the standardized instance
2. **Don't modify the config in components** - Make changes to the central axios.ts file instead
3. **Use relative imports correctly** - Make sure to count the directories correctly when importing
4. **Don't duplicate API logic** - Create reusable utility functions for common API operations 