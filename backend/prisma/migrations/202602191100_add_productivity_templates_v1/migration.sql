-- Alter existing template tables
ALTER TABLE "note_templates" ADD COLUMN "description" TEXT;
ALTER TABLE "note_templates" ADD COLUMN "is_system" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "note_templates" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "note_templates" ADD COLUMN "created_by_id" TEXT;

ALTER TABLE "task_templates" ADD COLUMN "is_system" BOOLEAN NOT NULL DEFAULT false;

-- Backfill legacy defaults as system templates
UPDATE "note_templates" SET "is_system" = true;
UPDATE "task_templates" SET "is_system" = true;

-- CreateTable
CREATE TABLE "reminder_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reminder_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "activity_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" TEXT NOT NULL,
    "auto_follow_up" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "activity_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "note_templates_is_system_idx" ON "note_templates"("is_system");
CREATE INDEX "note_templates_deleted_at_idx" ON "note_templates"("deleted_at");
CREATE INDEX "note_templates_created_by_id_idx" ON "note_templates"("created_by_id");
CREATE INDEX "task_templates_is_system_idx" ON "task_templates"("is_system");
CREATE INDEX "reminder_templates_is_system_idx" ON "reminder_templates"("is_system");
CREATE INDEX "reminder_templates_deleted_at_idx" ON "reminder_templates"("deleted_at");
CREATE INDEX "reminder_templates_created_by_id_idx" ON "reminder_templates"("created_by_id");
CREATE INDEX "activity_templates_is_system_idx" ON "activity_templates"("is_system");
CREATE INDEX "activity_templates_deleted_at_idx" ON "activity_templates"("deleted_at");
CREATE INDEX "activity_templates_created_by_id_idx" ON "activity_templates"("created_by_id");
