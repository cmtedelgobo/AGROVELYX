# Agrovelyx 2.3.1 — Cadastro raiz de animais e manejo em tabela

**Implantação:** substitua as pastas `public/` e `src/` do repositório atual pelas deste pacote, mantendo **inalterado** o `wrangler.jsonc` com o Database ID da sua instalação. Faça backup do banco D1 e do código atual; faça primeiro os testes no DEMONSTRATIVO. Não coloque dados reais novos antes de validar a homologação.

## Novidades

- Operacional → **Animais**, imediatamente antes de **PIA — Prontuário Individual**.
- Cadastro central consulta o registro já existente da tabela lógica `Animais e lotes`, sem duplicá-lo. Exibe ID, brinco, mossa, tatuagem, fase, lote e localização atual.
- Busca instantânea que vai estreitando os resultados enquanto se digita **ID / BRINCO / TATUAGEM / MOSSA**.
- Em cada animal: **Ver**, **Editar**, **Movimentar** e **PIA**. Na ficha: atalhos para Cio, Cobertura, Gestação, Parto, Maternidade, Desmame, Pré-creche, Creche, Recria, AVA e Terminação.
- Movimentar permite alterar fase, lote e instalação, informando data e justificativa. Atualiza o registro do animal e grava o evento na tabela lógica `Lotes e movimentações` **num único batch transacional no D1**, com auditoria. Não movimenta saldo coletivo de lotes nem baixa estoque; essa reconciliação será necessária em uma evolução específica.
- Nos módulos operacionais, **Novo lançamento** abre primeiro seleção múltipla de animais (ou lotes), com sugestões progressivas. O preenchimento é uma tabela: cada animal tem campos próprios, por operação. Ao confirmar, os lançamentos são gravados em batch atômico, auditados e associados ao ID permanente, para consulta no PIA.
- O servidor verifica o ID do animal/lote e a organização/granja da sessão, não aceita animais de outras granjas ou inativos e impede duplicação do mesmo ID na solicitação. Os módulos reprodutivos rejeitam animal cadastrado como macho. Outros requisitos zootécnicos específicos ainda dependem de validação do responsável técnico.
- Removido o botão **Senha** do cabeçalho; alteração de senha permanece no perfil do usuário. Dashboard com novos ícones vetoriais.

## Banco de dados

Esta atualização 2.3.1 **não exige SQL adicional**: utiliza as tabelas já existentes `erp_records` e `audit_logs`. Preserve e aplique antes a migração `016`, caso ainda não tenha sido aplicada (consulte o arquivo `LEIA_ANTES_DE_PUBLICAR.md`).

## Limitações e testes

- O PIA mostra os lançamentos feitos pelo fluxo 2.3.1 usando registros vinculados; ainda não consolida automaticamente todos os processos das tabelas especializadas criadas nos blocos 1 a 14.
- A pesquisa usa os cadastros carregados na sessão via `/api/records`, sujeito ao limite atual de 5.000 registros retornados e às permissões configuradas. Granjas maiores precisam de uma API de busca paginada e indexada no servidor.
- Busca e lançamentos exigem conexão online; a sincronização offline segura permanece indisponível.
- Fluxos de transferência de lotes, saldos, genética, procedimentos sanitários e controle de gestação precisam de regras adicionais para operação real.
- Não há confirmação visual automatizada na infraestrutura real da Cloudflare; os testes locais verificam navegação e composição das telas usando dados fictícios.

## Homologação sugerida

1. Commit no GitHub, confira deployment `Ready`, atualize Ctrl+F5.
2. Entre em DEMONSTRATIVO; cadastre 2 fêmeas fictícias e confira a pesquisa por trecho do brinco e tatuagem.
3. Abra a ficha do animal, movimente-o para Gestação e confirme a fase e local exibidos.
4. Abra Operacional → Cio, selecione as 2 matrizes, preencha datas diferentes e confirme os lançamentos. Confira os históricos e PIA.
5. Entre em LAGO AZUL e confirme que nenhum animal fictício do Demonstrativo aparece. Teste também tentativa de consultar IDs de outra granja via API.
6. Confira botão **Senha** removido, login, perfil, sair e visual mobile.
