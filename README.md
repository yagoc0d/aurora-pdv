# AuroraMoon — PDV & ERP

Sistema de ponto de venda e gestão para pequenos mercados/mercearias.

## Estrutura do projeto

```
auroramoon/
├── banco/
│   └── schema_completo.sql   ← Cole no Supabase para criar o banco do zero
├── src/
│   ├── main.jsx              ← Entry point React
│   ├── App.jsx               ← Roteador (/ = ERP, /pdv = PDV)
│   ├── supabaseClient.js     ← Conexão com o banco
│   ├── PDVVenda.jsx          ← Tela de caixa
│   ├── ERPLayout.jsx         ← Shell do painel gerencial
│   └── erp/
│       ├── FechamentoDia.jsx
│       ├── Estoque.jsx
│       ├── Fiado.jsx
│       ├── CadastroProdutos.jsx
│       └── CadastroClientes.jsx
├── index.html
├── vite.config.js
├── vercel.json               ← Necessário para roteamento no Vercel
└── package.json
```

## Como rodar localmente

```bash
npm install
npm run dev
```

## Como fazer deploy no Vercel

```bash
npm install -g vercel
vercel
```

## Banco de dados (Supabase)

1. Crie um projeto em supabase.com
2. Vá em **SQL Editor → New query**
3. Cole o conteúdo de `banco/schema_completo.sql` e clique em **Run**
4. Atualize `src/supabaseClient.js` com sua **Project URL** e **anon key**

## URLs do sistema

| URL | O que abre |
|-----|-----------|
| `/` | ERP — Painel gerencial |
| `/pdv` | PDV — Tela de caixa |
