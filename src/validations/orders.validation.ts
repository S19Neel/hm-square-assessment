import { z } from "zod";
import { ALLOWED_STATUSES } from "../constants/orders.constants.js";

export const getOrdersQuerySchema = z.object({
  customerId: z.string().optional(),
  status: z
    .string()
    .optional()
    .transform((val) => val?.toLowerCase()),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const orderRowSchema = z.object({
  order_id: z.string().min(1, "order_id is required"),
  customer_id: z.string().min(1, "customer_id is required"),
  order_date: z
    .string()
    .min(1, "order_date is required")
    .transform((val, ctx) => {
      const d = new Date(val);
      if (isNaN(d.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `order_date is not a valid date: "${val}"`,
        });
        return z.NEVER;
      }
      return d;
    }),
  order_amount: z
    .string()
    .min(1, "order_amount is required")
    .transform((val, ctx) => {
      const num = parseFloat(val);
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `order_amount is not a valid number: "${val}"`,
        });
        return z.NEVER;
      }
      if (num < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `order_amount must be non-negative: ${num}`,
        });
        return z.NEVER;
      }
      return num;
    }),
  status: z
    .string()
    .min(1, "status is required")
    .transform((val) => val.toLowerCase())
    .superRefine((val, ctx) => {
      if (
        !ALLOWED_STATUSES.includes(val as (typeof ALLOWED_STATUSES)[number])
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `status "${val}" is not valid. Allowed: ${ALLOWED_STATUSES.join(", ")}`,
        });
      }
    }),
});
