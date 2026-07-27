# Multi-stage Dockerfile for HM2 Backend Assessment

# Stage 1: Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package manifests and pnpm lock file
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
COPY prisma.config.ts tsconfig.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY src ./src

# Generate Prisma Client and build TypeScript project
RUN pnpm dlx prisma generate
RUN pnpm build

# Stage 2: Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

ENV NODE_ENV=production
ENV PORT=5000

# Copy manifests and install production dependencies only
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN pnpm install --prod --frozen-lockfile

# Copy built application and generated prisma client from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated

EXPOSE 5000

CMD ["node", "dist/app.js"]
