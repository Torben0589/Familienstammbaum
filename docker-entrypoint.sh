#!/bin/sh
set -e

echo "Familienstammbaum: Datenbank wird vorbereitet…"
node node_modules/prisma/build/index.js migrate deploy

echo "Familienstammbaum: Server startet…"
exec "$@"
