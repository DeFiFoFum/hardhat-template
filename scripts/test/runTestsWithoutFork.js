#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')


const EXCLUDE_DIRS = ['fork', 'node_modules', 'timing-reporter']

// Direct fork-related patterns that indicate actual fork usage
const DIRECT_FORK_PATTERNS = [
  /setupFork\s*\(/,
  /resetFork\s*\(/,
  /forkFixture\s*\(/,
  /forkIfHardhat\s*\(/,
  /🍴/, // The fork emoji from log messages
  /Setting up fork/,
  /Fork has been setup/,
  /Resetting fork/
]

// Fork-related import patterns that indicate direct fork usage
const FORK_IMPORT_PATTERNS = [
  /from\s+['"][^'"]*forkFixture['"]/,
  /from\s+['"][^'"]*forkHelper['"]/,
  /import.*setupFork/,
  /import.*resetFork/,
  /import.*forkIfHardhat/,
]

// Patterns to ignore when checking imports
const IGNORED_IMPORT_PATTERNS = [
  /from\s+['"]@[^'"]*['"]/, // External packages starting with @
  /from\s+['"]hardhat['"]/, // Hardhat imports
  /from\s+['"]chai['"]/, // Chai imports
  /from\s+['"][^'"]*typechain-types[^'"]*['"]/, // Typechain types
]

/**
 * Checks if hardhat config has forking enabled
 */
function checkHardhatConfigForking() {
  const configFiles = ['hardhat.config.ts', 'hardhat.config.js', 'hardhat-fork.config.ts']
  
  for (const configFile of configFiles) {
    if (fs.existsSync(configFile)) {
      try {
        const content = fs.readFileSync(configFile, 'utf8')
        if (/forking\s*:\s*\{/.test(content) || /forking\s*:\s*true/.test(content)) {
          console.warn(`⚠️  Forking detected in ${configFile}`)
          console.warn(`   This may cause fork behavior even in non-fork tests`)
          return true
        }
      } catch (error) {
        console.warn(`⚠️  Could not read ${configFile}: ${error.message}`)
      }
    }
  }
  return false
}

/**
 * Checks if content contains direct fork usage
 * @param {string} content - File content
 * @returns {object} - Object with hasDirectUsage and hasImports flags
 */
function checkForForkUsage(content) {
  const hasDirectUsage = DIRECT_FORK_PATTERNS.some(pattern => pattern.test(content))
  const hasImports = FORK_IMPORT_PATTERNS.some(pattern => pattern.test(content))
  
  return { hasDirectUsage, hasImports }
}

/**
 * Validates that test files don't contain fork-related functionality
 * @param {string[]} testFiles - Array of test file paths
 */
function validateNoForkUsage(testFiles) {
  console.log('🔍 Validating test files for fork usage...')
  
  // Check hardhat config first
  const configHasForking = checkHardhatConfigForking()
  if (configHasForking) {
    console.log('   Note: Hardhat config has forking enabled - ensure you\'re using the right config')
  }
  
  const violatingFiles = []
  
  for (const file of testFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8')
      const { hasDirectUsage, hasImports } = checkForForkUsage(content)
      
      if (hasDirectUsage || hasImports) {
        const violations = []
        const lines = content.split('\n')
        
        // Check for direct usage
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          for (const pattern of DIRECT_FORK_PATTERNS) {
            if (pattern.test(line)) {
              violations.push(`Line ${i + 1}: ${line.trim()}`)
            }
          }
          for (const pattern of FORK_IMPORT_PATTERNS) {
            if (pattern.test(line)) {
              violations.push(`Line ${i + 1}: ${line.trim()}`)
            }
          }
        }
        
        if (violations.length > 0) {
          violatingFiles.push({ file, violations: violations.slice(0, 3) }) // Limit to 3 violations per file
        }
      }
    } catch (error) {
      console.warn(`⚠️  Could not analyze ${file}: ${error.message}`)
    }
  }
  
  if (violatingFiles.length > 0) {
    console.error('❌ Fork usage detected in test files:')
    console.error('')
    
    for (const { file, violations } of violatingFiles) {
      console.error(`📄 ${file}:`)
      for (const violation of violations) {
        console.error(`   ${violation}`)
      }
      if (violations.length === 3) {
        console.error(`   ... (showing first 3 violations)`)
      }
      console.error('')
    }
    
    console.error('💡 Solution: Move these files to the test/fork/ directory')
    console.error('   Example: mv test/YourTest.spec.ts test/fork/')
    console.error('')
    process.exit(1)
  }
  
  console.log(`✅ Validated ${testFiles.length} files - no direct fork usage detected`)
}

// Recursively find all .spec.ts files except those in excluded directories
function findTestFiles(dir, testFiles = []) {
  const files = fs.readdirSync(dir)
  
  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    
    if (stat.isDirectory()) {
      // Skip excluded directories
      if (EXCLUDE_DIRS.includes(file)) {
        continue
      }
      findTestFiles(filePath, testFiles)
    } else if (file.endsWith('.spec.ts')) {
      testFiles.push(filePath)
    }
  }
  
  return testFiles
}

// Find all test files except those in fork directory
const testFiles = findTestFiles('test')

if (testFiles.length === 0) {
  console.log('No test files found!')
  process.exit(1)
}

console.log(`Found ${testFiles.length} test files (excluding fork tests)`)

// Validate no fork usage before running tests
validateNoForkUsage(testFiles)

// Join all test files into a single command
const testCommand = `hardhat test ${testFiles.join(' ')}`

try {
  execSync(testCommand, { stdio: 'inherit' })
} catch (error) {
  process.exit(error.status || 1)
} 