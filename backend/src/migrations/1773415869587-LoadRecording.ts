import { MigrationInterface, QueryRunner } from "typeorm";

export class LoadRecording1773415869587 implements MigrationInterface {
    name = 'LoadRecording1773415869587'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "meeting_recordings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "meetingId" uuid NOT NULL, "hostId" character varying NOT NULL, "filePath" character varying NOT NULL, "fileSize" bigint NOT NULL, "duration" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2ca7bd6a89b35d6708bc3ef6ee5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "meeting_recordings" ADD CONSTRAINT "FK_582311a852c87b98deb8127a13c" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meeting_recordings" DROP CONSTRAINT "FK_582311a852c87b98deb8127a13c"`);
        await queryRunner.query(`DROP TABLE "meeting_recordings"`);
    }

}
