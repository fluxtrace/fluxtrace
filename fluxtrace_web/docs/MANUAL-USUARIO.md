# Manual do utilizador — FluxTrace

Este guia destina-se a **utilizadores da aplicação web** FluxTrace (correlação e rasto de fluxo em logs Contradef). Para **instalação local passo a passo** (ambiente, VS Code, Postgres, arranque), veja [`MANUAL-DEV-LOCAL.md`](./MANUAL-DEV-LOCAL.md). Para servidores, variáveis e arquitectura, veja o **Manual técnico** (`MANUAL-TECNICO.md`) e o [`readme-web.md`](../readme-web.md) na raiz do pacote `fluxtrace_web/`.

**Ambiente:** o sistema corre no **browser** (recomendado: navegador recente). O idioma da interface pode ser alterado quando a app disponibiliza o selector de idioma (conjunto com o tema claro/escuro na barra de ferramentas visível nos ecrãs aplicáveis).

---

## 1. Introdução

O FluxTrace permite, entre outras funções:

- Acompanhar **lotes de análise** (estado, progresso, resultados).
- **Reduzir logs** (envio de ficheiros, monitorização do processamento).
- Explorar **interpretação consolidada** (fluxo, evidências, integrações como VirusTotal e MITRE, quando configuradas no servidor).
- Consultar **funções mapeadas** e materiais de apoio à análise.
- Gerir **perfil** e, para perfis administrativos, **utilizadores**.

> **Nota:** Algumas funções dependem de **permissões** da sua conta e da **configuração do servidor** (por exemplo API VirusTotal, OAuth institucional). Se algo não aparecer, confirme com o administrador.

---

## 2. Acesso e primeira utilização

### 2.1. Endereço da aplicação

Utilize o URL fornecido pela sua organização (ex.: ambiente interno ou serviço alojado).

**Figura 1 — Página inicial / entrada**

<!-- Espaço reservado para captura de ecrã. Sugestão de ficheiro: `docs/_screenshots/01-entrada-ou-login.png` -->

> **\[Inserir captura\]** — Ecrã inicial ou ecrã de autenticação, conforme o modo configurado no servidor.

### 2.2. Criar conta ou iniciar sessão

Conforme a configuração:

- **Registo:** aceda a **Registar** (rota `/register`) e preencha os dados pedidos.
- **Início de sessão:** aceda a **Entrar** (`/login`) com email e palavra-passe, ou use **OAuth** se o botão institucional estiver visível.

**Figura 2 — Ecrã de login**

<!-- `docs/_screenshots/02-login.png` -->

> **\[Inserir captura\]** — Formulário de login (e, se aplicável, botão OAuth).

### 2.3. Primeira alteração de senha

Se a política da organização exigir, após o primeiro acesso pode ser pedida a **alteração obrigatória da palavra-passe** (redireccionamento automático para `/trocar-senha-obrigatorio`).

**Figura 3 — Troca obrigatória de senha**

<!-- `docs/_screenshots/03-trocar-senha-obrigatorio.png` -->

> **\[Inserir captura\]** — Formulário de nova palavra-passe.

---

## 3. Idioma e tema

Quando disponível na barra superior:

- Altere o **idioma** (ex.: português / inglês).
- Altere **tema claro ou escuro** (preferência guardada no browser).

**Figura 4 — Idioma e tema**

<!-- `docs/_screenshots/04-idioma-tema.png` -->

> **\[Inserir captura\]** — Botões ou menu de idioma e tema.

---

## 4. Mapa do menu e rotas

A navegação principal segue as rotas abaixo (alinhado com [`readme-web.md`](../readme-web.md), secção Frontend):

