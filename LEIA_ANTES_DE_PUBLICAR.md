# AGROVELYX Suínos 2.3 — Pacote integrado

**ATENÇÃO: pacote para homologação.** Não foi executado contra o seu D1 real nem validado com navegador conectado à produção. Faça backup antes da migração e use inicialmente o ambiente DEMONSTRATIVO com registros fictícios.

## 1. Preservar os dados existentes

- **Não apague nem recrie o D1 `agrovelyx-prod`.**
- **Não envie/substitua `wrangler.jsonc`**: mantenha o arquivo atual do GitHub, com seu `database_id` real e binding `DB`.
- Não execute novamente os blocos de SQL antigos, nem os scripts com senhas.
- Faça backup/exportação do D1 e guarde uma cópia da versão atual do GitHub antes da atualização.
- Os arquivos SQL deste pacote são aditivos (`CREATE ... IF NOT EXISTS`), não contêm `DELETE`, `DROP` nem `ALTER` de tabelas legadas.
- As operações especializadas novas usam prefixo `agv23_`, e os cadastros anteriores continuam em `erp_records`.

## 2. Migração obrigatória **ANTES** de testar a nova interface

Cloudflare → D1 → `agrovelyx-prod` → Console.

Opção A: execute `migrations/016_agrovelyx_23_operacoes.sql` com uma ferramenta que aceite múltiplas instruções SQL.

Opção B (recomendada para quem utiliza o Console do navegador): abra a pasta `migrations/016_console_bloco_a_bloco/` e execute os arquivos **016_01.sql até 016_18.sql, em ordem, um por vez**. Se houver erro, pare e confira antes de continuar. Uma mensagem `No SQL statements detected` significa que aquele comando não foi reconhecido; não presuma execução.

Conferência:

```sql
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'agv23_%' ORDER BY name;
```

Esperado: 10 tabelas. Confira também:

```sql
SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'agv23_%' ORDER BY name;
```

Esperado: 2 triggers.

## 3. Atualização no GitHub

Envie as pastas `public/` e `src/` do ZIP **para a raiz do mesmo repositório**. A pasta `migrations/` pode ser enviada para documentar as alterações de esquema; os arquivos dessa pasta NÃO são executados automaticamente apenas porque você fez o commit.

Mantenha o `wrangler.jsonc` que já funciona. Faça commit. No Cloudflare confirme que o deployment novo ficou `Ready`. Depois pressione Ctrl+F5. Confira o endereço `/api/status` e faça login no DEMONSTRATIVO.

## 4. Mudanças operacionais

- Login por usuário e senha, identificação automática da granja; botão **Sair** e perfil clicável com alteração de senha. O botão **Senha** foi removido do cabeçalho.
- Menu **Cadastros** separado de **Administração**; botão Ocultar/Exibir painel de ação ausente.
- Fábrica: fornecedor e ingrediente relacionados, **+ Nova compra**, ordem de compra sequencial `DDMMAA###` pendente, mudança para recebido/cancelado por operação autenticada, saldo a partir dos lotes recebidos, fórmula em linhas com percentuais/kg e validação do peso total.
- Ordem de produção: numeração automática `DDMMAA###` por granja, fórmula congelada no momento da emissão, lote de destino, confirmação de fabricação no Worker, baixa FIFO de lotes de ingredientes e registro de fornecedor/compra/custo.
- **Consumo** posterior da ração por lote e período; histórico de consumo consultável no PIA do animal ligado ao lote. Não presume que tudo que foi fabricado foi consumido, nem atribui medida individual real.
- Logística: números NF-e / CT-e / GTA separados, anexos autenticados PDF/XML/imagem (até **250 KB por arquivo**), listagem/baixar, romaneio imprimível/salvável como PDF pelo navegador, cabeçalho da granja.
- RH: visualizar/editar/inativar colaboradores, escalas, lista e conclusão de treinamentos com conferência individual de presença; PDF por impressão do navegador.
- Animais e lotes: editar fase, brinco/mossa/tatuagem, botão PIA, importação JSON de até **100** registros por solicitação em batch atômico no D1, com prévia e verificação de duplicidade.
- Administração: usuários e permissões, auditoria, dados da granja com logomarca pequena (máximo 60 KB) e cabeçalhos de documento.

## 5. Limitações honestas

