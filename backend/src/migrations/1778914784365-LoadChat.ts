import { MigrationInterface, QueryRunner } from "typeorm";

export class LoadChat1778914784365 implements MigrationInterface {
    name = 'LoadChat1778914784365'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meetings" ADD "description" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meetings" DROP COLUMN "description"`);
    }

}
