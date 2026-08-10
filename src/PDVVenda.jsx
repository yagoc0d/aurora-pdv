import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Search, X, Plus, Minus, Scale, Banknote, Smartphone,
  CreditCard, BookUser, Trash2, Check, Loader2, AlertTriangle,
  Sun, Moon, FileText, Receipt
} from "lucide-react";
import { supabase } from "./supabaseClient";

const formatBRL = (v) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDT = (d) =>
  new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

// ---------------------------------------------------------------------------
// GERAÇÃO DE CUPOM PDF — usa jsPDF via CDN (injetado uma vez no <head>)
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

async function gerarCupomPDF({ venda, itens, cliente, download = true }) {
  await injetarJsPDF();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: [80, 200], orientation: "portrait" });

  const W = 80;
  let y = 8;
  const line = (txt, size = 8, align = "left", bold = false) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const x = align === "center" ? W / 2 : align === "right" ? W - 5 : 5;
    doc.text(txt, x, y, { align });
    y += size * 0.45 + 1.5;
  };
  const hr = () => { doc.setDrawColor(180); doc.line(5, y, W - 5, y); y += 3; };

  // Cabeçalho
  line("AuroraMoon", 13, "center", true);
  line("Vizinho Mercearia", 8, "center");
  hr();
  line(`Data: ${formatDT(venda.criado_em)}`, 7);
  line(`Nº: ${venda.id.slice(0, 8).toUpperCase()}`, 7);
  if (cliente) line(`Cliente: ${cliente}`, 7);
  hr();

  // Itens
  line("ITENS", 7, "left", true);
  y += 1;
  itens.forEach((it) => {
    const qtdStr = it.pesavel
      ? `${it.quantidade.toFixed(3)} kg x ${formatBRL(it.preco_unitario)}/kg`
      : `${it.quantidade}x ${formatBRL(it.preco_unitario)}`;
    const sub = formatBRL(it.subtotal);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(it.nome_produto, 5, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(qtdStr, 7, y);
    doc.text(sub, W - 5, y, { align: "right" });
    y += 5;
  });

  hr();
  line(`TOTAL: ${formatBRL(venda.valor_total)}`, 10, "right", true);

  const LABELS = { dinheiro: "Dinheiro", pix: "Pix", cartao: "Cartão", fiado: "Fiado" };
  line(`Pagamento: ${LABELS[venda.forma_pagamento] || venda.forma_pagamento}`, 7);

  if (venda.valor_recebido) {
    line(`Recebido: ${formatBRL(venda.valor_recebido)}`, 7);
    line(`Troco: ${formatBRL(venda.valor_recebido - venda.valor_total)}`, 7);
  }

  if (venda.forma_pagamento === "fiado" && cliente) {
    y += 8;
    hr();
    line("Assinatura do cliente:", 7);
    y += 10;
    doc.line(5, y, W - 5, y);
    y += 4;
    line(cliente, 7, "center");
  }

  y += 4;
  hr();
  line("Obrigado pela preferência!", 7, "center");

  const nome = `cupom-${venda.id.slice(0, 8)}.pdf`;
  if (download) {
    doc.save(nome);
  }
  return doc.output("blob");
}

