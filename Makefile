# Makefile for Crickeon Development
# Simplifies common development tasks

.PHONY: help install build start-mvp dev docker-up docker-down test lint format typecheck prisma-migrate prisma-seed clean

help:
	@echo "Crickeon Development Commands"
	@echo "========================================"
	@echo "make install          - Install all dependencies"
	@echo "make build            - Build all services and frontend"
	@echo "make dev              - Start full local stack (backend + frontend)"
	@echo "make start-mvp        - Start MVP backend only"
	@echo "make docker-up        - Start Docker services (Postgres, Redis)"
	@echo "make docker-down      - Stop Docker services"
	@echo "make test             - Run all tests"
	@echo "make test-watch       - Run tests in watch mode"
	@echo "make lint             - Lint codebase"
	@echo "make format           - Format code with Prettier"
	@echo "make typecheck        - Run TypeScript type checking"
	@echo "make prisma-migrate   - Run Prisma migrations"
	@echo "make prisma-seed      - Seed database with sample data"
	@echo "make clean            - Remove build artifacts"

# Installation & Setup
install:
	npm install

# Build Commands
build:
	npm run build

build-mvp:
	npm run build:mvp

# Development
dev: docker-up
	@echo "Starting Crickeon..."
	@echo "Backend: http://localhost:10000/api/v1"
	@echo "Frontend: http://localhost:5173"
	@npm run start:mvp &
	@sleep 3
	@npm run dev:frontend

start-mvp:
	npm run start:mvp

# Docker Management
docker-up:
	docker-compose -f crickeon-infra/docker-compose.yml up -d

docker-down:
	docker-compose -f crickeon-infra/docker-compose.yml down

docker-logs:
	docker-compose -f crickeon-infra/docker-compose.yml logs -f

# Testing
test:
	npm test

test-watch:
	npm run test:watch

test-coverage:
	npm run test:coverage

test-integration:
	npm run test:integration

# Code Quality
lint:
	npm run lint

format:
	npm run format

typecheck:
	npm run typecheck

# Database
prisma-migrate:
	npm run prisma:migrate

prisma-seed:
	npm run prisma:seed

prisma-studio:
	npm run prisma:studio

# Frontend
dev-frontend:
	npm run dev:frontend

build-frontend:
	npm run build --workspace @crickeon/frontend

# Backend
dev-backend:
	npm run start:mvp

build-backend:
	npm run build:mvp

# Cleanup
clean:
	rm -rf node_modules
	rm -rf dist
	rm -rf .turbo
	rm -rf coverage
	find . -type d -name ".next" -exec rm -rf {} + 2>/dev/null || true

reinstall: clean install

.DEFAULT_GOAL := help
