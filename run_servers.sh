#!/bin/bash
set -e

# Start MySQL
mysqld_safe --datadir=/var/lib/mysql &
MYSQL_PID=$!

# Wait for MySQL to be ready
for i in {1..60}; do
  if mysqladmin ping --silent; then
    break
  fi
  sleep 1
done

# Create the notes schema if it doesn't exist
mysql -e "CREATE DATABASE IF NOT EXISTS notes CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Install backend dependencies
cd /app/backend
pip install -r requirements.txt

# Run Django migrations (creates tables in the notes database)
python manage.py migrate

# Start Django ASGI backend with daphne on port 3001
daphne -b 0.0.0.0 -p 3001 bulletin.asgi:application &

# Install and start Next.js frontend on port 3000
cd /app/frontend
npm install
NEXT_TELEMETRY_DISABLED=1 npm run build
NEXT_TELEMETRY_DISABLED=1 npm run start &
