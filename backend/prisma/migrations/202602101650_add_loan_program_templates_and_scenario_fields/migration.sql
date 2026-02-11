-- AlterTable
ALTER TABLE "loan_scenarios" ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "preferred_program_id" TEXT,
ADD COLUMN     "recommendation_notes" TEXT,
ADD COLUMN     "scenario_data" TEXT,
ADD COLUMN     "shared_at" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "version" TEXT NOT NULL DEFAULT '1.0.0';

-- CreateTable
CREATE TABLE "loan_program_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'FIXED',
    "term_years" INTEGER NOT NULL,
    "default_rate" DOUBLE PRECISION,
    "arm_config" TEXT,
    "loan_type" TEXT NOT NULL DEFAULT 'conventional',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_program_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loan_program_templates_created_by_id_idx" ON "loan_program_templates"("created_by_id");

-- CreateIndex
CREATE INDEX "loan_program_templates_is_active_idx" ON "loan_program_templates"("is_active");

-- CreateIndex
CREATE INDEX "loan_program_templates_category_idx" ON "loan_program_templates"("category");

-- CreateIndex
CREATE INDEX "loan_program_templates_sort_order_idx" ON "loan_program_templates"("sort_order");

-- CreateIndex
CREATE INDEX "loan_scenarios_status_idx" ON "loan_scenarios"("status");

-- CreateIndex
CREATE INDEX "loan_scenarios_created_by_id_idx" ON "loan_scenarios"("created_by_id");

-- AddForeignKey
ALTER TABLE "loan_program_templates" ADD CONSTRAINT "loan_program_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

