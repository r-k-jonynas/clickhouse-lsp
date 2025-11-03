# Development Guide

This guide is for developers who want to contribute to or modify the ClickHouse LSP.

## Prerequisites

- Node.js (v18+)
- npm
- Emscripten (for building WASM parser)

## Initial Setup

### 1. Build the WASM Parser

First, ensure the tree-sitter parser is compiled to WASM:

```bash
git clone https://github.com/r-k-jonynas/tree-sitter-clickhouse.git
cd ../tree-sitter-clickhouse
npx tree-sitter build --wasm
cp tree-sitter-clickhouse.wasm ../clickhouse-lsp/parsers/
cd ../clickhouse-lsp
```

**Note:** This only needs to be done once, or when the grammar changes.

### 2. Install Dependencies

```bash
npm install
```

### 3. Compile TypeScript

```bash
npm run compile
```

## Development Workflow

### Watch Mode

Run TypeScript compiler in watch mode for automatic recompilation:

```bash
npm run watch
```

### Testing in VS Code

1. Open the `clickhouse-lsp` folder in VS Code
2. Press **F5** to launch the Extension Development Host
3. In the new window, open or create a `.sql` file
4. Changes require reloading the Extension Development Host window (Cmd/Ctrl+R)

### Testing Example

Create a test file with `.sql` extension:

```sql
CREATE TABLE users (
    id UInt64,
    name String,
    created DateTime
) ENGINE = MergeTree()
ORDER BY id;
```

You should see syntax highlighting for keywords, types, strings, etc.

## Project Structure

```
clickhouse-lsp/
├── src/
│   ├── server.ts          # LSP server with tree-sitter integration
│   └── extension.ts       # VS Code extension client
├── out/                   # Compiled JavaScript output
├── parsers/
│   └── tree-sitter-clickhouse.wasm  # Compiled parser (56KB)
├── queries/
│   └── highlights.scm     # Tree-sitter syntax highlighting queries
├── .vscode/
│   ├── launch.json        # VS Code debug configuration
│   └── tasks.json         # Build tasks
├── package.json           # Extension manifest and dependencies
├── tsconfig.json          # TypeScript configuration
└── language-configuration.json  # Basic language settings
```

## How It Works

### Architecture

```
┌─────────────────┐
│  Editor Client  │  (VS Code, Vim, Emacs, etc.)
└────────┬────────┘
         │ LSP Protocol (JSON-RPC)
         │
┌────────▼────────┐
│   LSP Server    │  (server.ts)
│  ┌───────────┐  │
│  │ web-tree- │  │
│  │ sitter    │  │
│  └─────┬─────┘  │
│        │        │
│  ┌─────▼─────┐  │
│  │ClickHouse │  │
│  │   WASM    │  │
│  │  Parser   │  │
│  └───────────┘  │
└─────────────────┘
```

### Key Components

1. **LSP Server (`server.ts`)**
   - Listens for LSP requests over stdio or IPC
   - Uses web-tree-sitter to parse SQL files
   - Executes highlight queries to identify tokens
   - Returns semantic tokens to the client

2. **Tree-sitter Parser (WASM)**
   - Pre-compiled to WebAssembly for portability
   - Parses ClickHouse SQL syntax
   - Built from `tree-sitter-clickhouse` grammar

3. **Highlight Queries (`queries/highlights.scm`)**
   - Tree-sitter query patterns
   - Maps syntax nodes to token types (keyword, type, string, etc.)
   - Sourced from `tree-sitter-clickhouse/queries/`

4. **VS Code Extension (`extension.ts`)**
   - Launches the LSP server as a child process
   - Manages client-server communication
   - Optional: only needed for VS Code integration

### Semantic Tokens Flow

1. Editor opens/edits a `.sql` file
2. Editor sends `textDocument/semanticTokens/full` request
3. Server parses the document with tree-sitter
4. Server runs highlight queries against the parse tree
5. Server collects matching nodes and their token types
6. Server encodes tokens in LSP delta format
7. Editor applies syntax highlighting based on token types

