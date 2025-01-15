#!/bin/sh

# Run database migrations
echo "Running database migrations..."
npm run migrate

# Start the Next.js application
echo "Starting Next.js application..."
npm run dev