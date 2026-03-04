#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

echo "==> Checking for vulnerabilities..."
npm audit

echo ""
echo "==> Applying automatic security fixes..."
npm audit fix

echo ""
echo "==> Updating dependencies to latest allowed versions..."
npm update

echo ""
echo "==> Done. Run scripts/build.sh to rebuild with updated packages."
