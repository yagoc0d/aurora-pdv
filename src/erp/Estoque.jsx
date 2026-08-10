import React, { useState, useEffect, useCallback, useMemo } from "react";
import { AlertTriangle, Loader2, RefreshCw, Search, ClipboardList, X, Check } from "lucide-react";
import { supabase } from "../supabaseClient";

const formatNum = (v, dec = 0) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export default function Estoque() {
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos"); // todos | baixo | ok
  const [modalContagem, setModalContagem] = useState(null);
  const [contagens, setContagens] = useState({}); // { produtoId: valorDigitado }
  const [salvandoContagem, setSalvandoContagem] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await supabase
        .from("produtos")
        .select("id, nome, categoria, unidade, pesavel, estoque_atual, estoque_minimo, ativo")
        .eq("ativo", true)
        .order("nome");
      setProdutos(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const produtosFiltrados = useMemo(() => {
    let lista = produtos;
    if (filtro === "baixo") lista = lista.filter((p) => p.estoque_atual < p.estoque_minimo);
    if (filtro === "ok") lista = lista.filter((p) => p.estoque_atual >= p.estoque_minimo);
    if (busca.trim()) {
      const t = busca.toLowerCase();
      lista = lista.filter((p) => p.nome.toLowerCase().includes(t) || p.categoria.toLowerCase().includes(t));
    }
    return lista;
  }, [produtos, filtro, busca]);

  const totalBaixo = useMemo(() => produtos.filter((p) => p.estoque_atual < p.estoque_minimo).length, [produtos]);

  async function salvarContagem(produto) {
    const val = contagens[produto.id];
    if (val === undefined || val === "") return;
    const contado = parseFloat(String(val).replace(",", "."));
    if (isNaN(contado)) return;

    setSalvandoContagem(true);
    try {
      await supabase.from("contagens_estoque").insert({
        produto_id: produto.id,
        estoque_sistema: produto.estoque_atual,
        estoque_contado: contado,
        observacao: "Contagem manual via ERP",
      });
      // Atualiza estoque_atual com o valor contado
      await supabase.from("produtos").update({ estoque_atual: contado }).eq("id", produto.id);
      await carregar();
      setModalContagem(null);
      setContagens({});
    } catch (err) {
      console.error(err);
    } finally {
      setSalvandoContagem(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.pageHeader}>
        <div>
          <div style={s.pageTitle}>Estoque</div>
          <div style={s.pageSub}>Posição atual, alertas e contagem física</div>
        </div>
        <button onClick={carregar} style={s.btnRefresh}><RefreshCw size={16} /></button>
      </div>

      {totalBaixo > 0 && (
        <div style={s.alerta}>
          <AlertTriangle size={16} />
          <span><b>{totalBaixo} produto{totalBaixo !== 1 ? "s" : ""}</b> abaixo do estoque mínimo — precisam de reposição</span>
        </div>
      )}

      <div style={s.filtrosRow}>
        <div style={s.searchWrap}>
          <Search size={16} color={C.textFaint} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto…" style={s.searchInput} />
          {busca && <button onClick={() => setBusca("")} style={s.clearBtn}><X size={14} /></button>}
        </div>
        <div style={s.tabs}>
          {[["todos", "Todos"], ["baixo", "⚠ Abaixo do mínimo"], ["ok", "OK"]].map(([val, label]) => (
            <button key={val} onClick={() => setFiltro(val)} style={{ ...s.tab, ...(filtro === val ? s.tabActive : {}) }}>{label}</button>
          ))}
        </div>
      </div>

      {carregando ? (
        <div style={s.loading}><Loader2 size={24} color={C.accent} style={{ animation: "spin 1s linear infinite" }} /></div>
      ) : (
        <div style={s.tabela}>
          <div style={s.tabelaHeader}>
            <span style={{ flex: 1 }}>Produto</span>
            <span style={{ width: 90, textAlign: "right" }}>Atual</span>
            <span style={{ width: 90, textAlign: "right" }}>Mínimo</span>
            <span style={{ width: 110, textAlign: "right" }}>Situação</span>
            <span style={{ width: 90, textAlign: "center" }}>Contagem</span>
          </div>
          {produtosFiltrados.length === 0 ? (
            <div style={s.empty}>Nenhum produto encontrado.</div>
          ) : (
            produtosFiltrados.map((p) => {
              const abaixo = p.estoque_atual < p.estoque_minimo;
              const diff = p.estoque_atual - p.estoque_minimo;
              return (
                <div key={p.id} style={s.tabelaRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.prodNome}>{p.nome}</div>
                    <div style={s.prodCat}>{p.categoria}</div>
                  </div>
                  <span style={{ width: 90, textAlign: "right", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: abaixo ? C.gold : C.textMain }}>
                    {formatNum(p.estoque_atual, p.pesavel ? 3 : 0)} {p.unidade}
                  </span>
                  <span style={{ width: 90, textAlign: "right", fontSize: 13, color: C.textFaint }}>
                    {formatNum(p.estoque_minimo, p.pesavel ? 3 : 0)} {p.unidade}
                  </span>
                  <span style={{ width: 110, textAlign: "right" }}>
                    {abaixo ? (
                      <span style={s.tagBaixo}><AlertTriangle size={11} /> Repor {formatNum(Math.abs(diff), p.pesavel ? 2 : 0)}</span>
                    ) : (
                      <span style={s.tagOk}>OK</span>
                    )}
                  </span>
                  <span style={{ width: 90, textAlign: "center" }}>
                    <button onClick={() => setModalContagem(p)} style={s.btnContagem} title="Registrar contagem física">
                      <ClipboardList size={15} />
                    </button>
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal de contagem física */}
      {modalContagem && (
        <div style={s.overlay} onClick={() => setModalContagem(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <ClipboardList size={18} color={C.accent} />
              <span style={s.modalTitulo}>Contagem física</span>
              <button onClick={() => setModalContagem(null)} style={s.modalClose}><X size={16} /></button>
            </div>
            <div style={s.modalProdNome}>{modalContagem.nome}</div>
            <div style={s.modalInfo}>
              Sistema registra: <b>{formatNum(modalContagem.estoque_atual, modalContagem.pesavel ? 3 : 0)} {modalContagem.unidade}</b>
            </div>
            <label style={s.modalLabel}>Quantidade contada fisicamente</label>
            <input
              autoFocus
              value={contagens[modalContagem.id] ?? ""}
              onChange={(e) => setContagens((prev) => ({ ...prev, [modalContagem.id]: e.target.value }))}
              placeholder={`0${modalContagem.pesavel ? ",000" : ""}`}
              inputMode="decimal"
              style={s.modalInput}
              onKeyDown={(e) => { if (e.key === "Enter") salvarContagem(modalContagem); }}
            />
            {contagens[modalContagem.id] !== undefined && contagens[modalContagem.id] !== "" && (() => {
              const contado = parseFloat(String(contagens[modalContagem.id]).replace(",", "."));
              const diff = contado - modalContagem.estoque_atual;
              if (isNaN(diff)) return null;
              return (
                <div style={{ ...s.modalDiff, color: diff < 0 ? C.red : diff > 0 ? C.green : C.textFaint }}>
                  Divergência: {diff > 0 ? "+" : ""}{formatNum(diff, modalContagem.pesavel ? 3 : 0)} {modalContagem.unidade}
                  {diff < 0 && " (possível perda ou furto)"}
                </div>
              );
            })()}
            <button
              onClick={() => salvarContagem(modalContagem)}
              disabled={salvandoContagem}
              style={s.modalBtn}
            >
              {salvandoContagem ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={16} />}
              Confirmar contagem e atualizar estoque
            </button>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const C = { bg: "#FFF", bgSubtle: "#F7F5F2", border: "#E2DED7", textMain: "#15120F", textFaint: "#8C8579", accent: "#1C5F8C", gold: "#C99A3E", green: "#2E7D4F", red: "#C23B2E" };
const s = {
  page: { padding: 28, display: "flex", flexDirection: "column", gap: 20, fontFamily: "'Inter', sans-serif" },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  pageTitle: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: C.textMain },
  pageSub: { fontSize: 13, color: C.textFaint, marginTop: 2 },
  btnRefresh: { display: "flex", alignItems: "center", justifyContent: "center", background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: 9, cursor: "pointer", color: C.textMain },
  alerta: { display: "flex", alignItems: "center", gap: 8, background: "#FDF6E7", border: `1px solid #C99A3E66`, borderRadius: 9, padding: "10px 14px", fontSize: 13, color: C.textMain, fontWeight: 500 },
  filtrosRow: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  searchWrap: { display: "flex", alignItems: "center", gap: 8, background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 9, padding: "9px 12px", flex: "1 1 180px" },
  searchInput: { flex: 1, background: "transparent", border: "none", outline: "none", color: C.textMain, fontSize: 13.5, fontFamily: "'Inter', sans-serif" },
  clearBtn: { background: "transparent", border: "none", color: C.textFaint, cursor: "pointer", padding: 0, display: "flex" },
  tabs: { display: "flex", gap: 2, background: C.bgSubtle, border: `1.5px solid ${C.border}`, borderRadius: 9, padding: 3 },
  tab: { background: "transparent", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, color: C.textFaint, cursor: "pointer" },
  tabActive: { background: "#FFF", color: C.textMain, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  loading: { display: "flex", justifyContent: "center", padding: 60 },
  tabela: { background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 12, overflow: "hidden" },
  tabelaHeader: { display: "flex", gap: 12, padding: "10px 16px", background: C.bgSubtle, fontSize: 11.5, fontWeight: 700, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.04em" },
  tabelaRow: { display: "flex", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${C.border}`, alignItems: "center" },
  prodNome: { fontSize: 14, fontWeight: 700, color: C.textMain },
  prodCat: { fontSize: 11.5, color: C.textFaint, marginTop: 2 },
  tagBaixo: { display: "inline-flex", alignItems: "center", gap: 4, background: "#FDF6E7", color: C.gold, fontSize: 11.5, fontWeight: 700, borderRadius: 6, padding: "3px 7px", border: `1px solid #C99A3E44` },
  tagOk: { display: "inline-flex", alignItems: "center", background: "#E7F4EC", color: C.green, fontSize: 11.5, fontWeight: 700, borderRadius: 6, padding: "3px 10px" },
  btnContagem: { display: "inline-flex", alignItems: "center", justifyContent: "center", background: C.bgSubtle, border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 8px", cursor: "pointer", color: C.textMain },
  empty: { color: C.textFaint, fontSize: 13.5, padding: 24, textAlign: "center" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 },
  modal: { background: "#FFF", borderRadius: 14, padding: 24, width: 360, display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.18)" },
  modalHeader: { display: "flex", alignItems: "center", gap: 8 },
  modalTitulo: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, flex: 1, color: C.textMain },
  modalClose: { background: "transparent", border: "none", color: C.textFaint, cursor: "pointer", display: "flex" },
  modalProdNome: { fontSize: 14.5, fontWeight: 700, color: C.textMain },
  modalInfo: { fontSize: 13, color: C.textFaint },
  modalLabel: { fontSize: 12, fontWeight: 700, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.04em" },
  modalInput: { background: C.bgSubtle, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", color: C.textMain, fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, outline: "none", textAlign: "center" },
  modalDiff: { fontSize: 13, fontWeight: 600 },
  modalBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: C.accent, color: "#FFF", border: "none", borderRadius: 9, padding: "12px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" },
};
