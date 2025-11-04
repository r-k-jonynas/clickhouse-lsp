import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  InitializeResult,
  SemanticTokensBuilder,
  SemanticTokensParams,
  DocumentFormattingParams,
  TextEdit,
  Range,
  Position,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Parser, Language, Query } from 'web-tree-sitter';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

// Create LSP connection
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let parser: Parser | null = null;
let clickhouseLanguage: Language | null = null;

// Paths to resources (set during initialization)
let wasmPath: string | null = null;
let highlightsPath: string | null = null;
let clickhouseFormatPath: string = 'clickhouse-format'; // Default to PATH

// Semantic token types (must match the legend we send to client)
const tokenTypes = [
  'keyword',
  'type',
  'string',
  'number',
  'comment',
  'variable',
  'function',
  'operator',
  'punctuation',
];

const tokenModifiers: string[] = [];

// Map tree-sitter capture names to semantic token types
const captureToTokenType: Record<string, number> = {
  'keyword': 0,
  'type.builtin': 1,
  'type': 1,
  'string': 2,
  'number': 3,
  'comment': 4,
  'variable': 5,
  'function': 6,
  'operator': 7,
  'punctuation.bracket': 8,
  'punctuation.delimiter': 8,
};

interface Token {
  line: number;
  char: number;
  length: number;
  tokenType: number;
}

connection.onInitialize((params: InitializeParams): InitializeResult => {
  // Get paths from initialization options (VS Code)
  const initOptions = params.initializationOptions as {
    wasmPath?: string;
    highlightsPath?: string;
    clickhouseFormatPath?: string;
  } | undefined;

  if (initOptions?.wasmPath) {
    wasmPath = initOptions.wasmPath;
  }

  if (initOptions?.highlightsPath) {
    highlightsPath = initOptions.highlightsPath;
  }

  if (initOptions?.clickhouseFormatPath) {
    clickhouseFormatPath = initOptions.clickhouseFormatPath;
  }

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      semanticTokensProvider: {
        legend: {
          tokenTypes,
          tokenModifiers,
        },
        full: true,
      },
      documentFormattingProvider: true,
    },
  };
  return result;
});

connection.onInitialized(async () => {
  try {
    // Initialize tree-sitter WASM
    await Parser.init();
    parser = new Parser();

    // Determine WASM path: use provided path (VS Code) or fall back to default (stdio mode)
    const resolvedWasmPath = wasmPath || path.join(__dirname, '../parsers/tree-sitter-clickhouse.wasm');

    if (!fs.existsSync(resolvedWasmPath)) {
      connection.console.error(`WASM file not found at: ${resolvedWasmPath}`);
      connection.console.error('Please ensure the WASM file is built and located at the correct path.');
      return;
    }

    clickhouseLanguage = await Language.load(resolvedWasmPath);
    parser.setLanguage(clickhouseLanguage);
    connection.console.log(`ClickHouse parser initialized successfully from: ${resolvedWasmPath}`);
  } catch (error) {
    connection.console.error(`Failed to initialize parser: ${error}`);
  }
});

// Parse document and extract semantic tokens
function getSemanticTokens(document: TextDocument): number[] {
  if (!parser || !clickhouseLanguage) {
    return [];
  }

  const text = document.getText();
  const tree = parser.parse(text);

  if (!tree) {
    return [];
  }

  const tokens: Token[] = [];

  // Load highlights query: use provided path (VS Code) or fall back to default (stdio mode)
  const resolvedHighlightsPath = highlightsPath || path.join(__dirname, '../queries/highlights.scm');

  let querySource: string;
  try {
    querySource = fs.readFileSync(resolvedHighlightsPath, 'utf8');
  } catch (error) {
    connection.console.error(`Failed to load highlights query from ${resolvedHighlightsPath}: ${error}`);
    return [];
  }

  // Parse and execute query
  let query: Query;
  try {
    query = new Query(clickhouseLanguage, querySource);
  } catch (error) {
    connection.console.error(`Failed to parse query: ${error}`);
    return [];
  }

  const matches = query.matches(tree.rootNode);

  for (const match of matches) {
    for (const capture of match.captures) {
      const node = capture.node;
      const captureName = capture.name;

      const tokenTypeIndex = captureToTokenType[captureName];
      if (tokenTypeIndex === undefined) {
        continue;
      }

      const startPoint = node.startPosition;
      const endPoint = node.endPosition;

      // Handle multi-line nodes by creating token for first line only
      if (startPoint.row === endPoint.row) {
        tokens.push({
          line: startPoint.row,
          char: startPoint.column,
          length: endPoint.column - startPoint.column,
          tokenType: tokenTypeIndex,
        });
      } else {
        // For multi-line tokens, just highlight the first line
        const firstLineLength = text.split('\n')[startPoint.row].length - startPoint.column;
        tokens.push({
          line: startPoint.row,
          char: startPoint.column,
          length: firstLineLength,
          tokenType: tokenTypeIndex,
        });
      }
    }
  }

  // Sort tokens by line then char
  tokens.sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    return a.char - b.char;
  });

  // Convert to LSP semantic tokens format (delta encoding)
  const builder = new SemanticTokensBuilder();
  for (const token of tokens) {
    builder.push(token.line, token.char, token.length, token.tokenType, 0);
  }

  return builder.build().data;
}

