# Outbox Worker

Worker для обработки событий из outbox паттерна с использованием RxJS и улучшенной системой классификации ошибок.

## Архитектура

Worker каждые 600ms:
1. Достаёт до 40 событий из БД (статус `CREATED`)
2. Обрабатывает их параллельно:
   - Публикует в RabbitMQ
   - При успехе — удаляет из БД (`markOneCompleted`)
   - При ошибке после 3 retry — помечает как `FAILED` (`markOneFailed`)
3. Использует `FOR UPDATE SKIP LOCKED` для конкурентного доступа

## Система классификации ошибок

Worker использует продвинутую систему классификации ошибок (`@app/lib/utils/error-classifier`), которая различает:

### Типы ошибок

1. **NETWORK** — сетевые ошибки (RabbitMQ, HTTP)
   - `ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT`, `EPIPE`
   - `socket hang up`, `timeout`
   - **Retryable**: ✅ Да

2. **DATABASE** — ошибки PostgreSQL/Slonik
   - Retryable коды:
     - `40001` — serialization_failure
     - `40P01` — deadlock_detected
     - `55P03` — lock_not_available
     - `08006` — connection_failure
   - Non-retryable коды:
     - `23505` — unique_constraint_violation
     - `23503` — foreign_key_violation
   - **Retryable**: ⚠️ Зависит от кода

3. **VALIDATION** — ошибки валидации Zod
   - Некорректная структура данных
   - **Retryable**: ❌ Нет

4. **UNKNOWN** — прочие ошибки
   - **Retryable**: ❌ Нет

### Логирование

Все ошибки логируются с контекстом:
```
[NETWORK] connect ECONNREFUSED 127.0.0.1:5672 (code: ECONNREFUSED)
[DATABASE] Deadlock detected (code: 40P01)
[VALIDATION] Validation failed
Metadata: {
  "issues": [
    {"path": "name", "message": "Expected string, received number"}
  ]
}
```

## Retry логика

- **3 попытки** с экспоненциальной задержкой: `2^n * 1000ms + jitter`
- Retry только для **retryable ошибок**:
  - ✅ Сетевые ошибки (NETWORK)
  - ✅ Временные ошибки БД (deadlock, serialization_failure)
  - ❌ Валидационные ошибки (VALIDATION)
  - ❌ Constraint violations (unique, foreign key)
- При каждой ошибке увеличивается `retryCount` в БД

## Тестирование

### Юнит-тесты

```bash
# Worker
npm test -- apps/outbox-worker/src/worker/worker.spec.ts

# Error Classifier
npm test -- libs/lib/src/utils/error-classifier.spec.ts
```

Покрытие Worker:
- ✅ Обработка батча событий
- ✅ Пустой батч (нет событий)
- ✅ Обработка ошибок и retry
- ✅ Параллельная обработка нескольких событий
- ✅ Продолжение работы при падении одного события
- ✅ Обработка ошибок при записи в БД

Покрытие Error Classifier:
- ✅ Определение сетевых ошибок
- ✅ Определение ошибок БД (Slonik/PostgreSQL)
- ✅ Определение retryable ошибок БД
- ✅ Определение валидационных ошибок (Zod)
- ✅ Классификация и форматирование ошибок

### Интеграционные тесты (OutboxService)

**Требуется PostgreSQL!**

1. Запустить PostgreSQL:
```bash
docker-compose up -d postgres
```

2. Установить переменную окружения:
```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/profi134"
```

3. Запустить тесты:
```bash
npm test -- apps/outbox-worker/src/outbox/outbox.service.integration.spec.ts
```

Покрытие:
- ✅ `getPendingButch` — получение и обновление статуса
- ✅ `FOR UPDATE SKIP LOCKED` — конкурентный доступ
- ✅ `markOneCompleted` — удаление события
- ✅ `markOneFailed` — обновление статуса на FAILED
- ✅ `addAttempt` — увеличение счётчика попыток

## Конфигурация

### Параллелизм

Контролируется на уровне инфраструктуры:
- **PostgreSQL connection pool** — ограничивает соединения к БД
- **RabbitMQ prefetch/channel limits** — ограничивает публикации

### Интервал обработки

По умолчанию: **600ms**

Изменить в `worker.ts:60`:
```typescript
interval(600) // <- изменить здесь
```

### Размер батча

По умолчанию: **40 событий**

Изменить в `worker.ts:88`:
```typescript
this.outboxService.getPendingButch(40) // <- изменить здесь
```

## Graceful Shutdown

Worker корректно завершается при:
- `SIGTERM` / `SIGINT`
- `onModuleDestroy`
- `onApplicationShutdown`

Ожидает завершения текущих операций до **15 секунд**, затем принудительно завершается.

## Использование Error Classifier в других частях проекта

```typescript
import {
  classifyError,
  isRetryableError,
  formatErrorForLog,
  ErrorType,
} from '@app/lib/utils/error-classifier';

try {
  await someOperation();
} catch (error) {
  const context = classifyError(error);
  
  if (context.type === ErrorType.VALIDATION) {
    // Обработка валидационных ошибок
    logger.warn(`Validation failed: ${formatErrorForLog(error)}`);
    return;
  }
  
  if (isRetryableError(error)) {
    // Повторить операцию
    await retry(someOperation);
  } else {
    // Логировать и пропустить
    logger.error(formatErrorForLog(error));
  }
}
```
