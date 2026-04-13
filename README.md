# Senai Notes Frontend

Frontend de um app estilo Notion para gerenciamento de notas e tarefas, com CRUD completo, autenticação e suporte a imagens responsivas dentro das notas.
<img width="1365" height="612" alt="image" src="https://github.com/user-attachments/assets/8cc0f64a-1aa2-4c3e-ab2a-536129a374ba" />
<img width="1366" height="612" alt="image" src="https://github.com/user-attachments/assets/09d127b2-100f-45fe-bbdb-04ed5fbdb70a" />


O foco da experiência é produtividade com interface limpa: navegação rápida, filtros por tags, tema claro/escuro e renderização visual de imagens com recorte responsivo (sem processamento pesado no servidor).

## Features Principais

- CRUD completo de notas (criar, listar, editar, excluir)
- Arquivamento e restauração de notas
- Autenticação de usuário (cadastro e login)
- Busca por título, conteúdo e tags
- Filtro por múltiplas tags
- Layout responsivo (desktop, tablet e mobile)
- Tema claro/escuro
- Upload por URL com preview de imagem e recorte usando `ngx-image-cropper`
- Exibição de imagem recortada via técnica `Container + Transform` para melhor performance visual

## Navegação e Rotas (Frontend)
O aplicativo foi estruturado utilizando o Angular Router para uma navegação fluida (Single Page Application). As principais rotas de acesso são:

/login : Tela inicial da aplicação para autenticação de usuários já registrados.

/new-user-notes : Tela de cadastro, onde novos usuários podem criar suas contas no sistema.

/all-notes : Painel principal (Área Logada). É a interface central onde ocorre todo o CRUD de tarefas, visualização de imagens, filtros por tags e gerenciamento do status (arquivar/restaurar) das notas.

## Integração com API
O frontend consome a API remota:

- Base URL: `https://backend-senainotes.onrender.com`
- ⚠️ Nota importante: O backend está hospedado no plano gratuito do Render. Por conta disso, o servidor entra em modo de repouso após um período de inatividade. O primeiro carregamento (login ou cadastro) pode levar de 50 a 60 segundos para responder enquanto o serviço "desperta". Após esse primeiro acesso, a navegação flui normalmente.
- Formato: JSON
- Autenticação: Bearer Token no header `Authorization`

### Headers Utilizados

- Públicas (login/cadastro):
  - `Content-Type: application/json`
- Protegidas (notas):
  - `Content-Type: application/json`
  - `Authorization: Bearer <meuToken>`

### Endpoints Consumidos Pelo Frontend

#### Autenticação

- `POST /api/auth/register`
  - Objetivo: criar novo usuário
  - Payload enviado:
    ```json
    {
      "name": "Nome do usuário",
      "email": "user@email.com",
      "password": "123456"
    }
    ```

- `POST /api/auth/login`
  - Objetivo: autenticar usuário
  - Payload enviado:
    ```json
    {
      "email": "user@email.com",
      "password": "123456"
    }
    ```
  - O frontend espera receber no retorno algo compatível com:
    ```json
    {
      "data": {
        "token": "jwt_token",
        "user": {
          "id": "user_id"
        }
      }
    }
    ```
  - O token e o ID são persistidos no `localStorage` como `meuToken` e `meuId`.

#### Notas

- `GET /api/notes?page=1&limit=100&archived=false`
  - Objetivo: listar notas ativas

- `GET /api/notes?page=1&limit=100&archived=true`
  - Objetivo: listar notas arquivadas

- `POST /api/notes`
  - Objetivo: criar nota
  - Payload enviado:
    ```json
    {
      "title": "Título da nota",
      "content": "Conteúdo da nota",
      "tags": ["dev", "frontend"],
      "imageUrl": "https://exemplo.com/imagem.jpg",
      "crop": {
        "x": 0,
        "y": 0,
        "width": 100,
        "height": 100,
        "ar": 2.35
      }
    }
    ```
  - `imageUrl` e `crop` são opcionais.

- `PUT /api/notes/:id`
  - Objetivo: atualizar nota existente
  - Payload: mesmo formato do `POST /api/notes`

- `DELETE /api/notes/:id`
  - Objetivo: excluir nota

- `PATCH /api/notes/:id/archive`
  - Objetivo: alternar estado de arquivamento (arquivar/restaurar)
  - Payload enviado pelo frontend: `{}` (corpo vazio)

### Formato de Nota Esperado no Retorno da API

O frontend mapeia a resposta da API para seu modelo interno esperando, principalmente, campos equivalentes a:

```json
{
  "_id": "note_id",
  "title": "Título",
  "content": "Conteúdo",
  "userId": "user_id",
  "tags": ["tag1", "tag2"],
  "imageUrl": "https://exemplo.com/imagem.jpg",
  "crop": {
    "x": 10,
    "y": 5,
    "width": 80,
    "height": 40,
    "ar": 2
  },
  "archived": false,
  "updatedAt": "2026-01-01T10:00:00.000Z"
}
```

Observações:
- O frontend aceita `_id` ou `id`.
- Para ordenação/exibição de data, usa `updatedAt` (fallback para `createdAt`).
- Quando há imagem, o recorte é aplicado no cliente para manter responsividade e consistência visual.

## Tecnologias Utilizadas

- Angular `20`
- TypeScript
- Angular Router
- Angular Reactive Forms
- Angular HttpClient
- RxJS
- `ngx-image-cropper`
- Font Awesome (`@fortawesome/angular-fontawesome`)
- CSS responsivo com media queries

## Como Rodar Localmente

### Pré-requisitos

- Node.js (recomendado LTS atual)
- npm
- Angular CLI (opcional, o projeto já expõe scripts via `npm`)

### Passo a Passo

1. Clone o repositório
   ```bash
   git clone <url-do-repositorio>
   ```

2. Acesse a pasta do projeto
   ```bash
   cd senai_notes-direto
   ```

3. Instale as dependências
   ```bash
   npm install
   ```

4. Rode em modo desenvolvimento
   ```bash
   npm start
   ```

5. Acesse no navegador
   - `http://localhost:4200`

## Scripts Úteis

- `npm start` - inicia servidor de desenvolvimento Angular
- `npm run build` - gera build de produção
- `npm test` - executa testes unitários
