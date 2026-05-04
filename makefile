.PHONY: up down stop restart logs ps producer-logs consumer-logs rabbitmq-logs redis-logs clean rebuild lint test 

up:
	docker compose --env-file .env up --build -d

down:
	docker compose down

stop:
	docker compose stop

restart:
	docker compose stop
	docker compose --env-file .env up --build -d

logs:
	docker compose logs -f

ps:
	docker compose ps

producer-logs:
	docker compose logs -f producer

consumer-logs:
	docker compose logs -f consumer

rabbitmq-logs:
	docker compose logs -f rabbitmq

redis-logs:
	docker compose logs -f redis

clean:
	docker compose down -v --remove-orphans

rebuild:
	docker compose build --no-cache

lint:
	npm run lint

test:
	npm run test
