import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserProfile1779033005284 implements MigrationInterface {
  name = 'UserProfile1779033005284';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "full_name" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "title" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "designation" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "phone_number" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "date_of_birth" date`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "date_of_birth"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone_number"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "designation"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "title"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "full_name"`);
  }
}
