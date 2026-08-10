import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, Search, X, ChevronRight, ChevronLeft, Check, Banknote, Smartphone, CreditCard, BookOpen, Calendar } from "lucide-react";
import { supabase } from "../supabaseClient";

const formatBRL = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDT = (d) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const formatData = (d) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

// ---------------------------------------------------------------------------
// Geração de caderneta em PDF — usa jsPDF via CDN
// ---------------------------------------------------------------------------
function injetarJsPDF() {
  if (window.jspdf) return Promise.resolve();
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

async function gerarCadernetaPDF({ cliente, vendas, periodo }) {
  await injetarJsPDF();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  let y = 15;

  const txt = (text, size = 10, align = "left", bold = false, color = [0,0,0]) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...color);
    const x = align === "center" ? W/2 : align === "right" ? W-15 : 15;
    doc.text(String(text), x, y, { align });
    y += size * 0.45 + 2;
  };
  const hr = (leve = false) => {
    doc.setDrawColor(leve ? 200 : 120);
    doc.line(15, y, W-15, y); y += 4;
  };
  const check = () => { if (y > 270) { doc.addPage(); y = 15; } };

  txt("AuroraMoon — Vizinho Mercearia", 16, "center", true);
  txt("CADERNETA DE FIADO", 13, "center", false, [28,95,140]);
  y += 2; hr();
  txt(`Cliente: ${cliente.nome}`, 12, "left", true);
  if (cliente.contato) txt(`Contato: ${cliente.contato}`, 10);
  txt(`Período: ${formatData(periodo.inicio)} a ${formatData(periodo.fim)}`, 10);
  txt(`Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, 10);
  y += 3; hr();

  let totalGeral = 0;

  vendas.forEach((v, idx) => {
    check();
    txt(`Compra ${idx + 1} — ${formatDT(v.criado_em)}`, 10, "left", true);
    y += 1;
    (v.itens || []).forEach((it) => {
      check();
      const qtdStr = it.pesavel ? `${Number(it.quantidade).toFixed(3)} kg` : `${it.quantidade}x`;
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(0,0,0);
      doc.text(`  ${it.nome_produto}`, 15, y);
      doc.text(qtdStr, 120, y);
      doc.text(formatBRL(it.subtotal), W-15, y, { align: "right" });
      y += 5;
    });
    check();
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(0,0,0);
    doc.text("Subtotal:", 15, y);
    doc.text(formatBRL(v.valor_total), W-15, y, { align: "right" });
    y += 5; totalGeral += Number(v.valor_total);
    hr(true);
  });

  check(); y += 2;
  doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(194,59,46);
  doc.text("TOTAL A PAGAR:", 15, y);
  doc.text(formatBRL(totalGeral), W-15, y, { align: "right" });
  y += 14;

  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100,100,100);
  doc.line(15, y, 100, y); y += 4;
  doc.text("Assinatura do cliente", 15, y);
  doc.line(120, y-4, W-15, y-4);
  doc.text("Assinatura do responsável", 120, y);

  doc.save(`caderneta-${cliente.nome.replace(/\s+/g, "-")}.pdf`);
}

export default function Fiado() {
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [clienteSel, setClienteSel] = useState(null);
  const [extrato, setExtrato] = useState([]);
  const [carregandoExtrato, setCarregandoExtrato] = useState(false);
  const [modalPag, setModalPag] = useState(false);
  const [valorPag, setValorPag] = useState("");
  const [formaPag, setFormaPag] = useState("dinheiro");
  const [salvando, setSalvando] = useState(false);

  // Caderneta
  const [modalCaderneta, setModalCaderneta] = useState(false);
  const [periodoInicio, setPeriodoInicio] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [periodoFim, setPeriodoFim] = useState(new Date().toISOString().slice(0, 10));
  const [gerandoCaderneta, setGerandoCaderneta] = useState(false);

  const carregarClientes = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await supabase
        .from("vw_saldo_clientes")
        .select("cliente_id, nome, contato, saldo_devedor")
        .order("nome");
      setClientes(data || []);
    } catch (err) { console.error(err); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { carregarClientes(); }, [carregarClientes]);

  async function abrirClienteHandler(c) {
    await abrirCliente(c);
  }

  async function handleGerarCaderneta() {
    if (!clienteSel) return;
    setGerandoCaderneta(true);
    try {
      // Busca todas as vendas de fiado do cliente no período
      const { data: vendas } = await supabase
        .from("vendas")
        .select("id, criado_em, valor_total, forma_pagamento")
        .eq("cliente_id", clienteSel.cliente_id)
        .eq("forma_pagamento", "fiado")
        .eq("status", "concluida")
        .gte("criado_em", `${periodoInicio}T00:00:00`)
        .lte("criado_em", `${periodoFim}T23:59:59`)
        .order("criado_em");

      if (!vendas || vendas.length === 0) {
        alert("Nenhuma compra no fiado encontrada neste período.");
        setGerandoCaderneta(false);
        return;
      }

      // Busca itens de cada venda
      const vendasComItens = await Promise.all(
        vendas.map(async (v) => {
          const { data: itens } = await supabase
            .from("itens_venda")
            .select("nome_produto, preco_unitario, quantidade, pesavel, subtotal")
            .eq("venda_id", v.id);
          return { ...v, itens: itens || [] };
        })
      );

      await gerarCadernetaPDF({
        cliente: { nome: clienteSel.nome, contato: clienteSel.contato },
        vendas: vendasComItens,
        periodo: { inicio: periodoInicio, fim: periodoFim },
      });

      setModalCaderneta(false);
    } catch (err) {
      console.error("Erro ao gerar caderneta:", err);
    } finally {
      setGerandoCaderneta(false);
    }
  }

  async function abrirCliente(c) {
    setClienteSel(c);
    setCarregandoExtrato(true);
    try {
      const { data } = await supabase
        .from("fiado_movimentos")
        .select("id, tipo, valor, forma_pagamento, observacao, criado_em")
        .eq("cliente_id", c.cliente_id)
        .order("criado_em", { ascending: false });
      setExtrato(data || []);
    } catch (err) { console.error(err); }
    finally { setCarregandoExtrato(false); }
  }

  async function registrarPagamento() {
    const valor = parseFloat(valorPag.replace(",", "."));
    if (isNaN(valor) || valor <= 0) return;
    setSalvando(true);
    try {
      await supabase.from("fiado_movimentos").insert({
        cliente_id: clienteSel.cliente_id,
        tipo: "pagamento",
        valor,
        forma_pagamento: formaPag,
        observacao: "Pagamento registrado via ERP",
      });
      setModalPag(false);
      setValorPag("");
      setFormaPag("dinheiro");
      await carregarClientes();
      // Recarrega extrato do cliente atualizado
      const clienteAtualizado = clientes.find((c) => c.cliente_id === clienteSel.cliente_id);
      if (clienteAtualizado) {
        const novoSaldo = clienteAtualizado.saldo_devedor - valor;
        setClienteSel({ ...clienteSel, saldo_devedor: novoSaldo });
      }
      await abrirCliente(clienteSel);
    } catch (err) { console.error(err); }
    finally { setSalvando(false); }
  }

  const clientesFiltrados = useMemo(() => {
    if (!busca.trim()) return clientes;
    return clientes.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase()));
  }, [clientes, busca]);

  const totalFiado = useMemo(() => clientes.reduce((acc, c) => acc + Number(c.saldo_devedor || 0), 0), [clientes]);

  if (clienteSel) {
    const saldo = clientes.find((c) => c.cliente_id === clienteSel.cliente_id)?.saldo_devedor ?? clienteSel.saldo_devedor;
    return (
      <div style={s.page}>
        <div style={s.pageHeader}>
          <button onClick={() => setClienteSel(null)} style={s.btnVoltar}>
            <ChevronLeft size={16} /> Voltar
          </button>
          <div style={{ flex: 1 }}>
            <div style={s.pageTitle}>{clienteSel.nome}</div>
            {clienteSel.contato && <div style={s.pageSub}>{clienteSel.contato}</div>}
          </div>
          <div style={s.saldoBox}>
            <div style={s.saldoLabel}>Saldo devedor</div>
            <div style={{ ...s.saldoValor, color: saldo > 0 ? C.red : C.green }}>{formatBRL(saldo)}</div>
          </div>
          {saldo > 0 && (
            <button onClick={() => setModalPag(true)} style={s.btnPagar}>
              <Check size={16} /> Registrar pagamento
            </button>
          )}
          <button onClick={() => setModalCaderneta(true)} style={s.btnCaderneta}>
            <BookOpen size={16} /> Gerar caderneta
          </button>
        </div>

        {carregandoExtrato ? (
          <div style={s.loading}><Loader2 size={24} color={C.accent} style={{ animation: "spin 1s linear infinite" }} /></div>
        ) : extrato.length === 0 ? (
          <div style={s.empty}>Nenhuma movimentação registrada.</div>
        ) : (
          <div style={s.tabela}>
            <div style={s.tabelaHeader}>
              <span style={{ flex: 1 }}>Data</span>
              <span style={{ flex: 1 }}>Tipo</span>
              <span style={{ flex: 1 }}>Forma</span>
              <span style={{ width: 120, textAlign: "right" }}>Valor</span>
            </div>
            {extrato.map((m) => (
              <div key={m.id} style={s.tabelaRow}>
                <span style={{ flex: 1, fontSize: 13, color: C.textFaint }}>{formatDT(m.criado_em)}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ ...s.tag, ...(m.tipo === "compra" ? s.tagCompra : s.tagPag) }}>
                    {m.tipo === "compra" ? "Compra" : "Pagamento"}
                  </span>
                </span>
                <span style={{ flex: 1, fontSize: 13, color: C.textFaint, textTransform: "capitalize" }}>
                  {m.forma_pagamento || "—"}
                </span>
                <span style={{ width: 120, textAlign: "right", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: m.tipo === "compra" ? C.red : C.green }}>
                  {m.tipo === "compra" ? "+" : "-"}{formatBRL(m.valor)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Modal de pagamento */}
        {modalPag && (
          <div style={s.overlay} onClick={() => setModalPag(false)}>
            <div style={s.modal} onClick={(e) => e.stopPropagation()}>
              <div style={s.modalTitulo}>Registrar pagamento</div>
              <div style={s.modalSub}>
                Saldo atual de <b>{clienteSel.nome}</b>: {formatBRL(saldo)}
              </div>
              <label style={s.label}>Valor recebido (R$)</label>
              <input
                autoFocus
                value={valorPag}
                onChange={(e) => setValorPag(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                style={s.modalInput}
                onKeyDown={(e) => { if (e.key === "Enter") registrarPagamento(); }}
              />
              <label style={s.label}>Forma de recebimento</label>
              <div style={s.payGrid}>
                {[["dinheiro", "Dinheiro", Banknote], ["pix", "Pix", Smartphone], ["cartao", "Cartão", CreditCard]].map(([val, label, Icon]) => (
                  <button key={val} onClick={() => setFormaPag(val)}
                    style={{ ...s.payBtn, ...(formaPag === val ? s.payBtnActive : {}) }}>
                    <Icon size={16} /> {label}
                  </button>
                ))}
              </div>
              {valorPag && !isNaN(parseFloat(valorPag.replace(",", "."))) && (
                <div style={s.novoSaldo}>
                  Novo saldo: <b>{formatBRL(Math.max(0, saldo - parseFloat(valorPag.replace(",", "."))))}</b>
                </div>
              )}
              <div style={s.modalBtns}>
                <button onClick={() => setModalPag(false)} style={s.btnCancelar}>Cancelar</button>
                <button onClick={registrarPagamento} disabled={salvando} style={s.btnConfirmar}>
                  {salvando ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={15} />}
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Modal de caderneta por período */}
        {modalCaderneta && (
          <div style={s.overlay} onClick={() => setModalCaderneta(false)}>
            <div style={s.modal} onClick={(e) => e.stopPropagation()}>
              <div style={s.modalTitulo}><BookOpen size={18} color={C.accent} /> Gerar caderneta</div>
              <div style={s.modalSub}>
                PDF consolidado de todas as compras no fiado de <b>{clienteSel.nome}</b> no período selecionado.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={s.label}>Data início</label>
                  <input type="date" value={periodoInicio}
                    onChange={(e) => setPeriodoInicio(e.target.value)}
                    style={s.dateInput} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={s.label}>Data fim</label>
                  <input type="date" value={periodoFim}
                    onChange={(e) => setPeriodoFim(e.target.value)}
                    style={s.dateInput} />
                </div>
              </div>
              <div style={s.modalBtns}>
                <button onClick={() => setModalCaderneta(false)} style={s.btnCancelar}>Cancelar</button>
                <button onClick={handleGerarCaderneta} disabled={gerandoCaderneta} style={s.btnConfirmar}>
                  {gerandoCaderneta
                    ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Gerando…</>
                    : <><BookOpen size={15} /> Gerar PDF</>}
                </button>
              </div>
            </div>
          </div>
        )}

        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.pageHeader}>
        <div>
          <div style={s.pageTitle}>Fiado</div>
          <div style={s.pageSub}>Extrato e pagamentos por cliente</div>
        </div>
        <div style={s.saldoBox}>
          <div style={s.saldoLabel}>Total em aberto</div>
          <div style={{ ...s.saldoValor, color: C.red }}>{formatBRL(totalFiado)}</div>
        </div>
      </div>

      <div style={s.searchWrap}>
        <Search size={16} color={C.textFaint} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente…" style={s.searchInput} />
        {busca && <button onClick={() => setBusca("")} style={s.clearBtn}><X size={14} /></button>}
      </div>

      {carregando ? (
        <div style={s.loading}><Loader2 size={24} color={C.accent} style={{ animation: "spin 1s linear infinite" }} /></div>
      ) : (
        <div style={s.tabela}>
          <div style={s.tabelaHeader}>
            <span style={{ flex: 1 }}>Cliente</span>
            <span style={{ flex: 1 }}>Contato</span>
            <span style={{ width: 140, textAlign: "right" }}>Saldo devedor</span>
            <span style={{ width: 40 }}></span>
          </div>
          {clientesFiltrados.map((c) => (
            <button key={c.cliente_id} onClick={() => abrirCliente(c)} style={s.clienteRow}>
              <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: C.textMain }}>{c.nome}</span>
              <span style={{ flex: 1, fontSize: 13, color: C.textFaint }}>{c.contato || "—"}</span>
              <span style={{ width: 140, textAlign: "right", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: c.saldo_devedor > 0 ? C.red : C.green }}>
                {formatBRL(c.saldo_devedor)}
              </span>
              <ChevronRight size={16} color={C.textFaint} style={{ width: 40 }} />
            </button>
          ))}
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const C = { bg: "#FFF", bgSubtle: "#F7F5F2", border: "#E2DED7", textMain: "#15120F", textFaint: "#8C8579", accent: "#1C5F8C", accentSoft: "#E8F0F6", red: "#C23B2E", green: "#2E7D4F" };
const s = {
  page: { padding: 28, display: "flex", flexDirection: "column", gap: 20, fontFamily: "'Inter', sans-serif", minHeight: "100%" },
  pageHeader: { display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" },
  pageTitle: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: C.textMain },
  pageSub: { fontSize: 13, color: C.textFaint, marginTop: 2 },
  btnVoltar: { display: "flex", alignItems: "center", gap: 6, background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, color: C.textMain, cursor: "pointer" },
  saldoBox: { marginLeft: "auto", textAlign: "right" },
  saldoLabel: { fontSize: 12, color: C.textFaint, fontWeight: 600 },
  saldoValor: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700 },
  btnPagar: { display: "flex", alignItems: "center", gap: 6, background: C.accent, color: "#FFF", border: "none", borderRadius: 9, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", cursor: "pointer" },
  btnCaderneta: { display: "flex", alignItems: "center", gap: 6, background: "#FFF", color: C.accent, border: `1.5px solid ${C.accent}`, borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  searchWrap: { display: "flex", alignItems: "center", gap: 8, background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 9, padding: "9px 12px" },
  searchInput: { flex: 1, background: "transparent", border: "none", outline: "none", color: C.textMain, fontSize: 13.5, fontFamily: "'Inter', sans-serif" },
  clearBtn: { background: "transparent", border: "none", color: C.textFaint, cursor: "pointer", padding: 0, display: "flex" },
  loading: { display: "flex", justifyContent: "center", padding: 60 },
  empty: { color: C.textFaint, fontSize: 13.5, padding: "20px 0" },
  tabela: { background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 12, overflow: "hidden" },
  tabelaHeader: { display: "flex", gap: 12, padding: "10px 16px", background: C.bgSubtle, fontSize: 11.5, fontWeight: 700, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.04em", alignItems: "center" },
  tabelaRow: { display: "flex", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${C.border}`, alignItems: "center" },
  clienteRow: { display: "flex", gap: 12, padding: "14px 16px", borderBottom: `1px solid ${C.border}`, alignItems: "center", width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${C.border}`, cursor: "pointer", textAlign: "left" },
  tag: { display: "inline-flex", borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 700 },
  tagCompra: { background: "#FDECEA", color: C.red },
  tagPag: { background: "#E7F4EC", color: C.green },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 },
  modal: { background: "#FFF", borderRadius: 14, padding: 24, width: 340, display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.18)" },
  modalTitulo: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: C.textMain },
  modalSub: { fontSize: 13, color: C.textFaint },
  label: { fontSize: 12, fontWeight: 700, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: 4 },
  dateInput: { background: C.bgSubtle, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.textMain, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "'Inter', sans-serif" },
  modalInput: { background: C.bgSubtle, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", color: C.textMain, fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, outline: "none", textAlign: "center" },
  payGrid: { display: "flex", gap: 8 },
  payBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", background: C.bgSubtle, border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 12.5, fontWeight: 700, color: C.textFaint, cursor: "pointer" },
  payBtnActive: { background: C.accentSoft, borderColor: C.accent, color: C.accent },
  novoSaldo: { fontSize: 13, color: C.textFaint },
  modalBtns: { display: "flex", gap: 8, marginTop: 4 },
  btnCancelar: { flex: 1, background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "10px", fontSize: 13.5, fontWeight: 700, color: C.textMain, cursor: "pointer" },
  btnConfirmar: { flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: C.accent, color: "#FFF", border: "none", borderRadius: 8, padding: "10px", fontSize: 13.5, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", cursor: "pointer" },
};
