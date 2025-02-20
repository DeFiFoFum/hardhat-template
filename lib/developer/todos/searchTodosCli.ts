#!/usr/bin/env node
import { searchTodos, type SearchOptions } from './searchTodos'
import path from 'path'
import prompts from 'prompts'
import chalk from 'chalk'

interface CliOptions {
  terms?: string
  ext?: string
  dir?: string
  output?: string
  format?: 'markdown' | 'json'
  context?: string
}

const DEFAULT_OPTIONS: SearchOptions = {
  searchTerms: ['TODO', 'FIXME'],
  fileExtensions: ['.ts', '.sol'],
  outputPath: 'todo-report.md',
  format: 'markdown',
  rootDir: process.cwd(),
  contextLines: 1,
}

function parseArgs(): CliOptions {
  const args: CliOptions = {}
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i]
    if (arg.startsWith('--')) {
      const value = process.argv[i + 1]
      switch (arg) {
        case '--terms':
          args.terms = value
          break
        case '--ext':
          args.ext = value
          break
        case '--dir':
          args.dir = value
          break
        case '--output':
          args.output = value
          break
        case '--format':
          args.format = value as 'markdown' | 'json'
          break
        case '--context':
          args.context = value
          break
      }
      i++
    }
  }
  return args
}

async function confirmDefaults(cliOptions: CliOptions): Promise<SearchOptions> {
  const options = { ...DEFAULT_OPTIONS }

  if (Object.keys(cliOptions).length === 0) {
    console.log(chalk.cyan('\nDefault configuration:'))
    console.log(chalk.gray('- Search terms:'), DEFAULT_OPTIONS.searchTerms.join(', '))
    console.log(chalk.gray('- File extensions:'), DEFAULT_OPTIONS.fileExtensions!.join(', '))
    console.log(chalk.gray('- Output file:'), DEFAULT_OPTIONS.outputPath)
    console.log(chalk.gray('- Format:'), DEFAULT_OPTIONS.format)
    console.log(chalk.gray('- Context lines:'), DEFAULT_OPTIONS.contextLines)
    console.log(chalk.gray('- Root directory:'), process.cwd())

    const { confirmed } = await prompts({
      type: 'confirm',
      name: 'confirmed',
      message: 'Are these defaults okay?',
      initial: true,
    })

    if (!confirmed) {
      const responses = await prompts([
        {
          type: 'list',
          name: 'searchTerms',
          message: 'Enter search terms (comma-separated):',
          initial: DEFAULT_OPTIONS.searchTerms.join(','),
          separator: ',',
        },
        {
          type: 'list',
          name: 'fileExtensions',
          message: 'Enter file extensions (comma-separated):',
          initial: DEFAULT_OPTIONS.fileExtensions!.join(','),
          separator: ',',
        },
        {
          type: 'text',
          name: 'outputPath',
          message: 'Enter output file path:',
          initial: DEFAULT_OPTIONS.outputPath,
        },
        {
          type: 'select',
          name: 'format',
          message: 'Select output format:',
          choices: [
            { title: 'Markdown', value: 'markdown' },
            { title: 'JSON', value: 'json' },
          ],
          initial: 0,
        },
        {
          type: 'number',
          name: 'contextLines',
          message: 'Number of context lines to show after each match:',
          initial: DEFAULT_OPTIONS.contextLines,
        },
      ])

      return {
        searchTerms: responses.searchTerms,
        fileExtensions: responses.fileExtensions,
        outputPath: responses.outputPath,
        format: responses.format,
        rootDir: process.cwd(),
        contextLines: responses.contextLines,
      } as SearchOptions
    }
  } else {
    if (cliOptions.terms) {
      options.searchTerms = cliOptions.terms.split(',')
    }
    if (cliOptions.ext) {
      options.fileExtensions = cliOptions.ext.split(',')
    }
    if (cliOptions.dir) {
      options.rootDir = cliOptions.dir
    }
    if (cliOptions.output) {
      options.outputPath = cliOptions.output
    }
    if (cliOptions.format) {
      options.format = cliOptions.format
    }
    if (cliOptions.context) {
      options.contextLines = parseInt(cliOptions.context, 10)
    }
  }

  return options as SearchOptions
}

async function main() {
  try {
    const cliOptions = parseArgs()
    const options = await confirmDefaults(cliOptions)

    console.log(chalk.cyan('\nSearching for TODOs...'))
    const result = await searchTodos(options)

    console.log(chalk.green('\nSearch completed!'))
    console.log(chalk.gray('Total matches:'), result.matches.length)
    console.log(chalk.gray('Analytics:'))
    Object.entries(result.analytics).forEach(([term, count]) => {
      console.log(`- ${term}: ${count} occurrences`)
    })

    if (options.outputPath) {
      console.log(chalk.gray('\nReport saved to:'), options.outputPath)
      console.log(chalk.gray('You can Command+Click on file paths in the report to open them in VSCode'))
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
