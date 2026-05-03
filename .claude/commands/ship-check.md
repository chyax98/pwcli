# /ship-check

Use this command before a local ship, release candidate, tag, or package dry run.

## Procedure

1. Read:
   - `AGENTS.md`
   - `codestable/architecture/release-v0.2.0.md`
   - `codestable/architecture/command-surface.md`
   - `skills/pwcli/SKILL.md`
2. Check `git status --short`; identify unrelated work.
3. Verify package contract:
   - `package.json` name/version/bin/files
   - `skills/pwcli/` included in package files
   - README does not duplicate full tutorial
4. Run release gate unless user asks for a lighter local precheck:

```bash
pnpm typecheck
pnpm build
pnpm smoke
git diff --check
npm pack --dry-run
```

5. If high-risk areas changed, add targeted validation:
   - session/profile/startup lock → real `pw session create/observe/close`
   - auth provider → `pw auth list` / `pw auth info <provider>` / targeted provider check
   - action/ref → real page click/fill/wait/verify
   - diagnostics → digest/export/bundle/run query
   - package/skill distribution → `node dist/cli.js skill path`
6. For release notes, only list shipped contract and known limitations. Do not write future design as supported.

## Output

Report:

- package contract status
- gate commands run and result
- high-risk targeted checks
- blocking P0/P1 issues
- release notes caveats
