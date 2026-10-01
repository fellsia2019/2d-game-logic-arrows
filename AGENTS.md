# Git branches

- For repository work, use the existing `main` branch. Do not create or push another branch unless the user explicitly asks for a branch.
- A detached worktree is not permission to create a branch. Find the repository's `main` checkout or arrange work there without adding a branch.
- When asked to commit or push, integrate the changes into `main` and push `main`. Verify the working tree and remote state first.
- Do not delete a branch with unique commits until its needed changes are present and verified in `main`.
