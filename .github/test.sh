#!/bin/bash
set -e

test_api() {
    pnpm --dir api run test:contract
}

setup_web() {
    pnpm run --prefix web check
    pnpm run --prefix web build
}

cd "$(git rev-parse --show-toplevel)"
pnpm install --frozen-lockfile

if [ "$1" = "api" ]; then
    test_api
elif [ "$1" = "web" ]; then
    setup_web
else
    echo "usage: $0 <api/web>" >&2
    exit 1
fi
