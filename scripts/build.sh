#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

echo "==> Installing dependencies..."
npm ci

echo "==> Building..."
npm run build

echo "==> Done. Output is in dist/"

echo "==> Restarting server..."

sudo systemctl restart vape-master.service
