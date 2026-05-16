#!/bin/sh
set -e

echo "⏳  Waiting for MySQL to be ready..."
sleep 2

echo "🌱  Running seed script..."
python seed.py

echo "🚀  Starting API server..."
exec uvicorn main:app --host 0.0.0.0 --port 8000