#!/bin/bash
# PostgreSQL backup script for Shaasthi
# Usage: ./scripts/db_backup.sh [output_dir]
# Recommended cron: 0 3 * * * /path/to/scripts/db_backup.sh /var/backups/shaasthi

set -euo pipefail

OUTPUT_DIR="${1:-/tmp/shaasthi_backups}"
mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="shaasthi_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

DB_HOST="${POSTGRES_HOST:-db}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-shaasthi}"
DB_USER="${POSTGRES_USER:-shaasthi}"
DB_PASSWORD="${POSTGRES_PASSWORD:-shaasthi}"

export PGPASSWORD="$DB_PASSWORD"

pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-acl \
  --compress=9 \
  --file="${OUTPUT_DIR}/${FILENAME}"

unset PGPASSWORD

find "$OUTPUT_DIR" -name "shaasthi_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup created: ${OUTPUT_DIR}/${FILENAME}"
echo "Old backups (${RETENTION_DAYS}d+) cleaned"
