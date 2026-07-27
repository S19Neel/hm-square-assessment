-- PostgreSQL Database Initialization Script for HM2 Assessment
-- Creates hash-partitioned orders table, partitions, indexes, and order_errors table.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create Parent Table with PARTITION BY HASH (customer_id)
CREATE TABLE IF NOT EXISTS "orders" (
    "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id"      TEXT NOT NULL,
    "customer_id"   TEXT NOT NULL,
    "order_date"    TIMESTAMPTZ NOT NULL,
    "order_amount"  DECIMAL(12,2) NOT NULL,
    "status"        VARCHAR(50) NOT NULL,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id", "customer_id"),
    CONSTRAINT "orders_order_id_key" UNIQUE ("order_id", "customer_id")
) PARTITION BY HASH ("customer_id");

-- Create 4 Hash Partitions
CREATE TABLE IF NOT EXISTS orders_p0 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS orders_p1 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS orders_p2 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS orders_p3 PARTITION OF orders FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- Indexes for Order Queries
CREATE INDEX IF NOT EXISTS "idx_orders_customer_id" ON "orders" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_orders_order_date" ON "orders" ("order_date");
CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "orders" ("status");

-- Create Order Errors Table for Malformed CSV Rows
CREATE TABLE IF NOT EXISTS "order_errors" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "upload_id"   TEXT NOT NULL,
    "row_number"  INTEGER NOT NULL,
    "raw_data"    JSONB NOT NULL,
    "errors"      JSONB NOT NULL,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "order_errors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_order_errors_upload_id" ON "order_errors" ("upload_id");
