# Manual — correr FluxTrace localmente (desenvolvimento e testes)

Guia **passo a passo** para instalar o ambiente, configurar variáveis, subir a aplicação no **Visual Studio Code** (ou outro editor) e validar com testes automáticos. Complementa [`readme-web.md`](../readme-web.md) e [`MANUAL-TECNICO.md`](./MANUAL-TECNICO.md).

**Ideia geral:** um único processo Node serve a API e o **Vite** em desenvolvimento; o browser acede à mesma origem (o mesmo host e porta). Normalmente isso é **`http://localhost:3000/`** — porta **3000**, desde que não defina `PORT` no `.env` e que nada mais esteja a usar essa porta; caso contrário o servidor tenta 3001, 3002, … e **mostra no terminal** qual usar. Não é preciso correr `frontend` e `backend` em portas separadas.

### Máquina nova (nada instalado) — ordem recomendada

Siga **por ordem**; não precisa de ler o resto do manual “de uma vez” — volte a cada secção quando chegar àquela etapa.

1. **Secção 0** — Instalar **Git**, **Node.js** (20 LTS ou 22), **VS Code** e **PostgreSQL** *ou* **Docker Desktop** + Postgres em contentor (**0.7**). Active **`corepack enable`** quando o Node já estiver no `PATH` (**0.4**). Depois de instalar Git ou Node, **feche e reabra o VS Code** (ou o terminal).
2. **Secção 1** — `git clone` do repositório e **Ficheiro → Abrir pasta…** na **raiz** do clone (pasta que contém `fluxtrace_web/`).
3. **Secção 2** — No terminal do VS Code: `cd fluxtrace_web`, confirme `node -v`; `corepack enable` se ainda não correu nesta sessão.
4. **Secção 4** — Criar **`fluxtrace_web/.env`** a partir de `backend/.env.example` (sobretudo `DATABASE_URL` e `JWT_SECRET`).
5. **Secção 5** — `pnpm install` (dentro de `fluxtrace_web/`).
6. **Secção 6** — `pnpm db:push`.
7. **Secção 7** — `pnpm dev` e abrir o URL que o terminal mostrar (em geral `http://localhost:3000/`).
8. **Secção 9** (opcional mas útil) — `pnpm check` e `pnpm test` para validar o ambiente.

Se algo falhar, **Secção 11** (problemas frequentes) e as mensagens no terminal costumam indicar o que falta (Postgres parado, `pnpm` não encontrado, porta ocupada, etc.).

---

## 0. O que vai precisar — checklist e como instalar

Use este capítulo **antes** de clonar o projecto, se ainda não tiver as ferramentas na máquina. No fim de cada subsecção há **espaço para uma captura de ecrã**: tire o print, guarde em `docs/_screenshots/dev-local/` (crie a pasta se não existir) e substitua o bloco *\[Inserir captura\]* por uma imagem Markdown, por exemplo:

```markdown
![Descrição curta](_screenshots/dev-local/00-git-versao.png)
```

### 0.1 Resumo (o que instalar)

| Ferramenta | Para quê | Obrigatório para FluxTrace local? |
|------------|----------|-----------------------------------|
| **Git** | Clonar e actualizar o repositório | Sim |
| **Node.js** (20 LTS ou 22) | Executar o servidor e o build | Sim |
| **Corepack** + **pnpm** | Instalar pacotes do projecto (`pnpm install`) | Sim |
| **PostgreSQL** (ou Docker + imagem Postgres) | Base de dados (`DATABASE_URL`) | Sim |
| **Visual Studio Code** | Editar código e terminal integrado | Recomendado (pode usar outro editor) |

No **Windows**, o `pnpm install` trata do binário **7-Zip** via npm (`7zip-bin`). Se falhar, veja o terminal e `backend/scripts/setup/ensure-7zip-executable.mjs`.

**Dica:** depois de instalar **Git** ou **Node**, **feche e volte a abrir** o VS Code (ou pelo menos o terminal) para o Windows actualizar o `PATH` e os comandos serem reconhecidos.

---

### 0.2 Git (Windows)

