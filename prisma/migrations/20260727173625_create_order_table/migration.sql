-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_date" TIMESTAMPTZ NOT NULL,
    "order_amount" DECIMAL(12,2) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_id_key" ON "orders"("order_id");

-- CreateIndex
CREATE INDEX "idx_orders_customer_id" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "idx_orders_order_date" ON "orders"("order_date");

-- CreateIndex
CREATE INDEX "idx_orders_status" ON "orders"("status");
