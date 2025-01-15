# Dockerize Checklist

Below is a step-by-step "dockerize" checklist with detailed examples and file references. Use these instructions to make your local development environment mirror your production environment as closely as possible—especially if you plan to deploy to Vercel.

## 1. Create a Dockerfile

1. In your project root, create a file named Dockerfile.  
2. Use a multi-stage build to keep the final image small and production-like.  
3. Make sure you install both dev and production dependencies in the builder stage, then copy only production dependencies into the final stage.

Example Dockerfile:

    ```dockerfile
    # --- Stage 1: Build the application ---
    FROM node:18-alpine AS builder

    WORKDIR /app

    # Copy only the necessary files first for caching
    COPY package.json package-lock.json ./

    # Install all dependencies (including dev) to build
    RUN npm install

    # Copy the entire repo
    COPY . .

    # Build the Next.js application
    RUN npm run build

    # --- Stage 2: Run (production) ---
    FROM node:18-alpine AS runner

    ENV NODE_ENV=production

    WORKDIR /app

    # Copy package.json and lockfile to install only production deps
    COPY package.json package-lock.json ./
    RUN npm install --omit=dev

    # Copy the compiled .next folder and other build artifacts from builder
    COPY --from=builder /app/.next ./.next
    COPY --from=builder /app/public ./public
    COPY --from=builder /app/next.config.mjs ./next.config.mjs

    # Expose the port (Next.js defaults to 3000)
    EXPOSE 3000

    # Start the production server
    CMD ["npm", "run", "start"]
    ```

Key Points:
- We're using Node.js v18 on Alpine Linux for a lightweight image
- The builder stage handles all dev dependencies and runs "npm run build"
- The runner stage installs only production dependencies and copies over the final build outputs

## 2. Create Docker Compose for Local Dev

1. If you want Docker to handle both your Next.js app and a local PostgreSQL instance, create a docker-compose.yml in your project root.
2. This helps ensure your local environment remains close to production.

Example docker-compose.yml:

    ```yaml
    version: "3.9"

    services:
      database:
        image: postgres:15
        container_name: myapp_db
        env_file:
          - .env
        environment:
          POSTGRES_USER: ${POSTGRES_USER}
          POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
          POSTGRES_DB: ${POSTGRES_DB}
        volumes:
          - db_data:/var/lib/postgresql/data
        ports:
          - "5432:5432"

      web:
        build: .
        container_name: myapp_web
        env_file:
          - .env
        environment:
          # POSTGRES_HOST should match the service name "database" here
          POSTGRES_HOST: database
        depends_on:
          - database
        ports:
          - "3000:3000"

    volumes:
      db_data:
    ```

## 3. Manage Environment Variables

1. Use a .env file to store environment variables for both local development and Docker usage.  
2. For production (Vercel), set these via the Vercel dashboard or another secure system.

Example .env (do not commit secrets to version control!):

    ```bash
    POSTGRES_DB=mydb
    POSTGRES_USER=myuser
    POSTGRES_PASSWORD=mypassword
    POSTGRES_HOST=database
    POSTGRES_PORT=5432

    # Next.js environment
    NEXTAUTH_URL=http://localhost:3000
    SECRET_JWT_KEY=someRandomSecret
    ```

Key Points:
- The env_file directive in docker-compose.yml loads these.
- Ensure your Next.js application references these environment variables properly (e.g., in lib/db.ts).
- For production on Vercel, do not rely on .env files in the container. Instead, configure environment variables in Vercel’s Environment Variables settings.

---

## 4. Local Development Steps

1. Install Docker & Docker Compose (if you haven’t already).  
2. Build the images using Docker Compose:

    ```bash
    docker-compose build
    ```

3. Spin up the containers:

    ```bash
    docker-compose up
    ```

4. Visit http://localhost:3000 to see your Next.js application running in Docker, with PostgreSQL also running in its own container.

Optional “Production-Like” Setup:
- Keep the default CMD in the Dockerfile as “npm run start” to mimic production, building once before spinning it up.  
- If you prefer hot reloading, override the command in docker-compose.yml with “npm run dev” and mount the code via volumes. This is convenient for coding but less production-like.

---

## 5. Prepare for Vercel Deployment

Vercel natively supports Next.js, but you can also deploy via Docker for uniformity:

1. Push your code (including the Dockerfile) to a Git repository.  
2. In Vercel’s dashboard, create a new project from your repository.  
3. Under “Build and Output Settings” (or advanced project settings), select that you want to use a Container / Dockerfile.  
4. Provide environment variables (DB credentials, secrets, etc.) in Vercel’s project settings.  
5. On deploy, Vercel will build the Docker image and run it.

Note:
- Typically, you won’t run PostgreSQL in a Vercel container since containers are ephemeral. Instead, connect to an external service like AWS RDS or Supabase.  
- If you don’t strictly need Docker in production, you could rely on Vercel’s built-in Next.js integration. However, Docker ensures consistency across local and production environments.

---

## 6. Verify Production-Like Workflow

- After deployment, confirm you can read/write to your database.  
- Double-check environment variables in Vercel’s dashboard.  
- If using logs, check container logs in Vercel for debugging.

### Summary

Following these steps helps ensure:
- You have a multi-stage Dockerfile building and running your Next.js application.  
- Docker Compose orchestrates local DB + app together.  
- .env for local secrets/config, environment variables for production.  
- docker-compose up for local dev, and a consistent Docker-based workflow for production if desired.

This consistency keeps your dev and production environments aligned for smoother, more reliable deployments.