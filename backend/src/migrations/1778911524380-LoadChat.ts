import { MigrationInterface, QueryRunner } from "typeorm";

export class LoadChat1778911524380 implements MigrationInterface {
    name = 'LoadChat1778911524380'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."workspace_members_role_enum" AS ENUM('owner', 'admin', 'member', 'guest')`);
        await queryRunner.query(`CREATE TABLE "workspace_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "userId" uuid NOT NULL, "role" "public"."workspace_members_role_enum" NOT NULL DEFAULT 'member', "joinedAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_22ab43ac5865cd62769121d2bc4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."message_attachments_type_enum" AS ENUM('image', 'video', 'audio', 'document', 'voice_note')`);
        await queryRunner.query(`CREATE TABLE "message_attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "message_id" uuid NOT NULL, "type" "public"."message_attachments_type_enum" NOT NULL, "storage_key" character varying NOT NULL, "url" character varying NOT NULL, "original_name" character varying NOT NULL, "mime_type" character varying NOT NULL, "size_bytes" bigint NOT NULL, "width" integer, "height" integer, "duration" double precision, "thumbnail_url" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e5085d973567c61e9306f10f95b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "message_reactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "message_id" uuid NOT NULL, "user_id" uuid NOT NULL, "emoji" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_654a9f0059ff93a8f156be66a5b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f5a1f46b4f33ce416f9c192ab2" ON "message_reactions" ("message_id", "user_id", "emoji") `);
        await queryRunner.query(`CREATE TYPE "public"."message_statuses_status_enum" AS ENUM('delivered', 'read')`);
        await queryRunner.query(`CREATE TABLE "message_statuses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "message_id" uuid NOT NULL, "user_id" uuid NOT NULL, "conversation_id" uuid NOT NULL, "status" "public"."message_statuses_status_enum" NOT NULL, "status_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_588875cf01317aa576e28039eb8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_aa29a73af33a25a7fba23c242c" ON "message_statuses" ("message_id", "user_id") `);
        await queryRunner.query(`CREATE TYPE "public"."messages_type_enum" AS ENUM('text', 'image', 'video', 'audio', 'document', 'voice_note', 'system')`);
        await queryRunner.query(`CREATE TYPE "public"."messages_delivery_status_enum" AS ENUM('sending', 'sent', 'delivered', 'read', 'failed')`);
        await queryRunner.query(`CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversation_id" uuid NOT NULL, "sender_id" uuid NOT NULL, "content" text, "type" "public"."messages_type_enum" NOT NULL DEFAULT 'text', "delivery_status" "public"."messages_delivery_status_enum" NOT NULL DEFAULT 'sent', "reply_to_id" uuid, "forwarded_from_id" uuid, "is_edited" boolean NOT NULL DEFAULT false, "is_deleted" boolean NOT NULL DEFAULT false, "deleted_for_everyone" boolean NOT NULL DEFAULT false, "scheduled_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE, "mentions" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8584a1974e1ca95f4861d975ff" ON "messages" ("conversation_id", "created_at") `);
        await queryRunner.query(`CREATE TYPE "public"."conversation_members_role_enum" AS ENUM('owner', 'admin', 'member')`);
        await queryRunner.query(`CREATE TABLE "conversation_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversation_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" "public"."conversation_members_role_enum" NOT NULL DEFAULT 'member', "is_muted" boolean NOT NULL DEFAULT false, "is_archived" boolean NOT NULL DEFAULT false, "is_pinned" boolean NOT NULL DEFAULT false, "unread_count" integer NOT NULL DEFAULT '0', "last_read_message_id" uuid, "last_read_at" TIMESTAMP WITH TIME ZONE, "joined_at" TIMESTAMP NOT NULL DEFAULT now(), "left_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_33146a476696a973a14d931e675" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5fa9076068b6f2a26fb793d243" ON "conversation_members" ("conversation_id", "user_id") `);
        await queryRunner.query(`CREATE TYPE "public"."conversations_type_enum" AS ENUM('direct', 'group', 'broadcast')`);
        await queryRunner.query(`CREATE TABLE "conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."conversations_type_enum" NOT NULL DEFAULT 'direct', "name" character varying, "description" character varying, "avatar_url" character varying, "created_by" uuid NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "last_message_at" TIMESTAMP WITH TIME ZONE, "pinned_message_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "workspaceId" uuid, CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "workspaces" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "ownerId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_b8e9fe62e93d60089dfc4f175f3" UNIQUE ("slug"), CONSTRAINT "PK_098656ae401f3e1a4586f47fd8e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('new_message', 'mention', 'group_invite', 'community_invite', 'reaction', 'join_request', 'system')`);
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "type" "public"."notifications_type_enum" NOT NULL, "title" character varying NOT NULL, "body" character varying, "reference_id" uuid, "reference_type" character varying, "is_read" boolean NOT NULL DEFAULT false, "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_af08fad7c04bb85403970afdc1" ON "notifications" ("user_id", "is_read") `);
        await queryRunner.query(`CREATE TYPE "public"."community_members_role_enum" AS ENUM('owner', 'admin', 'moderator', 'member')`);
        await queryRunner.query(`CREATE TYPE "public"."community_members_join_status_enum" AS ENUM('pending', 'approved', 'rejected')`);
        await queryRunner.query(`CREATE TABLE "community_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "community_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" "public"."community_members_role_enum" NOT NULL DEFAULT 'member', "join_status" "public"."community_members_join_status_enum" NOT NULL DEFAULT 'approved', "joined_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_03dff82f9cfcb02498e9f5fc640" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a304f5a705ec45c9d11b561828" ON "community_members" ("community_id", "user_id") `);
        await queryRunner.query(`CREATE TABLE "community_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "community_id" uuid NOT NULL, "conversation_id" uuid NOT NULL, "is_announcement" boolean NOT NULL DEFAULT false, "display_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c69dcd2be64285e2c7031894f3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."communities_visibility_enum" AS ENUM('public', 'private')`);
        await queryRunner.query(`CREATE TABLE "communities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying, "avatar_url" character varying, "cover_url" character varying, "visibility" "public"."communities_visibility_enum" NOT NULL DEFAULT 'public', "created_by" uuid NOT NULL, "invite_link" character varying, "require_approval" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_6c615c788a676c8c9b658658b36" UNIQUE ("invite_link"), CONSTRAINT "PK_fea1fe83c86ccde9d0a089e7ea2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ADD "avatarUrl" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "is_online" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "users" ADD "last_seen" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "workspace_members" ADD CONSTRAINT "FK_0dd45cb52108d0664df4e7e33e6" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workspace_members" ADD CONSTRAINT "FK_22176b38813258c2aadaae32448" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message_attachments" ADD CONSTRAINT "FK_bf65c3db8657cef6197b68b8c88" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message_reactions" ADD CONSTRAINT "FK_ce61e365d81a9dfc15cd36513b0" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message_reactions" ADD CONSTRAINT "FK_b6d3eda2f99b64016d6a4cf112f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message_statuses" ADD CONSTRAINT "FK_229b8548ced91512c3d1f08dc25" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message_statuses" ADD CONSTRAINT "FK_e8cd4c8e814448442e81c430b89" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_22133395bd13b970ccd0c34ab22" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_54e66104dd534ed1c191e44096f" FOREIGN KEY ("reply_to_id") REFERENCES "messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversation_members" ADD CONSTRAINT "FK_36340a1704b039608e34244511f" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversation_members" ADD CONSTRAINT "FK_a46c76be8f62c4b00a835cdc370" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_ed74afeb8d28f69b76bd09f4105" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD CONSTRAINT "FK_77607c5b6af821ec294d33aab0c" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "community_members" ADD CONSTRAINT "FK_46eb2c3e2d8b84acbd9a78974ab" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "community_members" ADD CONSTRAINT "FK_59ac0a0f039c16f8429ec9bda5d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "community_groups" ADD CONSTRAINT "FK_ebebc902d7540643d0e2c5a0901" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "community_groups" ADD CONSTRAINT "FK_5a61472945279e8dd93f892eb57" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "community_groups" DROP CONSTRAINT "FK_5a61472945279e8dd93f892eb57"`);
        await queryRunner.query(`ALTER TABLE "community_groups" DROP CONSTRAINT "FK_ebebc902d7540643d0e2c5a0901"`);
        await queryRunner.query(`ALTER TABLE "community_members" DROP CONSTRAINT "FK_59ac0a0f039c16f8429ec9bda5d"`);
        await queryRunner.query(`ALTER TABLE "community_members" DROP CONSTRAINT "FK_46eb2c3e2d8b84acbd9a78974ab"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`);
        await queryRunner.query(`ALTER TABLE "workspaces" DROP CONSTRAINT "FK_77607c5b6af821ec294d33aab0c"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_ed74afeb8d28f69b76bd09f4105"`);
        await queryRunner.query(`ALTER TABLE "conversation_members" DROP CONSTRAINT "FK_a46c76be8f62c4b00a835cdc370"`);
        await queryRunner.query(`ALTER TABLE "conversation_members" DROP CONSTRAINT "FK_36340a1704b039608e34244511f"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_54e66104dd534ed1c191e44096f"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_22133395bd13b970ccd0c34ab22"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23"`);
        await queryRunner.query(`ALTER TABLE "message_statuses" DROP CONSTRAINT "FK_e8cd4c8e814448442e81c430b89"`);
        await queryRunner.query(`ALTER TABLE "message_statuses" DROP CONSTRAINT "FK_229b8548ced91512c3d1f08dc25"`);
        await queryRunner.query(`ALTER TABLE "message_reactions" DROP CONSTRAINT "FK_b6d3eda2f99b64016d6a4cf112f"`);
        await queryRunner.query(`ALTER TABLE "message_reactions" DROP CONSTRAINT "FK_ce61e365d81a9dfc15cd36513b0"`);
        await queryRunner.query(`ALTER TABLE "message_attachments" DROP CONSTRAINT "FK_bf65c3db8657cef6197b68b8c88"`);
        await queryRunner.query(`ALTER TABLE "workspace_members" DROP CONSTRAINT "FK_22176b38813258c2aadaae32448"`);
        await queryRunner.query(`ALTER TABLE "workspace_members" DROP CONSTRAINT "FK_0dd45cb52108d0664df4e7e33e6"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_seen"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_online"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarUrl"`);
        await queryRunner.query(`DROP TABLE "communities"`);
        await queryRunner.query(`DROP TYPE "public"."communities_visibility_enum"`);
        await queryRunner.query(`DROP TABLE "community_groups"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a304f5a705ec45c9d11b561828"`);
        await queryRunner.query(`DROP TABLE "community_members"`);
        await queryRunner.query(`DROP TYPE "public"."community_members_join_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."community_members_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_af08fad7c04bb85403970afdc1"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
        await queryRunner.query(`DROP TABLE "workspaces"`);
        await queryRunner.query(`DROP TABLE "conversations"`);
        await queryRunner.query(`DROP TYPE "public"."conversations_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5fa9076068b6f2a26fb793d243"`);
        await queryRunner.query(`DROP TABLE "conversation_members"`);
        await queryRunner.query(`DROP TYPE "public"."conversation_members_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8584a1974e1ca95f4861d975ff"`);
        await queryRunner.query(`DROP TABLE "messages"`);
        await queryRunner.query(`DROP TYPE "public"."messages_delivery_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."messages_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aa29a73af33a25a7fba23c242c"`);
        await queryRunner.query(`DROP TABLE "message_statuses"`);
        await queryRunner.query(`DROP TYPE "public"."message_statuses_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f5a1f46b4f33ce416f9c192ab2"`);
        await queryRunner.query(`DROP TABLE "message_reactions"`);
        await queryRunner.query(`DROP TABLE "message_attachments"`);
        await queryRunner.query(`DROP TYPE "public"."message_attachments_type_enum"`);
        await queryRunner.query(`DROP TABLE "workspace_members"`);
        await queryRunner.query(`DROP TYPE "public"."workspace_members_role_enum"`);
    }

}
