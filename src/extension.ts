import * as path from 'path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  // Path to the server module
  const serverModule = context.asAbsolutePath(path.join('out', 'server.js'));

  // Resolve WASM file path using VS Code URI
  const wasmUri = vscode.Uri.joinPath(context.extensionUri, 'parsers', 'tree-sitter-clickhouse.wasm');
  const wasmPath = wasmUri.fsPath;

  // Resolve highlights query path
  const highlightsUri = vscode.Uri.joinPath(context.extensionUri, 'queries', 'highlights.scm');
  const highlightsPath = highlightsUri.fsPath;

  // Get clickhouse-format path from configuration
  const config = vscode.workspace.getConfiguration('clickhouseLsp');
  const clickhouseFormatPath = config.get<string>('formatPath', 'clickhouse-format');

  // Debug options for the server
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  // Server options: run the server in Node.js
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  // Client options: configure the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'clickhousesql' }],
    synchronize: {
      // Notify the server about file changes to '.sql' files in the workspace
      fileEvents: [],
    },
    initializationOptions: {
      wasmPath,
      highlightsPath,
      clickhouseFormatPath,
    },
  };

  // Create and start the language client
  client = new LanguageClient(
    'clickhouseLsp',
    'ClickHouse Language Server',
    serverOptions,
    clientOptions
  );

  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