| Caminho (URL) | O que vê |
|---------------|-----------|
| `/` | Área principal (**início / dashboard**) após autenticação, ou conteúdo público inicial conforme o modo de auth |
| `/login` | Início de sessão |
| `/register` | Registo de novo utilizador |
| `/trocar-senha-obrigatorio` | Alteração obrigatória de senha |
| `/perfil` | **Perfil** (dados da conta) |
| `/admin/usuarios` | **Administração de utilizadores** (só quem tiver permissão) |
| `/interpretacao-consolidada` | **Interpretação consolidada** (análise, fluxo, painéis) |
| `/reduce-logs` | **Reduzir logs** (envio e acompanhamento) |
| `/funcoes-mapeadas` | **Funções mapeadas** (catálogo / planilha / diagramas) |
| `/funcoes-mapeadas/fluxo-malware` | **Fluxo malware** — grafo compacto do lote |
| `/component-showcase` | Galeria de componentes (ambiente de desenvolvimento / demonstração) |
| `/404` | Página não encontrada (explícita) |
| *outro URL* | Mensagem de **página não encontrada** |

---

## 5. Área principal (início / dashboard)

Após iniciar sessão, o **dashboard** apresenta, em geral, um resumo dos **lotes** (batches), estados e atalhos úteis.

**Figura 5 — Dashboard principal**

<!-- `docs/_screenshots/05-dashboard.png` -->

> **\[Inserir captura\]** — Visão geral com lista ou cartões de lotes e métricas.

**O que pode fazer (típico):**

- Ver lotes em fila, em execução ou concluídos.
- Filtrar ou pesquisar (se a UI o permitir no momento).
- Abrir detalhes de um lote para aprofundar na interpretação ou transferir dados exportados (conforme opções mostradas).

---

## 6. Reduzir logs (`/reduce-logs`)

Destina-se ao fluxo de **envio de ficheiros de log**, **definição de parâmetros** da análise (nome, focos, origem, etc.) e **acompanhamento** do processamento.

**Figura 6 — Página Reduzir logs (visão geral)**

<!-- `docs/_screenshots/06-reduce-logs-visao.png` -->

> **\[Inserir captura\]** — Área de upload e formulário principal.

**Passos típicos:**

1. Preencha os campos pedidos (nome da análise, termos de foco, regex, origem, etc., conforme etiquetas no ecrã).
2. **Seleccione os ficheiros** (ou arraste para a zona indicada).
3. Confirme o envio e aguarde o progresso; a interface pode mostrar **percentagens**, estados por ficheiro e mensagens de erro legíveis.
4. Quando disponível, utilize **exportações** (ex.: Excel) ou ligações para ver o resultado noutro ecrã.

**Figura 7 — Progresso / estados por ficheiro**

<!-- `docs/_screenshots/07-reduce-logs-progresso.png` -->

> **\[Inserir captura\]** — Tabela ou lista de ficheiros com estado.

> **Dica:** Em ambientes de análise grandes, o administrador pode ter configurado **armazenamento** ou limites; mensagens de erro no ecrã ou toasts explicam muitas situações.

---

## 7. Interpretação consolidada (`/interpretacao-consolidada`)

Ecrã para explorar o **fluxo**, **evidências** e **painéis** associados a uma análise (MITRE, VirusTotal, etc., **se o servidor estiver configurado**).

**Figura 8 — Interpretação consolidada**

<!-- `docs/_screenshots/08-interpretacao-consolidada.png` -->

> **\[Inserir captura\]** — Vista principal com separadores ou secções.

**Funcionalidades frequentes:**

- Visualizar **diagrama de fluxo** (zoom, selecção de nós).
- Consultar **detalhes** de nós ou ligações e evidências de log (**ícones** / pré-visualizações).
- Abrir ou exportar **JSON** / **Excel** quando os botões existirem.
- Consultar **VirusTotal** ou **MITRE** nos painéis laterais ou secções dedicadas.

**Figura 9 — Diagrama de fluxo**

<!-- `docs/_screenshots/09-grafo-fluxo.png` -->

> **\[Inserir captura\]** — Grafo interactivo.

**Figura 10 — Painel VirusTotal ou MITRE (exemplo)**

<!-- `docs/_screenshots/10-painel-enriquecimento.png` -->

> **\[Inserir captura\]** — Um dos painéis de enriquecimento.

---

## 8. Funções mapeadas (`/funcoes-mapeadas`)

