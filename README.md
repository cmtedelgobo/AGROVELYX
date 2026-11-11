# AGROVELYX SUÍNOS 2.0 — PRÉVIA FUNCIONAL LOCAL

## Estado real do projeto

Esta versão evolui a navegação Beta 0.1 para um **protótipo interativo de testes**, sem backend. Mantém a estrutura visual azul da Stratéchne e incorpora a marca Agrovelyx Suínos fornecida pelo proprietário.

**NÃO É UM ERP PRONTO PARA USO EM GRANJA REAL.** Não use informações pessoais de funcionários, dados clínicos, financeiros ou de operação real nesta edição. O servidor, autenticação por usuário, papéis, dados por granja e banco Cloudflare D1 **ainda não estão implementados**.

## O que funciona no navegador

- Menu lateral com ícones SVG, layout adaptativo para celular e atalhos personalizáveis.
- Botão **Ocultar/Exibir painel de ação** nas telas.
- Telas de cadastros e lançamentos locais dos módulos, com criação, pesquisa, edição e exportação CSV.
- Modal de formulário **não fecha ao clicar fora**, nem ao pressionar Escape; preenchimento gera rascunho local. Ao sair, o rascunho pode ser retomado.
- **Salvar dados offline** consolida um lançamento no armazenamento local; indicador online/offline e serviço de cache estático para abertura da aplicação após visita prévia (sob HTTPS).
- Fila de lançamentos locais e **Central de Sincronização** com exportação/importação de backup JSON. A fila NÃO pode ser enviada, pois não existe API de sincronização autenticada neste ZIP.
- Cadastro animal com brinco, mossa e tatuagem independentes, aviso sobre duplicidade entre animais ativos e histórico das edições.
- **PIA** com identificações, genética informada e seções de consumo, vacinas, tratamento, partos e movimentações; os vínculos desta prévia usam identificações digitadas, NÃO relações referencialmente seguras entre entidades.
- Cadastro de colaboradores, cargos, setores e organograma em níveis, com relações acima/abaixo/paralelo (visualização experimental).
- Configurações por fase de produção e painel simplificado de galpões/baias.
- Registro local de auditoria da edição e criação (sem identidade autenticada), impressão do PIA via navegador.

## O que falta antes de considerar produção

1. API autenticada Cloudflare Workers, banco D1 com migrations e identificadores relacionais persistentes.
2. Separação de dados por cliente/granja, login seguro, controles de acesso, LGPD e usuários reais para auditoria.
3. Implementar sincronização bidirecional com idempotência, conflitos, retry, confirmações e persistência offline robusta (preferivelmente IndexedDB com fila transacional). **O botão `ENVIAR DADOS OFFLINE` só deverá aparecer quando o servidor estiver acessível e existirem pendências.** Ele não aparece nesta prévia para não simular um envio inexistente.
4. Transações de estoque de ração/medicamentos e custos reais com validação de saldos, lotes, carências e rateios.
5. Controles zootécnicos e índices tecnicamente validados, genealogia relacional, tempos de permanência automaticamente calculados, indicadores e regras de conferência.
6. Testes de ponta a ponta, revisão de segurança, histórico imutável e backup automático em servidor.

## Publicação no GitHub / Cloudflare

Substitua os arquivos do repositório pelos arquivos deste ZIP (preservando `public/` no nível da raiz). Cloudflare Pages: **Framework preset None**, comando de build em branco, diretório de saída `public`. O arquivo `wrangler.jsonc` existente continua voltado a assets estáticos.

No celular, abra via HTTPS depois de uma primeira visita online para permitir cache offline. Dados locais ficam **somente no navegador e dispositivo que os criou**; limpar dados do navegador pode apagá-los. Faça backup manual pelo menu `Gestão > Central de sincronização`.
