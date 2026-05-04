# Notification Microservices Platform

Микросервисная система на базе NestJS, RabbitMQ и Redis для обработки событий и отправки уведомлений в Telegram.

## Архитектура

Проект состоит из следующих сервисов:

- **Producer Service**
  - принимает входящие запросы
  - публикует события в RabbitMQ
  - реализует retry-механику
  - поддерживает idempotency через UUID
- **Consumer Service**
  - обрабатывает сообщения из RabbitMQ
  - отправляет уведомления в Telegram
  - использует manual ACK/NACK
- **RabbitMQ**
  - брокер сообщений
- **Redis**
  - storage/cache/idempotency layer
---
# Технологии
- NestJS
- RabbitMQ
- Redis
- Docker / Docker Compose
- Telegram Bot API (простой axios клиент)
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
REDIS_ROOT_PASSWORD=super_secret_root_password
REDIS_USER=prod_user
REDIS_PASSWORD=another_strong_password
REDIS_HOST=redis_prof
REDIS_PORT=6379
PORT=3000
RABBITMQ_DEFAULT_USER=guest
RABBITMQ_DEFAULT_PASS=guest
RABBITMQ_URL=amqp://guest:guest@rabbitmq_prof:5672
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID=50908111
```
---

# Запуск проекта

## Запуск всех сервисов

```bash
make up
```

---

## Остановка сервисов

```bash
make down
```

---

## Перезапуск

```bash
make restart
```

---

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

# API

Producer API доступен:

```txt
http://localhost:3000
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

## Producer

Producer:

- сериализует события в JSON
- присваивает UUID
- отправляет сообщения в RabbitMQ
- использует retry policy при network errors

---

## Consumer

Consumer:

- получает события из RabbitMQ
- выполняет обработку
- отправляет Telegram уведомления
- использует manual ACK/NACK

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
HTTP Request
    ↓
Producer Service
    ↓
RabbitMQ
    ↓
Consumer Service
    ↓
Telegram Bot API
```

---

# Тестирование

## Unit tests

```bash
make test
```

## E2E tests

```bash
make test-e2e
```

---

# SOLID / Clean Architecture

Проект придерживается:

- SOLID principles
- modular architecture
- separation of concerns
- dependency inversion
- message-driven architecture

---

# Возможные улучшения

- Dead Letter Queue (DLQ)
- Outbox Pattern
- Distributed tracing
- Prometheus metrics
- OpenTelemetry
- Circuit Breaker
- Rate limiting
- Swagger documentation
- Kubernetes deployment

---

# Автор

Test assignment implementation using NestJS microservices architecture.