1. **A versão 2.3 NÃO é um ERP integralmente homologado.** A interface/Worker não foram testados neste pacote no seu Cloudflare em produção. Valide tudo no DEMONSTRATIVO primeiro.
2. As tabelas especializadas antigas dos Blocos 1–14 (`feed_*`, `animals`, etc.) ainda não estão todas alimentadas diretamente pelos novos fluxos. As operações novas usam `agv23_*` e `erp_records`. É necessário um projeto de reconciliação dos saldos históricos antes de utilizá-las como contabilidade oficial.
3. O estoque anterior registrado em formulários genéricos **não é migrado automaticamente**. Recebimentos antigos exigem reconciliação para não duplicar entradas. O saldo real da tela 2.3 considera os recebimentos transacionais 2.3.
4. O PDF é uma **janela de impressão** do navegador, não um arquivo PDF binário gerado automaticamente no servidor. Compartilhar exige salvar/imprimir PDF e então compartilhar. Não emite NF-e, CT-e ou GTA oficiais.
5. Os anexos pequenos são salvos no D1 de maneira autenticada; para arquivos grandes, armazenamento robusto, antivírus e política de retenção, recomenda-se integrar Cloudflare R2. Não interprete esta solução como cofre documental homologado.
6. A baixa de fabricação usa a proporção da fórmula congelada, não uma ficha de pesagem de cada ingrediente validada por operador. Necessária evolução para registrar pesagem efetivamente utilizada, tolerâncias, perdas e reprovações.
7. Registro de alimentação por lote e período é histórico operacional; PIA individual apresenta vínculo **indireto ao lote**, não medida de ingestão individual.
8. Não há sincronização offline segura operacional; não usar dados reais sem rede.
9. Exclusões são tratadas como **inativação auditada** quando possuem vínculos. Não existe exclusão irreversível de lançamentos confirmados.
10. A migração não copia automaticamente todos os registros legados para o novo esquema. Faça homologação e reconciliação antes de operar com dados reais.

## 6. Roteiro de testes obrigatórios (apenas dados fictícios)

1. Entrar no DEMONSTRATIVO. Conferir no topo a granja correta e o perfil.
2. Cadastrar fornecedor e 2 ingredientes; conferir que o seletor da compra filtra pelo fornecedor.
3. Criar nova compra. Verificar número `DDMMAA###` e status PENDENTE. Abrir Ordem / PDF.
4. Atualizar para RECEBIDO. Confirmar entrada exatamente uma vez. Tentar receber novamente e verificar que não duplica.
5. Verificar estoque agrupado por ingrediente, inclusive com fornecedores diferentes para o mesmo ingrediente.
6. Criar fórmula de 1000 kg somando 1000 kg; testar fórmula com soma incorreta (deve recusar).
7. Criar lote de animais fictício. Emita ordem selecionando fórmula, quantidade e lote. Verifique numeração automática.
8. Confirme produção com saldo suficiente. Observe baixa do estoque e rastreabilidade dos lotes de origem. Confirme que tentar repetir não produz nova baixa.
9. Tente ordem sem estoque: deve ser rejeitada, preservando saldos.
10. Registre consumo efetivo do lote em período; verifique que não pode superar a quantidade produzida.
11. No cadastro do animal ligado ao lote, abra PIA e confira histórico de consumo por lote.
12. Cadastrar colaborador e escala. Conferir organograma por setor principal.
13. Criar treinamento, matricular colaboradores, conferir presença e imprimir ficha.
14. Em Logística, cadastrar carga com NF-e, CT-e, GTA separados; anexar um PDF pequeno e baixar. Gerar romaneio com cabeçalho da granja.
15. Importar JSON fictício com dois animais; repetir com mesmo ID (deve recusar sem registrar registros parciais).
16. Conferir que os usuários MASTER da Lago Azul compartilham registros, e que DEMONSTRATIVO não acessa esses registros, inclusive por chamadas diretas de API.
17. Sair do sistema e confirmar que rotas privadas retornam 401.

## 7. Erros e diagnóstico

- `No SQL statements detected`: tente os blocos SQL individuais em ordem.
- `Falha ao processar requisição` ou `Operação não concluída`: confira logs do Worker e se a migração 016 foi executada.
- `Sem permissão`: verifique usuário, organização e permissões daquele módulo.
- Falta de saldo: receba a compra antes de confirmar a fabricação.
- Build Failed: confira logs da aba Deployments antes de alterar código ou banco.

**Nenhuma senha inicial ou Database ID real estão incluídos neste ZIP.**
