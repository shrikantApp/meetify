import { MigrationInterface, QueryRunner } from "typeorm";

export class RecordChange1773474990699 implements MigrationInterface {
    name = 'RecordChange1773474990699'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meeting_recordings" DROP CONSTRAINT "FK_fbaf68ef686a66017b8712de240"`);
        await queryRunner.query(`CREATE TYPE "public"."meeting_recordings_status_enum" AS ENUM('IN_PROGRESS', 'PAUSED', 'COMPLETED', 'FAILED')`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ADD "status" "public"."meeting_recordings_status_enum" NOT NULL DEFAULT 'IN_PROGRESS'`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ALTER COLUMN "file_path" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ALTER COLUMN "file_size" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ALTER COLUMN "duration" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ALTER COLUMN "meeting_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" DROP COLUMN "host_id"`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ADD "host_id" uuid`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ADD CONSTRAINT "FK_fbaf68ef686a66017b8712de240" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ADD CONSTRAINT "FK_0c5927319fee6e42afac2fed8a6" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meeting_recordings" DROP CONSTRAINT "FK_0c5927319fee6e42afac2fed8a6"`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" DROP CONSTRAINT "FK_fbaf68ef686a66017b8712de240"`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" DROP COLUMN "host_id"`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ADD "host_id" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ALTER COLUMN "meeting_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ALTER COLUMN "duration" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ALTER COLUMN "file_size" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ALTER COLUMN "file_path" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."meeting_recordings_status_enum"`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ADD CONSTRAINT "FK_fbaf68ef686a66017b8712de240" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
