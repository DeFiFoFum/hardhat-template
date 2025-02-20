# - TODO Search Tool - Maintenance Guide

## Architecture

The tool is split into two main components:

### 1. Core Module (`search-todos.ts`)

The core search functionality is implemented as a TypeScript module with these key components:

```typescript
export interface SearchOptions {
  searchTerms: string[];
  fileExtensions?: string[];
  rootDir?: string;
  outputPath?: string;
  format?: 'markdown' | 'json';
  contextLines?: number; // Number of lines to show after each match
}

interface Match {
  term: string;
  file: string;
  line: number;
  content: string;
  absolutePath: string;    // Used for VSCode links
  relativePath: string;    // Used for portable/shareable links
  contextLines: string[];  // Lines following the match
}
```

Key functions:

- `walkDirectory`: Async generator for recursive file traversal
- `searchFile`: File content search with line tracking and context
- `generateMarkdown`: Privacy-aware report generation
- `searchTodos`: Main entry point coordinating the search

### 2. CLI Interface (`search-todos-cli.ts`)

Command-line interface with interactive features:

- Argument parsing
- Default options
- Interactive prompts
- Colored output

## Dependencies

### 1. [prompts](https://github.com/terkelg/prompts)

- Purpose: Interactive CLI interface
- Version: ^2.4.2
- Key features used:
  - Confirmation prompts
  - List inputs
  - Text inputs
  - Selection menus

### 2. [chalk](https://github.com/chalk/chalk)

- Purpose: Terminal styling
- Version: 4.1.1
- Usage:
  - Success messages (green)
  - Information (cyan)
  - Secondary info (gray)
  - Errors (red)

## Key Components

### 1. File System Operations

```typescript
async function* walkDirectory(dir: string, extensions?: string[]) {
  // Recursive file traversal
  // Filters by extension
  // Skips node_modules and .git
}

async function searchFile(filePath: string, searchTerms: string[], rootDir: string, contextLines: number = 1) {
  // Read file content
  // Search for terms
  // Capture context lines after each match
  // Return matches with both absolute and relative paths
}
```

### 2. Git Integration

```typescript
async function isGitRepo(dir: string): Promise<boolean>
async function getGitRoot(dir: string): Promise<string>
```

Uses `git` commands to:

- Detect git repositories
- Find repository root for relative paths
- Support portable file references

### 3. Search Implementation

```typescript
async function searchFile(filePath: string, searchTerms: string[]): Promise<Match[]>
```

- Line-by-line search
- Tracks line numbers
- Preserves context
- Handles multiple search terms
- Generates both absolute and relative paths

### 4. Output Generation

Two formats supported:

1. Markdown
   - Project-relative links
   - VSCode-compatible links
   - Code blocks with context lines
   - Privacy-aware data
2. JSON
   - Relative paths for portability
   - Optional absolute paths
   - Context lines included
   - Analytics data

## Extending the Tool

### 1. Adding New Features

#### Search Capabilities

```typescript
// Add to SearchOptions interface
interface SearchOptions {
  // Add new options here
  caseSensitive?: boolean;
  maxDepth?: number;
  contextLines?: number;
}

// Implement in searchTodos function
export async function searchTodos(options: SearchOptions) {
  // Handle new options
}
```

#### Output Formats

```typescript
// Add new format to type
format?: 'markdown' | 'json' | 'html';

// Add generator function
function generateHtml(result: SearchResult): string {
  // Generate HTML output
}
```

### 2. Version 2 Features

Planned enhancements:

1. Branch Comparison

   ```typescript
   interface BranchCompareOptions extends SearchOptions {
     baseBranch: string;
     compareBranch: string;
   }
   ```

2. Enhanced Analytics
   - Category grouping
   - Age tracking
   - Author attribution

### 3. Performance Optimizations

Current optimizations:

- Skips node_modules and .git
- Uses async generators
- Filters by extension early

Potential improvements:

- Parallel file processing
- Caching results
- Incremental updates

## Testing

### Manual Testing

1. Basic Functionality

```bash
# Test default behavior (1 context line)
yarn todos

# Test with custom terms and context
yarn todos --terms "DEBUG,REMOVE" --context 3
```

2. Edge Cases

- Empty directories
- Large files
- Special characters in paths
- Non-text files
- Symlinks

### Integration Points

1. VSCode Integration

- File links use absolute paths
- Line numbers in hash fragment
- URI encoding for special characters

2. Git Integration

- Repository detection
- Branch handling
- Path resolution

## Future Considerations

1. Performance

- File reading strategies
- Search algorithms
- Memory usage

2. Extensibility

- Plugin system
- Custom formatters
- Search strategies

3. Integration

- CI/CD integration
- Pre-commit hooks
- Automated reporting

4. Privacy & Portability

- Project-relative paths
- Configurable path handling
- Sanitized output options
