# Note Management API

A SaaS note management application with Jira-like interface

**Version:** 1.0.0

## Servers

- **Development server:** `http://localhost:3000`
- **Production server:** `https://api.notemanagement.com`

## Authentication

### bearerAuth

- **Type:** http
- **Scheme:** bearer
- **Bearer Format:** JWT
- **Description:** JWT token for authentication

## Authentication

### POST /api/auth/register

Register a new user

Create a new user account with email and password

#### Request Body

**Content Type:** `application/json`

```json
{
  "email": "user@example.com",
  "password": "string",
  "firstName": "string",
  "lastName": "string"
}
```

#### Responses

**201** - User registered successfully

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "a1b2c3d4e5f6789012345678901234ab",
      "email": "user@example.com",
      "firstName": "string",
      "lastName": "string",
      "isActive": true,
      "createdAt": "2025-08-15T08:19:16.613Z",
      "updatedAt": "2025-08-15T08:19:16.613Z",
      "lastLoginAt": "2025-08-15T08:19:16.613Z"
    },
    "token": "string",
    "refreshToken": "string",
    "expiresIn": 0
  }
}
```

**400** - Response

**409** - Response

**429** - Response

**500** - Response

#### Example

```bash
curl -X POST \
  "http://localhost:3000/api/auth/register" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
  -d '{"email":"user@example.com","password":"string","firstName":"string","lastName":"string"}'
```

### POST /api/auth/login

User login

Authenticate user with email and password

#### Request Body

**Content Type:** `application/json`

```json
{
  "email": "user@example.com",
  "password": "string"
}
```

#### Responses

**200** - Login successful

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "a1b2c3d4e5f6789012345678901234ab",
      "email": "user@example.com",
      "firstName": "string",
      "lastName": "string",
      "isActive": true,
      "createdAt": "2025-08-15T08:19:16.614Z",
      "updatedAt": "2025-08-15T08:19:16.614Z",
      "lastLoginAt": "2025-08-15T08:19:16.614Z"
    },
    "token": "string",
    "refreshToken": "string",
    "expiresIn": 0
  }
}
```

**400** - Response

**401** - Response

**429** - Response

**500** - Response

#### Example

```bash
curl -X POST \
  "http://localhost:3000/api/auth/login" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
  -d '{"email":"user@example.com","password":"string"}'
```

### GET /api/auth/me

Get current user profile

Get the profile of the currently authenticated user

#### Responses

**200** - User profile retrieved successfully

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4e5f6789012345678901234ab",
    "email": "user@example.com",
    "firstName": "string",
    "lastName": "string",
    "isActive": true,
    "createdAt": "2025-08-15T08:19:16.614Z",
    "updatedAt": "2025-08-15T08:19:16.614Z",
    "lastLoginAt": "2025-08-15T08:19:16.614Z"
  }
}
```

**401** - Response

**500** - Response

#### Example

```bash
curl -X GET \
  "http://localhost:3000/api/auth/me" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

## Notes

### GET /api/notes

Get user's notes

Retrieve a paginated list of notes for the authenticated user

#### Parameters

| Name | In | Type | Required | Description |
|------|----|----- |----------|-------------|
| undefined | undefined | string | No |  |
| undefined | undefined | string | No |  |
| undefined | undefined | string | No |  |
| undefined | undefined | string | No |  |
| status | query | string | No | Filter by note status |
| priority | query | string | No | Filter by note priority |
| groupId | query | string | No | Filter by group ID |
| search | query | string | No | Search in note titles and descriptions |

#### Responses

**200** - Notes retrieved successfully

```json
null
```

**400** - Response

**401** - Response

**500** - Response

#### Example

