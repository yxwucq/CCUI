#!/bin/bash
# Start CCUI stable build, targeting a project directory
# Usage: ./start.sh /path/to/project [port]
# Example: ./start.sh ~/Projects/mobcode 3457

DIR="$(cd "$(dirname "$0")/.." && pwd)"
export PROJECT_PATH="${1:-$(pwd)}"
export PORT="${2:-3457}"

exec node "$DIR/packages/server/dist/index.js"
