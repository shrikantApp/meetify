import { MigrationInterface, QueryRunner } from "typeorm";

export class LoadRecording11773419879301 implements MigrationInterface {
    name = 'LoadRecording11773419879301'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meeting_recordings" DROP CONSTRAINT "FK_582311a852c87b98deb8127a13c"`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" DROP COLUMN "meetingId"`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" DROP COLUMN "hostId"`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" DROP COLUMN "filePath"`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" DROP COLUMN "fileSize"`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ADD "meeting_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ADD "host_id" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ADD "file_path" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ADD "file_size" bigint NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ADD CONSTRAINT "FK_fbaf68ef686a66017b8712de240" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meeting_recordings" DROP CONSTRAINT "FK_fbaf68ef686a66017b8712de240"`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" DROP COLUMN "file_size"`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" DROP COLUMN "file_path"`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" DROP COLUMN "host_id"`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" DROP COLUMN "meeting_id"`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ADD "fileSize" bigint NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ADD "filePath" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ADD "hostId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ADD "meetingId" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ADD CONSTRAINT "FK_582311a852c87b98deb8127a13c" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
