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
  ALLOW_WEBSITE_URLS: Joi.string(),
});
