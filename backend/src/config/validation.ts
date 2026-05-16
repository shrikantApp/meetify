import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid(
    'localhost',
    'development',
    'staging',
    'production',
  ),
  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().default(3000),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_DATABASE: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_CA_CERT: Joi.string().optional(),
  ALLOW_WEBSITE_URLS: Joi.string(),
  JWT_SECRET: Joi.string().optional(),
  // Redis
  REDIS_URL: Joi.string().optional().default('redis://localhost:6379'),
  // MinIO / S3
  MINIO_ENDPOINT: Joi.string().optional().default('localhost'),
  MINIO_PORT: Joi.number().optional().default(9000),
  MINIO_ACCESS_KEY: Joi.string().optional().default('minioadmin'),
  MINIO_SECRET_KEY: Joi.string().optional().default('minioadmin'),
  MINIO_BUCKET: Joi.string().optional().default('meetify-chat'),
  MINIO_USE_SSL: Joi.boolean().optional().default(false),
  // Web Push
  VAPID_PUBLIC_KEY: Joi.string().optional(),
  VAPID_PRIVATE_KEY: Joi.string().optional(),
  VAPID_EMAIL: Joi.string().optional().default('mailto:admin@meetify.com'),
});
