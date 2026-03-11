import { DataSource } from "typeorm";
import * as dotenv from "dotenv";

dotenv.config();

const isUrlConfig = !!process.env.DATABASE_URL;

const AppDataSource = new DataSource(
  isUrlConfig
    ? {
      type: "postgres",
      url: process.env.DATABASE_URL,
      entities: ["src/**/*.entity.ts"],
      migrations: ["src/migrations/*.ts"],
      synchronize: false,
      ssl: {
        rejectUnauthorized: false,
      },
    }
    : {
      type: "postgres",
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT) || 5432,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DATABASE,
      entities: ["src/**/*.entity.ts"],
      migrations: ["src/migrations/*.ts"],
      synchronize: false,
      ssl: false,
    }
);

export default AppDataSource;
