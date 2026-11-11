# AGROVELYX Suínos 2.2 — Pacote consolidado de interface

## Como enviar ao GitHub
- Faça backup do repositório e do banco D1 antes de publicar.
- Extraia o ZIP e envie **public/** e **src/** à raiz do repositório AGROVELYX, sobrescrevendo arquivos de mesmo nome.
- **Não apague nem substitua o `wrangler.jsonc` existente**; ele tem o `database_id` real e o binding `DB` já configurado.
- Confirme Cloudflare Deployments = Ready, depois use Ctrl+F5 e teste em uma cópia/homologação primeiro.
- O `src/index.js` desta entrega mantém os endpoints existentes e corrige a criação de novas senhas para PBKDF2 100000 (compatível com os hashes de 100000 já aplicados no D1).
- Não execute novamente os SQL dos Blocos 1–15; não há migração de esquema obrigatória nesta entrega.

## O que foi implementado na interface com persistência genérica D1
- Menu separado em Cadastros e Administração, e remoção do botão Ocultar/Exibir painel de ação.
- Fábrica: fornecedores e ingredientes relacionados, seleção dependente nas compras, saldo **estimado** agrupado por ingrediente com recebimentos/ajustes, formulações em linhas kg/% com soma validada, ordens ligadas à fórmula existente e cadastro rápido de fórmula.
- Comercial/Logística: três campos distintos de NF-e, CT-e e GTA, e janela de romaneio operacional imprimível ou salvável como PDF do navegador.
- RH: lista de colaboradores com Ver, Editar, Inativar, escalas com consulta/edição e seleção de colaboradores, treinamentos com matriculados, marcação individual de presença, conclusão e ficha imprimível/PDF.
- Animais: fase atual, edição, botão Ver PIA e importação JSON de até 200 animais por lote com prévia e checagem de identificação interna duplicada.
- Dados da granja: razão social, CNPJ, telefone, endereço e imagem comprimida (até 60 KB), usados no cabeçalho do romaneio e ficha de treinamento.
- Service Worker: cache da versão 2.2 e correção da clonagem da Response.

## LIMITAÇÕES IMPORTANTES — não cadastrar dados reais sem validação
- A persistência de novos fluxos é feita em `erp_records` por organização e granja; não está integrada transacionalmente às tabelas especializadas `feed_*`, `animals`, `transport_*`, `employees` do D1.
- O estoque é uma **estimativa de interface** (recebimentos mais ajustes cadastrados), não inventário conciliado. A emissão/conclusão de ordem não baixa ingredientes em transação no banco.
- PDF = visualização HTML de impressão que o usuário pode salvar como PDF; não é emissão fiscal nem sanitária oficial e não incorpora anexos XML/PDF da NF-e/CT-e/GTA. Upload de documentos maiores e logomarca grande necessitarão Cloudflare R2.
- Importação PDF/Excel **não ocorre no navegador nesta versão**. Envie posteriormente os arquivos para conversão/validação e geração de JSON. O JSON é importado por múltiplas gravações, portanto pode ocorrer **importação parcial** se o servidor falhar: confira o total e os IDs antes de repetir.
- Offline seguro com sincronização ainda não está implementado. O botão offline legado deve permanecer sem armazenamento de dados sensíveis.
- A aprovação/auditoria em nível de negócio, histórico imutável, validações zootécnicas e restrição por módulo exigem Worker especializado e testes integrados.
- A proteção de dados depende da API autenticada e do `wrangler.jsonc` em produção. Não compartilhe senhas por mensagens e altere as senhas iniciais antes de uso real.

## Verificações mínimas
1. Login Vivian e Viviane: acesso à mesma Lago Azul.
2. Login Demonstrativo: ausência total dos registros Lago Azul.
3. Cadastrar fornecedor > ingrediente > compra; verificar dependência.
4. Tentar salvar fórmula cuja soma não atinja o peso: deve rejeitar.
5. Gerar romaneio e verificar cabeçalho da granja.
6. Criar treinamento com participantes e confirmar presença de cada um.
7. Abrir editar animal e botão PIA; testar importação de apenas 1 animal fictício.
8. Conferir o cache após Ctrl+F5, login e exclusão de acesso anterior no logout.
