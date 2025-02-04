#!/bin/bash

# Ensure script exits on first error
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if Docker daemon is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}Error: Docker daemon is not running.${NC}"
        echo -e "${BLUE}Please ensure Docker Desktop is running on your Mac.${NC}"
        echo -e "${BLUE}You can download Docker Desktop from: https://www.docker.com/products/docker-desktop/${NC}"
        exit 1
    fi
}

# Get the project-specific image prefix
get_image_prefix() {
    # Get the last part of the current directory as project name
    PROJECT_NAME=$(basename "$PWD")
    # Get current git branch, fallback to unknown
    BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    # Sanitize names
    PROJECT_NAME=$(echo "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')
    BRANCH_NAME=$(echo "$BRANCH_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')
    echo "${PROJECT_NAME}-${BRANCH_NAME}"
}

# Clean up function
cleanup() {
    if [ -f "docker-compose.test.yml" ]; then
        echo -e "${YELLOW}Cleaning up containers and test-specific images...${NC}"
        
        # Get our project-specific image prefix
        PREFIX=$(get_image_prefix)
        
        # Stop and remove containers
        docker-compose -f docker-compose.test.yml down --rmi local 2>/dev/null || true
        
        # Remove any leftover test images for this project/branch
        echo -e "${YELLOW}Cleaning up any leftover test images for ${PREFIX}...${NC}"
        docker images "${PREFIX}-test-*" --format "{{.ID}}" | xargs -r docker rmi 2>/dev/null || true
        
        rm -f docker-compose.test.yml
    fi
}

# Error handler
error_handler() {
    echo -e "\n${RED}Error occurred in script at line: ${BASH_LINENO[0]}${NC}"
    cleanup
    exit 1
}

# Set up traps
trap cleanup EXIT
trap error_handler ERR

# Check Docker before proceeding
check_docker

echo -e "${GREEN}Preparing test environment...${NC}"

# Install ts-node if not already installed (needed for our TypeScript scripts)
if ! command -v ts-node &> /dev/null; then
    echo -e "${YELLOW}Installing ts-node...${NC}"
    npm install -g ts-node typescript @types/node
fi

echo -e "${GREEN}Generating Docker Compose configuration...${NC}"
# The generate-compose script now handles base image management
npx ts-node lib/test/parallel/generate-compose.ts

# Verify docker-compose file was generated
if [ ! -f "docker-compose.test.yml" ]; then
    echo -e "${RED}Error: docker-compose.test.yml was not generated${NC}"
    exit 1
fi

echo -e "${GREEN}Building and running tests in parallel...${NC}"
echo -e "${BLUE}This may take a few minutes depending on the number of tests...${NC}"
echo -e "${YELLOW}Each test will run in its own container with Node.js 22${NC}"

# Run tests with Docker's native timeout handling
# Use --force-recreate to ensure clean state
docker-compose -f docker-compose.test.yml up \
    --build \
    --force-recreate \
    --abort-on-container-exit \
    --remove-orphans

COMPOSE_EXIT_CODE=$?
if [ $COMPOSE_EXIT_CODE -eq 137 ]; then
    echo -e "${RED}Error: Tests timed out${NC}"
    exit 1
elif [ $COMPOSE_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}Error: Some tests failed. Check the output above for details.${NC}"
    exit $COMPOSE_EXIT_CODE
fi

# Check exit codes and collect failed tests
FAILED_TESTS=""
EXIT_CODE=0
for service in $(docker-compose -f docker-compose.test.yml ps -q 2>/dev/null || true); do
    if [ -n "$service" ]; then
        SERVICE_NAME=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' $service 2>/dev/null || echo "unknown")
        EXIT_STATUS=$(docker inspect -f '{{.State.ExitCode}}' $service 2>/dev/null || echo "1")
        if [ "$EXIT_STATUS" != "0" ]; then
            EXIT_CODE=1
            FAILED_TESTS="$FAILED_TESTS\n - $SERVICE_NAME"
        fi
    fi
done

# Print summary
if [ "$EXIT_CODE" = "0" ]; then
    echo -e "\n${GREEN}All tests passed successfully!${NC}"
else
    echo -e "\n${RED}Some tests failed:${FAILED_TESTS}${NC}"
    echo -e "\n${YELLOW}Check the output above for detailed error messages${NC}"
fi

exit $EXIT_CODE
