-- Custom migration: Hash-partitioned orders table
-- This replaces the default Prisma-generated CREATE TABLE.
-- After running `prisma migrate dev --create-only`, replace the generated SQL with this.

-- CreateTable (with PARTITION BY HASH)
CREATE TABLE "orders" (
    "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id"      TEXT NOT NULL,
    "customer_id"   TEXT NOT NULL,
    "order_date"    TIMESTAMPTZ NOT NULL,
    "order_amount"  DECIMAL(12,2) NOT NULL,
    "status"        VARCHAR(50) NOT NULL,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- PostgreSQL requires the partition key (customer_id) to be part of
    -- any primary key or unique constraint on a partitioned table.
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id", "customer_id"),
    CONSTRAINT "orders_order_id_key" UNIQUE ("order_id", "customer_id")
) PARTITION BY HASH ("customer_id");

-- Create 4 hash partitions
-- PostgreSQL automatically routes inserts to the correct partition
-- based on the hash of customer_id modulo the number of partitions.
CREATE TABLE orders_p0 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE orders_p1 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE orders_p2 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE orders_p3 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- Indexes (created on parent table, automatically propagated to all partitions)
CREATE INDEX "idx_orders_customer_id" ON "orders" ("customer_id");
CREATE INDEX "idx_orders_order_date" ON "orders" ("order_date");
CREATE INDEX "idx_orders_status" ON "orders" ("status");
