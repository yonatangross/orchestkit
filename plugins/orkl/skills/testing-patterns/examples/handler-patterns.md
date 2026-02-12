# MSW Handler Patterns

## Complete Handler Examples

### CRUD API Handlers

```typescript
// src/mocks/handlers/users.ts
import { http, HttpResponse, delay } from 'msw';

interface User {
  id: string;
  name: string;
  email: string;
}

// In-memory store for testing
let users: User[] = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob', email: 'bob@example.com' },
];

export const userHandlers = [
  // List users with pagination
  http.get('/api/users', ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    
    const start = (page - 1) * limit;
    const paginatedUsers = users.slice(start, start + limit);
    
    return HttpResponse.json({
      data: paginatedUsers,
      meta: {
        page,
        limit,
        total: users.length,
        totalPages: Math.ceil(users.length / limit),
      },
    });
  }),

  // Get single user
  http.get('/api/users/:id', ({ params }) => {
    const user = users.find((u) => u.id === params.id);
    
    if (!user) {
      return HttpResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return HttpResponse.json({ data: user });
  }),

  // Create user
  http.post('/api/users', async ({ request }) => {
    const body = await request.json() as Omit<User, 'id'>;
    
    const newUser: User = {
      id: String(users.length + 1),
      ...body,
    };
    
    users.push(newUser);
    
    return HttpResponse.json({ data: newUser }, { status: 201 });
  }),

  // Update user
  http.put('/api/users/:id', async ({ request, params }) => {
    const body = await request.json() as Partial<User>;
    const index = users.findIndex((u) => u.id === params.id);
    
    if (index === -1) {
      return HttpResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    users[index] = { ...users[index], ...body };
    
    return HttpResponse.json({ data: users[index] });
  }),

  // Delete user
  http.delete('/api/users/:id', ({ params }) => {
    const index = users.findIndex((u) => u.id === params.id);
    
    if (index === -1) {
      return HttpResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    users.splice(index, 1);
    
    return new HttpResponse(null, { status: 204 });
  }),
];
```

### Error Simulation Handlers

```typescript
// src/mocks/handlers/errors.ts
import { http, HttpResponse, delay } from 'msw';

export const errorHandlers = [
  // 401 Unauthorized
  http.get('/api/protected', ({ request }) => {
    const auth = request.headers.get('Authorization');
    
    if (!auth || !auth.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid token' },
        { status: 401 }
      );
    }
    
    return HttpResponse.json({ data: 'secret data' });
  }),

  // 403 Forbidden
  http.delete('/api/admin/users/:id', () => {
    return HttpResponse.json(
      { error: 'Forbidden', message: 'Admin access required' },
      { status: 403 }
    );
  }),

  // 422 Validation Error
  http.post('/api/users', async ({ request }) => {
    const body = await request.json() as { email?: string };
    
    if (!body.email?.includes('@')) {
      return HttpResponse.json(
        {
          error: 'Validation Error',
          details: [
            { field: 'email', message: 'Invalid email format' },
          ],
        },
        { status: 422 }
      );
    }
    
    return HttpResponse.json({ data: { id: '1', ...body } }, { status: 201 });
  }),

  // 500 Server Error
  http.get('/api/unstable', () => {
    return HttpResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }),

  // Network Error
  http.get('/api/network-fail', () => {
    return HttpResponse.error();
  }),

  // Timeout simulation
  http.get('/api/timeout', async () => {
    await delay('infinite');
    return HttpResponse.json({ data: 'never' });
  }),
];
```

### Authentication Flow Handlers

```typescript
// src/mocks/handlers/auth.ts
import { http, HttpResponse } from 'msw';

interface LoginRequest {
  email: string;
  password: string;
}

const validUser = {
  email: 'test@example.com',
  password: 'password123',
};

export const authHandlers = [
  // Login
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as LoginRequest;
    
    if (body.email === validUser.email && body.password === validUser.password) {
      return HttpResponse.json({
        user: { id: '1', email: body.email, name: 'Test User' },
        accessToken: 'mock-access-token-123',
        refreshToken: 'mock-refresh-token-456',
      });
    }
    
    return HttpResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  // Refresh token
  http.post('/api/auth/refresh', async ({ request }) => {
    const body = await request.json() as { refreshToken: string };
    
    if (body.refreshToken === 'mock-refresh-token-456') {
      return HttpResponse.json({
        accessToken: 'mock-access-token-new',
        refreshToken: 'mock-refresh-token-new',
      });
    }
    
    return HttpResponse.json(
      { error: 'Invalid refresh token' },
      { status: 401 }
    );
  }),

  // Logout
  http.post('/api/auth/logout', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Get current user
  http.get('/api/auth/me', ({ request }) => {
    const auth = request.headers.get('Authorization');
    
    if (auth === 'Bearer mock-access-token-123' || 
        auth === 'Bearer mock-access-token-new') {
      return HttpResponse.json({
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
      });
    }
    
    return HttpResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }),
];
```

### File Upload Handler

```typescript
// src/mocks/handlers/upload.ts
import { http, HttpResponse } from 'msw';

export const uploadHandlers = [
  http.post('/api/upload', async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return HttpResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return HttpResponse.json(
        { error: 'Invalid file type' },
        { status: 422 }
      );
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return HttpResponse.json(
        { error: 'File too large' },
        { status: 422 }
      );
    }
    
    return HttpResponse.json({
      data: {
        id: 'file-123',
        name: file.name,
        size: file.size,
        type: file.type,
        url: `https://cdn.example.com/uploads/${file.name}`,
      },
    });
  }),
];
```

## Test Usage Examples

### Basic Component Test

```typescript
// src/components/UserList.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { UserList } from './UserList';

describe('UserList', () => {
  it('renders users from API', async () => {
    render(<UserList />);
    
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('shows error state on API failure', async () => {
    // Override handler for this test
    server.use(
      http.get('/api/users', () => {
        return HttpResponse.json(
          { error: 'Server error' },
          { status: 500 }
        );
      })
    );

    render(<UserList />);

    await waitFor(() => {
      expect(screen.getByText(/error loading users/i)).toBeInTheDocument();
    });
  });

  it('shows loading state during fetch', async () => {
    server.use(
      http.get('/api/users', async () => {
        await delay(100);
        return HttpResponse.json({ data: [] });
      })
    );

    render(<UserList />);

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument();
    });
  });
});
```

### Form Submission Test

```typescript
// src/components/CreateUserForm.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { CreateUserForm } from './CreateUserForm';

describe('CreateUserForm', () => {
  it('submits form and shows success', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(<CreateUserForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText('Name'), 'New User');
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com' })
      );
    });
  });

  it('shows validation errors from API', async () => {
    server.use(
      http.post('/api/users', () => {
        return HttpResponse.json(
          {
            error: 'Validation Error',
            details: [{ field: 'email', message: 'Email already exists' }],
          },
          { status: 422 }
        );
      })
    );

    const user = userEvent.setup();
    render(<CreateUserForm onSuccess={() => {}} />);

    await user.type(screen.getByLabelText('Email'), 'existing@example.com');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText('Email already exists')).toBeInTheDocument();
    });
  });
});
```
