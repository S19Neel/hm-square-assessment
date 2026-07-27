import dotenv from "dotenv";

dotenv.config();

interface EnvConfig {
  PORT: number;
  DATABASE_URL: string;
  GCS_BUCKET_NAME: string;
  NODE_ENV: string;
}

function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env: EnvConfig = {
  PORT: parseInt(process.env.PORT || "5000", 10),
  DATABASE_URL: getEnvVar("DATABASE_URL"),
  GCS_BUCKET_NAME: getEnvVar("GCS_BUCKET_NAME"),
  NODE_ENV: process.env.NODE_ENV || "development",
};
