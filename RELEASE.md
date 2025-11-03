# Release Planning Guide

This document outlines the release process for the ClickHouse LSP extension.

## Project Dependencies

The LSP has two main components:
1. **LSP Server/Extension** (`clickhouse-lsp/`) - TypeScript code providing language server features
2. **Grammar** (`tree-sitter-clickhouse/`) - Tree-sitter grammar that generates the WASM parser

## Release Scenarios

### Scenario 1: LSP-only Changes (Most Common)

**When:** Bug fixes, performance improvements, new LSP features (completions, diagnostics), configuration changes

**What Changed:** Code in `clickhouse-lsp/src/`

**Likelihood:** High - This is the most common type of update as you iterate on features

**Process:**
1. Make changes to LSP code in `clickhouse-lsp/src/`
2. Test locally with F5 in VS Code
3. Update version in `clickhouse-lsp/package.json`
4. Compile: `npm run compile`
5. **No need to rebuild WASM** - grammar unchanged
6. Package extension: `npx vsce package`
7. Tag release: `git tag v0.2.0`
8. Publish or distribute the `.vsix` file

**Time:** ~5 minutes

---

### Scenario 2: Grammar-only Changes (Moderate)

**When:** Adding new SQL syntax support, fixing parsing errors, improving highlight queries

**What Changed:**
- `tree-sitter-clickhouse/grammar.js`
- `tree-sitter-clickhouse/queries/highlights.scm`

**Likelihood:** Moderate - Happens when ClickHouse adds new syntax or you find parsing bugs

**Process:**
1. Make changes to grammar in `tree-sitter-clickhouse/`
2. Regenerate parser:
   ```bash
   cd tree-sitter-clickhouse
   npx tree-sitter generate
   npx tree-sitter test  # if you have tests
   ```
3. **Rebuild WASM:**
   ```bash
   npx tree-sitter build --wasm
   ```
4. **Copy WASM to LSP:**
   ```bash
   cp tree-sitter-clickhouse.wasm ../clickhouse-lsp/parsers/
   ```
5. **If highlights.scm changed, copy it too:**
   ```bash
   cp queries/highlights.scm ../clickhouse-lsp/queries/
   ```
6. Test in LSP (F5 in VS Code)
7. Update version in `clickhouse-lsp/package.json`
8. Compile LSP: `cd ../clickhouse-lsp && npm run compile`
9. Package: `npx vsce package`
10. Tag both repos:
    ```bash
    cd ../tree-sitter-clickhouse && git tag grammar-v0.2.0
    cd ../clickhouse-lsp && git tag v0.2.0
    ```
11. Publish

---

### Scenario 3: Both LSP and Grammar Changes (Rare)

**When:** Major feature requiring both new syntax and LSP features (e.g., adding support for a new ClickHouse statement type with autocomplete)

**What Changed:** Both `tree-sitter-clickhouse/` and `clickhouse-lsp/src/`

**Likelihood:** Low - Usually changes are isolated to one component

**Process:**
Combine both processes above:
1. Update grammar first (Scenario 2, steps 1-5)
2. Update LSP code (Scenario 1, step 1)
3. Test together
4. Version and package (Scenario 2, steps 7-11)a

---

## Version Management Strategy

### Option A: Independent Versioning (Recommended)
- `tree-sitter-clickhouse`: `0.1.0`, `0.2.0`, etc.
- `clickhouse-lsp`: `0.1.0`, `0.2.0`, etc.
- They version independently
- LSP package.json can note compatible grammar version in description

**Pros:** Clear what changed, follows semver naturally
**Cons:** Need to track compatibility

### Option B: Synchronized Versioning
- Both bump versions together even if only one changed
- Easier to communicate "use LSP v0.3.0 with grammar v0.3.0"

**Pros:** Simple compatibility story
**Cons:** Unnecessary version bumps, less semantic

**Recommendation:** Use Option A with compatibility notes

---

## Automation Recommendations

### Short-term (Manual)
Keep the current manual process documented here. It's simple enough for early development.

### Medium-term (Scripted)
Create release scripts:

**`scripts/release-grammar.sh`:**
```bash
#!/bin/bash
cd tree-sitter-clickhouse
npx tree-sitter generate
npx tree-sitter build --wasm
cp tree-sitter-clickhouse.wasm ../clickhouse-lsp/parsers/
cp queries/highlights.scm ../clickhouse-lsp/queries/
echo "Grammar rebuilt and copied to LSP"
```

**`scripts/release-lsp.sh`:**
```bash
#!/bin/bash
cd clickhouse-lsp
npm run compile
npx vsce package
echo "LSP packaged - ready to publish"
```

### Long-term (CI/CD)
Set up GitHub Actions:
1. **On grammar change:** Auto-build WASM, open PR to LSP with updated WASM
2. **On LSP change:** Run tests, build package
3. **On tag:** Auto-publish to VS Code marketplace

---

## Distribution Strategy

### Development Phase (Current)
- Manual testing with F5
- Share `.vsix` files directly

### Beta Phase
- Publish to VS Code marketplace as pre-release
- Get user feedback

### Stable Phase
- Publish stable releases to marketplace
- Maintain changelog
- Semantic versioning

---

## Checklist Template

### Pre-Release
- [ ] All tests pass (when you add them)
- [ ] WASM file is up to date (if grammar changed)
- [ ] Version bumped in package.json
- [ ] CHANGELOG.md updated
- [ ] Test with F5 in clean VS Code install

### Release
- [ ] Compile: `npm run compile`
- [ ] Package: `npx vsce package`
- [ ] Test the .vsix file
- [ ] Git tag created
- [ ] Published to marketplace (or distributed)

### Post-Release
- [ ] Verify installation works
- [ ] Monitor for issues
- [ ] Update documentation if needed

---

## Common Issues

**Issue:** "Incompatible language version" error
**Cause:** WASM file and web-tree-sitter versions don't match
**Fix:** Ensure `tree-sitter-cli` and `web-tree-sitter` package versions are compatible

**Issue:** Syntax not highlighting after grammar change
**Cause:** Old WASM file cached or not copied
**Fix:** Rebuild WASM and restart VS Code debug session

**Issue:** Extension not loading
**Cause:** Compilation errors or missing files
**Fix:** Check `npm run compile` output and verify WASM file exists

---

## FAQ

**Q: Do I need to republish the grammar separately?**
A: No, the grammar is bundled as WASM in the LSP extension. The tree-sitter-clickhouse repo is just the source.

**Q: Can users update the grammar without updating the LSP?**
A: No, they're bundled together. Grammar updates require a new LSP release.

**Q: Should I version the WASM file in git?**
A: Yes, include it for convenience. It's only ~56KB and makes builds simpler.

**Q: How often should I release?**
A:
- Grammar changes: When ClickHouse syntax is updated or bugs are found
- LSP changes: When new features are ready or bugs are fixed
- Aim for stable releases every 1-2 months, patch releases as needed
