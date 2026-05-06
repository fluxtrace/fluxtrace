-- Referência: `backend/drizzle/migrations/manual/rename_analysis_jobs_to_batches.sql`
-- O script npm run db:migrate-rename-jobs-to-batches é idempotente (TypeScript); este ficheiro SQL
-- documenta os passos equivalentes para execução manual em ferramentas SQL.
-- Na raiz `fluxtrace_web/`: npm run db:migrate-rename-jobs-to-batches (tsx; DATABASE_URL ou .env).
-- PostgreSQL na nuvem: SSL inferido pelo hostname (Render/Neon/…) ou sslmode=require / DATABASE_SSL=true (ver `backend/scripts/db/run-rename-jobs-to-batches.mts`).
-- Valide com SELECT antes de operadores DELETE em cascata.

BEGIN;

ALTER TYPE "job_status" RENAME TO "batch_status";

ALTER TABLE "analysisJobs" RENAME TO "analysisBatches";

ALTER TABLE "analysisBatches" RENAME COLUMN "jobId" TO "batchId";
ALTER TABLE "analysisBatches" RENAME COLUMN "pipelineJobId" TO "pipelineBatchRef";
ALTER TABLE "analysisBatches" RENAME COLUMN "pipelineJobPath" TO "pipelineExternalPath";

ALTER TABLE "analysisEvents" RENAME COLUMN "jobId" TO "batchId";
ALTER TABLE "analysisArtifacts" RENAME COLUMN "jobId" TO "batchId";
ALTER TABLE "analysisInsights" RENAME COLUMN "jobId" TO "batchId";
ALTER TABLE "analysisCommits" RENAME COLUMN "jobId" TO "batchId";

COMMIT;
