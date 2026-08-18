# Manual â€” correr FluxTrace localmente (desenvolvimento e testes)

Guia **passo a passo** para instalar o ambiente, configurar variÃ¡veis, subir a aplicaÃ§Ã£o no **Visual Studio Code** (ou outro editor) e validar com testes automÃ¡ticos. Complementa [`readme-web.md`](../readme-web.md) e [`MANUAL-TECNICO.md`](./MANUAL-TECNICO.md).

**Ideia geral:** um Ãºnico processo Node serve a API e o **Vite** em desenvolvimento; o browser acede Ã  mesma origem (o mesmo host e porta). Normalmente isso Ã© **`http://localhost:3000/`** â€” porta **3000**, desde que nÃ£o defina `PORT` no `.env` e que nada mais esteja a usar essa porta; caso contrÃ¡rio o servidor tenta 3001, 3002, â€¦ e **mostra no terminal** qual usar. NÃ£o Ã© preciso correr `frontend` e `backend` em portas separadas.

### MÃ¡quina nova (nada instalado) â€” ordem recomendada

Siga **por ordem**; nÃ£o precisa de ler o resto do manual â€œde uma vezâ€ â€” volte a cada secÃ§Ã£o quando chegar Ã quela etapa.

1. **SecÃ§Ã£o 0** â€” Instalar **Git**, **Node.js** (20 LTS ou 22), **VS Code** e **PostgreSQL** *ou* **Docker Desktop** + Postgres em contentor (**0.7**). Active **`corepack enable`** quando o Node jÃ¡ estiver no `PATH` (**0.4**). Depois de instalar Git ou Node, **feche e reabra o VS Code** (ou o terminal).
2. **SecÃ§Ã£o 1** â€” `git clone` do repositÃ³rio e **Ficheiro â†’ Abrir pastaâ€¦** na **raiz** do clone (pasta que contÃ©m `fluxtrace_web/`).
3. **SecÃ§Ã£o 2** â€” No terminal do VS Code: `cd fluxtrace_web`, confirme `node -v`; `corepack enable` se ainda nÃ£o correu nesta sessÃ£o.
4. **SecÃ§Ã£o 4** â€” Criar **`fluxtrace_web/.env`** a partir de `backend/.env.example` (sobretudo `DATABASE_URL` e `JWT_SECRET`).
5. **SecÃ§Ã£o 5** â€” `pnpm install` (dentro de `fluxtrace_web/`). Se o PowerShell bloquear `pnpm.ps1`, **0.4.1**; mensagens do Corepack / `approve-builds`, **5.1**.
6. **SecÃ§Ã£o 6** â€” `pnpm db:push` (PowerShell real se o drizzle pedir confirmaÃ§Ãµes â€” **6.2**).
7. **SecÃ§Ã£o 7** â€” `pnpm dev` e abrir o URL que o terminal mostrar (em geral `http://localhost:3000/`).
8. **SecÃ§Ã£o 9** (opcional mas Ãºtil) â€” `pnpm check` e `pnpm test` para validar o ambiente.

Se algo falhar, **SecÃ§Ã£o 11** (problemas frequentes) e as mensagens no terminal costumam indicar o que falta (Postgres parado, `pnpm` nÃ£o encontrado, **PowerShell a bloquear `pnpm.ps1`**, porta ocupada, etc.).

---

## 0. O que vai precisar â€” checklist e como instalar

Este manual Ã© **texto passo a passo** (sem pasta de figuras em `docs/`). Se exportar capturas para uso interno, nÃ£o as inclua no repositÃ³rio com palavras-passe, chaves API ou dados sensÃ­veis visÃ­veis.

### 0.1 Resumo (o que instalar)

| Ferramenta | Para quÃª | ObrigatÃ³rio para FluxTrace local? |
|------------|----------|-----------------------------------|
| **Git** | Clonar e actualizar o repositÃ³rio | Sim |
| **Node.js** (20 LTS ou 22) | Executar o servidor e o build | Sim |
| **Corepack** + **pnpm** | Instalar pacotes do projecto (`pnpm install`) | Sim |
| **PostgreSQL** (ou Docker + imagem Postgres) | Base de dados (`DATABASE_URL`) | Sim |
| **Visual Studio Code** | Editar cÃ³digo e terminal integrado | Recomendado (pode usar outro editor) |

