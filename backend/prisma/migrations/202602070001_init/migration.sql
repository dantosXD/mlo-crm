-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MLO',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "preferences" TEXT DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name_encrypted" TEXT NOT NULL,
    "email_encrypted" TEXT NOT NULL,
    "phone_encrypted" TEXT NOT NULL,
    "name_hash" TEXT NOT NULL,
    "email_hash" TEXT NOT NULL,
    "phone_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LEAD',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_financial_profiles" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "annual_income" DOUBLE PRECISION,
    "monthly_debts" DOUBLE PRECISION,
    "credit_score" INTEGER,
    "employment_type" TEXT,
    "employer_name" TEXT,
    "years_employed" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_financial_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "client_id" TEXT,
    "text" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "assigned_to_id" TEXT,
    "created_by_id" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "reminder_enabled" BOOLEAN NOT NULL DEFAULT false,
    "reminder_times" TEXT DEFAULT '[]',
    "reminder_message" TEXT,
    "snoozed_until" TIMESTAMP(3),
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurring_pattern" TEXT,
    "recurring_interval" INTEGER,
    "recurring_end_date" TIMESTAMP(3),
    "recurring_task_id" TEXT,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_subtasks" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_subtasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_reminder_history" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reminded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reminder_type" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "delivered" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT,

    CONSTRAINT "task_reminder_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_attachments" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "file_path" TEXT,
    "content" TEXT,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "due_date" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_scenarios" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "loan_type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "interest_rate" DOUBLE PRECISION NOT NULL,
    "term_years" INTEGER NOT NULL,
    "down_payment" DOUBLE PRECISION,
    "property_value" DOUBLE PRECISION,
    "property_taxes" DOUBLE PRECISION,
    "home_insurance" DOUBLE PRECISION,
    "hoa_fees" DOUBLE PRECISION,
    "pmi_rate" DOUBLE PRECISION,
    "monthly_payment" DOUBLE PRECISION,
    "total_monthly_payment" DOUBLE PRECISION,
    "total_interest" DOUBLE PRECISION,
    "loan_to_value" DOUBLE PRECISION,
    "debt_to_income" DOUBLE PRECISION,
    "is_preferred" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "client_id" TEXT,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_standard" BOOLEAN NOT NULL DEFAULT false,
    "documents" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "note_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "due_days" INTEGER,
    "steps" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "placeholders" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "template_id" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "follow_up_date" TIMESTAMP(3),
    "attachments" TEXT,
    "created_by_id" TEXT NOT NULL,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "trigger_type" TEXT NOT NULL,
    "trigger_config" TEXT,
    "conditions" TEXT,
    "actions" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_versions" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger_type" TEXT NOT NULL,
    "trigger_config" TEXT,
    "conditions" TEXT,
    "actions" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "client_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "trigger_data" TEXT,
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "logs" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "last_retry_at" TIMESTAMP(3),
    "next_retry_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_execution_logs" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "action_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input_data" TEXT,
    "output_data" TEXT,
    "error_message" TEXT,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "event_type" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "client_id" TEXT,
    "task_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurring_rule" TEXT,
    "recurring_end_date" TIMESTAMP(3),
    "recurring_event_id" TEXT,
    "reminders" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "color" TEXT,
    "external_id" TEXT,
    "external_calendar" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_attendees" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "rsvp_status" TEXT NOT NULL DEFAULT 'NEEDS_ACTION',
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "remind_at" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3),
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurring_pattern" TEXT,
    "recurring_interval" INTEGER,
    "recurring_end_date" TIMESTAMP(3),
    "recurring_reminder_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "snoozed_until" TIMESTAMP(3),
    "snooze_count" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_shares" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "shared_with_id" TEXT NOT NULL,
    "visibility_level" TEXT NOT NULL DEFAULT 'FULL_DETAILS',
    "permission_level" TEXT NOT NULL DEFAULT 'VIEW_ONLY',
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "expires_at" TIMESTAMP(3),
    "share_token" TEXT,
    "is_public_link" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "clients_name_hash_idx" ON "clients"("name_hash");

