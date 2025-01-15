FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Next.js application
RUN npm run build

# --- Stage 2: Production Runtime ---
FROM node:18-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy build output and public files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./

# Copy source files needed for runtime
COPY --from=builder /app/app ./app
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/components ./components
COPY --from=builder /app/hooks ./hooks
COPY --from=builder /app/contexts ./contexts
COPY --from=builder /app/types ./types
COPY --from=builder /app/migrations ./migrations

# Copy config files
COPY --from=builder /app/tailwind.config.ts ./
COPY --from=builder /app/postcss.config.js ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/next-env.d.ts ./
COPY --from=builder /app/middleware.ts ./

# Expose the port Next.js runs on
EXPOSE 3000

# Start the Next.js application
CMD ["npm", "run", "start"]