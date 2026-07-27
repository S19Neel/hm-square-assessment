-- CreateTable
CREATE TABLE "order_errors" (
    "id" UUID NOT NULL,
    "upload_id" TEXT NOT NULL,
    "row_number" INTEGER NOT NULL,
    "raw_data" JSONB NOT NULL,
    "errors" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_errors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_order_errors_upload_id" ON "order_errors"("upload_id");