Consulta de **funções** e conteúdos de apoio ligados ao mapeamento (diagramas Mermaid, tabelas, edição conforme permissões).

No menu principal existem dois itens irmãos: **Funções mapeadas** (`/funcoes-mapeadas`) para o catálogo e materiais legacy, e **Fluxo malware** (`/funcoes-mapeadas/fluxo-malware`) para o grafo de correlação compacto por lote (sem submenu).

**Figura 11 — Funções mapeadas**

<!-- `docs/_screenshots/11-funcoes-mapeadas.png` -->

> **\[Inserir captura\]** — Página com listas ou diagramas.

---

## 9. Perfil (`/perfil`)

Alteração de **dados pessoais** ou **palavra-passe** conforme os campos apresentados.

**Figura 12 — Perfil do utilizador**

<!-- `docs/_screenshots/12-perfil.png` -->

> **\[Inserir captura\]** — Formulário de perfil.

---

## 10. Administração de utilizadores (`/admin/usuarios`)

**Apenas para administradores.** Permite listar, criar ou gerir contas (exactamente quais acções dependem da implementação actual — convém validar com o manual técnico ou o administrador).

**Figura 13 — Lista de utilizadores**

<!-- `docs/_screenshots/13-admin-usuarios.png` -->

> **\[Inserir captura\]** — Tabela de utilizadores e botões de acção.

---

## 11. Component showcase (`/component-showcase`)

Página de **demonstração de componentes** de interface; útil em **formação** ou **testes visuais**, não faz parte do fluxo operacional corrente para todos os utilizadores.

**Figura 14 — Component showcase**

<!-- `docs/_screenshots/14-component-showcase.png` -->

> **\[Inserir captura\]** — Exemplos de botões, formulários e outros controlos.

---

## 12. Página não encontrada

Se o URL não existir, verá uma página de **404** amigável com sugestão de voltar ao início.

**Figura 15 — Erro 404**

<!-- `docs/_screenshots/15-404.png` -->

> **\[Inserir captura\]** — Mensagem de página não encontrada.

---

## 13. Resolução de problemas simples

| Problema | O que tentar |
|----------|----------------|
| “Não consigo iniciar sessão” | Confirme credenciais; verifique se deve usar OAuth; contacte o administrador se o modo de auth tiver mudado. |
| Página em branco após deploy | Administrador: confirmar que `VITE_AUTH_MODE` e build estão alinhados com o servidor. |
| Falha ao enviar ficheiros muito grandes | Reduzir tamanho ou dividir ficheiros; ver mensagem de erro; contactar suporte se persistir. |
| Dados VirusTotal / MITRE em falta | Normal se o servidor **não** tiver API ou dados configurados — não é falha do browser. |

Para **erros técnicos** (logs, variáveis, base de dados), veja `MANUAL-TECNICO.md`.

---

## 14. Pasta sugerida para capturas de ecrã

Ao exportar imagens para **este** manual, pode guardá-las em:

`fluxtrace_web/docs/_screenshots/`

com os nomes sugeridos nos comentários HTML deste documento (ou equivalente), e substituir os blocos **\[Inserir captura\]** por imagens Markdown, por exemplo:

```markdown
![Dashboard principal](_screenshots/05-dashboard.png)
```

*(Os comentários `<!-- ... -->` podem ser removidos após inserir as figuras.)*

Para o manual de **desenvolvimento local** (`MANUAL-DEV-LOCAL.md`), as figuras ficam na subpasta **`dev-local/`** (por exemplo `docs/_screenshots/dev-local/`), com nomes e referências indicados naquele documento.

---

## 15. Coerência com outros documentos

Este manual descreve o **uso** das funcionalidades visíveis na SPA. A lista de **rotas** e o comportamento de **sessão/troca de senha** estão em [`readme-web.md`](../readme-web.md) (secção Frontend). Requisitos de servidor e segurança em [`MANUAL-TECNICO.md`](./MANUAL-TECNICO.md) e na secção **Backend** do mesmo [`readme-web.md`](../readme-web.md).