```bash
curl -X GET \
  "http://localhost:3000/api/notes" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### POST /api/notes

Create a new note

Create a new note for the authenticated user

#### Request Body

**Content Type:** `application/json`

```json
{
  "title": "string",
  "description": "string",
  "priority": "low",
  "groupId": "a1b2c3d4e5f6789012345678901234ab"
}
```

#### Responses

**201** - Note created successfully

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4e5f6789012345678901234ab",
    "userId": "a1b2c3d4e5f6789012345678901234ab",
    "groupId": "a1b2c3d4e5f6789012345678901234ab",
    "title": "string",
    "description": "string",
    "status": "todo",
    "priority": "low",
    "createdAt": "2025-08-15T08:19:16.614Z",
    "updatedAt": "2025-08-15T08:19:16.614Z",
    "completedAt": "2025-08-15T08:19:16.614Z"
  }
}
```

**400** - Response

**401** - Response

**500** - Response

#### Example

```bash
curl -X POST \
  "http://localhost:3000/api/notes" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
  -d '{"title":"string","description":"string","priority":"low","groupId":"a1b2c3d4e5f6789012345678901234ab"}'
```

## Data Models

### User

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string | Yes | User ID |
| email | string | Yes | User email address |
| firstName | string | Yes | User first name |
| lastName | string | Yes | User last name |
| isActive | boolean | Yes | User active status |
| createdAt | string | Yes | User creation timestamp |
| updatedAt | string | Yes | User last update timestamp |
| lastLoginAt | string | No | Last login timestamp |

#### Example

```json
{
  "id": "a1b2c3d4e5f6789012345678901234ab",
  "email": "user@example.com",
  "firstName": "string",
  "lastName": "string",
  "isActive": true,
  "createdAt": "2025-08-15T08:19:16.614Z",
  "updatedAt": "2025-08-15T08:19:16.614Z",
  "lastLoginAt": "2025-08-15T08:19:16.614Z"
}
```

### Note

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string | Yes | Note ID |
| userId | string | Yes | Owner user ID |
| groupId | string | No | Group ID |
| title | string | Yes | Note title |
| description | string | No | Note description |
| status | enum: todo, in_progress, done | Yes | Note status |
| priority | enum: low, medium, high | Yes | Note priority |
| createdAt | string | Yes | Note creation timestamp |
| updatedAt | string | Yes | Note last update timestamp |
| completedAt | string | No | Note completion timestamp |

#### Example

```json
{
  "id": "a1b2c3d4e5f6789012345678901234ab",
  "userId": "a1b2c3d4e5f6789012345678901234ab",
  "groupId": "a1b2c3d4e5f6789012345678901234ab",
  "title": "string",
  "description": "string",
  "status": "todo",
  "priority": "low",
  "createdAt": "2025-08-15T08:19:16.614Z",
  "updatedAt": "2025-08-15T08:19:16.614Z",
  "completedAt": "2025-08-15T08:19:16.614Z"
}
```

### Group

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string | Yes | Group ID |
| userId | string | Yes | Owner user ID |
| name | string | Yes | Group name |
| description | string | No | Group description |
| color | string | Yes | Group color (hex) |
| createdAt | string | Yes | Group creation timestamp |
| updatedAt | string | Yes | Group last update timestamp |
| noteCount | integer | No | Number of notes in group (when included) |

#### Example

```json
{
  "id": "a1b2c3d4e5f6789012345678901234ab",
  "userId": "a1b2c3d4e5f6789012345678901234ab",
  "name": "string",
  "description": "string",
  "color": "string",
  "createdAt": "2025-08-15T08:19:16.614Z",
  "updatedAt": "2025-08-15T08:19:16.614Z",
  "noteCount": 0
}
```

### CompletedNote

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string | Yes | Completed note ID |
| userId | string | Yes | Owner user ID |
| originalNoteId | string | Yes | Original note ID |
| title | string | Yes | Note title |
| description | string | No | Note description |
| groupName | string | No | Group name at completion |
| priority | enum: low, medium, high | Yes | Note priority |
| completedAt | string | Yes | Note completion timestamp |
| createdAt | string | Yes | Original note creation timestamp |

#### Example

