# - TODO Search Tool - Operations Guide

## Overview

The TODO Search Tool is a powerful utility for finding and tracking TODO comments and similar markers in your codebase. It provides:

- Interactive and CLI-based search
- Support for multiple search terms (TODO, FIXME, etc.)
- File extension filtering
- Command-clickable file links in VSCode
- Project-relative source links
- Analytics on found items
- Markdown and JSON output formats
- Configurable context lines after each match

## Installation

### Prerequisites

- Node.js ≥ 18.x
- yarn or npm
- TypeScript

### Setup

The tool is already integrated into the project's package.json. No additional setup is required.

## Usage

### 1. Interactive Mode

Run the tool with default settings:

```bash
yarn todos
```

This will show the default configuration:

- Search terms: TODO, FIXME
- File extensions: .ts, .sol
- Output: todo-report.md
- Format: Markdown
- Context lines: 1
- Root directory: Git repository root

You can accept these defaults or customize them through the interactive prompts.

### 2. CLI Mode

Run with specific arguments:

```bash
# Custom search terms
yarn todos --terms "TODO,FIXME,HACK"

# Specific file extensions
yarn todos --ext ".ts,.js,.sol"

# Custom output location and format
yarn todos --output "./reports/todos.json" --format json

# Search specific directory
yarn todos --dir "./contracts"

# Show more context lines
yarn todos --context 3
```

Available arguments:

- `--terms`: Comma-separated list of terms to search for
- `--ext`: Comma-separated list of file extensions to search
- `--dir`: Root directory for search
- `--output`: Output file path
- `--format`: Output format ('markdown' or 'json')
- `--context`: Number of lines to show after each match (default: 1)

### 3. Output Format

#### Markdown Output (Default)

The markdown output includes:

1. Header with generation timestamp
2. List of matches with:
   - Project-relative file paths
   - Line numbers
   - VSCode-compatible links
   - Source code links
   - Code context with following lines
3. Analytics section
4. Raw JSON data for processing

Example:

```markdown
# TODO Report
Generated on [timestamp]

## Matches

[contracts/VaultManager.sol:45](./contracts/VaultManager.sol#L45) [(source)](./contracts/VaultManager.sol#L45)
\`\`\`
// TODO: Implement validation
function validateTransaction() {  // First context line
  require(data.length > 0);      // Second context line (if context > 1)
\`\`\`

## Analytics
- TODO: 15 occurrences
- FIXME: 8 occurrences
```

#### JSON Output

JSON output provides structured data for programmatic processing:

```json
{
  "timestamp": "2025-02-19T21:07:51.000Z",
  "matches": [
    {
      "term": "TODO",
      "file": "contracts/VaultManager.sol",
      "line": 45,
      "content": "// TODO: Implement validation",
      "relativePath": "contracts/VaultManager.sol",
      "contextLines": [
        "function validateTransaction() {",
        "  require(data.length > 0);"
      ]
    }
  ],
  "analytics": {
    "TODO": 15,
    "FIXME": 8
  }
}
```

### 4. Best Practices

1. **Search Terms**
   - Use consistent TODO formats in your code
   - Consider project-specific markers

2. **File Extensions**
   - Include all relevant file types
   - Exclude build/output directories

3. **Output**
   - Use markdown for human reading
   - Use JSON for automation/processing
   - Save reports for tracking over time

4. **Context Lines**
   - Use 1-2 lines for quick overview
   - Use 3+ lines for more detailed context
   - Adjust based on code complexity

### 5. Quick Start Example

See `scripts/examples/todo-search-example.ts` for a runnable example:

```bash
yarn ts-node scripts/examples/todo-search-example.ts
```

### 6. Troubleshooting

Common issues and solutions:

1. **No matches found**
   - Check search terms (case-sensitive)
   - Verify file extensions
   - Confirm search directory

2. **File links not working**
   - Ensure using VSCode for clickable links
   - Use source links for GitHub/web viewing
   - Verify file exists at location

3. **Performance issues**
   - Limit file extensions
   - Use specific directory
   - Exclude node_modules (done automatically)
