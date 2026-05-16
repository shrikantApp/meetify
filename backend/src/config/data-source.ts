import { DataSource } from "typeorm";
import * as dotenv from "dotenv";

dotenv.config();

const caCert = process.env.POSTGRES_CA_CERT;
const isUrlConfig = !!process.env.DATABASE_URL;

const sslConfig = caCert
  ? {
    rejectUnauthorized: true,
    ca: caCert.replace(/\\n/g, "\n"),
  }
  : {
    rejectUnauthorized: false,
  };

const AppDataSource = new DataSource(
  isUrlConfig
    ? {
      type: "postgres",
      url: process.env.DATABASE_URL,
      entities: ["src/**/*.entity.ts"],
      migrations: ["src/migrations/*.ts"],
      synchronize: false,
      ssl: sslConfig,
      extra: {
        max: 2,
        connectTimeoutMS: 10000,
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
      ssl: sslConfig,
      extra: {
        max: 2,
        connectTimeoutMS: 10000,
      },
    }
);

export default AppDataSource;
