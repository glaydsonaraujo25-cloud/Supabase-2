# Escala de Serviço

Aplicação web para gestão administrativa de escalas de serviço, construída com React, TypeScript e Supabase.

## Funcionalidades

- Cadastro e login com Supabase Auth
- Perfis `admin` e `usuario`
- Cadastro de militares
- Vínculo entre conta de usuário e militar
- Cadastro de tipos de serviço
- Criação e consulta da escala
- Visão geral com indicadores
- Consulta da escala individual
- Solicitação de troca de serviço
- Aprovação/recusa de solicitações pelo administrador
- Row Level Security (RLS) em todas as tabelas expostas
- Layout responsivo para desktop e celular

## Tecnologias

- React 19
- TypeScript
- Vite
- Supabase Auth
- Supabase PostgreSQL
- Supabase Row Level Security
- Lucide React

## 1. Criar/configurar o Supabase

Crie um projeto no Supabase e abra o **SQL Editor**. Execute todo o conteúdo de:

```text
supabase/schema.sql
```

O script cria as tabelas, relacionamentos, índices, trigger de perfil, RLS, permissões da Data API e tipos de serviço iniciais.

## 2. Configurar as variáveis de ambiente

Copie `.env.example` para `.env`:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_publishable_key
```

Use somente a **Publishable Key** no frontend. Nunca coloque Secret Key ou `service_role` em variáveis `VITE_*`.

## 3. Instalar e executar

É recomendado Node.js 22 ou superior.

```bash
npm install
npm run dev
```

Para validar produção:

```bash
npm run build
```

## 4. Criar o primeiro administrador

1. Cadastre a primeira conta pela própria aplicação.
2. Confirme o e-mail, caso a confirmação esteja habilitada.
3. No Supabase, encontre o UUID dessa conta em **Authentication > Users**.
4. Execute uma única vez no SQL Editor:

```sql
update public.profiles
set role = 'admin'
where id = 'UUID_DO_USUARIO';
```

Depois disso, essa conta poderá cadastrar militares, criar serviços, montar escalas, vincular contas e revisar solicitações de troca.

## Perfis de acesso

### Administrador

Pode consultar e gerenciar militares, tipos de serviço, escalas, vínculos de contas e solicitações de troca.

### Usuário

Pode consultar os dados necessários para a escala, visualizar os próprios serviços e solicitar uma troca quando sua conta estiver vinculada a um militar.

## Estrutura do banco

- `profiles`: perfil e papel do usuário autenticado
- `soldiers`: cadastro administrativo dos militares
- `service_types`: tipos de serviço
- `shifts`: escalas lançadas
- `swap_requests`: pedidos de troca

## Segurança

O frontend utiliza apenas a Publishable Key. As regras de autorização ficam no PostgreSQL por meio de RLS. O papel administrativo não é obtido de `user_metadata`, impedindo que um usuário se promova editando metadados da própria conta.

Evite cadastrar informações operacionais sensíveis que não sejam necessárias para a finalidade administrativa da aplicação.