-- CreateIndex
CREATE INDEX "clients_email_hash_idx" ON "clients"("email_hash");

-- CreateIndex
CREATE INDEX "clients_phone_hash_idx" ON "clients"("phone_hash");

-- CreateIndex
CREATE INDEX "clients_status_idx" ON "clients"("status");

-- CreateIndex
CREATE INDEX "clients_created_at_idx" ON "clients"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "client_financial_profiles_client_id_key" ON "client_financial_profiles"("client_id");

-- CreateIndex
CREATE INDEX "notes_client_id_idx" ON "notes"("client_id");

-- CreateIndex
CREATE INDEX "notes_created_at_idx" ON "notes"("created_at");

-- CreateIndex
CREATE INDEX "tasks_client_id_idx" ON "tasks"("client_id");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_due_date_idx" ON "tasks"("due_date");

-- CreateIndex
CREATE INDEX "tasks_assigned_to_id_idx" ON "tasks"("assigned_to_id");

-- CreateIndex
CREATE INDEX "tasks_deleted_at_idx" ON "tasks"("deleted_at");

-- CreateIndex
CREATE INDEX "tasks_type_idx" ON "tasks"("type");

-- CreateIndex
CREATE INDEX "task_reminder_history_task_id_idx" ON "task_reminder_history"("task_id");

-- CreateIndex
CREATE INDEX "task_reminder_history_user_id_idx" ON "task_reminder_history"("user_id");

-- CreateIndex
CREATE INDEX "task_reminder_history_reminded_at_idx" ON "task_reminder_history"("reminded_at");

-- CreateIndex
CREATE INDEX "task_attachments_task_id_idx" ON "task_attachments"("task_id");

-- CreateIndex
CREATE INDEX "task_attachments_type_idx" ON "task_attachments"("type");

-- CreateIndex
CREATE INDEX "documents_client_id_idx" ON "documents"("client_id");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "documents_category_idx" ON "documents"("category");

-- CreateIndex
CREATE INDEX "loan_scenarios_client_id_idx" ON "loan_scenarios"("client_id");

-- CreateIndex
CREATE INDEX "activities_client_id_idx" ON "activities"("client_id");

-- CreateIndex
CREATE INDEX "activities_user_id_idx" ON "activities"("user_id");

-- CreateIndex
CREATE INDEX "activities_type_idx" ON "activities"("type");

-- CreateIndex
CREATE INDEX "activities_created_at_idx" ON "activities"("created_at");

-- CreateIndex
CREATE INDEX "task_templates_type_idx" ON "task_templates"("type");

-- CreateIndex
CREATE INDEX "task_templates_created_by_id_idx" ON "task_templates"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "communication_templates_type_idx" ON "communication_templates"("type");

-- CreateIndex
CREATE INDEX "communication_templates_category_idx" ON "communication_templates"("category");

-- CreateIndex
CREATE INDEX "communication_templates_is_active_idx" ON "communication_templates"("is_active");

-- CreateIndex
CREATE INDEX "communications_client_id_idx" ON "communications"("client_id");

-- CreateIndex
CREATE INDEX "communications_type_idx" ON "communications"("type");

-- CreateIndex
CREATE INDEX "communications_status_idx" ON "communications"("status");

-- CreateIndex
CREATE INDEX "communications_scheduled_at_idx" ON "communications"("scheduled_at");

-- CreateIndex
CREATE INDEX "communications_follow_up_date_idx" ON "communications"("follow_up_date");

-- CreateIndex
CREATE INDEX "communications_created_at_idx" ON "communications"("created_at");

-- CreateIndex
CREATE INDEX "workflows_trigger_type_idx" ON "workflows"("trigger_type");

-- CreateIndex
CREATE INDEX "workflows_is_active_idx" ON "workflows"("is_active");

