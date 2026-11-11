# Agrovelyx 2.1.1 — Correção do login e imagem

- Mantém foto do leitão visível em janelas menores, inclusive quando ChatGPT e ERP estão lado a lado.
- Exibe separadamente falhas de login e de carregamento do painel.
- Atualiza cache de arquivos estáticos para v2.1.1.
- Adiciona `GET /api/status` para verificar somente a disponibilidade da API e do binding D1, sem revelar dados de granjas.

**Não executa migrações nem altera as tabelas D1.**

## Publicação

Substitua os arquivos do projeto no GitHub, **mas preserve seu `wrangler.jsonc` já corrigido com Database ID real**. O `wrangler.jsonc` deste ZIP é apenas um modelo e contém placeholder.

Depois de o Cloudflare indicar Ready, visite `/api/status`. Deve retornar `ok:true`, `database:connected`. Em seguida, entre na Agrovelyx e anote a mensagem que aparece abaixo do botão Entrar, caso não funcione. Não envie senha por captura de tela.

**Atenção**: o endpoint /api/status não confirma que o login ou o isolamento entre as granjas funciona. Não inserir dados reais antes dos testes de isolamento.
