-- =============================================================================
-- AURORAMOON PDV & ERP — Script completo para novo banco (v2)
-- Cliente: Vizinho Mercearia
-- Como usar: cole no SQL Editor do Supabase e clique em Run
-- =============================================================================

-- TABELAS ---------------------------------------------------------------------

create table if not exists produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null default 'Geral',
  preco numeric(10,2) not null check (preco >= 0),
  unidade text not null default 'un',
  pesavel boolean not null default false,
  codigo_barras text,
  estoque_atual numeric(10,3) not null default 0,
  estoque_minimo numeric(10,3) not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  contato text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists dias_caixa (
  id uuid primary key default gen_random_uuid(),
  data date not null unique,
  aberto_em timestamptz not null default now(),
  fechado_em timestamptz,
  resumo jsonb,
  criado_em timestamptz not null default now()
);

create table if not exists vendas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id),
  forma_pagamento text not null check (forma_pagamento in ('dinheiro','pix','cartao','fiado')),
  valor_total numeric(10,2) not null check (valor_total >= 0),
  valor_recebido numeric(10,2),
  status text not null default 'concluida' check (status in ('concluida','cancelada')),
  criado_em timestamptz not null default now()
);

create table if not exists itens_venda (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references vendas(id) on delete cascade,
  produto_id uuid references produtos(id),
  nome_produto text not null,
  preco_unitario numeric(10,2) not null check (preco_unitario >= 0),
  quantidade numeric(10,3) not null check (quantidade > 0),
  pesavel boolean not null default false,
  subtotal numeric(10,2) not null check (subtotal >= 0)
);

create table if not exists fiado_movimentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  tipo text not null check (tipo in ('compra','pagamento')),
  valor numeric(10,2) not null check (valor > 0),
  venda_id uuid references vendas(id),
  forma_pagamento text,
  observacao text,
  criado_em timestamptz not null default now()
);

create table if not exists contagens_estoque (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos(id),
  estoque_sistema numeric(10,3) not null,
  estoque_contado numeric(10,3) not null,
  divergencia numeric(10,3) generated always as (estoque_contado - estoque_sistema) stored,
  observacao text,
  criado_em timestamptz not null default now()
);

-- ÍNDICES ---------------------------------------------------------------------

create index if not exists idx_produtos_nome on produtos using gin (to_tsvector('portuguese', nome));
create index if not exists idx_produtos_categoria on produtos (categoria);
create index if not exists idx_clientes_nome on clientes using gin (to_tsvector('portuguese', nome));
create index if not exists idx_vendas_criado_em on vendas (criado_em);
create index if not exists idx_vendas_cliente on vendas (cliente_id);
create index if not exists idx_itens_venda_venda on itens_venda (venda_id);
create index if not exists idx_itens_venda_produto on itens_venda (produto_id);
create index if not exists idx_fiado_cliente on fiado_movimentos (cliente_id, criado_em);
create index if not exists idx_contagens_produto on contagens_estoque (produto_id, criado_em);

-- TRIGGERS --------------------------------------------------------------------

create or replace function fn_baixar_estoque()
returns trigger as $$
begin
  if new.produto_id is not null then
    update produtos set estoque_atual = estoque_atual - new.quantidade where id = new.produto_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_baixar_estoque on itens_venda;
create trigger trg_baixar_estoque after insert on itens_venda for each row execute function fn_baixar_estoque();

create or replace function fn_gerar_fiado_compra()
returns trigger as $$
begin
  if new.forma_pagamento = 'fiado' and new.cliente_id is not null then
    insert into fiado_movimentos (cliente_id, tipo, valor, venda_id)
    values (new.cliente_id, 'compra', new.valor_total, new.id);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_gerar_fiado_compra on vendas;
create trigger trg_gerar_fiado_compra after insert on vendas for each row execute function fn_gerar_fiado_compra();

-- VIEWS -----------------------------------------------------------------------

create or replace view vw_produtos_a_repor as
select id, nome, categoria, estoque_atual, estoque_minimo,
       (estoque_minimo - estoque_atual) as quantidade_sugerida_compra
from produtos where ativo = true and estoque_atual < estoque_minimo
order by (estoque_minimo - estoque_atual) desc;

