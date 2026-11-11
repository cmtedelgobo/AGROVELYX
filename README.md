# AGROVELYX SUÍNOS 2.0 — autenticação e separação de granjas

## Visão geral

Primeira integração de autenticação e D1. Interface original preservada, incluindo menus responsivos e formulários que **não fecham ao clicar fora**.

### Implementado
- Login via Worker, cookie `HttpOnly`, `Secure`, `SameSite=Strict`, duração de 12 horas.
- Senhas com PBKDF2/SHA-256, sal individual e 210.000 iterações.
- Sessão vinculada à organização e granja, validada em cada chamada.
- Usuários master/administradores podem cadastrar usuários e conceder permissões de leitura/edição.
- Registros genéricos de formulários da interface são persistidos por granja no D1 (`erp_records`).
- Auditoria de inclusão/alteração no D1. Bloqueio de login após tentativas repetidas.
- Endpoint de troca de senha; outros dispositivos são desconectados após alteração.

### Não concluído — NÃO usar como ERP definitivo para operação real
- Os lançamentos continuam em formulários genéricos, não nas tabelas zootécnicas normalizadas criadas nos blocos 1-14.
- Não há sincronização offline segura, integração com ração, financeiro, prontuário e demais tabelas de domínio.
- A proteção contra dupla identificação e validação de todos os vínculos ainda exige regras adicionais.
- Criação de usuários no painel funciona; remoção/edição de usuários e leitura do estado de permissões ainda precisam de interface.
- A configuração de fases não é salva remotamente e está desabilitada nesta etapa.
- Rascunhos em andamento ficam apenas na memória da página; não navegue ou recarregue durante preenchimento.
- Não usar o login demonstrativo fraco em serviço público sem trocar a senha.

## Passos de implantação (na ordem)

1. Faça backup do D1, se houver dados. Execute `migrations/015_auth_tenant.sql` **uma única vez** no Console do banco `agrovelyx-prod` após os Blocos 1-14. NÃO execute a migração duas vezes, pois o `ALTER TABLE ADD COLUMN` não é idempotente.
2. Execute o arquivo privado `AGROVELYX_01_GRANJAS_PRIVADO.sql` no Console do D1. Esse arquivo fica **fora deste ZIP**.
3. Execute `AGROVELYX_02_USUARIOS_PRIVADO.sql` no mesmo Console. Esse arquivo fica **fora deste ZIP**. Não envie esses arquivos para o GitHub.
4. Acesse Cloudflare D1 > `agrovelyx-prod`, copie o **Database ID** e substitua `SUBSTITUIR_PELO_DATABASE_ID_DO_D1` em `wrangler.jsonc`.
5. Publique o Worker com assets e D1 binding `DB` usando `npx wrangler deploy`, ou configure o projeto conectado ao GitHub para executar esse comando de deploy (não só upload estático de Pages).
6. Abra o endereço HTTPS do Worker e faça login. A tela inicial identifica o nome da granja.
7. Troque imediatamente as senhas iniciais, especialmente a do DEMONSTRATIVO, pelo botão `Senha`.
8. Em Cadastros e Administração > Usuários e permissões, crie acessos adicionais. Usuários comuns começam sem permissão de acesso aos registros e precisam de autorizações por módulo.

## Teste de isolamento obrigatório

- Entre com um dos logins da Lago Azul e grave um registro de teste. Saia.
- Entre no login do Demonstrativo. O registro da Lago Azul não deverá aparecer.
- Grave outro registro no Demonstrativo, saia e volte para Lago Azul. Os dados demonstrativos não deverão aparecer.
- Confira `erp_records`: `SELECT f.name, r.record_type, COUNT(*) AS registros FROM erp_records r JOIN farms f ON f.id=r.farm_id GROUP BY f.name,r.record_type;`

## Segurança

Não coloque senhas nem os scripts privados de seed dentro do repositório. Mantenha os scripts privados seguros e não reenvie por chat. Uma senha inicial curta pode ser cadastrada apenas para a primeira troca; depois é obrigatório usar senha longa, única e não compartilhada. Duas contas com a mesma senha continuam vulneráveis ao mesmo vazamento. Dados reais e dados fictícios não devem ser exportados juntos.