1. Abra o site oficial de downloads para Windows: [https://git-scm.com/download/win](https://git-scm.com/download/win)
2. Descarregue o instalador (**64-bit Git for Windows** é o mais comum).
3. Execute o instalador. Pode aceitar as opções por omissão na maior parte dos ecrãs; o importante é que a opção **“Git from the command line and also from 3rd-party software”** fique activa (para usar `git` no terminal).
4. Conclua o assistente.
5. Abra **PowerShell** ou **Prompt de Comandos** e confirme:

```bash
git --version
```

<!-- Captura sugerida: `docs/_screenshots/dev-local/00-git-download.png` — página de download -->

> **\[Inserir captura\]** — Página de download do Git ou ecrã final do instalador.

<!-- Captura sugerida: `docs/_screenshots/dev-local/00-git-version.png` — saída de `git --version` -->

> **\[Inserir captura\]** — Terminal a mostrar `git --version` com um número de versão.

---

### 0.3 Node.js (20 LTS ou 22)

1. Abra [https://nodejs.org/](https://nodejs.org/).
2. Descarregue a versão **LTS** (Long Term Support). Se a LTS for **20.x** ou **22.x**, use essa. Evite versões muito antigas (anteriores à 20) para ficar alinhado com o projecto.
3. Execute o instalador **Windows (.msi)**. Aceite a instalação de ferramentas nativas se o assistente perguntar (ajuda em módulos opcionais).
4. **Reinicie o terminal** (ou o VS Code) após a instalação.
5. Confirme:

```bash
node -v
```

Deve aparecer algo como `v22.x.y` ou `v24.x.y`.

<!-- Captura sugerida: `docs/_screenshots/dev-local/00-node-download.png` — site Node com LTS -->

> **\[Inserir captura\]** — Site do Node.js com o botão LTS visível.

<!-- Captura sugerida: `docs/_screenshots/dev-local/00-node-version.png` — `node -v` -->

> **\[Inserir captura\]** — Terminal com a versão do Node.

---

### 0.4 Corepack e pnpm

O **pnpm** é o gestor de pacotes deste repositório (não use `npm install` na pasta `fluxtrace_web`).

O **Corepack** já vem com instalações recentes do Node e permite usar a versão de pnpm indicada no `package.json` do projecto.

1. No terminal (já com Node instalado), execute **uma vez** (pode pedir execução como administrador no Windows):

```bash
corepack enable
```

2. Confirme que o Corepack responde:

```bash
corepack --version
```

3. Entre na pasta do projecto **depois** de o clonar (ver secção 1). Exemplo:

```bash
cd caminho\para\fluxtrace\fluxtrace_web
```

4. Ao correr o primeiro comando `pnpm` (por exemplo `pnpm install` na secção 5), o Corepack pode **descarregar automaticamente** a versão de pnpm correcta. Para apenas ver a versão **depois** de estar preparado:

```bash
pnpm -v
```

<!-- Captura sugerida: `docs/_screenshots/dev-local/00-corepack-enable.png` — `corepack enable` e `pnpm -v` -->

> **\[Inserir captura\]** — Terminal: `corepack enable` (se não houver erro) e versão do `pnpm`.

**Se `corepack` não for reconhecido:** reinstale Node a partir do site oficial (installer recente) ou veja a documentação do Node para o seu ambiente. **Se `pnpm` falhar após `corepack enable`:** feche o VS Code, abra de novo e repita.

---

### 0.5 Visual Studio Code

1. Abra [https://code.visualstudio.com/](https://code.visualstudio.com/).
2. Descarregue o instalador **User** ou **System** para Windows e execute-o.
3. No assistente, é útil marcar **“Add 'Open with Code' action to Windows Explorer file context menu”** (abrir pastas com botão direito).
4. Instale e abra o VS Code.
5. *Opcional:* na vista de **Extensões** (`Ctrl+Shift+X`), procure **Portuguese Language Pack** se quiser a UI em português.

<!-- Captura sugerida: `docs/_screenshots/dev-local/00-vscode-download.png` -->

> **\[Inserir captura\]** — Página de download do VS Code.

<!-- Captura sugerida: `docs/_screenshots/dev-local/00-vscode-primeiro-ecra.png` -->

> **\[Inserir captura\]** — VS Code aberto (área de boas-vindas ou explorador de ficheiros).

---

### 0.6 PostgreSQL (Windows — instalador)

1. Abra [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/) e use o instalador recomendado (**EDB** ou similar).
2. Durante o assistente, defina uma **palavra-passe** para o superutilizador `postgres` (anote-a em local seguro para desenvolvimento).
3. Mantenha a **porta** **5432** se não tiver conflito com outro serviço.
4. Conclua a instalação (pode incluir **pgAdmin** — útil para criar bases e utilizadores).
5. Crie uma base para o FluxTrace, por exemplo `fluxtrace_dev`:
   - Via **pgAdmin**: Servers → PostgreSQL → Databases → Create → Database.
   - Ou crie também um utilizador dedicado (recomendado em vez de usar sempre `postgres` em URLs de desenvolvimento).

Guarde **utilizador**, **palavra-passe**, **nome da base** e **porta** — entram na `DATABASE_URL` (secção 4).

<!-- Captura sugerida: `docs/_screenshots/dev-local/00-postgres-assistente-porta.png` -->

> **\[Inserir captura\]** — Passo do instalador PostgreSQL (porta ou palavra-passe, sem expor a palavra-passe real — pode borrar).

<!-- Captura sugerida: `docs/_screenshots/dev-local/00-pgadmin-nova-bd.png` -->

> **\[Inserir captura\]** — pgAdmin ou ecrã equivalente a mostrar a nova base `fluxtrace_dev`.

---

### 0.7 PostgreSQL com Docker (alternativa)

Se preferir **não** instalar PostgreSQL no Windows:

1. Instale [Docker Desktop para Windows](https://www.docker.com/products/docker-desktop/) (requer reinício e, em muitos PCs, WSL2).
2. Quando o Docker estiver **a correr** (ícone na barra de tarefas), abra um terminal e execute:

```bash
docker run --name fluxtrace-pg -e POSTGRES_PASSWORD=devpass -e POSTGRES_USER=flux -e POSTGRES_DB=fluxtrace_dev -p 5432:5432 -d postgres:16
```

3. Use `DATABASE_URL` como `postgresql://flux:devpass@127.0.0.1:5432/fluxtrace_dev` (ajuste se mudar utilizador ou palavra-passe).

<!-- Captura sugerida: `docs/_screenshots/dev-local/00-docker-desktop-a-correr.png` -->

> **\[Inserir captura\]** — Docker Desktop a indicar que o motor está activo.

<!-- Captura sugerida: `docs/_screenshots/dev-local/00-docker-container-postgres.png` -->

> **\[Inserir captura\]** — Lista de contentores com `fluxtrace-pg` em execução.

---

## 1. Clonar o repositório e abrir no VS Code

### 1.1 Clonar com Git

1. Escolha uma pasta no disco onde guardar o projecto (ex.: `D:\projetos\`).
2. Abra o **terminal** (PowerShell ou Git Bash) **nessa pasta** ou navegue até lá com `cd`.
3. Clone o repositório. **Substitua** o URL pelo que a sua organização lhe indicou (HTTPS ou SSH):

**HTTPS (exemplo genérico):**

```bash
git clone https://github.com/SEU_ORG/fluxtrace.git
```

**SSH (se tiver chave configurada no GitHub/GitLab):**

```bash
git clone git@github.com:SEU_ORG/fluxtrace.git
```

4. Quando terminar, deve existir uma pasta **`fluxtrace`** (ou o nome do repo) com `fluxtrace_web/` lá dentro.

<!-- Captura sugerida: `docs/_screenshots/dev-local/01-git-clone-terminal.png` -->

> **\[Inserir captura\]** — Terminal a mostrar o comando `git clone` e a mensagem de conclusão (sem expor URLs ou credenciais internas, se preferir borrar).

---

### 1.2 Abrir a pasta do repositório no VS Code

1. Abra o **Visual Studio Code**.
2. Menu **Ficheiro → Abrir pasta…** (ou **File → Open Folder…** se a UI estiver em inglês).
3. Seleccione a pasta **raiz** do repositório clonado — a que contém **`fluxtrace_web`** (e, em muitos clones, **`test-samples`**). **Não** abra apenas `fluxtrace_web` se quiser ver o repo completo na árvore; abrir a raiz (`fluxtrace`) é o recomendado neste manual.

<!-- Captura sugerida: `docs/_screenshots/dev-local/01-vscode-abrir-pasta.png` — diálogo «Abrir pasta» a apontar para a raiz do repo -->

> **\[Inserir captura\]** — Diálogo do Windows / VS Code ao escolher a pasta raiz do clone.

<!-- Captura sugerida: `docs/_screenshots/dev-local/01-vscode-explorador-raiz.png` — Explorador lateral com `fluxtrace_web` e pastas vizinhas visíveis -->

> **\[Inserir captura\]** — Barra lateral **Explorador** do VS Code a mostrar `fluxtrace_web`, `test-samples` (se existir) e `docs` ao nível correcto.

---

### 1.3 Porque abrir a raiz do repo

Trabalhar a partir da **raiz** (`fluxtrace`) permite ver documentação, `test-samples` e configs partilhadas; os comandos `pnpm` que vêm a seguir correrão **dentro de** `fluxtrace_web/` (secção 2).

---

## 2. Verificar ferramentas e entrar na pasta `fluxtrace_web`

Se seguiu a **secção 0**, Git, Node, Corepack e (opcionalmente) VS Code e PostgreSQL já estão tratados. Aqui só **confirma** que tudo responde no terminal e posiciona a pasta de trabalho.

1. Abra um **terminal** no VS Code na pasta do repositório (**Terminal → Novo terminal**, `` Ctrl+Shift+` ``).
2. Confira o Node:

```bash
node -v
```

3. Active o Corepack (se ainda não o fez nesta máquina):

```bash
corepack enable
```

4. Entre na pasta da aplicação web (ajuste o caminho ao seu clone):

```bash
cd fluxtrace_web
```

5. Quando fizer `pnpm install` (secção 5), o pnpm ficará disponível; opcionalmente, **após** `pnpm install`, pode testar `pnpm -v` na mesma pasta.

Daqui em diante, assume-se que o terminal **cwd** é **`fluxtrace_web/`** (onde está o `package.json` com os scripts `dev`, `db:push`, etc.).

---

## 3. PostgreSQL (recordatório)

Se **já** criou a base na **secção 0.6** ou **0.7**, não precisa de repetir. Confirme apenas que o serviço PostgreSQL (ou o contentor Docker) **está a correr** antes de `pnpm db:push` e `pnpm dev`.

**Lembrete — Docker (reutilizar o exemplo da secção 0.7):**

```bash
docker run --name fluxtrace-pg -e POSTGRES_PASSWORD=devpass -e POSTGRES_USER=flux -e POSTGRES_DB=fluxtrace_dev -p 5432:5432 -d postgres:16
```

Ajuste utilizador, palavra-passe e nome da base ao valor em **`DATABASE_URL`** (secção 4).

---

## 4. Ficheiro `.env` (obrigatório)

1. Na pasta **`fluxtrace_web/`**, copie o modelo:

   - Origem: `backend/.env.example`
   - Destino: **`fluxtrace_web/.env`** (ao lado de `package.json`, **não** commite este ficheiro).

2. Edite pelo menos:

   - **`DATABASE_URL`** — string de ligação PostgreSQL, por exemplo:  
     `postgresql://flux:devpass@127.0.0.1:5432/fluxtrace_dev`
   - **`JWT_SECRET`** — uma cadeia longa e aleatória (qualquer gerador seguro serve para desenvolvimento local).

3. Para **primeiros testes sem ecrã de login**, deixe como no exemplo (já comentado no `.env.example`):

   - `AUTH_MODE=none`
   - `VITE_AUTH_MODE=none`

   A UI pode mostrar utilizador em modo bypass de administrador; para **login / registo** locais, siga os comentários no `.env.example` (`AUTH_MODE=local`, `VITE_AUTH_MODE=local`, `pnpm db:push`, etc.).

4. **Opcional:** `VIRUSTOTAL_API_KEY` — só necessário para enriquecimento VirusTotal na Interpretação consolidada (chave só no servidor, **sem** prefixo `VITE_`).

Referência de todas as variáveis: comentários em **`backend/.env.example`** e código em **`backend/_core/config/env.ts`**.

---

## 5. Instalar dependências

No terminal, com `cwd` = **`fluxtrace_web/`**:

```bash
pnpm install
```

Aguarde o fim do `postinstall` (7-Zip, etc.). Se aparecer erro de rede ou de permissões, corrija antes de continuar.

---

## 6. Criar / actualizar tabelas na base (Drizzle)

Ainda em **`fluxtrace_web/`**:

```bash
pnpm db:push
```

Isto aplica o schema esperado pelo Drizzle à base apontada por `DATABASE_URL`. Execute de novo quando o projecto exigir migrações (ver comunicados no repositório ou `MANUAL-TECNICO.md`).

---

## 7. Arrancar a aplicação em modo desenvolvimento

```bash
pnpm dev
```

O servidor inicia **`tsx watch`** sobre `backend/_core/server/index.ts`, integra o Vite e imprime algo como:

```text
Server running on http://localhost:3000/
```

- Se a porta **3000** estiver ocupada, o processo tenta **3001, 3002, …** e indica qual usou.
- Em caso de falha de ligação à base, veja as mensagens `[Database]` no terminal e confirme `DATABASE_URL`, firewall e TLS (`DATABASE_SSL` ou `sslmode` na URL, se aplicável).

Abra o browser em **`http://localhost:3000/`** (ou na porta mostrada).

---

## 8. Validar no browser (fumo manual)

Sugestão mínima:

1. A página inicial / dashboard carrega sem erro visível grave.
2. Navegue para rotas principais (ex.: **Reduzir logs**, **Interpretação consolidada**), conforme `readme-web.md` (tabela de rotas).
3. Se usar `AUTH_MODE=local`, teste **Entrar** / **Registo**; se usar `none`, confirme que as áreas necessárias respondem (sem login).

Fluxos pesados (upload de lotes grandes) dependem de disco temporário e configuração; veja `.env.example` (`CONTRADEF_*`, etc.).

---

## 9. Testes e verificação de tipos (linha de comandos)

Com `cwd` = **`fluxtrace_web/`**:

| Comando | Função |
|---------|--------|
| `pnpm check` | `tsc` no frontend e no backend sem emitir ficheiros. |
| `pnpm test` | **Vitest** — testes do `frontend` e do `backend`. |
| `pnpm build` | Build de produção (Vite + bundle do servidor); útil para validar que compila. |

Execute `pnpm check` e `pnpm test` antes de considerar o ambiente “validado” para desenvolvimento.

---

## 10. Atalhos úteis no VS Code

- **Terminal integrado:** pasta activa `fluxtrace_web` para não repetir `cd`.
- **Parar o servidor:** no terminal onde corre `pnpm dev`, `Ctrl+C`.
- **Reiniciar após mudar `.env`:** pare e volte a correr `pnpm dev` (variáveis `VITE_*` exigem rebuild se alterar só no build estático; em `pnpm dev` o Vite reage a muitas mudanças, mas `.env` completo costuma precisar de reinício).
- Abrir o **Output** / **Terminal** se o `db:push` ou o arranque falharem — copiar a mensagem de erro ajuda ao diagnóstico.

---

## 11. Problemas frequentes

| Sintoma | O que verificar |
|---------|------------------|
| `pnpm` não encontrado | `corepack enable`; fechar e reabrir o terminal. |
| Erro ao ligar ao PostgreSQL | `DATABASE_URL`, serviço PostgreSQL a correr, porta 5432 (ou a que usar), palavra-passe. |
| Porta em uso | Fechar outro processo na 3000 ou aceitar a porta alternativa indicada no log. |
| Página em branco / erros de API | Consola do browser (F12) e terminal do `pnpm dev`; confirme que abriu o URL `localhost` com a **mesma porta** do log. |
| Login não aparece com `AUTH_MODE=local` | `VITE_AUTH_MODE=local` **no mesmo** `.env` e **reiniciar** `pnpm dev` (o modo auth da UI vem das vars `VITE_*`). |

---

## 12. Documentação relacionada

| Ficheiro | Conteúdo |
|----------|----------|
| [`readme-web.md`](../readme-web.md) | Arranque, estrutura, rotas, deploy (resumo). |
| [`MANUAL-TECNICO.md`](./MANUAL-TECNICO.md) | Arquitectura, API, operação. |
| [`MANUAL-USUARIO.md`](./MANUAL-USUARIO.md) | Funcionalidades para utilizadores. |
| [`test-samples/README.md`](../../test-samples/README.md) | Amostras de teste e tempos de referência (raiz do repo). |

---

*Este manual descreve um fluxo típico em Windows / VS Code; em Linux ou macOS os passos são os mesmos, mudando apenas a instalação do PostgreSQL e caminhos.*
