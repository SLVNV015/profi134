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

```bash
docker compose -env-file .env up -d --build
```
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

## Producer

Producer:
- Принимает некое событие с фронта, Correlation id не обязателен, если его нет то генерирует свое
- отправляет сообщения в RabbitMQ
- из базы только редис хранит 24 часа можно реализовать эндпоинт на попытки успешние и нет, что то тяжелее не хотелось нести
- использует retry policy при network errors
- используется emit с ack - то есть не ждем ответа от другого сервиса

---

## Consumer

Consumer:

- получает события из RabbitMQ
- выполняет обработку (timeout 500ms)
- отправляет Telegram уведомления
- использует manual ACK/NACK

сообщение в телеграме выглядит просто:

```txt
Succes RabbitMq message recieved:
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
то есть сейчас при emit и без реализованной dlx, то есть ни обратно в очередь не кидается ни в DLQ просто теряется по сути, но это же тестовое задание

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

Тестами ничего не покрыто ни юнит ни e2e


---

# Возможные улучшения
- Dead Letter Queue (DLQ)
- Более приличные логи
- Тесты
Остальное для тестового задания без пользы излишне
