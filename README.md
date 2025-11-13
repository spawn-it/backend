# SpawnIT - Backend

**Node.js/Express REST API and OpenTofu orchestrator**

> ⚠️ **Academic Project Notice**  
> This is a 2-3 week academic project developed for the PLM & Web course at HEIG-VD. The codebase is a proof of concept and may undergo significant changes. A Java/Spring Boot rewrite is planned for future iterations.

## Overview

The backend serves as the core orchestrator for SpawnIT, providing:

- **REST API** for service management (catalog, templates, deployments)
- **OpenTofu Executor** for infrastructure provisioning
- **Job Manager** for asynchronous operation handling
- **Drift Detection** for infrastructure state monitoring
- **Server-Sent Events** for real-time updates to the frontend
- **S3 Integration** for state and configuration storage

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express 5
- **IaC Engine**: OpenTofu (executed via child processes)
- **Storage**: AWS SDK for S3 (MinIO)
- **Authentication**: Keycloak (OpenID Connect)

## Project Structure

```
backend/
├── routes/              # API endpoints
│   ├── catalog.js       # Service catalog
│   ├── template.js      # Deployment templates
│   └── opentofu.js      # IaC operations
├── services/
│   ├── executor/        # OpenTofu command execution
│   ├── manager/         # Job and instance management
│   └── s3/              # MinIO/S3 client
├── opentofu/            # Terraform modules
│   ├── networks/        # Network provisioning
│   └── services/        # Service deployment
├── models/              # Data models
├── sse/                 # Server-Sent Events
└── config/              # Configuration and constants
```

## Getting Started

### Prerequisites

- Node.js 20+
- OpenTofu 1.6+ installed and available in PATH
- MinIO instance (or AWS S3)
- Keycloak instance

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file (see backend configuration):

```env
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
KEYCLOAK_URL=http://localhost:8080
# ... additional configuration
```

### Running

```bash
# Development
npm start

# Linting
npm run lint

# Code formatting
npm run format
```

## API Endpoints

### Catalog

```http
GET /api/catalog
```

Returns the list of available services with their configurations.

### Templates

```http
GET /api/template/:serviceName
POST /api/template
```

Retrieve or create deployment templates for services.

### OpenTofu Operations

```http
POST /api/opentofu/plan
POST /api/opentofu/apply
POST /api/opentofu/destroy
GET /api/opentofu/status/:jobId
```

Execute infrastructure operations asynchronously.

### Real-time Updates

```http
GET /api/events
```

Server-Sent Events stream for deployment status updates.

## Architecture Decisions

### Why Node.js (for now)?

Node.js was chosen for rapid prototyping and its good integration with Express for REST APIs. However, for a production system, a Java/Spring Boot rewrite would provide:

- Better type safety
- More robust error handling
- Stronger ecosystem for enterprise applications
- Better performance for concurrent operations

### OpenTofu Execution

OpenTofu is executed via Node.js child processes. Each operation runs in an isolated working directory with its own state file stored in S3.

### State Management

All OpenTofu states are stored in MinIO (S3-compatible storage) to ensure:

- Centralized state management
- Multi-user collaboration support
- State locking capabilities

## Known Limitations

- **Error handling**: Basic error handling, needs improvement
- **Validation**: Limited input validation on API endpoints
- **Concurrency**: Simple lock mechanism, could be more robust
- **Testing**: No automated tests (time constraint)

## Future Improvements

- [ ] Rewrite in Java/Spring Boot
- [ ] Add comprehensive test suite
- [ ] Implement proper logging (structured)
- [ ] Add input validation with schemas
- [ ] Implement proper authentication middleware
- [ ] Add rate limiting and request throttling

## Contributing

This is an academic project. Feel free to fork and improve, but note that the codebase is intentionally minimal for demonstration purposes.

## Authors

- **Massimo Stefani**
- **Timothée Van Hove**

HEIG-VD - PLM & Web Course
