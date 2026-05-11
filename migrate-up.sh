#!/bin/bash

# Скрипт для применения миграций
# Usage: ./migrate-up.sh [migration_file]

set -e

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Загрузка переменных окружения из .env
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Параметры подключения к БД
DB_HOST=${POSTGRES_HOST:-localhost}
DB_PORT=${POSTGRES_PORT:-5432}
DB_NAME=${POSTGRES_DB:-profi134}
DB_USER=${POSTGRES_USER:-postgres}
DB_PASSWORD=${POSTGRES_PASSWORD:-postgres}

# Директория с миграциями
MIGRATIONS_DIR="./migrations"

# Функция для применения одной миграции
apply_migration() {
    local migration_file=$1
    echo -e "${YELLOW}Applying migration: ${migration_file}${NC}"

    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration_file"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Migration applied successfully: ${migration_file}${NC}"
    else
        echo -e "${RED}✗ Failed to apply migration: ${migration_file}${NC}"
        exit 1
    fi
}

# Если указан конкретный файл миграции
if [ -n "$1" ]; then
    if [ -f "$1" ]; then
        apply_migration "$1"
    else
        echo -e "${RED}Migration file not found: $1${NC}"
        exit 1
    fi
else
    # Применяем все миграции .up.sql в порядке возрастания
    echo -e "${YELLOW}Applying all migrations...${NC}"

    for migration in $(ls $MIGRATIONS_DIR/*.up.sql 2>/dev/null | sort); do
        apply_migration "$migration"
    done

    echo -e "${GREEN}All migrations applied successfully!${NC}"
fi
