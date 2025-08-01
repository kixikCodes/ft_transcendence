.DEFAULT_GOAL := help

UNAME_S := $(shell uname -s)

up:
	@echo "Starting Services..."
	sudo docker compose up --build -d
	sudo docker ps -a

down:
	@echo "Stopping and removing Services..."
	sudo docker compose down

prune: down
	@echo "Nuking all Services..."
	sudo docker system prune -af --volumes

re: down up

reset: prune up


help:
	@echo "----------------------------------------------------"
	@echo "Makefile for ft_transcendence (Simple Setup)"
	@echo "----------------------------------------------------"
	@echo "Available commands:"
	@echo "  make up        - Start all services"
	@echo "  make down      - Stop and remove all services"
	@echo "  make re        - Remove and restart all services"
	@echo "----------------------------------------------------"

.PHONY: up down re help
