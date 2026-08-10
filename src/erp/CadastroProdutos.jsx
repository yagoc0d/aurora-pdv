import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import {
  Search,
  Plus,
  Pencil,
  X,
  Check,
  Scale,
  Package,
  AlertTriangle,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  Loader2,
} from "lucide-react";
import { supabase } from "../supabaseClient";

const CATEGORIAS_PADRAO = [
  "Avulsos",
  "Bebidas",
  "Cesta básica",
  "Laticínios",
  "Limpeza",
  "Padaria",
];

const FORM_VAZIO = {
  nome: "",
  categoria: "",
  preco: "",
  unidade: "un",
  pesavel: false,
  codigo_barras: "",
  estoque_atual: "",
  estoque_minimo: "",
  ativo: true,
};

const formatBRL = (v) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ---------------------------------------------------------------------------
export default function CadastroProdutos() {
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroDB, setErroDB] = useState(null);

  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [filtroStatus, setFiltroStatus] = useState("ativos");
  const [painelAberto, setPainelAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [salvoId, setSalvoId] = useState(null);
  const nomeRef = useRef(null);

  useEffect(() => {
    if (painelAberto) nomeRef.current?.focus();
  }, [painelAberto]);

  // -------------------------------------------------------------------------
  // Carregar produtos do Supabase
  // -------------------------------------------------------------------------
  const carregarProdutos = useCallback(async () => {
    setCarregando(true);
    setErroDB(null);
    try {
      const { data, error } = await supabase
        .from("produtos")
        .select(
          "id, nome, categoria, preco, unidade, pesavel, codigo_barras, estoque_atual, estoque_minimo, ativo",
        )
        .order("nome");
      if (error) throw error;
      setProdutos(data || []);
    } catch (err) {
      setErroDB("Não foi possível carregar os produtos. Verifique a conexão.");
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarProdutos();
  }, [carregarProdutos]);

  // -------------------------------------------------------------------------
  // Filtros e derivações
  // -------------------------------------------------------------------------
  const categorias = useMemo(() => {
    const doProdutos = produtos.map((p) => p.categoria);
    return [...new Set([...CATEGORIAS_PADRAO, ...doProdutos])].sort();
  }, [produtos]);

  const produtosFiltrados = useMemo(() => {
    let lista = produtos;
    if (filtroStatus === "ativos") lista = lista.filter((p) => p.ativo);
    if (filtroStatus === "inativos") lista = lista.filter((p) => !p.ativo);
    if (filtroCategoria !== "Todas")
      lista = lista.filter((p) => p.categoria === filtroCategoria);
    if (busca.trim()) {
      const t = busca.toLowerCase();
      lista = lista.filter(
        (p) =>
          p.nome.toLowerCase().includes(t) ||
          p.categoria.toLowerCase().includes(t),
      );
    }
    return lista.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [produtos, busca, filtroCategoria, filtroStatus]);

  const abaixoDoMinimo = useMemo(
    () =>
      produtos.filter((p) => p.ativo && p.estoque_atual < p.estoque_minimo)
        .length,
    [produtos],
  );

  // -------------------------------------------------------------------------
  // Painel de formulário
  // -------------------------------------------------------------------------
  function abrirNovo() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setErros({});
    setPainelAberto(true);
  }

  function abrirEdicao(produto) {
    setEditandoId(produto.id);
    setForm({
      nome: produto.nome,
      categoria: produto.categoria,
      preco: String(produto.preco),
      unidade: produto.unidade,
      pesavel: produto.pesavel,
      codigo_barras: produto.codigo_barras || "",
      estoque_atual: String(produto.estoque_atual),
      estoque_minimo: String(produto.estoque_minimo),
      ativo: produto.ativo,
    });
    setErros({});
    setPainelAberto(true);
  }

  function fecharPainel() {
    setPainelAberto(false);
    setEditandoId(null);
    setErros({});
  }

  function setField(campo, valor) {
    setForm((f) => {
      const novo = { ...f, [campo]: valor };
      if (campo === "pesavel") novo.unidade = valor ? "kg" : "un";
      return novo;
    });
    setErros((e) => ({ ...e, [campo]: undefined }));
  }

  function validar() {
    const e = {};
    if (!form.nome.trim()) e.nome = "Nome é obrigatório";
    if (!form.categoria.trim()) e.categoria = "Categoria é obrigatória";
    const preco = parseFloat(form.preco.replace(",", "."));
    if (isNaN(preco) || preco < 0) e.preco = "Preço inválido";
    if (form.estoque_minimo !== "" && isNaN(parseFloat(form.estoque_minimo)))
      e.estoque_minimo = "Valor inválido";
    if (form.estoque_atual !== "" && isNaN(parseFloat(form.estoque_atual)))
      e.estoque_atual = "Valor inválido";
    return e;
  }

  // -------------------------------------------------------------------------
  // Salvar — INSERT ou UPDATE no Supabase
  // -------------------------------------------------------------------------
  async function salvar() {
    const e = validar();
    if (Object.keys(e).length > 0) {
      setErros(e);
      return;
    }

    setSalvando(true);
    const dados = {
      nome: form.nome.trim(),
      categoria: form.categoria.trim(),
      preco: parseFloat(form.preco.replace(",", ".")),
      unidade: form.unidade,
      pesavel: form.pesavel,
      codigo_barras: form.codigo_barras.trim() || null,
      estoque_atual:
        form.estoque_atual !== "" ? parseFloat(form.estoque_atual) : 0,
      estoque_minimo:
        form.estoque_minimo !== "" ? parseFloat(form.estoque_minimo) : 0,
      ativo: form.ativo,
    };

    try {
      if (editandoId) {
        const { error } = await supabase
          .from("produtos")
          .update(dados)
          .eq("id", editandoId);
        if (error) throw error;
        setSalvoId(editandoId);
      } else {
        const { data, error } = await supabase
          .from("produtos")
          .insert(dados)
          .select("id")
          .single();
        if (error) throw error;
        setSalvoId(data.id);
      }

      await carregarProdutos();
      setTimeout(() => setSalvoId(null), 1800);
      fecharPainel();
    } catch (err) {
      setErros({ _geral: "Erro ao salvar. Tente novamente." });
      console.error(err);
    } finally {
      setSalvando(false);
    }
  }

  // -------------------------------------------------------------------------
  // Toggle ativo/inativo direto na linha
  // -------------------------------------------------------------------------
  async function toggleAtivo(produto) {
    try {
      const { error } = await supabase
        .from("produtos")
        .update({ ativo: !produto.ativo })
        .eq("id", produto.id);
      if (error) throw error;
      setProdutos((prev) =>
        prev.map((p) => (p.id === produto.id ? { ...p, ativo: !p.ativo } : p)),
      );
    } catch (err) {
      console.error("Erro ao alterar status do produto:", err);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (carregando) {
    return (
      <div
        style={{
          ...s.app,
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <style>{fonts}</style>
        <Loader2
          size={28}
          color={C.accent}
          style={{ animation: "spin 1s linear infinite" }}
        />
        <span style={{ color: C.textFaint, fontSize: 14 }}>
          Carregando produtos…
        </span>
        <style>{`@keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  if (erroDB) {
    return (
      <div
        style={{
          ...s.app,
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: 40,
        }}
      >
        <style>{fonts}</style>
        <AlertTriangle size={28} color={C.gold} />
        <span style={{ color: C.textMain, fontSize: 14, fontWeight: 600 }}>
          {erroDB}
        </span>
        <button onClick={carregarProdutos} style={s.btnNovo}>
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div style={s.app}>
      <style>{fonts}</style>
      <style>{`@keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }`}</style>

      {/* HEADER */}
      <header style={s.header}>
        <div style={s.brand}>
          <LogoMark />
          <div>
            <div style={s.brandName}>AuroraMoon</div>
            <div style={s.brandSub}>
              Vizinho Mercearia · Cadastro de Produtos
            </div>
          </div>
        </div>
        <button onClick={abrirNovo} style={s.btnNovo}>
          <Plus size={16} /> Novo produto
        </button>
      </header>

      <div style={s.main}>
        <div style={s.leftCol}>
          {/* Alerta de estoque baixo — RF08 */}
          {abaixoDoMinimo > 0 && (
            <div style={s.alertaBaixo}>
              <AlertTriangle size={16} />
              <span>
                <b>
                  {abaixoDoMinimo}{" "}
                  {abaixoDoMinimo === 1 ? "produto" : "produtos"}
                </b>{" "}
                {abaixoDoMinimo === 1 ? "está abaixo" : "estão abaixo"} do
                estoque mínimo
              </span>
            </div>
          )}

          {/* Filtros */}
          <div style={s.filtrosRow}>
            <div style={s.searchWrap}>
              <Search size={17} color={C.textFaint} />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar produto…"
                style={s.searchInput}
              />
              {busca && (
                <button onClick={() => setBusca("")} style={s.clearBtn}>
                  <X size={14} />
                </button>
              )}
            </div>

            <div style={s.selectWrap}>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                style={s.select}
              >
                <option value="Todas">Todas as categorias</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} style={s.selectIcon} />
            </div>

            <div style={s.statusTabs}>
              {[
                ["ativos", "Ativos"],
                ["todos", "Todos"],
                ["inativos", "Inativos"],
              ].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFiltroStatus(val)}
                  style={{
                    ...s.statusTab,
                    ...(filtroStatus === val ? s.statusTabActive : {}),
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Cabeçalho da tabela */}
          <div style={s.tableHeader}>
            <span style={{ flex: "1 1 auto" }}>Produto</span>
            <span style={s.colPreco}>Preço</span>
            <span style={s.colEstoque}>Estoque</span>
            <span style={s.colAcoes}></span>
          </div>

          {/* Linhas */}
          <div style={s.tableBody}>
            {produtosFiltrados.length === 0 ? (
              <div style={s.empty}>
                <Package size={32} color={C.textFaint} />
                <div style={s.emptyTitle}>Nenhum produto encontrado</div>
                <div style={s.emptyText}>
                  Tente outra busca ou crie um novo produto.
                </div>
              </div>
            ) : (
              produtosFiltrados.map((p) => {
                const abaixo = p.estoque_atual < p.estoque_minimo;
                const foiSalvo = salvoId === p.id;
                return (
                  <div
                    key={p.id}
                    style={{
                      ...s.tableRow,
                      ...(foiSalvo ? s.tableRowSalvo : {}),
                      opacity: p.ativo ? 1 : 0.5,
                    }}
                  >
                    <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                      <div style={s.prodNome}>
                        {p.nome}
                        {p.pesavel && <Scale size={11} style={s.tagIcon} />}
                        {!p.ativo && <span style={s.tagInativo}>inativo</span>}
                      </div>
                      <div style={s.prodCat}>{p.categoria}</div>
                    </div>

                    <div style={s.colPreco}>
                      <span style={s.precoVal}>{formatBRL(p.preco)}</span>
                      <span style={s.precoUnit}>/{p.unidade}</span>
                    </div>

                    <div style={s.colEstoque}>
                      <span
                        style={{
                          ...s.estoqueVal,
                          ...(abaixo ? s.estoqueBaixo : {}),
                        }}
                      >
                        {p.estoque_atual}
                      </span>
                      <span style={s.estoqueMin}>/ mín {p.estoque_minimo}</span>
                      {abaixo && (
                        <AlertTriangle
                          size={12}
                          color={C.gold}
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </div>

                    <div style={s.colAcoes}>
                      <button
                        onClick={() => toggleAtivo(p)}
                        style={s.btnToggle}
                        title={p.ativo ? "Desativar" : "Ativar"}
                      >
                        {p.ativo ? (
                          <ToggleRight size={20} color={C.green} />
                        ) : (
                          <ToggleLeft size={20} color={C.textFaint} />
                        )}
                      </button>
                      <button
                        onClick={() => abrirEdicao(p)}
                        style={s.btnEditar}
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={s.rodape}>
            {produtosFiltrados.length} produto
            {produtosFiltrados.length !== 1 ? "s" : ""} exibido
            {produtosFiltrados.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* PAINEL DE FORMULÁRIO */}
        {painelAberto && (
          <div style={s.painel}>
            <div style={s.painelHeader}>
              <span style={s.painelTitulo}>
                {editandoId ? "Editar produto" : "Novo produto"}
              </span>
              <button onClick={fecharPainel} style={s.btnFechar}>
                <X size={18} />
              </button>
            </div>

            <div style={s.painelBody}>
              <Campo label="Nome do produto *" erro={erros.nome}>
                <input
                  ref={nomeRef}
                  value={form.nome}
                  onChange={(e) => setField("nome", e.target.value)}
                  placeholder="Ex: Arroz Tio João 5kg"
                  style={{ ...s.input, ...(erros.nome ? s.inputErro : {}) }}
                />
              </Campo>

              <Campo label="Categoria *" erro={erros.categoria}>
                <div style={s.selectWrapFull}>
                  <select
                    value={form.categoria}
                    onChange={(e) => setField("categoria", e.target.value)}
                    style={{
                      ...s.selectField,
                      ...(erros.categoria ? s.inputErro : {}),
                    }}
                  >
                    <option value="">Selecionar categoria…</option>
                    {categorias.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="__nova__">+ Nova categoria</option>
                  </select>
                  <ChevronDown size={14} style={s.selectIcon} />
                </div>
                {form.categoria === "__nova__" && (
                  <input
                    autoFocus
                    placeholder="Nome da nova categoria"
                    onChange={(e) => setField("categoria", e.target.value)}
                    style={{ ...s.input, marginTop: 6 }}
                  />
                )}
              </Campo>

              <div style={s.row2}>
                <Campo
                  label="Preço (R$) *"
                  erro={erros.preco}
                  style={{ flex: 1 }}
                >
                  <input
                    value={form.preco}
                    onChange={(e) => setField("preco", e.target.value)}
                    placeholder="0,00"
                    inputMode="decimal"
                    style={{ ...s.input, ...(erros.preco ? s.inputErro : {}) }}
                  />
                </Campo>
                <Campo label="Unidade" style={{ width: 100 }}>
                  <div style={s.selectWrapFull}>
                    <select
                      value={form.unidade}
                      onChange={(e) => setField("unidade", e.target.value)}
                      style={s.selectField}
                      disabled={form.pesavel}
                    >
                      <option value="un">un</option>
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="l">l</option>
                      <option value="ml">ml</option>
                    </select>
                    <ChevronDown size={14} style={s.selectIcon} />
                  </div>
                </Campo>
              </div>

              <div
                style={s.toggleRow}
                onClick={() => setField("pesavel", !form.pesavel)}
              >
                <div>
                  <div style={s.toggleLabel}>Produto pesável em balança</div>
                  <div style={s.toggleDesc}>
                    Pedirá peso manual em kg ao vender (RF02)
                  </div>
                </div>
                {form.pesavel ? (
                  <ToggleRight size={26} color={C.accent} />
                ) : (
                  <ToggleLeft size={26} color={C.textFaint} />
                )}
              </div>

              <Campo label="Código de barras (opcional)">
                <input
                  value={form.codigo_barras}
                  onChange={(e) => setField("codigo_barras", e.target.value)}
                  placeholder="Ex: 7891234560001"
                  inputMode="numeric"
                  style={s.input}
                />
              </Campo>

              <div style={s.divisor} />

              <div style={s.row2}>
                <Campo
                  label="Estoque inicial"
                  erro={erros.estoque_atual}
                  style={{ flex: 1 }}
                >
                  <input
                    value={form.estoque_atual}
                    onChange={(e) => setField("estoque_atual", e.target.value)}
                    placeholder="0"
                    inputMode="decimal"
                    style={{
                      ...s.input,
                      ...(erros.estoque_atual ? s.inputErro : {}),
                    }}
                  />
                </Campo>
                <Campo
                  label="Estoque mínimo"
                  erro={erros.estoque_minimo}
                  style={{ flex: 1 }}
                >
                  <input
                    value={form.estoque_minimo}
                    onChange={(e) => setField("estoque_minimo", e.target.value)}
                    placeholder="0"
                    inputMode="decimal"
                    style={{
                      ...s.input,
                      ...(erros.estoque_minimo ? s.inputErro : {}),
                    }}
                  />
                </Campo>
              </div>
              <div style={s.estoqueHint}>
                Quando abaixo do mínimo, o produto aparece na lista de
                reposição.
              </div>

              <div style={s.divisor} />

              <div
                style={s.toggleRow}
                onClick={() => setField("ativo", !form.ativo)}
              >
                <div>
                  <div style={s.toggleLabel}>Produto ativo</div>
                  <div style={s.toggleDesc}>
                    Produtos inativos não aparecem no PDV
                  </div>
                </div>
                {form.ativo ? (
                  <ToggleRight size={26} color={C.green} />
                ) : (
                  <ToggleLeft size={26} color={C.textFaint} />
                )}
              </div>

              {erros._geral && (
                <div
                  style={{
                    fontSize: 12.5,
                    color: C.red,
                    fontWeight: 600,
                    background: "#FDECEA",
                    borderRadius: 8,
                    padding: "8px 10px",
                  }}
                >
                  {erros._geral}
                </div>
              )}
            </div>

            <div style={s.painelFooter}>
              <button
                onClick={fecharPainel}
                style={s.btnCancelar}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button onClick={salvar} style={s.btnSalvar} disabled={salvando}>
                {salvando ? (
                  <>
                    <Loader2
                      size={16}
                      style={{ animation: "spin 1s linear infinite" }}
                    />{" "}
                    Salvando…
                  </>
                ) : (
                  <>
                    <Check size={16} />{" "}
                    {editandoId ? "Salvar alterações" : "Cadastrar produto"}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Campo({ label, erro, children, style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, ...style }}>
      <label style={s.label}>{label}</label>
      {children}
      {erro && <span style={s.erroText}>{erro}</span>}
    </div>
  );
}

function LogoMark() {
  return (
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none">
      <g stroke={C.accent} strokeWidth="3.5" strokeLinecap="round">
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={50 + Math.cos(angle) * 34}
              y1={50 + Math.sin(angle) * 34}
              x2={50 + Math.cos(angle) * 44}
              y2={50 + Math.sin(angle) * 44}
            />
          );
        })}
      </g>
      <circle
        cx="50"
        cy="50"
        r="26"
        fill="#FFF"
        stroke={C.accent}
        strokeWidth="3"
      />
      <path
        d="M 62 30 A 22 22 0 1 0 62 70 A 17 17 0 1 1 62 30 Z"
        fill={C.violet}
      />
    </svg>
  );
}

const fonts = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');`;

const C = {
  bg: "#FFFFFF",
  bgSubtle: "#F7F5F2",
  border: "#E2DED7",
  textMain: "#15120F",
  textFaint: "#8C8579",
  accent: "#1C5F8C",
  accentSoft: "#E8F0F6",
  violet: "#6B5B95",
  gold: "#C99A3E",
  goldSoft: "#FDF6E7",
  green: "#2E7D4F",
  greenSoft: "#E7F4EC",
  red: "#C23B2E",
};

const s = {
  app: {
    fontFamily: "'Inter', sans-serif",
    background: C.bg,
    color: C.textMain,
    minHeight: "640px",
    display: "flex",
    flexDirection: "column",
    borderRadius: 16,
    overflow: "hidden",
    border: `1px solid ${C.border}`,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 24px",
    borderBottom: `1px solid ${C.border}`,
    background: C.bgSubtle,
  },
  brand: { display: "flex", alignItems: "center", gap: 12 },
  brandName: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 700,
    fontSize: 18,
    color: C.accent,
  },
  brandSub: { fontSize: 12, color: C.textFaint },
  btnNovo: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: C.accent,
    color: "#FFF",
    border: "none",
    borderRadius: 9,
    padding: "9px 16px",
    fontSize: 13.5,
    fontWeight: 700,
    fontFamily: "'Space Grotesk', sans-serif",
    cursor: "pointer",
  },
  main: { display: "flex", flex: 1, minHeight: 0 },
  leftCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: 20,
    gap: 12,
    minWidth: 0,
    overflowY: "auto",
  },
  alertaBaixo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: C.goldSoft,
    border: `1px solid ${C.gold}66`,
    borderRadius: 9,
    padding: "10px 14px",
    fontSize: 13,
    color: C.textMain,
    fontWeight: 500,
  },
  filtrosRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  searchWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: C.bgSubtle,
    border: `1.5px solid ${C.border}`,
    borderRadius: 9,
    padding: "9px 12px",
    flex: "1 1 180px",
  },
  searchInput: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: C.textMain,
    fontSize: 13.5,
    fontFamily: "'Inter', sans-serif",
  },
  clearBtn: {
    background: "transparent",
    border: "none",
    color: C.textFaint,
    cursor: "pointer",
    padding: 0,
    display: "flex",
  },
  selectWrap: { position: "relative", display: "flex", alignItems: "center" },
  selectWrapFull: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  select: {
    appearance: "none",
    background: C.bgSubtle,
    border: `1.5px solid ${C.border}`,
    borderRadius: 9,
    padding: "9px 32px 9px 12px",
    fontSize: 13,
    color: C.textMain,
    fontFamily: "'Inter', sans-serif",
    cursor: "pointer",
    outline: "none",
  },
  selectField: {
    appearance: "none",
    background: C.bgSubtle,
    border: `1.5px solid ${C.border}`,
    borderRadius: 8,
    padding: "10px 32px 10px 12px",
    fontSize: 13.5,
    color: C.textMain,
    fontFamily: "'Inter', sans-serif",
    cursor: "pointer",
    outline: "none",
    width: "100%",
  },
  selectIcon: {
    position: "absolute",
    right: 10,
    pointerEvents: "none",
    color: C.textFaint,
  },
  statusTabs: {
    display: "flex",
    gap: 2,
    background: C.bgSubtle,
    border: `1.5px solid ${C.border}`,
    borderRadius: 9,
    padding: 3,
  },
  statusTab: {
    background: "transparent",
    border: "none",
    borderRadius: 7,
    padding: "6px 12px",
    fontSize: 12.5,
    fontWeight: 600,
    color: C.textFaint,
    cursor: "pointer",
  },
  statusTabActive: {
    background: "#FFF",
    color: C.textMain,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  tableHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 14px",
    fontSize: 11.5,
    fontWeight: 700,
    color: C.textFaint,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: C.bgSubtle,
    borderRadius: 9,
    border: `1px solid ${C.border}`,
  },
  colPreco: { width: 100, textAlign: "right", flexShrink: 0 },
  colEstoque: {
    width: 130,
    textAlign: "right",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  colAcoes: {
    width: 72,
    flexShrink: 0,
    display: "flex",
    gap: 4,
    justifyContent: "flex-end",
  },
  tableBody: {
    flex: 1,
    border: `1.5px solid ${C.border}`,
    borderRadius: 10,
    overflow: "hidden",
  },
  tableRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderBottom: `1px solid ${C.border}`,
    background: "#FFF",
  },
  tableRowSalvo: { background: C.greenSoft },
  prodNome: {
    fontSize: 14,
    fontWeight: 700,
    color: C.textMain,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  prodCat: { fontSize: 12, color: C.textFaint, marginTop: 2 },
  tagIcon: { color: C.textFaint },
  tagInativo: {
    fontSize: 10,
    fontWeight: 700,
    background: C.bgSubtle,
    color: C.textFaint,
    borderRadius: 4,
    padding: "1px 5px",
  },
  precoVal: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 13.5,
    fontWeight: 700,
    color: C.textMain,
  },
  precoUnit: { fontSize: 11, color: C.textFaint, marginLeft: 2 },
  estoqueVal: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 13.5,
    fontWeight: 700,
    color: C.textMain,
  },
  estoqueBaixo: { color: C.gold },
  estoqueMin: { fontSize: 11, color: C.textFaint, marginLeft: 4 },
  btnToggle: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 2,
    display: "flex",
  },
  btnEditar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: C.bgSubtle,
    border: `1px solid ${C.border}`,
    borderRadius: 7,
    padding: "6px",
    color: C.textMain,
    cursor: "pointer",
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 48,
  },
  emptyTitle: { fontSize: 14, fontWeight: 700, color: C.textMain },
  emptyText: { fontSize: 12.5, color: C.textFaint },
  rodape: { fontSize: 12, color: C.textFaint, textAlign: "right" },
  painel: {
    width: 340,
    flexShrink: 0,
    borderLeft: `1.5px solid ${C.border}`,
    display: "flex",
    flexDirection: "column",
    background: "#FFF",
  },
  painelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: `1px solid ${C.border}`,
    background: C.bgSubtle,
  },
  painelTitulo: { fontSize: 15, fontWeight: 700, color: C.textMain },
  btnFechar: {
    background: "transparent",
    border: "none",
    color: C.textFaint,
    cursor: "pointer",
    display: "flex",
  },
  painelBody: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: C.textFaint,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  input: {
    background: C.bgSubtle,
    border: `1.5px solid ${C.border}`,
    borderRadius: 8,
    padding: "10px 12px",
    color: C.textMain,
    fontSize: 14,
    fontFamily: "'Inter', sans-serif",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  inputErro: { borderColor: C.red, background: "#FDECEA" },
  erroText: { fontSize: 12, color: C.red, fontWeight: 500 },
  row2: { display: "flex", gap: 10 },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: C.bgSubtle,
    border: `1.5px solid ${C.border}`,
    borderRadius: 9,
    padding: "12px 14px",
    cursor: "pointer",
  },
  toggleLabel: { fontSize: 13.5, fontWeight: 700, color: C.textMain },
  toggleDesc: { fontSize: 11.5, color: C.textFaint, marginTop: 2 },
  divisor: { height: 1, background: C.border },
  estoqueHint: {
    fontSize: 12,
    color: C.textFaint,
    background: C.bgSubtle,
    borderRadius: 7,
    padding: "8px 10px",
    marginTop: -6,
  },
  painelFooter: {
    display: "flex",
    gap: 10,
    padding: "14px 20px",
    borderTop: `1px solid ${C.border}`,
    background: C.bgSubtle,
  },
  btnCancelar: {
    flex: 1,
    background: "#FFF",
    border: `1.5px solid ${C.border}`,
    borderRadius: 8,
    padding: "10px",
    fontSize: 13.5,
    fontWeight: 700,
    color: C.textMain,
    cursor: "pointer",
  },
  btnSalvar: {
    flex: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: C.accent,
    color: "#FFF",
    border: "none",
    borderRadius: 8,
    padding: "10px",
    fontSize: 13.5,
    fontWeight: 700,
    fontFamily: "'Space Grotesk', sans-serif",
    cursor: "pointer",
  },
};
