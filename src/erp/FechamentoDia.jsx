import React, { useState, useEffect, useCallback } from "react";
import { Banknote, Smartphone, CreditCard, BookUser, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { supabase } from "../supabaseClient";

const formatBRL = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatData = (d) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

const ICONES_PAG = { dinheiro: Banknote, pix: Smartphone, cartao: CreditCard, fiado: BookUser };
const LABELS_PAG = { dinheiro: "Dinheiro", pix: "Pix", cartao: "Cartão", fiado: "Fiado" };
const CORES_PAG = { dinheiro: "#2E7D4F", pix: "#1C5F8C", cartao: "#6B5B95", fiado: "#C99A3E" };

export default function FechamentoDia() {
  const [dados, setDados] = useState([]);
  const [dataSel, setDataSel] = useState(new Date().toISOString().slice(0, 10));
  const [carregando, setCarregando] = useState(true);
  const [vendas, setVendas] = useState([]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      // Totais por forma de pagamento no dia selecionado
      const { data: fechamento } = await supabase
        .from("vw_fechamento_caixa_diario")
        .select("*")
        .eq("dia", dataSel);

      // Vendas individuais do dia
      const { data: listaVendas } = await supabase
        .from("vendas")
        .select("id, forma_pagamento, valor_total, valor_recebido, criado_em, clientes(nome)")
        .eq("status", "concluida")
        .gte("criado_em", `${dataSel}T00:00:00`)
        .lte("criado_em", `${dataSel}T23:59:59`)
        .order("criado_em", { ascending: false });

      setDados(fechamento || []);
      setVendas(listaVendas || []);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }, [dataSel]);

  useEffect(() => { carregar(); }, [carregar]);

  const totalDia = dados.reduce((acc, r) => acc + Number(r.total), 0);
  const totalVendas = dados.reduce((acc, r) => acc + Number(r.qtd_vendas), 0);

  return (
    <div style={s.page}>
      <div style={s.pageHeader}>
        <div>
          <div style={s.pageTitle}>Fechamento do Dia</div>
          <div style={s.pageSub}>Resumo de vendas e formas de pagamento</div>
        </div>
        <div style={s.headerRight}>
          <input
            type="date"
            value={dataSel}
            onChange={(e) => setDataSel(e.target.value)}
            style={s.dateInput}
          />
          <button onClick={carregar} style={s.btnRefresh} title="Atualizar">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {carregando ? (
        <div style={s.loading}><Loader2 size={24} color={C.accent} style={{ animation: "spin 1s linear infinite" }} /></div>
      ) : (
        <>
          <div style={s.dataLabel}>{formatData(dataSel)}</div>

          {/* Cards de resumo */}
          <div style={s.cardsRow}>
            <div style={{ ...s.card, ...s.cardDestaque }}>
              <div style={s.cardLabel}>Total do dia</div>
              <div style={s.cardValorGrande}>{formatBRL(totalDia)}</div>
              <div style={s.cardSub}>{totalVendas} venda{totalVendas !== 1 ? "s" : ""} concluída{totalVendas !== 1 ? "s" : ""}</div>
            </div>

            {["dinheiro", "pix", "cartao", "fiado"].map((forma) => {
              const linha = dados.find((d) => d.forma_pagamento === forma);
              const Icon = ICONES_PAG[forma];
              return (
                <div key={forma} style={s.card}>
                  <div style={{ ...s.cardIconWrap, background: CORES_PAG[forma] + "18", color: CORES_PAG[forma] }}>
                    <Icon size={18} />
                  </div>
                  <div style={s.cardLabel}>{LABELS_PAG[forma]}</div>
                  <div style={{ ...s.cardValor, color: CORES_PAG[forma] }}>
                    {formatBRL(linha?.total || 0)}
                  </div>
                  <div style={s.cardSub}>{linha?.qtd_vendas || 0} venda{(linha?.qtd_vendas || 0) !== 1 ? "s" : ""}</div>
                </div>
              );
            })}
          </div>

          {/* Lista de vendas do dia */}
          <div style={s.section}>
            <div style={s.sectionTitle}>Vendas do dia</div>
            {vendas.length === 0 ? (
              <div style={s.empty}>Nenhuma venda registrada neste dia.</div>
            ) : (
              <div style={s.tabela}>
                <div style={s.tabelaHeader}>
                  <span style={{ flex: 1 }}>Horário</span>
                  <span style={{ flex: 2 }}>Cliente</span>
                  <span style={{ flex: 1 }}>Pagamento</span>
                  <span style={{ width: 110, textAlign: "right" }}>Valor</span>
                </div>
                {vendas.map((v) => {
                  const Icon = ICONES_PAG[v.forma_pagamento];
                  const hora = new Date(v.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={v.id} style={s.tabelaRow}>
                      <span style={{ flex: 1, color: C.textFaint, fontSize: 13 }}>{hora}</span>
                      <span style={{ flex: 2, fontWeight: 600, fontSize: 13.5 }}>
                        {v.clientes?.nome || "—"}
                      </span>
                      <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                        {Icon && <Icon size={14} color={CORES_PAG[v.forma_pagamento]} />}
                        {LABELS_PAG[v.forma_pagamento]}
                      </span>
                      <span style={{ width: 110, textAlign: "right", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14 }}>
                        {formatBRL(v.valor_total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const C = { bg: "#FFF", bgSubtle: "#F7F5F2", border: "#E2DED7", textMain: "#15120F", textFaint: "#8C8579", accent: "#1C5F8C" };
const s = {
  page: { padding: 28, display: "flex", flexDirection: "column", gap: 20, fontFamily: "'Inter', sans-serif" },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 },
  pageTitle: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: C.textMain },
  pageSub: { fontSize: 13, color: C.textFaint, marginTop: 2 },
  headerRight: { display: "flex", gap: 8, alignItems: "center" },
  dateInput: { background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: C.textMain, outline: "none", fontFamily: "'Inter', sans-serif" },
  btnRefresh: { display: "flex", alignItems: "center", justifyContent: "center", background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: 9, cursor: "pointer", color: C.textMain },
  loading: { display: "flex", justifyContent: "center", padding: 60 },
  dataLabel: { fontSize: 13, color: C.textFaint, textTransform: "capitalize" },
  cardsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 },
  card: { background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 },
  cardDestaque: { background: C.textMain, border: "none" },
  cardIconWrap: { width: 34, height: 34, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  cardLabel: { fontSize: 12, fontWeight: 600, color: C.textFaint },
  cardValorGrande: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700, color: "#FFF8F0", letterSpacing: "-0.02em" },
  cardValor: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700 },
  cardSub: { fontSize: 11.5, color: C.textFaint },
  section: { display: "flex", flexDirection: "column", gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: C.textMain },
  tabela: { background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 12, overflow: "hidden" },
  tabelaHeader: { display: "flex", gap: 12, padding: "10px 16px", background: C.bgSubtle, fontSize: 11.5, fontWeight: 700, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.04em" },
  tabelaRow: { display: "flex", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${C.border}`, alignItems: "center" },
  empty: { color: C.textFaint, fontSize: 13.5, padding: "20px 0" },
};
