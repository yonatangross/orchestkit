/**
 * MSW Handler Template
 * 
 * Copy this template when creating new API handlers.
 * Replace placeholders with actual types and data.
 */

import { http, HttpResponse, delay } from 'msw';

// =============================================================================
// Types
// =============================================================================

interface Resource {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateResourceRequest {
  name: string;
}

interface UpdateResourceRequest {
  name?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ErrorResponse {
  error: string;
  message?: string;
  details?: Array<{ field: string; message: string }>;
}

// =============================================================================
// Mock Data Store
// =============================================================================

let resources: Resource[] = [
  {
    id: '1',
    name: 'Resource 1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Resource 2',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

// =============================================================================
// Handlers
// =============================================================================

export const resourceHandlers = [
  // -------------------------------------------------------------------------
  // LIST - GET /api/resources
  // -------------------------------------------------------------------------
  http.get('/api/resources', ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search') || '';

    // Filter by search
    let filtered = resources;
    if (search) {
      filtered = resources.filter((r) =>
        r.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Paginate
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    const response: PaginatedResponse<Resource> = {
      data: paginated,
      meta: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit),
      },
    };

    return HttpResponse.json(response);
  }),

  // -------------------------------------------------------------------------
  // GET ONE - GET /api/resources/:id
  // -------------------------------------------------------------------------
  http.get('/api/resources/:id', ({ params }) => {
    const resource = resources.find((r) => r.id === params.id);

    if (!resource) {
      return HttpResponse.json(
        { error: 'Not Found', message: 'Resource not found' } as ErrorResponse,
        { status: 404 }
      );
    }

    return HttpResponse.json({ data: resource });
  }),

  // -------------------------------------------------------------------------
  // CREATE - POST /api/resources
  // -------------------------------------------------------------------------
  http.post('/api/resources', async ({ request }) => {
    const body = (await request.json()) as CreateResourceRequest;

    // Validation
    if (!body.name || body.name.length < 2) {
      return HttpResponse.json(
        {
          error: 'Validation Error',
          details: [{ field: 'name', message: 'Name must be at least 2 characters' }],
        } as ErrorResponse,
        { status: 422 }
      );
    }

    const newResource: Resource = {
      id: String(resources.length + 1),
      name: body.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    resources.push(newResource);

    return HttpResponse.json({ data: newResource }, { status: 201 });
  }),

  // -------------------------------------------------------------------------
  // UPDATE - PUT /api/resources/:id
  // -------------------------------------------------------------------------
  http.put('/api/resources/:id', async ({ request, params }) => {
    const body = (await request.json()) as UpdateResourceRequest;
    const index = resources.findIndex((r) => r.id === params.id);

    if (index === -1) {
      return HttpResponse.json(
        { error: 'Not Found', message: 'Resource not found' } as ErrorResponse,
        { status: 404 }
      );
    }

    resources[index] = {
      ...resources[index],
      ...body,
      updatedAt: new Date().toISOString(),
    };

    return HttpResponse.json({ data: resources[index] });
  }),

  // -------------------------------------------------------------------------
  // DELETE - DELETE /api/resources/:id
  // -------------------------------------------------------------------------
  http.delete('/api/resources/:id', ({ params }) => {
    const index = resources.findIndex((r) => r.id === params.id);

    if (index === -1) {
      return HttpResponse.json(
        { error: 'Not Found', message: 'Resource not found' } as ErrorResponse,
        { status: 404 }
      );
    }

    resources.splice(index, 1);

    return new HttpResponse(null, { status: 204 });
  }),
];

// =============================================================================
// Test Helper: Reset Store
// =============================================================================

export function resetResourceStore() {
  resources = [
    {
      id: '1',
      name: 'Resource 1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      name: 'Resource 2',
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  ];
}
