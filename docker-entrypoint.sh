#!/bin/sh
set -e

echo "Familienstammbaum: Datenbank wird vorbereitet…"
npx prisma migrate deploy

echo "Familienstammbaum: Server startet…"
exec "$@"
