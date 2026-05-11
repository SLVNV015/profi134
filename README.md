# Notification Microservices Platform

Микросервисная система на базе NestJS, RabbitMQ, PostgreSQL и Redis для обработки событий и отправки уведомлений в Telegram с использованием Outbox Pattern.

## Архитектура

Проект состоит из следующих сервисов:

- **Producer Service**
  - принимает входящие запросы через REST API
  - сохраняет события в таблицу `outbox` (PostgreSQL)
  - реализует Transactional Outbox Pattern
  - поддерживает idempotency через Redis
- **Outbox Worker Service**
  - читает события из таблицы `outbox` батчами
  - публикует события в RabbitMQ
  - реализует retry-механику с экспоненциальной задержкой
  - использует `FOR UPDATE SKIP LOCKED` для конкурентной обработки
  - обновляет статусы событий (CREATED → PROCESSING → SEND/FAILED)
- **Consumer Service**
  - обрабатывает сообщения из RabbitMQ
  - отправляет уведомления в Telegram
  - использует manual ACK/NACK
  - поддерживает DLQ (Dead Letter Queue)
- **PostgreSQL**
  - хранилище для Outbox Pattern
  - таблица `outbox` с индексами для эффективной выборки
- **RabbitMQ**
  - брокер сообщений
- **Redis**
  - idempotency layer для дедупликации запросов
---
# Технологии
- NestJS
- PostgreSQL (Slonik)
- RabbitMQ
- Redis
- Docker / Docker Compose
- Telegram Bot API (простой axios клиент)
- RxJS для реактивной обработки
---

# Запуск
Перед запуском должны быть установлены:
- Docker
- Docker Compose
- Make (необязательно, но удобно)
---

# Переменные окружения
Создайте `.env` файл в корне проекта.
## Пример `.env`

```env
# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=profi134
POSTGRES_HOST=postgres_prof
POSTGRES_PORT=5432

# Redis
REDIS_PASSWORD=another_strong_password
REDIS_HOST=redis_prof
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_DEFAULT_USER=guest
RABBITMQ_DEFAULT_PASS=guest
RABBITMQ_URL=amqp://guest:guest@rabbitmq_prof:5672

# Application
PORT=3000

# Telegram
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID=50908111
```
---

# Запуск проекта

## Первый запуск

При первом запуске необходимо выполнить миграции базы данных:

```bash
# Запустить PostgreSQL
docker compose up -d postgres

# Применить миграции
./migrate-up.sh
```

Миграция создаст таблицу `outbox` с индексами и триггерами для автоматического обновления `updatedAt`.

## Запуск всех сервисов

```bash
make up
```

```bash
docker compose --env-file .env up -d --build
```

## Очистка volumes (если нужно сбросить данные)

Если возникли проблемы с RabbitMQ, PostgreSQL или Redis, можно очистить volumes:

```bash
# Остановить все сервисы
docker compose down

# Удалить volumes
docker volume rm profi134_postgres_prof profi134_rabbitmq_prof profi134_redis_prof

# Или удалить все volumes проекта
docker compose down -v

# Запустить заново
docker compose up -d --build
```

**Важно:** После очистки volumes PostgreSQL нужно заново применить миграции (они применятся автоматически при старте контейнера через `docker-entrypoint-initdb.d`).

---

## Остановка сервисов

```bash
make stop
```
```bash
docker compose stop
```

---

## Перезапуск

```bash
make restart
```
---

# Документация свагер по умолчанию доступна по адресу:

```txt
http://localhost:3000/api
```

# RabbitMQ Management UI

RabbitMQ management доступен по адресу:

```txt
http://localhost:15672
```

## Credentials

```txt
login: guest
password: guest
```

---

# Логи

## Все сервисы

```bash
make logs
```

## Producer

```bash
make producer-logs
```

## Consumer

```bash
make consumer-logs
```

---

# Очистка контейнеров и volumes

```bash
make clean
```

---

# Механизм обработки сообщений

## Outbox Pattern

Проект реализует **Transactional Outbox Pattern** для гарантированной доставки сообщений:

1. **Producer** сохраняет событие в таблицу `outbox` в PostgreSQL (статус `CREATED`)
2. **Outbox Worker** периодически (каждые 600ms) читает батчи событий из `outbox`
3. Worker блокирует события через `FOR UPDATE SKIP LOCKED` и меняет статус на `PROCESSING`
4. Worker публикует события в RabbitMQ с retry-механикой
5. При успехе статус меняется на `SEND`, при ошибке — на `FAILED`

