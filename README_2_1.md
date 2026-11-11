# AGROVELYX Suínos 2.1 — Interface e integrações iniciais

- Identidade visual verde-escura, com marca Agrovelyx do protótipo de login e símbolo Stratéchne enviado pelo usuário no rodapé.
- Telas operacionais contextualizadas por área (métricas simples, orientações, registros e formulários).
- Login sem seleção de granja; consulta de vínculo user_farm_access e sessões D1.
- Correções de compatibilidade da autenticação com os SQLs executados na conversa: auth_sessions.session_token_hash, organization_id obrigatório, auth_login_attempts como log de tentativas.
- Criação de usuário atribui vínculo à granja atual.

## Atenção
O código não foi implantado na Cloudflare nem testado contra o D1 real. Cálculos e operações específicas ainda precisam de APIs sobre as tabelas especializadas. Não inserir dados reais sem validar autenticação, hashes, migrações e isolamento em homologação.

## Implantação
Revise `wrangler.jsonc` e configure `database_id` da instância D1 existente. Faça teste num ambiente separado e só então publique. Não inclua SQL com senhas no repositório.

## Banco existente
O usuário já executou manualmente o Bloco 15A–15F; **não reexecute** `migrations/015_auth_tenant.sql` nem os SQLs de cadastro de master. Apenas configure o binding para o banco existente.

## Limitações específicas
Os fluxos desenhados agora diferenciam os módulos visualmente, mas continuam salvando dados genéricos em `erp_records`. Fórmulas de cálculo, geração de PDF, aprovação real, integrações com tabelas especializadas e anexos ficam pendentes. A credencial demonstrativa anterior exige troca antes da publicação.
