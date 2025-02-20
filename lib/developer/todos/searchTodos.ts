import fs from 'fs/promises'
import path from 'path'
import { promisify } from 'util'
import { exec as execCallback } from 'child_process'

const exec = promisify(execCallback)

export interface SearchOptions {
  searchTerms: string[]
  fileExtensions?: string[]
  rootDir?: string
  outputPath?: string
  format?: 'markdown' | 'json'
  contextLines?: number // Number of lines to show after the match
}

interface Match {
  term: string
  file: string
  line: number
  content: string
  absolutePath: string
  relativePath: string // Project-relative path
  contextLines: string[] // Array of lines following the match
}

interface SearchResult {
  timestamp: string
  matches: Match[]
  analytics: Record<string, number>
}

async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await exec('git rev-parse --is-inside-work-tree', { cwd: dir })
    return true
  } catch {
    return false
  }
}

async function getGitRoot(dir: string): Promise<string> {
  const { stdout } = await exec('git rev-parse --show-toplevel', { cwd: dir })
  return stdout.trim()
}

async function* walkDirectory(dir: string, extensions?: string[]): AsyncGenerator<string> {
  const files = await fs.readdir(dir, { withFileTypes: true })

  for (const file of files) {
    const fullPath = path.join(dir, file.name)

    if (file.isDirectory()) {
      // Skip node_modules and .git directories
      if (file.name !== 'node_modules' && file.name !== '.git') {
        yield* walkDirectory(fullPath, extensions)
      }
    } else if (!extensions || extensions.some((ext) => file.name.endsWith(ext))) {
      yield fullPath
    }
  }
}

async function searchFile(
  filePath: string,
  searchTerms: string[],
  rootDir: string,
  contextLines: number = 1,
): Promise<Match[]> {
  const content = await fs.readFile(filePath, 'utf-8')
  const lines = content.split('\n')
  const matches: Match[] = []

  lines.forEach((line, index) => {
    for (const term of searchTerms) {
      if (line.includes(term)) {
        // Get following lines as context
        const context: string[] = []
        for (let i = 1; i <= contextLines && index + i < lines.length; i++) {
          context.push(lines[index + i].trim())
        }

        matches.push({
          term,
          file: filePath,
          line: index + 1,
          content: line.trim(),
          absolutePath: path.resolve(filePath),
          relativePath: path.relative(rootDir, filePath),
          contextLines: context,
        })
      }
    }
  })

  return matches
}

function generateMarkdown(result: SearchResult, rootDir: string): string {
  const lines: string[] = [
    '# TODO Report',
    `Generated on ${new Date(result.timestamp).toLocaleString()}\n`,
    '## Analytics\n',
  ]

  // Add analytics
  Object.entries(result.analytics).forEach(([term, count]) => {
    lines.push(`- ${term}: ${count} occurrences`)
  })

  lines.push('\n## Table of Contents\n')

  // Group matches by file
  const fileGroups = new Map<string, Match[]>()
  for (const match of result.matches) {
    const matches = fileGroups.get(match.relativePath) || []
    matches.push(match)
    fileGroups.set(match.relativePath, matches)
  }

  // Generate table of contents
  Array.from(fileGroups.keys())
    .sort()
    .forEach((file) => {
      const matches = fileGroups.get(file)!
      const firstMatch = matches[0]
      const relativeLink = `./${firstMatch.relativePath}`
      lines.push(`- [${firstMatch.relativePath}](${relativeLink}#L${firstMatch.line}) (${matches.length} items)`)
    })

  lines.push('\n## Matches\n')

  // Output matches grouped by file
  Array.from(fileGroups.entries())
    .sort()
    .forEach(([_, matches]) => {
      matches.forEach((match) => {
        const relativeLink = `./${match.relativePath}`
        lines.push(`[${match.relativePath}:${match.line}](${relativeLink}#L${match.line})`)
        lines.push('```')
        lines.push(match.content)
        if (match.contextLines.length > 0) {
          lines.push(...match.contextLines)
        }
        lines.push('```\n')
      })
    })

  return lines.join('\n')
}

export async function searchTodos(options: SearchOptions): Promise<SearchResult> {
  const searchTerms = options.searchTerms
  const fileExtensions = options.fileExtensions
  let rootDir = options.rootDir || process.cwd()

  // If in a git repo, use git root as base directory
  if (await isGitRepo(rootDir)) {
    rootDir = await getGitRoot(rootDir)
  }

  const matches: Match[] = []
  const analytics: Record<string, number> = {}

  // Initialize analytics counters
  searchTerms.forEach((term) => {
    analytics[term] = 0
  })

  // Search files
  for await (const file of walkDirectory(rootDir, fileExtensions)) {
    const fileMatches = await searchFile(file, searchTerms, rootDir, options.contextLines)
    matches.push(...fileMatches)

    // Update analytics
    fileMatches.forEach((match) => {
      analytics[match.term]++
    })
  }

  const result: SearchResult = {
    timestamp: new Date().toISOString(),
    matches,
    analytics,
  }

  // Generate output
  if (options.outputPath) {
    const content = options.format === 'json' ? JSON.stringify(result, null, 2) : generateMarkdown(result, rootDir)

    await fs.writeFile(options.outputPath, content)
  }

  return result
}
