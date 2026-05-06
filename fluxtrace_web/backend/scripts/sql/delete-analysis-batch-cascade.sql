-- Apaga um lote de análise e linhas dependentes (mesma ordem que deleteAnalysisBatchAndRelatedData no servidor).
-- Uso: substituir o placeholder pelo batchId exato, por exemplo: ctr-xxxxxxxx
-- Tabelas conforme drizzle/schema/schema.ts (nomes com aspas — camelCase no Postgres).
--
-- ATENÇÃO: operação destrutiva. Faça backup ou confirme o batchId em SELECT antes.
--
-- BEGIN;
--   \set batch_id 'SEU-BATCH-ID-AQUI'
--   (ou editar a linha WHERE abaixo)
--
-- DELETE ... WHERE "batchId" = 'SEU-BATCH-ID';
-- COMMIT;

BEGIN;

DELETE FROM "analysisEvents" WHERE "batchId" = 'REPLACE_WITH_BATCH_ID';
DELETE FROM "analysisArtifacts" WHERE "batchId" = 'REPLACE_WITH_BATCH_ID';
DELETE FROM "analysisInsights" WHERE "batchId" = 'REPLACE_WITH_BATCH_ID';
DELETE FROM "analysisCommits" WHERE "batchId" = 'REPLACE_WITH_BATCH_ID';
DELETE FROM "analysisBatches" WHERE "batchId" = 'REPLACE_WITH_BATCH_ID';

-- Opcional: verificar
-- SELECT 'analysisBatches remanescente' AS check_name, count(*) FROM "analysisBatches" WHERE "batchId" = 'REPLACE_WITH_BATCH_ID';

COMMIT;

-- Nota: apagar da BD não interrompe um processo Node já a correr em memória;
-- se um lote estiver preso, pode ser necessário reiniciar o serviço. No servidor,
-- apague também a pasta de workspace local do lote em ARTEFACTO_ROOT, se existir
-- (ex.: <root>/ctr-<id>/), ou use o botão "Remover lote" na UI (chama o procedimento TRPC deleteBatch).