connection.onRequest('textDocument/semanticTokens/full', (params: SemanticTokensParams) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return { data: [] };
  }

  const tokens = getSemanticTokens(document);
  return { data: tokens };
});

// Parse clickhouse-format error messages to make them more user-friendly
function parseClickHouseError(stderr: string): string {
  // Example error formats:
  // 1. Code: 62. DB::Exception: Syntax error (query): failed at position 38 (created) (line 3, col 5): created DateTime
  // 2. Code: 62. DB::Exception: Syntax error (query): failed at position 26 (status): status = 'active'

  // Try to extract line/column and problematic token
  const lineColMatch = stderr.match(/\(line (\d+), col (\d+)\)/);
  const tokenMatch = stderr.match(/failed at position \d+ \(([^)]+)\)/);
  const positionMatch = stderr.match(/failed at position (\d+)/);

  // Best case: we have line, column, and token
  if (lineColMatch && tokenMatch) {
    const [, line, col] = lineColMatch;
    const token = tokenMatch[1];
    return `Syntax error at line ${line}, column ${col}: unexpected '${token}'`;
  }

  // Good case: we have token but no line/col
  if (tokenMatch) {
    const token = tokenMatch[1];
    return `Syntax error: unexpected '${token}'`;
  }

  // Fallback case: we have position but no details
  if (positionMatch) {
    const position = positionMatch[1];
    return `Syntax error at position ${position}`;
  }

  // Last resort: show the first line of the exception
  const exceptionMatch = stderr.match(/DB::Exception: (.+?)(?=\.|$)/);
  if (exceptionMatch) {
    return exceptionMatch[1];
  }

  // Ultimate fallback: just show first line, stripped of code
  const firstLine = stderr.split('\n')[0].replace(/^Code: \d+\.\s*/, '');
  return `Formatting failed: ${firstLine || 'Unknown error'}`;
}

// Format document using clickhouse-format
async function formatDocument(document: TextDocument): Promise<TextEdit[]> {
  const text = document.getText();

  return new Promise((resolve) => {
    const process = spawn(clickhouseFormatPath, [], {
      timeout: 5000, // 5 second timeout
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('error', (error: NodeJS.ErrnoException) => {
      connection.console.error(`clickhouse-format spawn error: ${error.message}`);

      // Check if binary is not found
      if (error.code === 'ENOENT') {
        connection.window.showErrorMessage(
          `clickhouse-format not found. Please install ClickHouse or configure the binary path in settings.`
        );
      } else {
        connection.window.showErrorMessage(
          `Failed to run clickhouse-format: ${error.message}`
        );
      }
      resolve([]);
    });

    process.on('close', (code) => {
      if (code !== 0) {
        connection.console.error(`clickhouse-format exited with code ${code}: ${stderr}`);

        // Parse clickhouse-format error for better user message
        const errorMsg = parseClickHouseError(stderr);
        connection.window.showErrorMessage(errorMsg);
        resolve([]);
        return;
      }

      if (stderr.trim()) {
        connection.console.warn(`clickhouse-format stderr: ${stderr}`);
      }

      // Return a single TextEdit that replaces the entire document
      const lastLine = document.lineCount - 1;
      const lastChar = document.getText().split('\n')[lastLine]?.length || 0;

      resolve([
        TextEdit.replace(
          Range.create(
            Position.create(0, 0),
            Position.create(lastLine, lastChar)
          ),
          stdout
        ),
      ]);
    });

    // Write the document text to stdin
    process.stdin.write(text);
    process.stdin.end();
  });
}

connection.onDocumentFormatting(async (params: DocumentFormattingParams): Promise<TextEdit[]> => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  return formatDocument(document);
});

// Listen for document changes
documents.listen(connection);
connection.listen();
