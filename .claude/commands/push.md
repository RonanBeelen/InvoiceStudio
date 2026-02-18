Push code to GitHub repository (InvoiceStudio).

## Steps

1. Run `git status` to see all changed, staged, and untracked files
2. Review the changes and create a clear, concise commit message summarizing what changed
3. Stage all relevant files with `git add` (exclude secrets, .env, credentials, node_modules — these are in .gitignore)
4. Commit with a descriptive message
5. Push to `origin main` with `git push -u origin main`
6. Confirm success and show the commit hash

## Rules

- NEVER commit `.env`, `credentials.json`, `token.json`, or any secrets
- If there are no changes to commit, inform the user and skip
- If there are merge conflicts or push errors, explain the issue and ask for guidance
- Use conventional commit style: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:` etc.
- Always show what files will be committed before committing
