# Parallel Test Runner

A Docker-based parallel test runner that executes each test file in its own container, with smart caching and efficient resource management.

## Features

- **Parallel Execution**: Runs each test file in its own container for maximum parallelization
- **Smart Caching**: Only rebuilds Docker images when source files change
- **Project-Aware**: Uses project name and git branch in image names for clear organization
- **Efficient Cleanup**: Automatically removes old images to prevent disk space bloat

## Architecture

The system uses a two-stage Docker build approach:

1. **Base Image** (`Dockerfile.base`):
   - Contains all project dependencies
   - Includes compiled contracts and generated types
   - Built once and cached until source files change
   - Named as: `[project]-[branch]-test-base`

2. **Runner Images** (`Dockerfile.runner`):
   - Lightweight containers for individual tests
   - Uses the base image, only adds test configuration
   - Named as: `[project]-[branch]-test-[test-name]`

## Prerequisites

- Docker Desktop installed and running
- Node.js and yarn
- Git (for branch-aware image naming)

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

### First Run

On the first run, the system will:

1. Build the base image with all dependencies
2. Create individual runner images for each test
3. Execute all tests in parallel

This initial setup might take a few minutes as it needs to build everything from scratch.

### Subsequent Runs

On subsequent runs, the system:

1. Checks if any relevant files have changed (*.sol,*.ts, package.json, etc.)
2. Reuses the existing base image if no changes detected
3. Only rebuilds if necessary, making test runs much faster

### Force Rebuild

To force a rebuild of the base image:

1. Remove the existing image:

   ```bash
   docker rmi $(docker images "[project]-[branch]-test-base" -q)
   ```

2. Run the tests again:

   ```bash
   yarn test:parallel
   ```

## Components

- `Dockerfile.base` - Base image configuration with dependencies and compilation
- `Dockerfile.runner` - Lightweight test runner configuration
- `image-manager.ts` - Handles image versioning and caching logic
- `generate-compose.ts` - Generates Docker Compose configuration
- `run-tests.sh` - Main orchestration script
- `.dockerignore` - Optimizes Docker build context

## How It Works

1. **Image Management**:
   - Calculates a hash of all relevant source files
   - Uses this hash to version the base image
   - Only rebuilds when the hash changes
   - Automatically cleans up old images

2. **Test Execution**:
   - Finds all test files (*.spec.ts,*.test.ts)
   - Creates a Docker Compose service for each test
   - Runs all tests in parallel
   - Aggregates results and exit codes

3. **Cleanup**:
   - Removes runner images after tests complete
   - Keeps only the latest working base image
   - Organizes images by project and branch

## Troubleshooting

### Common Issues

1. **Docker Not Running**:

   ```
   Error: Docker daemon is not running
   ```

   Solution: Start Docker Desktop

2. **Memory Issues**:

   ```
   Error: Tests timed out
   ```

   Solution: Increase Docker memory limit in Docker Desktop settings

3. **Disk Space**:
   To clean up all test-related images:

   ```bash
   docker images "[project]-[branch]-test-*" -q | xargs docker rmi
   ```

### Error Messages

- Exit code 137: Test container ran out of memory
- Exit code 1: Test failure
- Exit code 0: Tests passed successfully

## Best Practices

1. Keep test files focused and independent
2. Use proper cleanup in test files
3. Be mindful of memory usage in tests
4. Use appropriate timeouts for async operations

## Resource Management

- Each test container is limited to:
  - 2GB memory
  - 1 CPU core
  - 5 minute timeout

These limits can be adjusted in the `generate-compose.ts` file if needed.
