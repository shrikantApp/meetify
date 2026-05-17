import { MigrationInterface, QueryRunner } from 'typeorm';

export class LoadMahaNotify1779029567410 implements MigrationInterface {
  name = 'LoadMahaNotify1779029567410';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workspaces" ADD "avatarUrl" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "avatarUrl"`);
  }
}