```json
{
  "id": "a1b2c3d4e5f6789012345678901234ab",
  "userId": "a1b2c3d4e5f6789012345678901234ab",
  "originalNoteId": "a1b2c3d4e5f6789012345678901234ab",
  "title": "string",
  "description": "string",
  "groupName": "string",
  "priority": "low",
  "completedAt": "2025-08-15T08:19:16.614Z",
  "createdAt": "2025-08-15T08:19:16.614Z"
}
```

### LoginRequest

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| email | string | Yes | User email |
| password | string | Yes | User password |

#### Example

```json
{
  "email": "user@example.com",
  "password": "string"
}
```

### RegisterRequest

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| email | string | Yes | User email |
| password | string | Yes | User password |
| firstName | string | Yes | User first name |
| lastName | string | Yes | User last name |

#### Example

```json
{
  "email": "user@example.com",
  "password": "string",
  "firstName": "string",
  "lastName": "string"
}
```

### AuthResponse

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| success | boolean | No |  |
| data | object | No |  |

#### Example

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "a1b2c3d4e5f6789012345678901234ab",
      "email": "user@example.com",
      "firstName": "string",
      "lastName": "string",
      "isActive": true,
      "createdAt": "2025-08-15T08:19:16.614Z",
      "updatedAt": "2025-08-15T08:19:16.614Z",
      "lastLoginAt": "2025-08-15T08:19:16.614Z"
    },
    "token": "string",
    "refreshToken": "string",
    "expiresIn": 0
  }
}
```

### CreateNoteRequest

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| title | string | Yes | Note title |
| description | string | No | Note description |
| priority | enum: low, medium, high | No | Note priority |
| groupId | string | No | Group ID |

#### Example

```json
{
  "title": "string",
  "description": "string",
  "priority": "low",
  "groupId": "a1b2c3d4e5f6789012345678901234ab"
}
```

### UpdateNoteRequest

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| title | string | No | Note title |
| description | string | No | Note description |
| status | enum: todo, in_progress, done | No | Note status |
| priority | enum: low, medium, high | No | Note priority |
| groupId | string | No | Group ID |

#### Example

```json
{
  "title": "string",
  "description": "string",
  "status": "todo",
  "priority": "low",
  "groupId": "a1b2c3d4e5f6789012345678901234ab"
}
```

### CreateGroupRequest

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| name | string | Yes | Group name |
| description | string | No | Group description |
| color | string | No | Group color (hex) |

#### Example

```json
{
  "name": "string",
  "description": "string",
  "color": "string"
}
```

### SuccessResponse

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| success | boolean | Yes |  |
| data | object | No | Response data |
| message | string | No | Success message |

#### Example

```json
{
  "success": true,
  "data": {},
  "message": "string"
}
```

### ErrorResponse

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| success | boolean | Yes |  |
| error | object | Yes |  |
| timestamp | string | No | Error timestamp |
| requestId | string | No | Request ID for tracking |

#### Example

```json
{
  "success": false,
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  },
  "timestamp": "2025-08-15T08:19:16.614Z",
  "requestId": "string"
}
```

### PaginatedResponse

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| success | boolean | Yes |  |
| data | object | Yes |  |

#### Example

```json
{
  "success": true,
  "data": {
    "items": [
      {}
    ],
    "pagination": {
      "page": 0,
      "limit": 0,
      "total": 0,
      "totalPages": 0,
      "hasNext": true,
      "hasPrev": true
    }
  }
}
```

### HealthResponse

#### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| status | string | Yes |  |
| timestamp | string | Yes |  |
| environment | string | Yes | Environment name |
| version | string | Yes | Application version |
| database | enum: connected, disconnected | Yes |  |
| uptime | number | Yes | Process uptime in seconds |

#### Example

```json
{
  "status": "OK",
  "timestamp": "2025-08-15T08:19:16.614Z",
  "environment": "string",
  "version": "string",
  "database": "connected",
  "uptime": 0
}
```