No **Windows**, o `pnpm install` trata do binÃ¡rio **7-Zip** via npm (`7zip-bin`). Se falhar, veja o terminal e `backend/scripts/setup/ensure-7zip-executable.mjs`.

**Dica:** depois de instalar **Git** ou **Node**, **feche e volte a abrir** o VS Code (ou pelo menos o terminal) para o Windows actualizar o `PATH` e os comandos serem reconhecidos.

**Opcional** â€” versÃ£o do Windows (Ãºtil em suporte / diagnÃ³stico):


---

### 0.2 Git (Windows)

1. Abra o site oficial de downloads para Windows: [https://git-scm.com/download/win](https://git-scm.com/download/win)
2. Descarregue o instalador (**64-bit Git for Windows** Ã© o mais comum).
3. Execute o instalador. Pode aceitar as opÃ§Ãµes por omissÃ£o na maior parte dos ecrÃ£s; o importante Ã© que a opÃ§Ã£o **â€œGit from the command line and also from 3rd-party softwareâ€** fique activa (para usar `git` no terminal).
4. Conclua o assistente.
5. Abra **PowerShell** ou **Prompt de Comandos** e confirme:

```bash
git --version
```



---

### 0.3 Node.js (20 LTS ou 22)

1. Abra [https://nodejs.org/](https://nodejs.org/).
2. Descarregue a versÃ£o **LTS** (Long Term Support). Se a LTS for **20.x** ou **22.x**, use essa. Evite versÃµes muito antigas (anteriores Ã  20) para ficar alinhado com o projecto.
3. Execute o instalador **Windows (.msi)**. Aceite a instalaÃ§Ã£o de ferramentas nativas se o assistente perguntar (ajuda em mÃ³dulos opcionais).
4. **Reinicie o terminal** (ou o VS Code) apÃ³s a instalaÃ§Ã£o.
5. Confirme:

```bash
node -v
```

Deve aparecer algo como `v22.x.y` (ou outra LTS suportada pelo projecto).



---

### 0.4 Corepack e pnpm

O **pnpm** Ã© o gestor de pacotes deste repositÃ³rio (nÃ£o use `npm install` na pasta `fluxtrace_web`).

O **Corepack** jÃ¡ vem com instalaÃ§Ãµes recentes do Node e permite usar a versÃ£o de pnpm indicada no `package.json` do projecto.

1. No terminal (jÃ¡ com Node instalado), execute **uma vez** (pode pedir execuÃ§Ã£o como administrador no Windows):

```bash
corepack enable
```

2. Confirme que o Corepack responde:

```bash
corepack --version
```

3. Entre na pasta do projecto **depois** de o clonar (ver secÃ§Ã£o 1). Exemplo:

```bash
cd caminho\para\fluxtrace\fluxtrace_web
```

4. Ao correr o primeiro comando `pnpm` (por exemplo `pnpm install` na secÃ§Ã£o 5), o Corepack pode **descarregar automaticamente** a versÃ£o de pnpm correcta. Para apenas ver a versÃ£o **depois** de estar preparado:

```bash
pnpm -v
```


**Se `corepack` nÃ£o for reconhecido:** reinstale Node a partir do site oficial (installer recente) ou veja a documentaÃ§Ã£o do Node para o seu ambiente. **Se `pnpm` falhar apÃ³s `corepack enable`:** feche o VS Code, abra de novo e repita.

---

### 0.4.1 Windows â€” PowerShell bloqueia `pnpm` (`ExecutionPolicy` / `pnpm.ps1`)

No **Windows**, o terminal do VS Code usa muitas vezes **PowerShell**. O Node disponibiliza `pnpm` como **`pnpm.ps1`** em `C:\Program Files\nodejs\` (alÃ©m do `pnpm.cmd`). Se a **polÃ­tica de execuÃ§Ã£o** do PowerShell estiver restrita, o `pnpm install` pode falhar com uma mensagem como:

```text
pnpm : O arquivo C:\Program Files\nodejs\pnpm.ps1 nÃ£o pode ser carregado porque a execuÃ§Ã£o de scripts foi
desabilitada neste sistema. Para obter mais informaÃ§Ãµes, consulte about_Execution_Policies em
https://go.microsoft.com/fwlink/?LinkID=135170.
    + CategoryInfo          : ErrodeSeguranÃ§a: (:) [], PSSecurityException
    + FullyQualifiedErrorId : UnauthorizedAccess
```

**CorrecÃ§Ã£o recomendada (uma vez por utilizador Windows):**

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Confirme com `S`/`Y` se o PowerShell perguntar. Em seguida, na pasta **`fluxtrace_web/`**, volte a correr:

```powershell
pnpm install
```

`RemoteSigned` Ã© um equilÃ­brio habitual em mÃ¡quinas de desenvolvimento (scripts **locais** correm; scripts descarregados da Internet costumam precisar de assinatura). DocumentaÃ§Ã£o Microsoft: [about_Execution_Policies](https://learn.microsoft.com/pt-br/powershell/module/microsoft.powershell.core/about/about_execution_policies).

**Alternativas imediatas** (sem alterar a polÃ­tica):

- Chamar explicitamente o launcher **`.cmd`** no PowerShell:  
  `pnpm.cmd install` , `pnpm.cmd dev`, etc.
- Abrir no VS Code um terminal **Command Prompt** (**Terminal â†’ Novo terminal** â†’ painel `+` â–¼ â†’ **Command Prompt**) em vez de PowerShell.
- Usar **Git Bash** se tiver Git for Windows instalado.

---

### 0.5 Visual Studio Code

1. Abra [https://code.visualstudio.com/](https://code.visualstudio.com/).
2. Descarregue o instalador **User** ou **System** para Windows e execute-o.
3. No assistente, Ã© Ãºtil marcar **â€œAdd 'Open with Code' action to Windows Explorer file context menuâ€** (abrir pastas com botÃ£o direito).
4. Instale e abra o VS Code.
5. *Opcional:* na vista de **ExtensÃµes** (`Ctrl+Shift+X`), procure **Portuguese Language Pack** se quiser a UI em portuguÃªs.

*(NÃ£o hÃ¡ figuras separadas do site do VS Code neste pacote; o ecrÃ£ tÃ­pico com o repositÃ³rio aberto aparece na **secÃ§Ã£o 1.2**.)*

---

### 0.6 PostgreSQL (Windows â€” instalador)



1. Abra [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/) e use o instalador recomendado (**EDB** ou similar).
2. Durante o assistente, defina uma **palavra-passe** para o superutilizador `postgres` (anote-a em local seguro para desenvolvimento).
3. Mantenha a **porta** **5432** se nÃ£o tiver conflito com outro serviÃ§o.
4. Conclua a instalaÃ§Ã£o (pode incluir **pgAdmin** â€” Ãºtil para criar bases e utilizadores).
5. Crie uma base para o FluxTrace, por exemplo `fluxtrace_dev`:
   - Via **pgAdmin**: Servers â†’ PostgreSQL â†’ Databases â†’ Create â†’ Database.
   - Ou crie tambÃ©m um utilizador dedicado (recomendado em vez de usar sempre `postgres` em URLs de desenvolvimento).

Guarde **utilizador**, **palavra-passe**, **nome da base** e **porta** â€” entram na `DATABASE_URL` (secÃ§Ã£o 4).



---

### 0.7 PostgreSQL com Docker (alternativa)

Se preferir **nÃ£o** instalar PostgreSQL no Windows:

1. Instale [Docker Desktop para Windows](https://www.docker.com/products/docker-desktop/) (requer reinÃ­cio e, em muitos PCs, WSL2).
2. Quando o Docker estiver **a correr** (Ã­cone na barra de tarefas), abra um terminal e execute:

```bash
docker run --name fluxtrace-pg -e POSTGRES_PASSWORD=devpass -e POSTGRES_USER=flux -e POSTGRES_DB=fluxtrace_dev -p 5432:5432 -d postgres:16
```

3. Use `DATABASE_URL` como `postgresql://flux:devpass@127.0.0.1:5432/fluxtrace_dev` (ajuste se mudar utilizador ou palavra-passe).

*(Opcional: documentar o fluxo Docker Desktop com capturas fora do repositÃ³rio.)*

---

## 1. Clonar o repositÃ³rio e abrir no VS Code

### 1.1 Clonar com Git

1. Escolha uma pasta no disco onde guardar o projecto (ex.: `D:\projetos\`).
2. Abra o **terminal** (PowerShell ou Git Bash) **nessa pasta** ou navegue atÃ© lÃ¡ com `cd`.
3. Clone o repositÃ³rio. **Substitua** o URL pelo que a sua organizaÃ§Ã£o lhe indicou (HTTPS ou SSH):

**HTTPS (exemplo genÃ©rico):**

```bash
git clone https://github.com/SEU_ORG/fluxtrace.git
```

**SSH (se tiver chave configurada no GitHub/GitLab):**

```bash
git clone git@github.com:SEU_ORG/fluxtrace.git
```

4. Quando terminar, deve existir uma pasta **`fluxtrace`** (ou o nome do repo) com `fluxtrace_web/` lÃ¡ dentro.


---

### 1.2 Abrir a pasta do repositÃ³rio no VS Code

1. Abra o **Visual Studio Code**.
2. Menu **Ficheiro â†’ Abrir pastaâ€¦** (ou **File â†’ Open Folderâ€¦** se a UI estiver em inglÃªs).
3. Seleccione a pasta **raiz** do repositÃ³rio clonado â€” a que contÃ©m **`fluxtrace_web`** (e, em muitos clones, **`test-samples`**). **NÃ£o** abra apenas `fluxtrace_web` se quiser ver o repo completo na Ã¡rvore; abrir a raiz (`fluxtrace`) Ã© o recomendado neste manual.



---

### 1.3 Porque abrir a raiz do repo

Trabalhar a partir da **raiz** (`fluxtrace`) permite ver documentaÃ§Ã£o, `test-samples` e configs partilhadas; os comandos `pnpm` que vÃªm a seguir correrÃ£o **dentro de** `fluxtrace_web/` (secÃ§Ã£o 2).

---

## 2. Verificar ferramentas e entrar na pasta `fluxtrace_web`

Se seguiu a **secÃ§Ã£o 0**, Git, Node, Corepack e (opcionalmente) VS Code e PostgreSQL jÃ¡ estÃ£o tratados. Aqui sÃ³ **confirma** que tudo responde no terminal e posiciona a pasta de trabalho.

1. Abra um **terminal** no VS Code na pasta do repositÃ³rio (**Terminal â†’ Novo terminal**, `` Ctrl+Shift+` ``).
2. Confira o Node:

```bash
node -v
```

3. Active o Corepack (se ainda nÃ£o o fez nesta mÃ¡quina):

```bash
corepack enable
```

4. Entre na pasta da aplicaÃ§Ã£o web (ajuste o caminho ao seu clone):

```bash
cd fluxtrace_web
```

5. Quando fizer `pnpm install` (secÃ§Ã£o 5), o pnpm ficarÃ¡ disponÃ­vel; opcionalmente, **apÃ³s** `pnpm install`, pode testar `pnpm -v` na mesma pasta.

Daqui em diante, assume-se que o terminal **cwd** Ã© **`fluxtrace_web/`** (onde estÃ¡ o `package.json` com os scripts `dev`, `db:push`, etc.).

---

## 3. PostgreSQL (recordatÃ³rio)

Se **jÃ¡** criou a base na **secÃ§Ã£o 0.6** ou **0.7**, nÃ£o precisa de repetir. Confirme apenas que o serviÃ§o PostgreSQL (ou o contentor Docker) **estÃ¡ a correr** antes de `pnpm db:push` e `pnpm dev`.

**Lembrete â€” Docker (reutilizar o exemplo da secÃ§Ã£o 0.7):**

```bash
docker run --name fluxtrace-pg -e POSTGRES_PASSWORD=devpass -e POSTGRES_USER=flux -e POSTGRES_DB=fluxtrace_dev -p 5432:5432 -d postgres:16
```

Ajuste utilizador, palavra-passe e nome da base ao valor em **`DATABASE_URL`** (secÃ§Ã£o 4).

---

## 4. Ficheiro `.env` (obrigatÃ³rio)

1. Na pasta **`fluxtrace_web/`**, copie o modelo:

   - Origem: `backend/.env.example`
   - Destino: **`fluxtrace_web/.env`** (ao lado de `package.json`, **nÃ£o** commite este ficheiro).

2. Edite pelo menos:

   - **`DATABASE_URL`** â€” string de ligaÃ§Ã£o PostgreSQL, por exemplo:  
     `postgresql://flux:devpass@127.0.0.1:5432/fluxtrace_dev`
   - **`JWT_SECRET`** â€” uma cadeia longa e aleatÃ³ria (qualquer gerador seguro serve para desenvolvimento local).

3. Para **primeiros testes sem ecrÃ£ de login**, deixe como no exemplo (jÃ¡ comentado no `.env.example`):

   - `AUTH_MODE=none`
   - `VITE_AUTH_MODE=none`

   A UI pode mostrar utilizador em modo bypass de administrador; para **login / registo** locais, siga os comentÃ¡rios no `.env.example` (`AUTH_MODE=local`, `VITE_AUTH_MODE=local`, `pnpm db:push`, etc.).

4. **Opcional:** `VIRUSTOTAL_API_KEY` â€” sÃ³ necessÃ¡rio para enriquecimento VirusTotal na InterpretaÃ§Ã£o consolidada (chave sÃ³ no servidor, **sem** prefixo `VITE_`).

ReferÃªncia de todas as variÃ¡veis: comentÃ¡rios em **`backend/.env.example`** e cÃ³digo em **`backend/_core/config/env.ts`**.


## 5. Instalar dependÃªncias

No terminal, com `cwd` = **`fluxtrace_web/`**:

```bash
pnpm install
```

No **Windows**, se o terminal for **PowerShell** e aparecer erro sobre **`pnpm.ps1`** e **execuÃ§Ã£o de scripts**, veja a **secÃ§Ã£o 0.4.1** (ou use `pnpm.cmd install`).

Aguarde o fim do `postinstall` (7-Zip, etc.). Se aparecer erro de rede ou de permissÃµes, corrija antes de continuar.

### 5.1 Mensagens comuns no primeiro `pnpm install` (Windows)

**1 â€” Corepack a descarregar o `pnpm`**

Se aparecer algo como `Corepack is about to download ... pnpm-10.x.x.tgz` e `Do you want to continue? [Y/n]`, responda **`Y`** (Enter). Isto sÃ³ costuma acontecer **na primeira vez** que o Corepack prepara a versÃ£o de `pnpm` pedida pelo `package.json`.

**2 â€” Aviso Node `DEP0169` / `url.parse()`**

Um `DeprecationWarning` referindo `url.parse()` pode surgir durante o download; vem em geral de **dependÃªncias** (Corepack/registo), nÃ£o do vosso cÃ³digo. **Pode ignorar** para desenvolvimento local, salvo se estiverem a depurar com `node --trace-deprecation`.

**3 â€” `Ignored build scripts: @tailwindcss/oxide, esbuild`**

VersÃµes recentes do **pnpm** podem **adiar** a execuÃ§Ã£o de *build scripts* de certos pacotes atÃ© os aprovar (polÃ­tica de seguranÃ§a). Muitas vezes o `pnpm install` **termina na mesma** (`Done in â€¦`) e o projecto **compila**, porque hÃ¡ **binÃ¡rios prÃ©-compilados**.

- Se **`pnpm dev`** ou **`pnpm build`** falharem por falta de binÃ¡rio nativo (`esbuild`, Tailwind `oxide`, etc.), execute:

```bash
pnpm approve-builds
```

Siga as instruÃ§Ãµes no ecrÃ£ para **aprovar** os pacotes que o projecto precisa (por exemplo `esbuild`, `@tailwindcss/oxide`), e volte a correr `pnpm install` se o assistente o indicar.

---

## 6. Criar / actualizar tabelas na base (Drizzle)

Ainda em **`fluxtrace_web/`**:

```bash
pnpm db:push
```

Isto aplica o schema esperado pelo Drizzle Ã  base apontada por `DATABASE_URL`. O comando testa a ligaÃ§Ã£o primeiro (mensagem `[db:push]`) e, se a base ainda nÃ£o existir, tenta criÃ¡-la. Execute de novo quando o projecto exigir migraÃ§Ãµes (ver comunicados no repositÃ³rio ou `MANUAL-TECNICO.md`).

### 6.1 Erro Â«No schema files foundÂ» (`drizzle/schema/index.ts`)

Se aparecer algo como **`No schema files found for path config ['./drizzle/schema/index.ts']`**:

- O comando corre a partir de **`fluxtrace_web/`**, mas o `drizzle.config.ts` vive em **`backend/`**; caminhos relativos sÃ³ `drizzle/...` apontavam para uma pasta **inexistente** na raiz da app.
- No **Windows**, caminhos com **`\`** tambÃ©m podem confundir o `drizzle-kit`.

O repositÃ³rio usa caminhos **absolutos normalizados com `/`** em `backend/drizzle.config.ts`. Garanta que estÃ¡ com o **Ãºltimo cÃ³digo**; em Ãºltimo caso, volte a fazer `git pull`.

### 6.2 `drizzle-kit` pede confirmaÃ§Ã£o interativa (truncate / alteraÃ§Ãµes perigosas)

Se o `push` perguntar se quer **esvaziar** uma tabela ou alterar constraints e o terminal **nÃ£o** for interactivo (ex.: output colado, algumas extensÃµes), pode aparecer erro de **TTY**. Use um **PowerShell** ou **cmd** normal no VS Code e rode `pnpm db:push` de novo para poder responder **`Yes`/`No`** com seguranÃ§a **apÃ³s ler** o aviso (dados podem ser afectados).


### 6.3 `db:push` falha em «Pulling schema from database…» (exit 1, sem detalhe)

O `drizzle-kit` pode terminar com código 1 **sem** imprimir `ECONNREFUSED`, palavra-passe incorrecta ou «database does not exist». Causas habituais no Windows:

1. Serviço PostgreSQL **parado** (Services → `postgresql-x64-…` → Start), ou Docker Desktop desligado.
2. `fluxtrace_web/.env` ainda com `SEU-USUARIO` / `SUA_SENHA` do `.env.example` — o ficheiro tem de estar na raiz de **`fluxtrace_web/`**, não em `backend/`.
3. A base da URL (ex. `fluxtrace_dev`) **não foi criada** no pgAdmin. O wrapper tenta `CREATE DATABASE`; se isso falhar, crie-a à mão.
4. Palavra-passe / utilizador errados (instalador EDB: utilizador `postgres`).
5. `localhost` a resolver para IPv6 (`::1`) — use `127.0.0.1` na `DATABASE_URL`.

Volte a correr `pnpm db:push`: a linha `[db:push]` deve mostrar o erro real.

---

## 7. Arrancar a aplicaÃ§Ã£o em modo desenvolvimento

```bash
pnpm dev
```

O servidor inicia **`tsx watch`** sobre `backend/_core/server/index.ts`, integra o Vite e imprime algo como:

```text
Server running on http://localhost:3000/
```

- Se a porta **3000** estiver ocupada, o processo tenta **3001, 3002, â€¦** e indica qual usou.
- Em caso de falha de ligaÃ§Ã£o Ã  base, veja as mensagens `[Database]` no terminal e confirme `DATABASE_URL`, firewall e TLS (`DATABASE_SSL` ou `sslmode` na URL, se aplicÃ¡vel).

Abra o browser em **`http://localhost:3000/`** (ou na porta mostrada).


## 8. Validar no browser (fumo manual)

SugestÃ£o mÃ­nima:

1. A pÃ¡gina inicial / dashboard carrega sem erro visÃ­vel grave.
2. Navegue para rotas principais (ex.: **Reduzir logs**, **InterpretaÃ§Ã£o consolidada**), conforme `readme-web.md` (tabela de rotas).
3. Se usar `AUTH_MODE=local`, teste **Entrar** / **Registo**; se usar `none`, confirme que as Ã¡reas necessÃ¡rias respondem (sem login).


Fluxos pesados (upload de lotes grandes) dependem de disco temporÃ¡rio e configuraÃ§Ã£o; veja `.env.example` (`CONTRADEF_*`, etc.).

---

## 9. Testes e verificaÃ§Ã£o de tipos (linha de comandos)

Com `cwd` = **`fluxtrace_web/`**:

| Comando | FunÃ§Ã£o |
|---------|--------|
| `pnpm check` | `tsc` no frontend e no backend sem emitir ficheiros. |
| `pnpm test` | **Vitest** â€” testes do `frontend` e do `backend`. |
| `pnpm build` | Build de produÃ§Ã£o (Vite + bundle do servidor); Ãºtil para validar que compila. |

Execute `pnpm check` e `pnpm test` antes de considerar o ambiente â€œvalidadoâ€ para desenvolvimento.

---

## 10. Atalhos Ãºteis no VS Code

- **Terminal integrado:** pasta activa `fluxtrace_web` para nÃ£o repetir `cd`.
- **Parar o servidor:** no terminal onde corre `pnpm dev`, `Ctrl+C`.
- **Reiniciar apÃ³s mudar `.env`:** pare e volte a correr `pnpm dev` (variÃ¡veis `VITE_*` exigem rebuild se alterar sÃ³ no build estÃ¡tico; em `pnpm dev` o Vite reage a muitas mudanÃ§as, mas `.env` completo costuma precisar de reinÃ­cio).
- Abrir o **Output** / **Terminal** se o `db:push` ou o arranque falharem â€” copiar a mensagem de erro ajuda ao diagnÃ³stico.

---

## 11. Problemas frequentes

| Sintoma | O que verificar |
|---------|------------------|
| `db:push`: Â«No schema files foundÂ» para `drizzle/...` | **SecÃ§Ã£o 6.1** â€” caminhos do `drizzle.config.ts` / Windows; actualize o repositÃ³rio. |
| `db:push`: Pulling schema e exit 1 sem detalhe | **Secção 6.3** — Postgres a correr, `.env` sem placeholders, base criada, `127.0.0.1`. |
| `db:push`: TTY / prompts interactivos | **SecÃ§Ã£o 6.2** â€” correr num terminal real e responder ao drizzle-kit. |
| PowerShell: `pnpm.ps1` / Â«execuÃ§Ã£o de scripts desabilitadaÂ» | **SecÃ§Ã£o 0.4.1:** `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`, ou `pnpm.cmd â€¦`, ou terminal **cmd** / Git Bash. |
| `pnpm` nÃ£o encontrado | `corepack enable`; fechar e reabrir o terminal. |
| Erro ao ligar ao PostgreSQL | `DATABASE_URL`, serviÃ§o PostgreSQL a correr, porta 5432 (ou a que usar), palavra-passe. |
| Porta em uso | Fechar outro processo na 3000 ou aceitar a porta alternativa indicada no log. |
| PÃ¡gina em branco / erros de API | Consola do browser (F12) e terminal do `pnpm dev`; confirme que abriu o URL `localhost` com a **mesma porta** do log. |
| Login nÃ£o aparece com `AUTH_MODE=local` | `VITE_AUTH_MODE=local` **no mesmo** `.env` e **reiniciar** `pnpm dev` (o modo auth da UI vem das vars `VITE_*`). |

---

## 12. DocumentaÃ§Ã£o relacionada

| Ficheiro | ConteÃºdo |
|----------|----------|
| [`readme-web.md`](../readme-web.md) | Arranque, estrutura, rotas, deploy (resumo). |
| [`MANUAL-TECNICO.md`](./MANUAL-TECNICO.md) | Arquitectura, API, operaÃ§Ã£o. |
| [`MANUAL-USUARIO.md`](./MANUAL-USUARIO.md) | Funcionalidades para utilizadores. |
| [`test-samples/README.md`](../../test-samples/README.md) | InventÃ¡rio de 16 amostras `.zip`, tamanhos e tempos de referÃªncia (raiz do repo). |

---

*Este manual descreve um fluxo tÃ­pico em Windows / VS Code; em Linux ou macOS os passos sÃ£o os mesmos, mudando apenas a instalaÃ§Ã£o do PostgreSQL e caminhos.*
