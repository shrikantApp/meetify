import { MigrationInterface, QueryRunner } from "typeorm";

export class LoadChat1778915711991 implements MigrationInterface {
    name = 'LoadChat1778915711991'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meetings" ADD "ended_at" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meetings" DROP COLUMN "ended_at"`);
    }

}
