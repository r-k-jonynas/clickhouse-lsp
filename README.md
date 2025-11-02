# ClickHouse LSP

A minimal Language Server Protocol (LSP) implementation for ClickHouse SQL with syntax highlighting support in Visual Studio Code.

## Features

- Syntax highlighting for ClickHouse SQL files (.sql)
- Powered by tree-sitter parser

## Setup

1. Ensure the WASM parser is built (only needed once or after grammar changes):
```bash
cd ../tree-sitter-clickhouse
npx tree-sitter build --wasm
cp tree-sitter-clickhouse.wasm ../clickhouse-lsp/
cd ../clickhouse-lsp
```

2. Install dependencies:
```bash
npm install
```

3. Compile the TypeScript code:
```bash
npm run compile
```

4. Open this folder in VS Code and press F5 to launch the extension in a new Extension Development Host window.

5. In the Extension Development Host, create a new file with `.sql` extension and start typing ClickHouse SQL:
```sql
CREATE TABLE users (
    id UInt64,
    name String,
    created DateTime
) ENGINE = MergeTree()
ORDER BY id;
```

You should see syntax highlighting for keywords, types, strings, etc.

## Development

- Run `npm run watch` to compile TypeScript in watch mode
- Press F5 in VS Code to launch the extension
- Reload the Extension Development Host window after making changes

## Project Structure

- `src/server.ts` - LSP server implementation with tree-sitter integration
- `src/extension.ts` - VS Code extension client
- `package.json` - Extension manifest and dependencies
- `language-configuration.json` - Basic language configuration (brackets, comments)

## How It Works

The LSP server uses tree-sitter to parse ClickHouse SQL files and provides semantic tokens for syntax highlighting. It loads the highlight queries from the tree-sitter-clickhouse grammar to identify tokens like keywords, types, strings, numbers, and comments.
