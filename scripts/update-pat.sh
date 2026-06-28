#!/usr/bin/env bash
# update-pat.sh — Update the DEV_HARNESS_PAT secret in the ops repo.
#
# The sync workflow (sync-dev-harness.yml) needs a GitHub Personal Access Token
# with write access to bakr-bagaber/dev-harness. If the PAT is expired or
# corrupted, the sync fails with:
#   "Cannot convert argument to a ByteString because the character at index 6
#    has a value of 1578 which is greater than 255."
#
# Usage:
#   1. Create a new PAT at: https://github.com/settings/tokens
#      - Classic token with "repo" scope
#      - OR fine-grained with Contents: Read/Write on bakr-bagaber/dev-harness
#   2. Run this script and paste the token when prompted:
#      ./scripts/update-pat.sh
#
set -euo pipefail

REPO="bakr-bagaber/ops"
SECRET_NAME="DEV_HARNESS_PAT"

echo "=== Update DEV_HARNESS_PAT secret ==="
echo ""
echo "Step 1: Create a new PAT at https://github.com/settings/tokens"
echo "  - Classic token: check 'repo' scope"
echo "  - Fine-grained: Contents Read/Write on bakr-bagaber/dev-harness"
echo ""
echo "Step 2: Paste the token below (it will be hidden)"
echo ""

read -s -p "Paste your new PAT: " TOKEN
echo ""

if [ -z "$TOKEN" ]; then
  echo "✗ No token provided. Aborting."
  exit 1
fi

# Validate token is ASCII (the previous token had non-ASCII chars at index 6)
if ! echo "$TOKEN" | LC_ALL=C grep -q '^[[:print:]]+$'; then
  echo "✗ Token contains non-ASCII characters. Please re-copy the token carefully."
  exit 1
fi

echo "Setting secret..."
echo "$TOKEN" | gh secret set "$SECRET_NAME" --repo "$REPO"
echo "✓ Secret updated."

# Verify
echo ""
echo "Verifying..."
gh secret list --repo "$REPO" | grep "$SECRET_NAME" && echo "✓ Secret exists." || echo "✗ Secret not found."

# Trigger sync workflow
echo ""
echo "Triggering sync workflow..."
gh workflow run sync-dev-harness.yml --repo "$REPO"
echo "✓ Workflow triggered. Check: gh run list --workflow=sync-dev-harness.yml --repo $REPO"

unset TOKEN