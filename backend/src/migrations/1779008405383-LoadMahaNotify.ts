import { MigrationInterface, QueryRunner } from "typeorm";

export class LoadMahaNotify1779008405383 implements MigrationInterface {
    name = 'LoadMahaNotify1779008405383'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conversations" ADD "requires_confirmation" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`CREATE TYPE "public"."conversations_confirmation_status_enum" AS ENUM('pending', 'accepted', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD "confirmation_status" "public"."conversations_confirmation_status_enum" NOT NULL DEFAULT 'accepted'`);
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum" RENAME TO "notifications_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('new_message', 'mention', 'direct_chat_request', 'group_invite', 'workspace_invite', 'workspace_join_request', 'workspace_activity', 'community_invite', 'reaction', 'join_request', 'system')`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum" USING "type"::"text"::"public"."notifications_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum_old" AS ENUM('new_message', 'mention', 'group_invite', 'workspace_invite', 'workspace_join_request', 'workspace_activity', 'community_invite', 'reaction', 'join_request', 'system')`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum_old" USING "type"::"text"::"public"."notifications_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum_old" RENAME TO "notifications_type_enum"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "confirmation_status"`);
        await queryRunner.query(`DROP TYPE "public"."conversations_confirmation_status_enum"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "requires_confirmation"`);
    }

}
