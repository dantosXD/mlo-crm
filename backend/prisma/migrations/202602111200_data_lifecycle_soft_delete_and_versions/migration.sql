-- AlterTable
ALTER TABLE "users" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "clients" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "notes" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "task_subtasks" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "task_attachments" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "documents" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "loan_scenarios" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "loan_program_templates" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "task_templates" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "notifications" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "communication_templates" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "communications" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "workflows" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "events" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "reminders" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "calendar_shares" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "entity_versions" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "before_data" TEXT,
    "after_data" TEXT,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");
CREATE INDEX "clients_deleted_at_idx" ON "clients"("deleted_at");
CREATE INDEX "notes_deleted_at_idx" ON "notes"("deleted_at");
CREATE INDEX "task_subtasks_deleted_at_idx" ON "task_subtasks"("deleted_at");
CREATE INDEX "task_attachments_deleted_at_idx" ON "task_attachments"("deleted_at");
CREATE INDEX "documents_deleted_at_idx" ON "documents"("deleted_at");
CREATE INDEX "loan_scenarios_deleted_at_idx" ON "loan_scenarios"("deleted_at");
CREATE INDEX "loan_program_templates_deleted_at_idx" ON "loan_program_templates"("deleted_at");
CREATE INDEX "task_templates_deleted_at_idx" ON "task_templates"("deleted_at");
CREATE INDEX "notifications_deleted_at_idx" ON "notifications"("deleted_at");
CREATE INDEX "communication_templates_deleted_at_idx" ON "communication_templates"("deleted_at");
CREATE INDEX "communications_deleted_at_idx" ON "communications"("deleted_at");
CREATE INDEX "workflows_deleted_at_idx" ON "workflows"("deleted_at");
CREATE INDEX "events_deleted_at_idx" ON "events"("deleted_at");
CREATE INDEX "reminders_deleted_at_idx" ON "reminders"("deleted_at");
CREATE INDEX "calendar_shares_deleted_at_idx" ON "calendar_shares"("deleted_at");
CREATE INDEX "entity_versions_entity_type_entity_id_created_at_idx" ON "entity_versions"("entity_type", "entity_id", "created_at");
CREATE INDEX "entity_versions_actor_user_id_idx" ON "entity_versions"("actor_user_id");
