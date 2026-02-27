import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Used by the TypeORM CLI to generate/run migrations.
 * Run: npx typeorm-ts-node-commonjs migration:generate src/migrations/InitSchema -d src/data-source.ts
 * Run: npx typeorm-ts-node-commonjs migration:run -d src/data-source.ts
 */
export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'meetify',
    entities: ['src/**/*.entity.ts'],
    migrations: ['src/migrations/*.ts'],
    synchronize: false, // Must be false when using migrations
});