-- CreateIndex
CREATE INDEX "workflows_created_at_idx" ON "workflows"("created_at");

-- CreateIndex
CREATE INDEX "workflow_versions_workflow_id_idx" ON "workflow_versions"("workflow_id");

-- CreateIndex
CREATE INDEX "workflow_versions_version_idx" ON "workflow_versions"("version");

-- CreateIndex
CREATE INDEX "workflow_executions_workflow_id_idx" ON "workflow_executions"("workflow_id");

-- CreateIndex
CREATE INDEX "workflow_executions_client_id_idx" ON "workflow_executions"("client_id");

-- CreateIndex
CREATE INDEX "workflow_executions_status_idx" ON "workflow_executions"("status");

-- CreateIndex
CREATE INDEX "workflow_executions_created_at_idx" ON "workflow_executions"("created_at");

-- CreateIndex
CREATE INDEX "workflow_execution_logs_execution_id_idx" ON "workflow_execution_logs"("execution_id");

-- CreateIndex
CREATE INDEX "workflow_execution_logs_executed_at_idx" ON "workflow_execution_logs"("executed_at");

-- CreateIndex
CREATE INDEX "events_start_time_idx" ON "events"("start_time");

-- CreateIndex
CREATE INDEX "events_end_time_idx" ON "events"("end_time");

-- CreateIndex
CREATE INDEX "events_event_type_idx" ON "events"("event_type");

-- CreateIndex
CREATE INDEX "events_client_id_idx" ON "events"("client_id");

-- CreateIndex
CREATE INDEX "events_task_id_idx" ON "events"("task_id");

-- CreateIndex
CREATE INDEX "events_created_by_id_idx" ON "events"("created_by_id");

-- CreateIndex
CREATE INDEX "events_status_idx" ON "events"("status");

-- CreateIndex
CREATE INDEX "event_attendees_event_id_idx" ON "event_attendees"("event_id");

-- CreateIndex
CREATE INDEX "event_attendees_email_idx" ON "event_attendees"("email");

-- CreateIndex
CREATE INDEX "reminders_user_id_idx" ON "reminders"("user_id");

-- CreateIndex
CREATE INDEX "reminders_client_id_idx" ON "reminders"("client_id");

-- CreateIndex
CREATE INDEX "reminders_remind_at_idx" ON "reminders"("remind_at");

-- CreateIndex
CREATE INDEX "reminders_status_idx" ON "reminders"("status");

-- CreateIndex
CREATE INDEX "reminders_category_idx" ON "reminders"("category");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_shares_share_token_key" ON "calendar_shares"("share_token");

-- CreateIndex
CREATE INDEX "calendar_shares_owner_id_idx" ON "calendar_shares"("owner_id");

-- CreateIndex
CREATE INDEX "calendar_shares_shared_with_id_idx" ON "calendar_shares"("shared_with_id");

-- CreateIndex
CREATE INDEX "calendar_shares_share_token_idx" ON "calendar_shares"("share_token");

-- CreateIndex
CREATE INDEX "calendar_shares_is_active_idx" ON "calendar_shares"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_shares_owner_id_shared_with_id_key" ON "calendar_shares"("owner_id", "shared_with_id");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_financial_profiles" ADD CONSTRAINT "client_financial_profiles_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurring_task_id_fkey" FOREIGN KEY ("recurring_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_subtasks" ADD CONSTRAINT "task_subtasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reminder_history" ADD CONSTRAINT "task_reminder_history_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_scenarios" ADD CONSTRAINT "loan_scenarios_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "communication_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_execution_logs" ADD CONSTRAINT "workflow_execution_logs_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "workflow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_recurring_event_id_fkey" FOREIGN KEY ("recurring_event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_shares" ADD CONSTRAINT "calendar_shares_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_shares" ADD CONSTRAINT "calendar_shares_shared_with_id_fkey" FOREIGN KEY ("shared_with_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