// Gera PDF consolidado de caderneta (múltiplas vendas)
async function gerarCaderneta({ cliente, vendas, periodo }) {
  await injetarJsPDF();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const W = 210;
  let y = 15;
  const line = (txt, size = 10, align = "left", bold = false, color = [0,0,0]) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...color);
    const x = align === "center" ? W / 2 : align === "right" ? W - 15 : 15;
    doc.text(txt, x, y, { align });
    y += size * 0.45 + 2;
  };
  const hr = (leve = false) => {
    doc.setDrawColor(leve ? 200 : 100);
    doc.line(15, y, W - 15, y);
    y += 4;
  };
  const checkPage = () => {
    if (y > 270) { doc.addPage(); y = 15; }
  };

  // Capa
  line("AuroraMoon — Vizinho Mercearia", 16, "center", true);
  line("CADERNETA DE FIADO", 13, "center", false, [28, 95, 140]);
  y += 2; hr();
  line(`Cliente: ${cliente.nome}`, 12, "left", true);
  if (cliente.contato) line(`Contato: ${cliente.contato}`, 10);
  line(`Período: ${periodo.inicio} a ${periodo.fim}`, 10);
  line(`Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, 10);
  y += 3; hr();

  let totalGeral = 0;

  vendas.forEach((v, idx) => {
    checkPage();
    line(`Compra ${idx + 1} — ${formatDT(v.criado_em)}`, 10, "left", true);
    y += 1;

    (v.itens || []).forEach((it) => {
      checkPage();
      const qtdStr = it.pesavel
        ? `${it.quantidade.toFixed(3)} kg`
        : `${it.quantidade}x`;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(`  ${it.nome_produto}`, 15, y);
      doc.text(qtdStr, 120, y);
      doc.text(formatBRL(it.subtotal), W - 15, y, { align: "right" });
      y += 5;
    });

    checkPage();
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(`Subtotal desta compra:`, 15, y);
    doc.text(formatBRL(v.valor_total), W - 15, y, { align: "right" });
    y += 5;
    totalGeral += Number(v.valor_total);
    hr(true);
  });

  checkPage();
  y += 2;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(194, 59, 46);
  doc.text("TOTAL A PAGAR:", 15, y);
  doc.text(formatBRL(totalGeral), W - 15, y, { align: "right" });
  y += 12;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.line(15, y, 100, y);
  y += 4;
  doc.text("Assinatura do cliente", 15, y);
  doc.line(120, y - 4, W - 15, y - 4);
  doc.text("Assinatura do responsável", 120, y);

  doc.save(`caderneta-${cliente.nome.replace(/\s+/g, "-")}.pdf`);
}

// ---------------------------------------------------------------------------
export default function PDVVenda() {
  const [produtos, setProdutos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroDB, setErroDB] = useState(null);

  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState([]);
  const [modalPeso, setModalPeso] = useState(null);
  const [itemFocoId, setItemFocoId] = useState(null);
  const [pagamento, setPagamento] = useState(null);
  const [clienteFiado, setClienteFiado] = useState(null);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [valorRecebido, setValorRecebido] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [vendaFinalizada, setVendaFinalizada] = useState(false);
  const [erroVenda, setErroVenda] = useState(null);

  // Controle do dia
  const [diaCaixa, setDiaCaixa] = useState(null); // registro do dia_caixa atual
  const [statusDia, setStatusDia] = useState("fechado"); // "fechado" | "aberto" | "confirmandoFechar"
  const [abrindoDia, setAbrindoDia] = useState(false);
  const [fechandoDia, setFechendoDia] = useState(false);
  const [resumoFechamento, setResumoFechamento] = useState(null); // modal de resumo ao fechar

  // Modal de cupom pós-venda
  const [modalCupom, setModalCupom] = useState(null); // { venda, itens, cliente }

  const inputBuscaRef = useRef(null);

  // -------------------------------------------------------------------------
  // Carregar dados do banco + status do dia atual
  // -------------------------------------------------------------------------
  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErroDB(null);
    try {
      const [
        { data: prods, error: errProds },
        { data: clts, error: errClts },
        { data: dia, error: errDia },
      ] = await Promise.all([
        supabase.from("produtos").select("id, nome, categoria, preco, unidade, pesavel, estoque_atual").eq("ativo", true).order("nome"),
        supabase.from("vw_saldo_clientes").select("cliente_id, nome, contato, saldo_devedor").order("nome"),
        supabase.from("dias_caixa").select("*").eq("data", new Date().toISOString().slice(0, 10)).is("fechado_em", null).maybeSingle(),
      ]);

      if (errProds) throw errProds;
      if (errClts) throw errClts;

      setProdutos(prods || []);
      setClientes(clts || []);

      if (dia) {
        setDiaCaixa(dia);
        setStatusDia("aberto");
      } else {
        setDiaCaixa(null);
        setStatusDia("fechado");
      }
    } catch (err) {
      setErroDB("Não foi possível conectar ao banco. Verifique a conexão.");
      console.error(err);
    } finally {
      setCarregando(false);
      inputBuscaRef.current?.focus();
    }
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  // -------------------------------------------------------------------------
  // Abrir dia
  // -------------------------------------------------------------------------
  async function abrirDia() {
    setAbrindoDia(true);
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("dias_caixa")
        .upsert({ data: hoje }, { onConflict: "data" })
        .select()
        .single();
      if (error) throw error;
      setDiaCaixa(data);
      setStatusDia("aberto");
    } catch (err) {
      console.error("Erro ao abrir dia:", err);
    } finally {
      setAbrindoDia(false);
    }
  }

  // -------------------------------------------------------------------------
  // Fechar dia — busca resumo e abre modal de confirmação
  // -------------------------------------------------------------------------
  async function prepararFechamento() {
    setStatusDia("confirmandoFechar");
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data: totais } = await supabase
        .from("vw_fechamento_caixa_diario")
        .select("*")
        .eq("dia", hoje);
      setResumoFechamento(totais || []);
    } catch (err) {
      console.error("Erro ao buscar resumo:", err);
      setResumoFechamento([]);
    }
  }

  async function confirmarFechamento() {
    if (!diaCaixa) return;
    setFechendoDia(true);
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data: totais } = await supabase
        .from("vw_fechamento_caixa_diario")
        .select("*")
        .eq("dia", hoje);

      await supabase
        .from("dias_caixa")
        .update({ fechado_em: new Date().toISOString(), resumo: totais })
        .eq("id", diaCaixa.id);

      setStatusDia("fechado");
      setDiaCaixa(null);
      setResumoFechamento(null);
    } catch (err) {
      console.error("Erro ao fechar dia:", err);
    } finally {
      setFechendoDia(false);
    }
  }

  // -------------------------------------------------------------------------
  // Busca de produtos
  // -------------------------------------------------------------------------
  const resultados = useMemo(() => {
    if (!busca.trim()) return [];
    const termo = busca.toLowerCase();
    return produtos.filter(
      (p) => p.nome.toLowerCase().includes(termo) || p.categoria.toLowerCase().includes(termo)
    ).slice(0, 6);
  }, [busca, produtos]);

  const total = useMemo(
    () => itens.reduce((acc, it) => acc + it.preco * (it.pesavel ? it.peso : it.qtd), 0),
    [itens]
  );

  const troco = useMemo(() => {
    const recebido = parseFloat(valorRecebido.replace(",", "."));
    if (isNaN(recebido)) return null;
    return recebido - total;
  }, [valorRecebido, total]);

  // -------------------------------------------------------------------------
  // Manipulação de itens
  // -------------------------------------------------------------------------
  function adicionarProduto(produto) {
    setBusca("");
    if (produto.pesavel) { setModalPeso(produto); return; }
    const existente = itens.find((it) => it.produtoId === produto.id);
    if (existente) { setItemFocoId(existente.id); return; }
    const novoId = crypto.randomUUID();
    setItens((prev) => [
      ...prev,
      { id: novoId, produtoId: produto.id, nome: produto.nome, preco: produto.preco, qtd: 1, unidade: produto.unidade, pesavel: false },
    ]);
    setItemFocoId(novoId);
  }

  function confirmarPeso(produto, pesoKg) {
    const peso = parseFloat(pesoKg.replace(",", "."));
    if (isNaN(peso) || peso <= 0) return;
    setItens((prev) => [
      ...prev,
      { id: crypto.randomUUID(), produtoId: produto.id, nome: produto.nome, preco: produto.preco, peso, qtd: 1, unidade: produto.unidade, pesavel: true },
    ]);
    setModalPeso(null);
    inputBuscaRef.current?.focus();
  }

  function alterarQtd(itemId, delta) {
    setItens((prev) => prev.map((it) => it.id === itemId ? { ...it, qtd: Math.max(1, it.qtd + delta) } : it));
  }

  function definirQtd(itemId, valor) {
    setItens((prev) => prev.map((it) => it.id === itemId ? { ...it, qtdInput: valor } : it));
  }

  function confirmarQtd(itemId) {
    setItens((prev) => prev.map((it) => {
      if (it.id !== itemId) return it;
      const n = parseInt(it.qtdInput, 10);
      return { ...it, qtd: isNaN(n) || n < 1 ? it.qtd : n, qtdInput: undefined };
    }));
    setItemFocoId(null);
  }

  function removerItem(itemId) {
    setItens((prev) => prev.filter((it) => it.id !== itemId));
  }

  function adicionarAvulso() {
    const nome = busca.trim();
    if (!nome) return;
    const novoId = crypto.randomUUID();
    setItens((prev) => [
      ...prev,
      { id: novoId, produtoId: null, nome: `${nome} (avulso)`, preco: 0, qtd: 1, unidade: "un", pesavel: false },
    ]);
    setBusca("");
    setItemFocoId(novoId);
  }

  // -------------------------------------------------------------------------
  // Finalizar venda — grava no Supabase, depois abre modal de cupom
  // -------------------------------------------------------------------------
  async function finalizarVenda() {
    if (itens.length === 0 || !pagamento) return;
    if (pagamento === "fiado" && !clienteFiado) return;

    setSalvando(true);
    setErroVenda(null);

    try {
      const { data: venda, error: errVenda } = await supabase
        .from("vendas")
        .insert({
          cliente_id: pagamento === "fiado" ? clienteFiado.cliente_id : null,
          forma_pagamento: pagamento,
          valor_total: total,
          valor_recebido: pagamento === "dinheiro" ? parseFloat(valorRecebido.replace(",", ".")) || null : null,
          status: "concluida",
        })
        .select("id, criado_em, forma_pagamento, valor_total, valor_recebido")
        .single();

      if (errVenda) throw errVenda;

      const itensParaInserir = itens.map((it) => ({
        venda_id: venda.id,
        produto_id: it.produtoId || null,
        nome_produto: it.nome,
        preco_unitario: it.preco,
        quantidade: it.pesavel ? it.peso : it.qtd,
        pesavel: it.pesavel,
        subtotal: it.preco * (it.pesavel ? it.peso : it.qtd),
      }));

      const { error: errItens } = await supabase.from("itens_venda").insert(itensParaInserir);
      if (errItens) throw errItens;

      // Snapshot dos itens para o cupom (antes de limpar o estado)
      const itensCupom = itensParaInserir.map((it) => ({
        nome_produto: it.nome_produto,
        preco_unitario: it.preco_unitario,
        quantidade: it.quantidade,
        pesavel: it.pesavel,
        subtotal: it.subtotal,
      }));

      const clienteNome = pagamento === "fiado" ? clienteFiado.nome : null;

      setVendaFinalizada(true);
      carregarDados();

      // Fiado: gera cupom automaticamente e abre modal com download pronto
      if (pagamento === "fiado") {
        await gerarCupomPDF({ venda, itens: itensCupom, cliente: clienteNome, download: true });
      }

      // Abre modal perguntando se quer o cupom (para todas as formas)
      setTimeout(() => {
        setModalCupom({ venda, itens: itensCupom, cliente: clienteNome });
        setItens([]);
        setPagamento(null);
        setClienteFiado(null);
        setBuscaCliente("");
        setValorRecebido("");
        setVendaFinalizada(false);
      }, 800);

    } catch (err) {
      setErroVenda("Erro ao registrar venda. Tente novamente.");
      console.error(err);
    } finally {
      setSalvando(false);
    }
  }

  const podeFinalizarFiado = pagamento === "fiado" ? !!clienteFiado : true;
  const podeFinalizar = itens.length > 0 && pagamento && podeFinalizarFiado && !salvando && statusDia === "aberto";

  const clientesFiltrados = useMemo(() => {
    if (!buscaCliente.trim()) return clientes;
    return clientes.filter((c) => c.nome.toLowerCase().includes(buscaCliente.toLowerCase()));
  }, [buscaCliente, clientes]);

  // -------------------------------------------------------------------------
  // Render: loading / erro
  // -------------------------------------------------------------------------
  if (carregando) {
    return (
      <div style={{ ...styles.app, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <style>{fontImports}</style>
        <Loader2 size={28} color={C.accent} style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ color: C.textFaint, fontSize: 14 }}>Conectando ao banco…</span>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (erroDB) {
    return (
      <div style={{ ...styles.app, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 }}>
        <style>{fontImports}</style>
        <AlertTriangle size={28} color={C.gold} />
        <span style={{ color: C.textMain, fontSize: 14, fontWeight: 600 }}>{erroDB}</span>
        <button onClick={carregarDados} style={styles.finalizeBtn}>Tentar novamente</button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render principal
  // -------------------------------------------------------------------------
  return (
    <div style={styles.app}>
      <style>{fontImports}</style>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* HEADER */}
      <header style={styles.header}>
        <a href="/" style={styles.brandLink} title="Voltar ao painel gerencial">
          <LogoMark />
          <div>
            <div style={styles.brandName}>AuroraMoon</div>
            <div style={styles.brandSub}>Vizinho Mercearia · PDV</div>
          </div>
        </a>

        <div style={styles.headerControls}>
          <div style={styles.headerDate}>
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </div>

          {statusDia === "fechado" && (
            <button onClick={abrirDia} disabled={abrindoDia} style={styles.btnAbrirDia}>
              {abrindoDia ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sun size={14} />}
              Abrir dia
            </button>
          )}

          {statusDia === "aberto" && (
            <button onClick={prepararFechamento} style={styles.btnFecharDia}>
              <Moon size={14} /> Fechar dia
            </button>
          )}

          {statusDia === "confirmandoFechar" && (
            <div style={styles.confirmacaoFechar}>
              <span style={styles.confirmacaoTexto}>Confirmar fechamento?</span>
              <button onClick={confirmarFechamento} disabled={fechandoDia} style={styles.btnConfirmarFechar}>
                {fechandoDia ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={13} />}
                Sim, fechar
              </button>
              <button onClick={() => setStatusDia("aberto")} style={styles.btnCancelarFechar}>
                <X size={13} />
              </button>
            </div>
          )}

          <div style={{
            ...styles.statusDiaBadge,
            background: statusDia === "aberto" ? "#E7F4EC" : "#F7F5F2",
            color: statusDia === "aberto" ? C.green : C.textFaint,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusDia === "aberto" ? C.green : C.textFaint, flexShrink: 0 }} />
            {statusDia === "aberto" ? "Dia aberto" : "Dia fechado"}
          </div>
        </div>
      </header>

      {/* AVISO: dia fechado bloqueia vendas */}
      {statusDia === "fechado" && (
        <div style={styles.avisoDiaFechado}>
          <Moon size={16} />
          <span>O dia está fechado. Abra o dia para registrar vendas.</span>
        </div>
      )}

      <div style={styles.main}>
        {/* COLUNA ESQUERDA */}
        <div style={styles.leftCol}>
          <div style={styles.searchWrap}>
            <Search size={20} color={C.textFaint} style={{ flexShrink: 0 }} />
            <input
              ref={inputBuscaRef}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={statusDia === "aberto" ? "Buscar produto por nome ou categoria…" : "Abra o dia para buscar produtos"}
              style={styles.searchInput}
              disabled={statusDia !== "aberto"}
              onKeyDown={(e) => { if (e.key === "Enter" && resultados.length > 0) adicionarProduto(resultados[0]); }}
            />
            {busca.trim() && (
              <button onClick={adicionarAvulso} style={styles.btnAvulso}>
                <Plus size={14} /> avulso
              </button>
            )}
          </div>

          {resultados.length > 0 && (
            <div style={styles.resultsGrid}>
              {resultados.map((p) => (
                <button key={p.id} onClick={() => adicionarProduto(p)} style={styles.resultCard}>
                  <div style={styles.resultNome}>{p.nome}</div>
                  <div style={styles.resultMeta}>
                    <span>{p.categoria}</span>
                    {p.pesavel && <Scale size={12} />}
                  </div>
                  <div style={styles.resultPreco}>
                    {formatBRL(p.preco)}
                    <span style={styles.resultUnidade}>/{p.unidade}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div style={styles.itemsPanel}>
            <div style={styles.itemsPanelHeader}>
              <span>Venda em andamento</span>
              <span style={styles.itemsCount}>{itens.length} {itens.length === 1 ? "item" : "itens"}</span>
            </div>

            {itens.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>🛒</div>
                <div style={styles.emptyTitle}>Nenhum item ainda</div>
                <div style={styles.emptyText}>
                  {statusDia === "aberto" ? "Busque um produto acima para começar a venda." : "Abra o dia para começar a vender."}
                </div>
              </div>
            ) : (
              <div style={styles.itemsList}>
                {itens.map((it) => (
                  <ItemRow key={it.id} item={it} autoFocus={itemFocoId === it.id}
                    onAlterarQtd={alterarQtd} onDefinirQtd={definirQtd}
                    onConfirmarQtd={confirmarQtd} onRemover={removerItem} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div style={styles.rightCol}>
          <div style={styles.totalPanel}>
            <div style={styles.totalLabel}>Total da venda</div>
            <div style={styles.totalValue}>{formatBRL(total)}</div>
            <div style={styles.totalDivider} />

            <div style={styles.payLabel}>Forma de pagamento</div>
            <div style={styles.payGrid}>
              <PayButton icon={Banknote} label="Dinheiro" active={pagamento === "dinheiro"} onClick={() => setPagamento("dinheiro")} disabled={statusDia !== "aberto"} />
              <PayButton icon={Smartphone} label="Pix" active={pagamento === "pix"} onClick={() => setPagamento("pix")} disabled={statusDia !== "aberto"} />
              <PayButton icon={CreditCard} label="Cartão" active={pagamento === "cartao"} onClick={() => setPagamento("cartao")} disabled={statusDia !== "aberto"} />
              <PayButton icon={BookUser} label="Fiado" active={pagamento === "fiado"} onClick={() => setPagamento("fiado")} disabled={statusDia !== "aberto"} />
            </div>

            {pagamento === "dinheiro" && (
              <div style={styles.cashBox}>
                <label style={styles.cashLabel}>Valor recebido</label>
                <input value={valorRecebido} onChange={(e) => setValorRecebido(e.target.value)}
                  placeholder="0,00" inputMode="decimal" style={styles.cashInput} />
                {troco !== null && (
                  <div style={{ ...styles.trocoBox, color: troco < 0 ? C.red : C.green }}>
                    {troco < 0 ? "Falta" : "Troco"}: {formatBRL(Math.abs(troco))}
                  </div>
                )}
              </div>
            )}

            {pagamento === "fiado" && (
              <div style={styles.fiadoBox}>
                <input value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)}
                  placeholder="Buscar cliente…" style={styles.fiadoSearch} />
                <div style={styles.fiadoList}>
                  {clientesFiltrados.map((c) => (
                    <button key={c.cliente_id} onClick={() => setClienteFiado(c)}
                      style={{ ...styles.fiadoItem, ...(clienteFiado?.cliente_id === c.cliente_id ? styles.fiadoItemActive : {}) }}>
                      <span>{c.nome}</span>
                      <span style={styles.fiadoSaldo}>saldo: {formatBRL(c.saldo_devedor)}</span>
                    </button>
                  ))}
                </div>
                {clienteFiado && (
                  <div style={styles.fiadoResumo}>
                    Novo saldo de <b>{clienteFiado.nome}</b>: {formatBRL(clienteFiado.saldo_devedor + total)}
                  </div>
                )}
              </div>
            )}

            {erroVenda && (
              <div style={styles.erroVenda}>
                <AlertTriangle size={14} /> {erroVenda}
              </div>
            )}

            <button onClick={finalizarVenda} disabled={!podeFinalizar || vendaFinalizada}
              style={{ ...styles.finalizeBtn, ...(podeFinalizar ? {} : styles.finalizeBtnDisabled), ...(vendaFinalizada ? styles.finalizeBtnDone : {}) }}>
              {salvando ? (
                <><Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> Salvando…</>
              ) : vendaFinalizada ? (
                <><Check size={20} /> Venda registrada</>
              ) : (
                "Finalizar venda"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL PESO */}
      {modalPeso && (
        <ModalPeso produto={modalPeso}
          onConfirmar={(peso) => confirmarPeso(modalPeso, peso)}
          onCancelar={() => setModalPeso(null)} />
      )}

      {/* MODAL CUPOM */}
      {modalCupom && (
        <ModalCupom
          dados={modalCupom}
          onBaixar={async () => {
            await gerarCupomPDF({ ...modalCupom, download: true });
          }}
          onFechar={() => {
            setModalCupom(null);
            inputBuscaRef.current?.focus();
          }}
        />
      )}

      {/* MODAL RESUMO FECHAMENTO */}
      {statusDia === "confirmandoFechar" && resumoFechamento !== null && (
        <ModalFechamento
          resumo={resumoFechamento}
          fechando={fechandoDia}
          onConfirmar={confirmarFechamento}
          onCancelar={() => setStatusDia("aberto")}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------
function ItemRow({ item, autoFocus, onAlterarQtd, onDefinirQtd, onConfirmarQtd, onRemover }) {
  const qtdRef = useRef(null);
  useEffect(() => {
    if (autoFocus && qtdRef.current) { qtdRef.current.focus(); qtdRef.current.select(); }
  }, [autoFocus]);
  const valorQtd = item.qtdInput !== undefined ? item.qtdInput : String(item.qtd);
  return (
    <div style={styles.itemRow}>
      <div style={styles.itemInfo}>
        <div style={styles.itemNome}>
          {item.nome}
          {item.pesavel && <Scale size={12} style={{ marginLeft: 6, color: C.textFaint }} />}
        </div>
        <div style={styles.itemPrecoUnit}>{formatBRL(item.preco)} / {item.unidade}</div>
      </div>
      {item.pesavel ? (
        <div style={styles.pesoTag}>{item.peso.toFixed(3)} kg</div>
      ) : (
        <div style={styles.qtdControl}>
          <button onClick={() => onAlterarQtd(item.id, -1)} style={styles.qtdBtn}><Minus size={14} /></button>
          <input ref={qtdRef} value={valorQtd}
            onChange={(e) => onDefinirQtd(item.id, e.target.value.replace(/[^0-9]/g, ""))}
            onFocus={(e) => e.target.select()}
            onBlur={() => onConfirmarQtd(item.id)}
            onKeyDown={(e) => { if (e.key === "Enter") onConfirmarQtd(item.id); }}
            style={styles.qtdInput} inputMode="numeric" />
          <button onClick={() => onAlterarQtd(item.id, 1)} style={styles.qtdBtn}><Plus size={14} /></button>
        </div>
      )}
      <div style={styles.itemSubtotal}>{formatBRL(item.preco * (item.pesavel ? item.peso : item.qtd))}</div>
      <button onClick={() => onRemover(item.id)} style={styles.removeBtn} title="Remover"><Trash2 size={16} /></button>
    </div>
  );
}

function PayButton({ icon: Icon, label, active, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...styles.payBtn, ...(active ? styles.payBtnActive : {}), ...(disabled ? { opacity: 0.4, cursor: "not-allowed" } : {}) }}>
      <Icon size={18} /><span>{label}</span>
    </button>
  );
}

function ModalPeso({ produto, onConfirmar, onCancelar }) {
  const [peso, setPeso] = useState("");
  const ref = useRef(null);
  useEffect(() => ref.current?.focus(), []);
  const pesoNum = parseFloat(peso.replace(",", "."));
  const subtotal = !isNaN(pesoNum) ? pesoNum * produto.preco : 0;
  return (
    <div style={styles.modalOverlay} onClick={onCancelar}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <Scale size={20} color={C.accent} />
          <span>Lançar peso — {produto.nome}</span>
          <button onClick={onCancelar} style={styles.modalClose}><X size={18} /></button>
        </div>
        <div style={styles.modalPrecoRef}>{formatBRL(produto.preco)} / {produto.unidade}</div>
        <input ref={ref} value={peso} onChange={(e) => setPeso(e.target.value)}
          placeholder="0,000" inputMode="decimal" style={styles.modalInput}
          onKeyDown={(e) => { if (e.key === "Enter" && !isNaN(pesoNum) && pesoNum > 0) onConfirmar(peso); }} />
        <div style={styles.modalSubtotalLabel}>Subtotal calculado</div>
        <div style={styles.modalSubtotal}>{formatBRL(subtotal)}</div>
        <button onClick={() => onConfirmar(peso)} disabled={isNaN(pesoNum) || pesoNum <= 0}
          style={{ ...styles.modalConfirmBtn, ...(isNaN(pesoNum) || pesoNum <= 0 ? styles.finalizeBtnDisabled : {}) }}>
          Adicionar à venda
        </button>
      </div>
    </div>
  );
}

function ModalCupom({ dados, onBaixar, onFechar }) {
  const [baixando, setBaixando] = useState(false);
  const isFiado = dados.venda.forma_pagamento === "fiado";
  return (
    <div style={styles.modalOverlay}>
      <div style={{ ...styles.modalBox, width: 340 }}>
        <div style={styles.modalHeader}>
          <Receipt size={20} color={C.accent} />
          <span>Venda registrada!</span>
        </div>
        <div style={{ fontSize: 13.5, color: C.textMain, lineHeight: 1.5 }}>
          {isFiado ? (
            <>
              O cupom foi <b>gerado automaticamente</b> e vinculado a <b>{dados.cliente}</b>. Deseja baixar uma cópia agora?
            </>
          ) : (
            <>Deseja gerar o cupom desta venda em PDF para o cliente?</>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={onFechar} style={styles.btnCancelarModal}>
            {isFiado ? "Não, obrigado" : "Não"}
          </button>
          <button
            onClick={async () => { setBaixando(true); await onBaixar(); setBaixando(false); onFechar(); }}
            disabled={baixando}
            style={styles.btnConfirmarModal}
          >
            {baixando
              ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Gerando…</>
              : <><FileText size={15} /> Baixar cupom PDF</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalFechamento({ resumo, fechando, onConfirmar, onCancelar }) {
  const LABELS = { dinheiro: "Dinheiro", pix: "Pix", cartao: "Cartão", fiado: "Fiado" };
  const totalDia = resumo.reduce((acc, r) => acc + Number(r.total || 0), 0);
  const totalVendas = resumo.reduce((acc, r) => acc + Number(r.qtd_vendas || 0), 0);
  return (
    <div style={styles.modalOverlay}>
      <div style={{ ...styles.modalBox, width: 380 }}>
        <div style={styles.modalHeader}>
          <Moon size={20} color={C.textMain} />
          <span style={{ fontWeight: 700 }}>Resumo do dia — confirmar fechamento</span>
        </div>
        <div style={{ fontSize: 13, color: C.textFaint, marginBottom: 4 }}>
          {totalVendas} venda{totalVendas !== 1 ? "s" : ""} concluída{totalVendas !== 1 ? "s" : ""} hoje
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {resumo.length === 0 ? (
            <div style={{ color: C.textFaint, fontSize: 13 }}>Nenhuma venda registrada hoje.</div>
          ) : resumo.map((r) => (
            <div key={r.forma_pagamento} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: C.textMain }}>{LABELS[r.forma_pagamento] || r.forma_pagamento}</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>
                {formatBRL(r.total)} <span style={{ color: C.textFaint, fontSize: 12 }}>({r.qtd_vendas}x)</span>
              </span>
            </div>
          ))}
          {resumo.length > 0 && (
            <>
              <div style={{ height: 1, background: C.border, margin: "4px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16 }}>
                <span style={{ fontWeight: 700 }}>Total</span>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: C.green }}>
                  {formatBRL(totalDia)}
                </span>
              </div>
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancelar} style={styles.btnCancelarModal}>Cancelar</button>
          <button onClick={onConfirmar} disabled={fechando} style={styles.btnConfirmarModal}>
            {fechando
              ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Fechando…</>
              : <><Moon size={15} /> Confirmar fechamento</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function LogoMark() {
  return (
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none">
      <g stroke={C.accent} strokeWidth="3.5" strokeLinecap="round">
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          return <line key={i} x1={50 + Math.cos(angle) * 34} y1={50 + Math.sin(angle) * 34} x2={50 + Math.cos(angle) * 44} y2={50 + Math.sin(angle) * 44} />;
        })}
      </g>
      <circle cx="50" cy="50" r="26" fill="#FFF" stroke={C.accent} strokeWidth="3" />
      <path d="M 62 30 A 22 22 0 1 0 62 70 A 17 17 0 1 1 62 30 Z" fill={C.violet} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
const fontImports = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');`;

const C = {
  bg: "#FFFFFF", bgSubtle: "#F7F5F2", border: "#E2DED7",
  textMain: "#15120F", textFaint: "#8C8579",
  accent: "#1C5F8C", accentSoft: "#E8F0F6",
  violet: "#6B5B95", gold: "#C99A3E",
  green: "#2E7D4F", red: "#C23B2E",
};

const styles = {
  app: { fontFamily: "'Inter', sans-serif", background: C.bg, color: C.textMain, minHeight: "100vh", width: "100%", display: "flex", flexDirection: "column" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", borderBottom: `1px solid ${C.border}`, background: C.bgSubtle, gap: 16, flexWrap: "wrap" },
  brandLink: { display: "flex", alignItems: "center", gap: 12, textDecoration: "none", cursor: "pointer" },
  brandName: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: C.accent },
  brandSub: { fontSize: 12, color: C.textFaint },
  headerControls: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },
  headerDate: { fontSize: 13, color: C.textFaint, textTransform: "capitalize" },
  btnAbrirDia: { display: "flex", alignItems: "center", gap: 6, background: C.green, color: "#FFF", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" },
  btnFecharDia: { display: "flex", alignItems: "center", gap: 6, background: "#15120F", color: "#FFF8F0", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" },
  confirmacaoFechar: { display: "flex", alignItems: "center", gap: 6 },
  confirmacaoTexto: { fontSize: 12.5, fontWeight: 600, color: C.textMain },
  btnConfirmarFechar: { display: "flex", alignItems: "center", gap: 4, background: C.red, color: "#FFF", border: "none", borderRadius: 7, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" },
  btnCancelarFechar: { display: "flex", alignItems: "center", background: C.bgSubtle, color: C.textMain, border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 9px", cursor: "pointer" },
  statusDiaBadge: { display: "flex", alignItems: "center", gap: 5, borderRadius: 20, padding: "5px 10px", fontSize: 12, fontWeight: 700 },
  avisoDiaFechado: { display: "flex", alignItems: "center", gap: 8, background: "#F7F5F2", borderBottom: `1px solid ${C.border}`, padding: "10px 24px", fontSize: 13, color: C.textFaint, fontWeight: 600 },
  main: { display: "flex", flex: 1, gap: 16, padding: 16, minHeight: 0, background: C.bg },
  leftCol: { flex: "1 1 62%", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 },
  rightCol: { flex: "0 0 320px" },
  searchWrap: { display: "flex", alignItems: "center", gap: 10, background: C.bgSubtle, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "12px 16px" },
  searchInput: { flex: 1, background: "transparent", border: "none", outline: "none", color: C.textMain, fontSize: 15, fontFamily: "'Inter', sans-serif" },
  btnAvulso: { display: "flex", alignItems: "center", gap: 4, background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}55`, borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  resultsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 },
  resultCard: { background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: 12, textAlign: "left", cursor: "pointer", color: C.textMain, display: "flex", flexDirection: "column", gap: 4 },
  resultNome: { fontSize: 13, fontWeight: 700, lineHeight: 1.3, color: C.textMain },
  resultMeta: { fontSize: 11, color: C.textFaint, display: "flex", alignItems: "center", gap: 6 },
  resultPreco: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, color: C.textMain, marginTop: 2 },
  resultUnidade: { fontSize: 11, color: C.textFaint, fontWeight: 400, marginLeft: 2 },
  itemsPanel: { flex: 1, background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 12, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" },
  itemsPanelHeader: { display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1.5px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: C.textFaint, background: C.bgSubtle },
  itemsCount: { color: C.textMain },
  itemsList: { overflowY: "auto", flex: 1 },
  itemRow: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${C.border}` },
  itemInfo: { flex: 1, minWidth: 0 },
  itemNome: { fontSize: 14.5, fontWeight: 700, display: "flex", alignItems: "center", color: C.textMain },
  itemPrecoUnit: { fontSize: 12, color: C.textFaint, marginTop: 2 },
  pesoTag: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 600, background: C.bgSubtle, border: `1px solid ${C.border}`, padding: "4px 10px", borderRadius: 8, color: C.textMain },
  qtdControl: { display: "flex", alignItems: "center", gap: 6 },
  qtdBtn: { width: 26, height: 26, borderRadius: 7, border: `1px solid ${C.border}`, background: C.bgSubtle, color: C.textMain, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  qtdInput: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, width: 36, textAlign: "center", color: C.textMain, background: "#FFF", border: `1.5px solid ${C.accent}`, borderRadius: 6, padding: "4px 2px", outline: "none" },
  itemSubtotal: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, minWidth: 78, textAlign: "right", color: C.textMain },
  removeBtn: { background: "transparent", border: "none", color: C.textFaint, cursor: "pointer", padding: 4, display: "flex" },
  emptyState: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: 40, color: C.textFaint },
  emptyIcon: { fontSize: 32, marginBottom: 4, opacity: 0.6 },
  emptyTitle: { fontSize: 14, fontWeight: 700, color: C.textMain },
  emptyText: { fontSize: 12.5 },
  totalPanel: { background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 8, position: "sticky", top: 0 },
  totalLabel: { fontSize: 12.5, color: C.textFaint, fontWeight: 600 },
  totalValue: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 40, fontWeight: 700, color: C.textMain, letterSpacing: "-0.02em", lineHeight: 1.1 },
  totalDivider: { height: 1, background: C.border, margin: "12px 0 8px" },
  payLabel: { fontSize: 12.5, color: C.textFaint, fontWeight: 600, marginBottom: 4 },
  payGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  payBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 8px", background: C.bgSubtle, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.textFaint, cursor: "pointer", fontSize: 12.5, fontWeight: 700 },
  payBtnActive: { background: C.accentSoft, borderColor: C.accent, color: C.accent },
  cashBox: { marginTop: 10, display: "flex", flexDirection: "column", gap: 6 },
  cashLabel: { fontSize: 12, color: C.textFaint, fontWeight: 600 },
  cashInput: { background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.textMain, fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, outline: "none" },
  trocoBox: { fontSize: 13.5, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" },
  fiadoBox: { marginTop: 10, display: "flex", flexDirection: "column", gap: 8 },
  fiadoSearch: { background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.textMain, fontSize: 13, outline: "none" },
  fiadoList: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 140, overflowY: "auto" },
  fiadoItem: { display: "flex", justifyContent: "space-between", background: C.bgSubtle, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.textMain, fontSize: 12.5, fontWeight: 600, cursor: "pointer", textAlign: "left" },
  fiadoItemActive: { borderColor: C.accent, background: C.accentSoft, color: C.accent },
  fiadoSaldo: { color: C.textFaint, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 },
  fiadoResumo: { fontSize: 12, color: C.textMain, background: C.accentSoft, borderRadius: 8, padding: "8px 10px", fontWeight: 500 },
  erroVenda: { display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.red, fontWeight: 600, background: "#FDECEA", borderRadius: 8, padding: "8px 10px" },
  finalizeBtn: { marginTop: 14, background: C.accent, color: "#FFF", border: "none", borderRadius: 10, padding: "14px", fontSize: 15, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  finalizeBtnDisabled: { background: C.bgSubtle, color: C.textFaint, cursor: "not-allowed" },
  finalizeBtnDone: { background: C.green, color: "#fff" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 },
  modalBox: { background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 14, padding: 24, width: 320, display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 12px 40px rgba(20,18,15,0.18)" },
  modalHeader: { display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: C.textMain },
  modalClose: { marginLeft: "auto", background: "transparent", border: "none", color: C.textFaint, cursor: "pointer" },
  modalPrecoRef: { fontSize: 12.5, color: C.textFaint },
  modalInput: { background: C.bgSubtle, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", color: C.textMain, fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, outline: "none", textAlign: "center" },
  modalSubtotalLabel: { fontSize: 11.5, color: C.textFaint },
  modalSubtotal: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, color: C.textMain },
  modalConfirmBtn: { background: C.accent, color: "#FFF", border: "none", borderRadius: 9, padding: "12px", fontWeight: 700, cursor: "pointer" },
  btnCancelarModal: { flex: 1, background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "10px", fontSize: 13.5, fontWeight: 700, color: C.textMain, cursor: "pointer" },
  btnConfirmarModal: { flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: C.accent, color: "#FFF", border: "none", borderRadius: 8, padding: "10px", fontSize: 13.5, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", cursor: "pointer" },
};
