import fs from 'fs'
import path from 'path'
import glob from 'glob'

// Function to find all test files in the repository
function findTestFiles(): string[] {
  // Search for all test files in the entire repository
  const testPatterns = ['**/*.spec.ts', '**/*.test.ts']

  const allFiles = testPatterns.flatMap((pattern) =>
    glob.sync(pattern, {
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', 'coverage/**', '.git/**'],
      dot: false, // Ignore dotfiles/dotfolders
    })
  )

  // Deduplicate results
  return Array.from(new Set(allFiles))
}

// Function to generate Docker-compatible service name from file path
function generateServiceName(filePath: string): string {
  // Convert to lowercase and replace all non-alphanumeric characters with hyphens
  const sanitized = filePath
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .replace(/-spec-ts$/, '')
    .replace(/-test-ts$/, '')

  // Ensure name starts with a letter (Docker requirement)
  return `test-${sanitized}`
}

// Function to generate Docker Compose configuration
function generateDockerCompose(): void {
  const testFiles = findTestFiles()
  console.log('Found test files:', testFiles)

  const dockerCompose = {
    services: Object.fromEntries(
      testFiles.map((file) => [
        generateServiceName(file),
        {
          build: {
            context: '.',
            dockerfile: 'lib/test/parallel/Dockerfile',
            args: {
              TEST_FILE: file,
            },
          },
          image: `hardhat-parallel-test-runner-${generateServiceName(file)}`,
          environment: {
            // Pass through any environment variables needed for tests
            NODE_ENV: 'test',
            TESTING: 'true',
            // Ensure proper compilation
            FORCE_COLOR: 'true',
            HARDHAT_COMPILE_TASK_LOCK: 'false',
          },
          // Add resource limits to prevent memory issues
          mem_limit: '2g',
          mem_reservation: '1g',
          cpus: '1',
          // Add timeout settings
          stop_grace_period: '5m',
          healthcheck: {
            test: ['CMD-SHELL', "ps aux | grep 'hardhat test' | grep -v grep || exit 1"],
            interval: '30s',
            timeout: '10s',
            retries: 3,
            start_period: '30s',
          },
        },
      ])
    ),
  }

  // Write the configuration file to the project root
  fs.writeFileSync(
    'docker-compose.test.yml',
    `# This file is auto-generated. Do not edit manually.
${JSON.stringify(dockerCompose, null, 2)}`
  )

  console.log('Generated Docker Compose configuration with', testFiles.length, 'test services')
}

// Execute if run directly
if (require.main === module) {
  try {
    generateDockerCompose()
    console.log('Docker Compose configuration generated successfully')
  } catch (error) {
    console.error('Error generating Docker Compose configuration:', error)
    process.exit(1)
  }
}
