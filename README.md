# ClickHouse LSP

A minimal Language Server Protocol (LSP) implementation for ClickHouse SQL with syntax highlighting support.

Should (?) work with **VS Code (tested), Vim, Neovim, Emacs**, and any other editor that supports LSP.

## Features

- Syntax highlighting for ClickHouse SQL files (.sql)
- Powered by tree-sitter parser (WASM)
- Editor-agnostic via standard LSP protocol

## Installation

### Global Install (Recommended)

Install the LSP server globally to use with any editor:

```bash
git clone <repository-url>
cd clickhouse-lsp
npm install
npm run compile
npm install -g .
```

This adds `clickhouse-lsp` to your PATH. Now you can use it in any editor with just:
```
clickhouse-lsp --stdio
```

### VS Code Extension

For VS Code users who prefer the extension (packaged with VS Code-specific features):

```bash
npm run compile
npx vsce package
```

Then install the `.vsix` file via Extensions → "Install from VSIX..."

### For Developers

See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed setup and development instructions.

## Editor Configuration

The LSP server works with any editor that supports the Language Server Protocol. Below are configuration examples for popular editors.

### VS Code

1. Package the extension:
   ```bash
   npx vsce package
   ```

2. Install the `.vsix` file:
   - Open VS Code
   - Go to Extensions panel (Cmd/Ctrl+Shift+X)
   - Click "..." menu → "Install from VSIX..."
   - Select the generated `.vsix` file

Alternatively, for development/testing, see [DEVELOPMENT.md](./DEVELOPMENT.md).

### Neovim (Native LSP)

After global installation, add to your `~/.config/nvim/init.lua`:

```lua
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

-- Define ClickHouse LSP
if not configs.clickhouse_lsp then
  configs.clickhouse_lsp = {
    default_config = {
      cmd = {'clickhouse-lsp', '--stdio'},
      filetypes = {'sql'},
      root_dir = lspconfig.util.root_pattern('.git', vim.fn.getcwd()),
      settings = {},
    },
  }
end

-- Enable it
lspconfig.clickhouse_lsp.setup{}
```

### Vim with coc.nvim

Add to `~/.vim/coc-settings.json` or `~/.config/nvim/coc-settings.json`:

```json
{
  "languageserver": {
    "clickhouse": {
      "command": "clickhouse-lsp",
      "args": ["--stdio"],
      "filetypes": ["sql"],
      "rootPatterns": [".git/"]
    }
  }
}
```

### Vim with vim-lsp

Add to `~/.vimrc`:

```vim
if executable('clickhouse-lsp')
  au User lsp_setup call lsp#register_server({
    \ 'name': 'clickhouse-lsp',
    \ 'cmd': {server_info->['clickhouse-lsp', '--stdio']},
    \ 'allowlist': ['sql'],
    \ })
endif
```

### Emacs with eglot

Add to `~/.emacs.d/init.el` or `~/.config/emacs/init.el`:

```elisp
(require 'eglot)

;; Register ClickHouse LSP
(add-to-list 'eglot-server-programs
             '(sql-mode . ("clickhouse-lsp" "--stdio")))

;; Auto-start eglot for SQL files (optional)
(add-hook 'sql-mode-hook 'eglot-ensure)
```

Or with `use-package`:

```elisp
(use-package eglot
  :ensure t
  :config
  (add-to-list 'eglot-server-programs
               '(sql-mode . ("clickhouse-lsp" "--stdio")))
  :hook (sql-mode . eglot-ensure))
```

### Emacs with lsp-mode

Add to `~/.emacs.d/init.el`:

```elisp
(require 'lsp-mode)

;; Register ClickHouse LSP
(lsp-register-client
 (make-lsp-client
  :new-connection (lsp-stdio-connection '("clickhouse-lsp" "--stdio"))
  :major-modes '(sql-mode)
  :server-id 'clickhouse-lsp))

;; Auto-start for SQL files (optional)
(add-hook 'sql-mode-hook #'lsp-deferred)
```

### Helix

Add to `~/.config/helix/languages.toml`:

```toml
[[language]]
name = "sql"
language-servers = ["clickhouse-lsp"]

[language-server.clickhouse-lsp]
command = "clickhouse-lsp"
args = ["--stdio"]
```

### Sublime Text with LSP

Add to LSP settings (`Preferences: LSP Settings`):

```json
{
  "clients": {
    "clickhouse-lsp": {
      "enabled": true,
      "command": ["clickhouse-lsp", "--stdio"],
      "selector": "source.sql"
    }
  }
}
```

## Example

Create a `.sql` file to see syntax highlighting in action:

```sql
-- ClickHouse SQL Example
CREATE TABLE IF NOT EXISTS events (
    event_id UInt64,
    user_id UInt64,
    event_name String,
    event_time DateTime,
    properties Map(String, String),
    tags Array(String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (user_id, event_time)
PRIMARY KEY (user_id)
SETTINGS index_granularity = 8192;

SELECT
    count() AS total,
    sum(event_id) AS sum_ids,
    toDate(event_time) AS event_date
FROM events
WHERE event_name LIKE 'click%'
  AND event_time >= now() - INTERVAL 7 DAY
GROUP BY event_date
ORDER BY event_date DESC;
```

## Contributing

Contributions are welcome! Please see [DEVELOPMENT.md](./DEVELOPMENT.md) for:
- Development setup
- Project architecture
- How to make changes
- Testing procedures
- Release process

## License

MIT
