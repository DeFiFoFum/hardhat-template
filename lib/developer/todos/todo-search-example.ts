import { searchTodos } from './searchTodos'
import chalk from 'chalk'

/**
 * Basic example showing default usage
 */
async function basicExample() {
  console.log(chalk.cyan('\nRunning basic search...'))

  const result = await searchTodos({
    searchTerms: ['TODO', 'FIXME'],
    fileExtensions: ['.ts', '.sol'],
    contextLines: 1, // Show one line of context after each match
  })

  console.log(chalk.green('\nBasic search results:'))
  console.log('Total matches:', result.matches.length)
  console.log('\nAnalytics:')
  Object.entries(result.analytics).forEach(([term, count]) => {
    console.log(`- ${term}: ${count} occurrences`)
  })
}

/**
 * Advanced example showing different configurations
 */
async function advancedExample() {
  console.log(chalk.cyan('\nRunning advanced searches...'))

  // Example 1: Custom search terms
  console.log('\n1. Searching with custom terms...')
  const customSearch = await searchTodos({
    searchTerms: ['TODO', 'FIXME', 'HACK'],
    fileExtensions: ['.ts', '.sol'],
    outputPath: 'scripts/examples/output/custom-todos.md',
    format: 'markdown',
    contextLines: 3, // Show three lines of context after each match
  })

  console.log(chalk.green('Results saved to custom-todos.md'))
  console.log('Found:', customSearch.matches.length, 'matches')

  // Example 2: JSON output
  console.log('\n2. Generating JSON report...')
  const jsonSearch = await searchTodos({
    searchTerms: ['TODO'],
    outputPath: 'scripts/examples/output/todos.json',
    format: 'json',
    contextLines: 2, // Show two lines of context after each match
  })

  console.log(chalk.green('Results saved to todos.json'))
  console.log('Found:', jsonSearch.matches.length, 'matches')

  // Example 3: Multiple file extensions
  console.log('\n3. Searching multiple file types...')
  const multiExtSearch = await searchTodos({
    searchTerms: ['TODO'],
    fileExtensions: ['.ts', '.js', '.sol'],
    outputPath: 'scripts/examples/output/multi-ext-todos.md',
    contextLines: 1, // Show one line of context after each match
  })

  console.log(chalk.green('Results saved to multi-ext-todos.md'))
  console.log('Found:', multiExtSearch.matches.length, 'matches')
}

/**
 * Run all examples
 */
async function main() {
  try {
    // Run examples
    await basicExample()

    try {
      await advancedExample()
    } catch (error) {
      console.error(chalk.yellow('\nWarning: Some advanced examples failed:'))
      console.error(error instanceof Error ? error.message : error)
      console.log(chalk.gray('This is expected if certain directories do not exist.'))
    }

    console.log(chalk.green('\nAll examples completed successfully!'))
    console.log('\nTip: Check the generated output files in scripts/examples/output/:')
    console.log('- custom-todos.md (3 lines of context)')
    console.log('- todos.json (2 lines of context)')
    console.log('- multi-ext-todos.md (1 line of context)')
  } catch (error) {
    console.error(chalk.red('\nError running examples:'))
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Run the examples
main()
