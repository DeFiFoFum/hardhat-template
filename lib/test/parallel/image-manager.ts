import crypto from 'crypto'
import fs from 'fs'
import glob from 'glob'
import path from 'path'
import { execSync } from 'child_process'

function getProjectName(): string {
  // Get the last part of the current working directory as project name
  return path.basename(process.cwd())
}

function getCurrentBranch(): string {
  try {
    // Get current git branch, fallback to 'unknown' if not in a git repo
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
  } catch (error) {
    console.warn('Warning: Could not determine git branch:', error)
    return 'unknown'
  }
}

// Generate base name for all images in this project/branch
function getBaseImagePrefix(): string {
  const projectName = getProjectName()
  const branchName = getCurrentBranch()
  // Sanitize names to be docker-compatible (using underscores instead of hyphens)
  const sanitize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  return `${sanitize(projectName)}-${sanitize(branchName)}`
}

const BASE_IMAGE_NAME = `${getBaseImagePrefix()}-test-base`

export function calculateContentHash(): string {
  // Files to include in hash calculation
  const patterns = [
    '**/*.sol', // Solidity contracts
    '**/*.ts', // TypeScript files
    'package.json', // Dependencies
    'yarn.lock', // Exact versions
    'hardhat.config.ts', // Project configuration
    'tsconfig.json', // TypeScript configuration
  ]

  try {
    const files = patterns
      .flatMap((pattern) =>
        glob.sync(pattern, {
          ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', 'coverage/**', '.git/**'],
          dot: false,
        })
      )
      .filter((file) => {
        try {
          return fs.statSync(file).isFile()
        } catch (error) {
          console.warn(`Warning: Could not stat file ${file}:`, error)
          return false
        }
      })
      .sort() // Sort for consistency

    if (files.length === 0) {
      console.warn('Warning: No matching files found for content hash calculation')
      // Return a default hash when no files are found
      return 'empty'
    }

    const hash = crypto.createHash('sha256')

    for (const file of files) {
      try {
        const content = fs.readFileSync(file)
        hash.update(content)
        console.log(`Added file to hash calculation: ${file}`)
      } catch (error) {
        console.warn(`Warning: Could not read file ${file}:`, error)
        // Continue with other files instead of failing completely
        continue
      }
    }

    return hash.digest('hex')
  } catch (error) {
    console.error('Error calculating content hash:', error)
    throw error
  }
}

export function getBaseImageTag(contentHash: string): string {
  return `${BASE_IMAGE_NAME}:${contentHash}`
}

// Export for use in generate-compose.ts
export function getImagePrefix(): string {
  return getBaseImagePrefix()
}

export function getCurrentBaseImageHash(): string | null {
  try {
    const output = execSync(`docker inspect ${BASE_IMAGE_NAME}:latest --format='{{.Config.Labels.content_hash}}'`, {
      encoding: 'utf8',
    }).trim()
    return output || null
  } catch {
    return null
  }
}

export function buildBaseImage(contentHash: string): void {
  const tag = getBaseImageTag(contentHash)

  // Build the new image with the content hash
  execSync(
    `docker build -f lib/test/parallel/Dockerfile.base \
     --build-arg CONTENT_HASH=${contentHash} \
     -t ${tag} \
     -t ${BASE_IMAGE_NAME}:latest .`,
    { stdio: 'inherit' }
  )

  // Find and remove old images
  try {
    const images = execSync(`docker images ${BASE_IMAGE_NAME} --format "{{.ID}} {{.Tag}}"`, { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)

    for (const image of images) {
      const [id, tag] = image.split(' ')
      if (tag !== 'latest' && tag !== contentHash) {
        console.log(`Removing old image: ${BASE_IMAGE_NAME}:${tag}`)
        execSync(`docker rmi ${id}`, { stdio: 'inherit' })
      }
    }
  } catch (error) {
    console.warn('Warning: Failed to cleanup old images:', error)
  }
}

export function ensureBaseImage(): string {
  const currentHash = calculateContentHash()
  const existingHash = getCurrentBaseImageHash()

  if (currentHash !== existingHash) {
    console.log('Content changes detected, rebuilding base image...')
    buildBaseImage(currentHash)
  } else {
    console.log('Using existing base image - no changes detected')
  }

  return getBaseImageTag(currentHash)
}
