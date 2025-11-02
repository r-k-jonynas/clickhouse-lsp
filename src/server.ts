import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  InitializeResult,
  SemanticTokensBuilder,
  SemanticTokensParams,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Parser, Language, Query } from 'web-tree-sitter';
import * as fs from 'fs';
import * as path from 'path';

// Create LSP connection
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let parser: Parser | null = null;
let clickhouseLanguage: Language | null = null;

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
    },
  };
  return result;
});

connection.onInitialized(async () => {
  try {
    // Initialize tree-sitter WASM
    await Parser.init();
    parser = new Parser();

    // Load ClickHouse language from WASM file
    const wasmPath = path.join(__dirname, '../tree-sitter-clickhouse.wasm');

    if (!fs.existsSync(wasmPath)) {
      connection.console.error(`WASM file not found at: ${wasmPath}`);
      connection.console.error('Please build the WASM file with: cd ../tree-sitter-clickhouse && npx tree-sitter build --wasm && cp tree-sitter-clickhouse.wasm ../clickhouse-lsp/');
      return;
    }

    clickhouseLanguage = await Language.load(wasmPath);
    parser.setLanguage(clickhouseLanguage);
    connection.console.log('ClickHouse parser initialized successfully');
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

  // Load highlights query
  const queryPath = path.join(__dirname, '../queries/highlights.scm');

  let querySource: string;
  try {
    querySource = fs.readFileSync(queryPath, 'utf8');
  } catch (error) {
    connection.console.error(`Failed to load highlights query: ${error}`);
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

// Listen for document changes
documents.listen(connection);
connection.listen();
