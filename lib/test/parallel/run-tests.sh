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

# Clean up function
cleanup() {
    if [ -f "docker-compose.test.yml" ]; then
        echo -e "${YELLOW}Cleaning up containers...${NC}"
        docker-compose -f docker-compose.test.yml down 2>/dev/null || true
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

echo -e "${GREEN}Generating Docker Compose configuration...${NC}"
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
