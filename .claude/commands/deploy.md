---
description: Deploy latest changes — commit, push, restart service, verify
---

## Deploy Workflow

1. **Check status**: Run `git status` and `git diff --stat` to review changes
2. **Commit**: Stage and commit with a descriptive message
3. **Push**: Push to origin/main
4. **Restart**: Run `sudo systemctl restart command-centre`
5. **Verify**: Wait 5 seconds, then:
   - Check service status: `sudo systemctl is-active command-centre`
   - Check HTTP: `curl -s -o /dev/null -w "%{http_code}" https://cc.regulex.io`
   - Check logs: `sudo journalctl -u command-centre -n 10 --no-pager`
6. **Report**: Show deployment result — success or failure with logs

If any step fails, STOP and report the error. Do not continue blindly.
