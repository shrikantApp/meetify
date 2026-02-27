import { MigrationInterface, QueryRunner } from "typeorm";

export class Load1771914468628 implements MigrationInterface {
    name = 'Load1771914468628'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "meeting_participants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "joined_at" TIMESTAMP NOT NULL DEFAULT now(), "left_at" TIMESTAMP, "meeting_id" uuid, "user_id" uuid, CONSTRAINT "PK_994ee66a92de655fb478c038980" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "meetings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "meeting_code" character varying NOT NULL, "title" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "host_id" uuid, CONSTRAINT "UQ_23734e73d5f5caadf1869dde085" UNIQUE ("meeting_code"), CONSTRAINT "PK_aa73be861afa77eb4ed31f3ed57" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "meeting_participants" ADD CONSTRAINT "FK_4d2e803caeb25541cc89f2efa5b" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "meeting_participants" ADD CONSTRAINT "FK_4743681bb404d50f8000e2a8228" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "meetings" ADD CONSTRAINT "FK_6bf7c3bf900ea781101614178d0" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meetings" DROP CONSTRAINT "FK_6bf7c3bf900ea781101614178d0"`);
        await queryRunner.query(`ALTER TABLE "meeting_participants" DROP CONSTRAINT "FK_4743681bb404d50f8000e2a8228"`);
        await queryRunner.query(`ALTER TABLE "meeting_participants" DROP CONSTRAINT "FK_4d2e803caeb25541cc89f2efa5b"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "meetings"`);
        await queryRunner.query(`DROP TABLE "meeting_participants"`);
    }

}