create or replace view vw_saldo_clientes as
select c.id as cliente_id, c.nome, c.contato,
  coalesce(sum(case when fm.tipo='compra' then fm.valor else 0 end),0)
  - coalesce(sum(case when fm.tipo='pagamento' then fm.valor else 0 end),0) as saldo_devedor
from clientes c left join fiado_movimentos fm on fm.cliente_id = c.id
group by c.id, c.nome, c.contato;

create or replace view vw_fechamento_caixa_diario as
select date(criado_em) as dia, forma_pagamento, count(*) as qtd_vendas, sum(valor_total) as total
from vendas where status = 'concluida'
group by date(criado_em), forma_pagamento
order by dia desc, forma_pagamento;

create or replace view vw_dia_atual as
select * from dias_caixa where data = current_date and fechado_em is null;

-- RLS — acesso anônimo (v1, operador único sem login) -------------------------

alter table produtos enable row level security;
alter table clientes enable row level security;
alter table dias_caixa enable row level security;
alter table vendas enable row level security;
alter table itens_venda enable row level security;
alter table fiado_movimentos enable row level security;
alter table contagens_estoque enable row level security;

do $$ begin
  drop policy if exists "Acesso anon em produtos" on produtos;
  drop policy if exists "Acesso anon em clientes" on clientes;
  drop policy if exists "Acesso anon em dias_caixa" on dias_caixa;
  drop policy if exists "Acesso anon em vendas" on vendas;
  drop policy if exists "Acesso anon em itens_venda" on itens_venda;
  drop policy if exists "Acesso anon em fiado_movimentos" on fiado_movimentos;
  drop policy if exists "Acesso anon em contagens_estoque" on contagens_estoque;
  drop policy if exists "Usuários autenticados podem tudo em produtos" on produtos;
  drop policy if exists "Usuários autenticados podem tudo em clientes" on clientes;
  drop policy if exists "Usuários autenticados podem tudo em vendas" on vendas;
  drop policy if exists "Usuários autenticados podem tudo em itens_venda" on itens_venda;
  drop policy if exists "Usuários autenticados podem tudo em fiado_movimentos" on fiado_movimentos;
  drop policy if exists "Usuários autenticados podem tudo em contagens_estoque" on contagens_estoque;
end $$;

create policy "Acesso anon em produtos"          on produtos          for all to anon using (true) with check (true);
create policy "Acesso anon em clientes"          on clientes          for all to anon using (true) with check (true);
create policy "Acesso anon em dias_caixa"        on dias_caixa        for all to anon using (true) with check (true);
create policy "Acesso anon em vendas"            on vendas            for all to anon using (true) with check (true);
create policy "Acesso anon em itens_venda"       on itens_venda       for all to anon using (true) with check (true);
create policy "Acesso anon em fiado_movimentos"  on fiado_movimentos  for all to anon using (true) with check (true);
create policy "Acesso anon em contagens_estoque" on contagens_estoque for all to anon using (true) with check (true);

-- DADOS DE EXEMPLO (remova se quiser banco limpo) -----------------------------

insert into produtos (nome, categoria, preco, unidade, pesavel, estoque_atual, estoque_minimo) values
  ('Arroz Tio João 5kg','Cesta básica',24.90,'un',false,18,5),
  ('Feijão Carioca 1kg','Cesta básica', 8.50,'un',false,32,8),
  ('Coca-Cola 2L',      'Bebidas',       9.99,'un',false,24,6),
  ('Pão Francês',       'Padaria',       0.80,'un',false,60,15),
  ('Queijo Mussarela',  'Padaria',      39.90,'kg',true,  5, 2),
  ('Presunto Fatiado',  'Padaria',      28.50,'kg',true,  4, 2),
  ('Bala Soft Avulsa',  'Avulsos',       0.25,'un',false,200,30),
  ('Sacola Plástica',   'Avulsos',       0.30,'un',false,500,50),
  ('Leite Integral 1L', 'Laticínios',    6.49,'un',false, 40,10),
  ('Detergente Neutro', 'Limpeza',       2.99,'un',false, 22, 5)
on conflict do nothing;

insert into clientes (nome, contato) values
  ('Maria das Graças','(31) 99999-0001'),
  ('Seu Antônio', null),
  ('Dona Lurdes','(31) 99999-0003')
on conflict do nothing;
