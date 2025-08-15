# Note Management API

A SaaS note management application with Jira-like interface

## Quick Start

1. **Base URL:** `http://localhost:3000`
2. **Authentication:** Bearer token required for most endpoints
3. **Content Type:** `application/json`

## Authentication

To authenticate, send a POST request to `/api/auth/login` with your credentials:

```bash
curl -X POST \
  "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'
```

Use the returned token in the Authorization header for subsequent requests:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/notes"
```

## Documentation

- **Interactive API Docs:** [Swagger UI](http://localhost:3000/api-docs)
- **OpenAPI Spec:** [openapi.json](http://localhost:3000/api/openapi.json)
- **Full API Reference:** [api-reference.md](./api-reference.md)

## Collections

Import these collections into your API client:

- **Postman:** [postman-collection.json](./postman-collection.json)
- **Insomnia:** [insomnia-collection.json](./insomnia-collection.json)

## Error Handling

All API responses follow a consistent format:

**Success Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  },
  "timestamp": "2024-01-01T00:00:00Z",
  "requestId": "req-123"
}
```

## Rate Limiting

- Authentication endpoints: 5 requests per 15 minutes
- General API endpoints: 100 requests per minute

## Support

For API support, please contact: support@notemanagement.com

## Version

Current API version: 1.0.0
