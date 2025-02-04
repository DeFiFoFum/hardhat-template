# Parallel Test Runner

This directory contains a Docker-based parallel test runner that can run each test file in its own container.

## Setup

1. Copy this entire `parallel` directory to your project's `lib/test/` folder
2. Add the following script to your package.json:

```json
{
  "scripts": {
    "test:parallel": "bash lib/test/parallel/run-tests.sh"
  }
}
```

## Usage

Run all tests in parallel:

```bash
yarn test:parallel
```

## Files

- `Dockerfile` - Container configuration for running tests
- `generate-compose.ts` - Generates Docker Compose configuration
- `run-tests.sh` - Main script to orchestrate parallel testing
- `.dockerignore` - Optimizes Docker build context
