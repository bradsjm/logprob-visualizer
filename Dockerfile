# Multi-stage Dockerfile for running frontend (Vite React) and backend (Fastify)
# Targets:
# - dev  : hot-reload dev server + API with proxy
# - prod : build static site and run it via `vite preview` alongside API

ARG NODE_VERSION=22-alpine

# ---------- Base with shared settings ----------
FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV NODE_ENV=production

# Install dependencies using a clean layer
FROM base AS deps
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Build frontend (static assets) ----------
FROM deps AS build
# Allows overriding API base used by the built frontend.
# For dev target we rely on Vite proxy; for prod, set a full URL, e.g. http://localhost:8787
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=${VITE_API_BASE}
COPY . .
RUN npm run build

# ---------- Development target (hot reload) ----------
FROM deps AS dev
ENV NODE_ENV=development
ENV HOST=0.0.0.0
# Vite dev server listens here per vite.config.ts
EXPOSE 8080
# Fastify API default port
EXPOSE 8787
COPY . .
# Run both dev servers with the existing script
CMD ["npm","run","dev:all"]

# ---------- Production target (default) ----------
FROM deps AS prod
ENV NODE_ENV=production
ENV HOST=0.0.0.0
EXPOSE 8080 8787

# Copy sources and built assets from build stage
COPY . .
COPY --from=build /app/dist /app/dist

# Start API and static file server (vite preview) together
# Note: we keep devDependencies so `concurrently`, `vite`, and `tsx` are available at runtime.
CMD ["sh","-lc","concurrently -k -n WEB,API -c green,cyan \"vite preview --host 0.0.0.0 --port 8080\" \"tsx server/index.ts\""]

