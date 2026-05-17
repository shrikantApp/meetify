import { MigrationInterface, QueryRunner } from 'typeorm';

export class LoadModule1778995180740 implements MigrationInterface {
  name = 'LoadModule1778995180740';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const originalQuery = queryRunner.query.bind(queryRunner);
    queryRunner.query = (async (query: string, parameters?: any[]) => {
      try {
        return await originalQuery(query, parameters);
      } catch (error: any) {
        const tolerableCodes = new Set([
          '42710', // duplicate_object
          '42P07', // duplicate_table / relation already exists
          '42701', // duplicate_column
          '42703', // undefined_column
          '42704', // undefined_object
        ]);
        if (tolerableCodes.has(error?.code)) {
          return [];
        }
        throw error;
      }
    }) as typeof queryRunner.query;

    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."workspace_join_requests_status_enum" AS ENUM('pending', 'approved', 'rejected', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "workspace_join_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspace_id" uuid NOT NULL, "requester_id" uuid NOT NULL, "status" "public"."workspace_join_requests_status_enum" NOT NULL DEFAULT 'pending', "message" text, "reviewed_by" uuid, "reviewed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a7eb61f8eb71a2d25d51936d4b5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_2e2bc6db4223762cef7f86ecaa" ON "workspace_join_requests" ("requester_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_6ba298f71ffe6a9918ef276bd9" ON "workspace_join_requests" ("workspace_id", "status") `,
    );
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."workspace_invitations_role_enum" AS ENUM('owner', 'admin', 'member', 'guest'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."workspace_invitations_status_enum" AS ENUM('pending', 'accepted', 'rejected', 'cancelled', 'expired'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "workspace_invitations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspace_id" uuid NOT NULL, "inviter_id" uuid NOT NULL, "invitee_user_id" uuid, "invitee_email" character varying, "role" "public"."workspace_invitations_role_enum" NOT NULL DEFAULT 'member', "status" "public"."workspace_invitations_status_enum" NOT NULL DEFAULT 'pending', "token_hash" character varying, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "message" text, "accepted_at" TIMESTAMP WITH TIME ZONE, "rejected_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_525b9069dc828a8ee8fdc62c32c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_466fb624c78c7119d5a796f8e7" ON "workspace_invitations" ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_54e811da4d71f72dac33f04b34" ON "workspace_invitations" ("invitee_email", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_e8a4cb6087dda795fa9e808969" ON "workspace_invitations" ("invitee_user_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_32a73f4046cb7b1598bd0059b0" ON "workspace_invitations" ("workspace_id", "status") `,
    );
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."workspace_activity_logs_action_enum" AS ENUM('workspace_created', 'workspace_updated', 'member_invited', 'invitation_accepted', 'invitation_rejected', 'join_request_created', 'join_request_approved', 'join_request_rejected', 'member_left', 'member_removed', 'member_role_updated'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "workspace_activity_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspace_id" uuid NOT NULL, "actor_id" uuid, "target_user_id" uuid, "action" "public"."workspace_activity_logs_action_enum" NOT NULL, "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c0d8046ac626a0344ae5079177b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_90c1f5af01312f526883e4a49f" ON "workspace_activity_logs" ("workspace_id", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'workspace_invite'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'workspace_join_request'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'workspace_activity'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_1338555359359d21492bb8ba0b" ON "workspace_members" ("workspaceId", "role") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_22176b38813258c2aadaae3244" ON "workspace_members" ("userId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_99bcb5fdac446371d41f048b24" ON "workspace_members" ("workspaceId", "userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_77607c5b6af821ec294d33aab0" ON "workspaces" ("ownerId") `,
    );
    await queryRunner.query(
      `DO $$ BEGIN ALTER TABLE "workspace_join_requests" ADD CONSTRAINT "FK_e1c799b3d9b57ff81faf532cb0e" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN ALTER TABLE "workspace_join_requests" ADD CONSTRAINT "FK_e023d92009d9d4b489228ff25f8" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN ALTER TABLE "workspace_join_requests" ADD CONSTRAINT "FK_76e8b7c9d666e427901fc8dce4b" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN ALTER TABLE "workspace_invitations" ADD CONSTRAINT "FK_cf5df369b7a86ea3cdf18c7b56d" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN ALTER TABLE "workspace_invitations" ADD CONSTRAINT "FK_7676b6af9283e6200193966ccf3" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN ALTER TABLE "workspace_invitations" ADD CONSTRAINT "FK_482d63d446e562f7f4467196ae2" FOREIGN KEY ("invitee_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN ALTER TABLE "workspace_activity_logs" ADD CONSTRAINT "FK_4cb3a4ca1559eb32ddc0b14318a" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN ALTER TABLE "workspace_activity_logs" ADD CONSTRAINT "FK_97acf39633baa4dc7ee3009e0a8" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN ALTER TABLE "workspace_activity_logs" ADD CONSTRAINT "FK_ad1adab3502500d4386ed938da7" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workspace_activity_logs" DROP CONSTRAINT "FK_ad1adab3502500d4386ed938da7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_activity_logs" DROP CONSTRAINT "FK_97acf39633baa4dc7ee3009e0a8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_activity_logs" DROP CONSTRAINT "FK_4cb3a4ca1559eb32ddc0b14318a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_invitations" DROP CONSTRAINT "FK_482d63d446e562f7f4467196ae2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_invitations" DROP CONSTRAINT "FK_7676b6af9283e6200193966ccf3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_invitations" DROP CONSTRAINT "FK_cf5df369b7a86ea3cdf18c7b56d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_join_requests" DROP CONSTRAINT "FK_76e8b7c9d666e427901fc8dce4b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_join_requests" DROP CONSTRAINT "FK_e023d92009d9d4b489228ff25f8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_join_requests" DROP CONSTRAINT "FK_e1c799b3d9b57ff81faf532cb0e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_77607c5b6af821ec294d33aab0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_99bcb5fdac446371d41f048b24"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_22176b38813258c2aadaae3244"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1338555359359d21492bb8ba0b"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum_old" AS ENUM('new_message', 'mention', 'group_invite', 'community_invite', 'reaction', 'join_request', 'system')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum_old" USING "type"::"text"::"public"."notifications_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum_old" RENAME TO "notifications_type_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "deletedAt"`);
    await queryRunner.query(
      `ALTER TABLE "workspace_members" DROP COLUMN "deletedAt"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_90c1f5af01312f526883e4a49f"`,
    );
    await queryRunner.query(`DROP TABLE "workspace_activity_logs"`);
    await queryRunner.query(
      `DROP TYPE "public"."workspace_activity_logs_action_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_32a73f4046cb7b1598bd0059b0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e8a4cb6087dda795fa9e808969"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_54e811da4d71f72dac33f04b34"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_466fb624c78c7119d5a796f8e7"`,
    );
    await queryRunner.query(`DROP TABLE "workspace_invitations"`);
    await queryRunner.query(
      `DROP TYPE "public"."workspace_invitations_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."workspace_invitations_role_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6ba298f71ffe6a9918ef276bd9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2e2bc6db4223762cef7f86ecaa"`,
    );
    await queryRunner.query(`DROP TABLE "workspace_join_requests"`);
    await queryRunner.query(
      `DROP TYPE "public"."workspace_join_requests_status_enum"`,
    );
  }
}
