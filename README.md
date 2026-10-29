# AGROVELYX Suíno — Beta 0.1

Interface estática de demonstração, sem login, sem API, sem D1 e **sem armazenamento de dados reais**. Os atalhos podem ser adicionados, removidos e reordenados, com preferência salva localmente neste navegador. A navegação entre áreas está funcional; telas internas são placeholders de desenvolvimento.

## Publicar pelo GitHub + Cloudflare Pages (sem instalar Node.js)

1. No repositório AGROVELYX do GitHub, clique em **Add file → Upload files**.
2. Envie **a pasta `public` com seus três arquivos** (`index.html`, `styles.css`, `app.js`) e este `README.md`. Verifique que a estrutura do repositório ficou como abaixo.
3. Faça o commit na branch `main`.
4. Cloudflare → Workers & Pages → **Create application → Pages → Connect to Git**.
5. Selecione seu repositório `AGROVELYX`, branch `main`.
6. Framework preset: **None**; Build command: **em branco** (ou `exit 0`); Build output directory: **public**.
7. Publique e abra o endereço `*.pages.dev` gerado pela Cloudflare.

Estrutura esperada:

```
AGROVELYX/
  README.md
  public/
    index.html
    styles.css
    app.js
```

**Importante:** não é um sistema de produção. Futuramente separar frontend, API Workers e banco D1; adicionar autenticação e autorização antes de cadastrar informações reais.
