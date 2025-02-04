FROM node:22

WORKDIR /app

# Copy entire project first
COPY . .

# Install dependencies and compile contracts
RUN yarn install --frozen-lockfile --ignore-engines && \
    # Run full compilation and generate types
    yarn compile && \
    # Verify typechain types were generated
    ls typechain-types

# The test file to run will be passed as a build arg
ARG TEST_FILE
ENV TEST_FILE=${TEST_FILE}

# Add healthcheck to detect hanging tests
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD ps aux | grep "hardhat test" | grep -v grep || exit 1

# Run single test file with a timeout and proper Node.js flags
CMD ["sh", "-c", "node --max-old-space-size=4096 --no-warnings node_modules/.bin/hardhat test $TEST_FILE"]
