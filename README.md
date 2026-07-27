# Scalable Order Ingestion Backend

A high-performance Node.js & TypeScript backend application designed to ingest large dataset CSV order files (~10,000+ records), upload raw files to Google Cloud Storage (GCS) via Application Default Credentials (ADC), stream-parse data with Zod validation, and store orders in a hash-partitioned PostgreSQL database.

---

## 🛠️ Tech Stack & System Architecture

- **Runtime & Language**: Node.js (v20+), TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 16 (Native Declarative Hash Partitioning on `customer_id`)
- **ORM**: Prisma 7 (`@prisma/adapter-pg` driver adapter)
- **Cloud Storage**: Google Cloud Storage (`@google-cloud/storage`) using ADC
- **Data Validation**: Zod
- **Async Queue & Processing**: In-memory event-driven worker queue with status polling
- **Resilience**: Exponential backoff retry handler with random jitter
- **Testing**: Vitest, Supertest (21 passing tests)
- **Containerization**: Multi-stage Docker & Docker Compose

---

## 🚀 Setup and Run Instructions

### Local Development

#### Prerequisites
- Node.js v20+ and `pnpm`
- PostgreSQL 16 instance running locally or remotely
- Google Cloud CLI authenticated via ADC (`gcloud auth application-default login`)

#### Step-by-Step Commands

1. **Clone Repository & Install Dependencies**:
   ```bash
   git clone <repository-url>
   cd hm2-assessment
   pnpm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory (based on `.env.example`):
   ```env
   PORT=5000
   DATABASE_URL="postgresql://postgres:password@localhost:5432/hm2-assessment"
   GCS_BUCKET_NAME="your-gcs-bucket-name"
   LOG_LEVEL="info"
   CSV_BATCH_SIZE=500
   ```

3. **Initialize Database & Partitions**:
   Generate Prisma client and execute `init-db.sql` to create the `orders` table, 4 hash partitions (`orders_p0` .. `orders_p3`), indexes, and `order_errors` table:
   ```bash
   pnpm dlx prisma generate
   pnpm prisma db execute --file ./prisma/init-db.sql --schema ./prisma/schema.prisma
   ```

4. **Start Application**:
   ```bash
   # Development mode with hot-reloading
   pnpm dev

   # Production build & start
   pnpm build
   pnpm start
   ```

5. **Run Test Suite**:
   ```bash
   pnpm vitest run
   ```
---

## ☁️ How Google Application Default Credentials (ADC) is Configured

The application integrates with Google Cloud Storage without hardcoding service account keys or committing JSON credential files to the repository:

1. **Local Environment**:
   Run `gcloud auth application-default login`. This creates credentials at `~/.config/gcloud/application_default_credentials.json`.
2. **SDK Auto-Discovery**:
   The `@google-cloud/storage` SDK implicitly instantiates authentication:
   ```typescript
   import { Storage } from "@google-cloud/storage";
   const storage = new Storage(); // Auto-detects ADC from environment/gcloud
   ```
3. **Docker Environment**:
   `docker-compose.yml` mounts `~/.config/gcloud` from the host OS into `/root/.config/gcloud` inside the container in read-only mode (`ro`).

---

## 🗄️ Explanation of Sharding Strategy

### Chosen Approach: Native PostgreSQL Hash Partitioning on `customer_id`

- **Shard Key**: `customer_id`
- **Partitions**: 4 static hash partitions (`orders_p0`, `orders_p1`, `orders_p2`, `orders_p3`)
- **Routing**: Native PostgreSQL modulo hash routing (`PARTITION BY HASH (customer_id)`).

### Why `customer_id` was Selected:

1. **Uniform Data Distribution**:
   Hashing `customer_id` spreads orders evenly across all 4 physical table partitions regardless of order spikes or temporal ordering, preventing single-shard hotspots.
2. **Single-Partition Query Pruning**:
   Customer-centric queries (`GET /orders?customerId=CUST-001`) allow PostgreSQL query planner to perform **partition pruning**, hitting only the specific partition storing that customer's records.
3. **Application Routing Simplicity**:
   PostgreSQL natively handles partition assignment on `INSERT`. The application queries partition metadata (`tableoid::regclass`) to expose `shardInfo` in API responses for transparency.

---

## ⚖️ Design Decisions and Trade-offs

### 1. Asynchronous Background Job Queue vs Synchronous Request-Response
- **Decision**: `POST /upload-orders` returns `202 Accepted` immediately with a status URL (`/orders/status/:uploadId`), delegating CSV parsing and batch DB insertion to a background worker queue.
- **Trade-off**: Requires clients to poll or track job status, but prevents HTTP timeout failures when uploading large files (~10,000+ rows).

### 2. Streaming CSV Processing vs Full Memory Buffering
- **Decision**: Uses Node.js Streams (`csv-parse`) to parse rows on-the-fly and yield batches of 500 records.
- **Trade-off**: Lower memory footprint (O(1) memory bound per batch), avoiding Node.js heap overflow on multi-megabyte files.

### 3. Database Batch Inserts & Idempotency
- **Decision**: Valid orders are inserted in batches of 500 using `createMany` with `skipDuplicates: true`.
- **Trade-off**: `skipDuplicates` ignores duplicate `order_id` records gracefully without failing the entire batch transaction.

### 4. Malformed Row Logging (`OrderError` Table)
- **Decision**: Invalid/malformed CSV rows fail row validation gracefully and are persisted into a dedicated `order_errors` PostgreSQL table per `uploadId`.
- **Trade-off**: Slightly increases database write calls for bad rows, but guarantees complete auditability via `GET /orders/errors/:uploadId`.

---

## ⭐ Bonus Points Implementation Summary

| Bonus Point | Implementation Detail |
|---|---|
| **Background Processing (Workers / Queues)** | Event-driven async job queue (`queue.service.ts`) with live status tracking (`GET /orders/status/:uploadId`) |
| **Retry & Idempotency Handling** | Exponential backoff with random jitter (`retry.ts`) on GCS/DB operations + `skipDuplicates: true` |
| **Dockerized Setup** | Multi-stage `Dockerfile` and `docker-compose.yml` with automated partition initialization |
| **Unit & Integration Tests** | 21 passing test cases across 4 test suites using Vitest & Supertest |
| **Clear Separation of Concerns** | Modular architecture (`routes`, `controllers`, `services`, `middleware`, `validations`, `constants`, `types`, `utils`) |

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/upload-orders` | Upload orders CSV. Returns 202 Accepted & background job status URL. |
| `GET` | `/orders/status/:uploadId` | Fetch live background job processing status and progress counts. |
| `GET` | `/orders/:orderId` | Fetch order by ID, including partition `shardInfo` metadata. |
| `GET` | `/orders` | Fetch paginated orders (optional filters: `customerId`, `status`, `page`, `limit`). |
| `GET` | `/orders/errors/:uploadId` | Fetch all persisted malformed row errors for an upload attempt. |
| `GET` | `/metrics` | Fetch system metrics (uptime, memory, DB ping, partition row distribution). |
| `GET` | `/health` | Server health checkup endpoint. |
