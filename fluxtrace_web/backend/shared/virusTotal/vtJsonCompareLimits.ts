/**
 * Tamanho máximo do texto JSON enviado nas mutations `compareVtJsonExport` e `compareUnifiedVtMitreExport`.
 * Caracteres Unicode contam como 1; o corpo HTTP está limitado no Express a `json({ limit: "50mb" })` —
 * este valor deixa margem para o encapsulamento tRPC/superjson.
 */
export const VT_COMPARE_EXTERNAL_JSON_MAX_CHARS = 15_000_000;