## Making Changes

### Modifying the LSP Server

Edit `src/server.ts` for:
- Adding new LSP capabilities (completions, diagnostics, etc.)
- Changing token mappings
- Performance optimizations

After changes:
```bash
npm run compile
# Reload Extension Development Host in VS Code (Cmd/Ctrl+R)
```

### Updating the Grammar

If you modify `tree-sitter-clickhouse`:

1. Update grammar in `tree-sitter-clickhouse/grammar.js`
2. Regenerate parser:
   ```bash
   cd tree-sitter-clickhouse
   npx tree-sitter generate
   npx tree-sitter test  # if you have tests
   ```
3. Rebuild WASM:
   ```bash
   npx tree-sitter build --wasm
   ```
4. Copy to LSP:
   ```bash
   cp tree-sitter-clickhouse.wasm ../clickhouse-lsp/parsers/
   ```
5. If highlights changed, copy query too:
   ```bash
   cp queries/highlights.scm ../clickhouse-lsp/queries/
   ```
6. Test in LSP

### Adding New Token Types

1. Add to `tokenTypes` array in `server.ts`:
   ```typescript
   const tokenTypes = [
     'keyword',
     'type',
     // ... add new type here
   ];
   ```

2. Update `captureToTokenType` mapping:
   ```typescript
   const captureToTokenType: Record<string, number> = {
     'keyword': 0,
     'type': 1,
     // ... add mapping for new capture name
   };
   ```

3. Ensure the capture name exists in `queries/highlights.scm`

## Testing with Other Editors

The server supports stdio transport for Vim, Neovim, Emacs, etc.

### Quick stdio test:

```bash
node out/server.js --stdio
```

The server will wait for LSP messages on stdin. See the main README for editor-specific configuration examples.

## Debugging

### VS Code Debugging

The `.vscode/launch.json` is pre-configured:
- Server runs with `--inspect=6009` in debug mode
- Set breakpoints in `src/server.ts`
- Use the Debug panel in VS Code

### Console Logging

Use the connection's console for logging:

```typescript
connection.console.log('Debug message');
connection.console.error('Error message');
```

Logs appear in VS Code's "ClickHouse Language Server" output panel.

## Common Issues

### "Incompatible language version" error

The WASM file and web-tree-sitter versions don't match.

**Fix:** Ensure `tree-sitter-cli` version matches `web-tree-sitter` in package.json. Currently using v0.25.10 for both.

### Syntax not highlighting after grammar change

Old WASM file is cached.

**Fix:** Rebuild WASM, copy to `clickhouse-lsp/`, and fully restart VS Code debug session (not just reload).

### TypeScript compilation errors

Dependencies might be out of sync.

**Fix:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run compile
```

## Building for Distribution

### Create VS Code Extension Package

```bash
npm run compile
npx vsce package
```

This creates `clickhouse-lsp-X.Y.Z.vsix`.

### Files Included in Distribution

See `.vscodeignore` for excluded files. The package includes:
- `out/` (compiled JavaScript)
- `parsers/tree-sitter-clickhouse.wasm`
- `queries/highlights.scm`
- `package.json`
- `language-configuration.json`

## Release Process

See [RELEASE.md](./RELEASE.md) for detailed release procedures.

## Contributing

1. Make changes in a feature branch
2. Test thoroughly with F5 in VS Code
3. Update documentation if needed
4. Ensure `npm run compile` succeeds without errors
5. Test with at least one other editor (Vim/Neovim/Emacs) if changing server code
6. Submit pull request with clear description

## Resources

- [Tree-sitter Documentation](https://tree-sitter.github.io/tree-sitter/)
- [LSP Specification](https://microsoft.github.io/language-server-protocol/)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [web-tree-sitter on npm](https://www.npmjs.com/package/web-tree-sitter)