### Преимущества Outbox Pattern:
- Атомарность: событие сохраняется в той же транзакции, что и бизнес-данные
- Гарантированная доставка: события не теряются при падении RabbitMQ
- Конкурентная обработка: несколько worker'ов могут работать параллельно благодаря `SKIP LOCKED`
- Retry-механика: автоматические повторы с экспоненциальной задержкой

### Структура таблицы outbox:

```sql
CREATE TABLE outbox (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    timestamp BIGINT NOT NULL,
    correlationId VARCHAR(255) NOT NULL,
    retryCount INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'CREATED',  -- CREATED | PROCESSING | SEND | FAILED
    createdAt TIMESTAMP DEFAULT NOW(),
    updatedAt TIMESTAMP DEFAULT NOW()
);
```

## Producer

Producer:
- Принимает события через REST API
- Генерирует `correlationId` если не передан
- Сохраняет событие в таблицу `outbox` (PostgreSQL)
- Использует Redis для idempotency (хранит 24 часа)
- Возвращает `eventId` и `correlationId` клиенту

## Outbox Worker

Worker:
- Читает батчи по 40 событий из `outbox` каждые 600ms
- Использует `FOR UPDATE SKIP LOCKED` для конкурентной обработки
- Публикует события в RabbitMQ через routing key `event.process`
- Retry-механика: 3 попытки с экспоненциальной задержкой (2^attempt * 1000ms + jitter)
- Классифицирует ошибки (network, validation, timeout) и пропускает retry для невосстановимых
- Обновляет `retryCount` при каждой попытке
- Использует RxJS для реактивной обработки

## Consumer

Consumer:
- Получает события из RabbitMQ (очередь `event.process`)
- Выполняет обработку (timeout 500ms)
- Отправляет Telegram уведомления
- Использует manual ACK/NACK
- Поддерживает DLQ для failed сообщений

Сообщение в телеграме выглядит так:

```txt
Success RabbitMQ message received:
id=b6aed855-b6e9-43b1-86c4-74ce9a37e677
type=order.created
correlationId=123e4567-e89b-12d3-a456-426655440001
timestamp=Mon May 04 2026 13:22:00 GMT+0000 (Coordinated Universal Time)
data={
  "orderId": 1,
  "userId": 1
}
```

### ACK

Сообщение подтверждается:

```ts
channel.ack(message)
```

### NACK

При ошибке:

```ts
channel.nack(message, false, false)
```

Сообщение отправляется в DLQ (Dead Letter Queue) для последующего анализа.

---

# Telegram Integration

Для работы Telegram notifications необходимо:

1. Создать Telegram Bot через `@BotFather`
2. Получить `BOT_TOKEN`
3. Узнать `CHAT_ID`
4. Указать значения в `.env`

---

# Пример workflow

```txt
HTTP Request (POST /messages)
    ↓
Producer Service
    ↓
PostgreSQL (outbox table) ← сохранение события
    ↓
Outbox Worker ← читает батчи каждые 600ms
    ↓
RabbitMQ (event.process)
    ↓
Consumer Service
    ↓
Telegram Bot API
```

---

# База данных

## PostgreSQL

Используется библиотека **Slonik** для работы с PostgreSQL:
- Type-safe SQL queries с помощью `sql.type(schema)`
- Connection pooling
- Zod schemas для валидации результатов

## Миграции

Миграции находятся в папке `migrations/`:
- `001_create_outbox_table.up.sql` — создание таблицы outbox
- `001_create_outbox_table.down.sql` — откат миграции

Применение миграций:

```bash
# Применить миграции
./migrate-up.sh

# Откатить миграции
./migrate-down.sh
```

При первом запуске через `docker compose` миграция применяется автоматически через `docker-entrypoint-initdb.d`.

---

# Тестирование

## Unit тесты

Проект покрыт unit-тестами для критичных компонентов:

```bash
# Запустить все тесты
npm test

# Запустить тесты с coverage
npm run test:cov

# Запустить тесты в watch mode
npm run test:watch
```

Основные тестируемые компоненты:
- `OutboxService` — работа с таблицей outbox (integration tests с testcontainers)
- `WorkerService` — логика обработки батчей и retry
- `error-classifier` — классификация ошибок для retry-механики

---

# Возможные улучшения
- Мониторинг и метрики (Prometheus/Grafana)
- Более детальные логи с трейсингом (OpenTelemetry)
- Graceful shutdown для Worker'а
- Автоматическая очистка старых событий из outbox (статус SEND старше N дней)
- Circuit breaker для Telegram API
- Rate limiting для Producer API
- E2E тесты
