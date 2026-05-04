# /docs-maintain

Use this command to maintain `skills/pwcli/` and `codestable/architecture/` without turning docs into process logs.

## Procedure

1. Read:
   - `AGENTS.md`
   - `codestable/architecture/documentation-governance.md`
   - `.claude/rules/08-skill-maintenance.md`
   - `.claude/rules/09-skill-writing-standard.md`
2. Check `git status --short`; do not overwrite unrelated work.
3. Identify the change type:
   - command / flag / output / error code
   - workflow
   - limitation / recovery
   - architecture boundary
   - docs cleanup
4. Apply the routing rules:
   - `SKILL.md`: external Agent instruction + 80% high-frequency routing only
   - CLI `--help`: precise command parameters, flags, outputs, errors
   - `references/workflows.md`: executable task chains and success criteria
   - `references/failure-recovery.md`: blocked state, recovery, evidence handoff
   - `references/forge-dc-auth.md`: DC provider usage rules
   - `codestable/architecture/`: architecture facts, contracts, ADRs, stable conclusions
5. Remove or rewrite:
   - process plans
   - surveys not converted to ADR/decision notes
   - issue/backlog candidates
   - true internal implementation explanations inside `SKILL.md`
   - real business domains, accounts, tokens, cookies, state
6. Validate:
   - `pnpm build`
   - targeted grep for forbidden terms if relevant
   - command help checks if command surface changed

## Output

Report:

- files changed
- P1/P2/P3 doc issues fixed
- validation run
- remaining cleanup items
