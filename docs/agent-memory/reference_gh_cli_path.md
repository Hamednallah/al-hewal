---
name: reference-gh-cli-path
description: 'On this Windows machine `gh` is NOT on PATH for Bash OR PowerShell; call gh.exe by absolute path'
metadata:
  node_type: memory
  type: reference
  originSessionId: ec428393-53a9-4fa7-a81f-c55ac530d492
---

`gh` CLI is installed at `C:\Program Files\GitHub CLI\gh.exe` but is not on PATH for either the git-bash shell or PowerShell sessions Claude Code spawns. Both `gh ...` and `Get-Command gh` fail with "not found".

**How to use it:**

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" pr create --title "..." --body $body
& "C:\Program Files\GitHub CLI\gh.exe" pr merge <n> --auto --squash --delete-branch
& "C:\Program Files\GitHub CLI\gh.exe" run list --branch <branch> --limit 5
& "C:\Program Files\GitHub CLI\gh.exe" run watch <id> --exit-status
& "C:\Program Files\GitHub CLI\gh.exe" run view <id> --json status,conclusion,jobs
```

Use the PowerShell tool (not Bash) and always quote the path. The `&` call operator handles the space in "GitHub CLI".

Related: [[feedback-monitor-ci]] — the post-push CI-watch workflow.
