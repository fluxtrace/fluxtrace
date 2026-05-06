/** Nome comercial e identificação no browser (aba, título, sidebar). */
export const APP_NAME = "FluxTrace";
/** Substring curta cuando o layout precisar só do produto sem extensões. */
export const APP_NAME_SHORT = "FluxTrace";
/** Linha opcional sob o nome (landing, marca de sessão local). */
export const APP_BRAND_LINE = "Rasto de fluxo em logs Contradef — MITRE ATT&CK, VirusTotal, diagramas Mermaid.";
/** Fragmento compacto sob o nome no topo da landing (cabecera). */
export const APP_HEADER_TAGLINE =
  "Correlação, redução inteligente e identificação de malware evasivo até a sua descoberta, mapeando seu fluxo e gerando o grafo.";
/** Sufixo ligado ao título completo quando não há rótulo de página. */
export const APP_TITLE_SUFFIX = "· Rastrear e correlacionar ameaças em logs Contradef";
/** Título completo sugerido para <title> (aba). */
export function appDocumentTitle(pageLabel?: string) {
  if (pageLabel?.trim()) {
    return `${pageLabel.trim()} | ${APP_NAME}`;
  }
  return `${APP_NAME} ${APP_TITLE_SUFFIX}`;
}
