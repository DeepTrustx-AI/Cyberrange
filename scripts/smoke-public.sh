#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 https://staging.example.com" >&2
  exit 2
fi

base_url=${1%/}
case "$base_url" in
  https://*) ;;
  *)
    echo "the smoke-test URL must use HTTPS" >&2
    exit 2
    ;;
esac

work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

curl --fail --silent --show-error --location \
  --retry 2 --connect-timeout 10 --max-time 30 \
  "$base_url/" --output "$work_dir/index.html"
grep --quiet --ignore-case '<!doctype html' "$work_dir/index.html"

curl --fail --silent --show-error \
  --retry 2 --connect-timeout 10 --max-time 30 \
  "$base_url/api/health" --output "$work_dir/health.json"
node - "$work_dir/health.json" <<'NODE'
const fs = require('node:fs');
const health = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (health.status !== 'ok' || health.connected !== true) {
  throw new Error('backend health response is not healthy');
}
NODE

redirect_code=$(curl --silent --show-error --output /dev/null \
  --write-out '%{http_code}' --connect-timeout 10 --max-time 30 \
  "$base_url/compliance-lab")
if [[ "$redirect_code" != "308" ]]; then
  echo "expected /compliance-lab to return 308; received $redirect_code" >&2
  exit 1
fi

echo "public smoke checks passed for $base_url"
