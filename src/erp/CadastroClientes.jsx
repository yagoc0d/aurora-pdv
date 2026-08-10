import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Search, Plus, Pencil, X, Check, Users, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { supabase } from "../supabaseClient";

const FORM_VAZIO = { nome: "", contato: "", ativo: true };
const formatBRL = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CadastroClientes() {
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [painelAberto, setPainelAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [salvoId, setSalvoId] = useState(null);
  const nomeRef = useRef(null);

  useEffect(() => { if (painelAberto) nomeRef.current?.focus(); }, [painelAberto]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, contato, ativo, criado_em")
        .order("nome");

      // Busca saldos da view
      const { data: saldos } = await supabase
        .from("vw_saldo_clientes")
        .select("cliente_id, saldo_devedor");

      const saldoMap = Object.fromEntries((saldos || []).map((s) => [s.cliente_id, s.saldo_devedor]));
      setClientes((data || []).map((c) => ({ ...c, saldo_devedor: saldoMap[c.id] || 0 })));
    } catch (err) { console.error(err); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const clientesFiltrados = useMemo(() => {
    if (!busca.trim()) return clientes;
    return clientes.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase()) || (c.contato || "").includes(busca));
  }, [clientes, busca]);

  function abrirNovo() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setErros({});
    setPainelAberto(true);
  }

  function abrirEdicao(c) {
    setEditandoId(c.id);
    setForm({ nome: c.nome, contato: c.contato || "", ativo: c.ativo });
    setErros({});
    setPainelAberto(true);
  }

  function setField(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((e) => ({ ...e, [campo]: undefined }));
  }

  async function salvar() {
    if (!form.nome.trim()) { setErros({ nome: "Nome é obrigatório" }); return; }
    setSalvando(true);
    const dados = { nome: form.nome.trim(), contato: form.contato.trim() || null, ativo: form.ativo };
    try {
      if (editandoId) {
        await supabase.from("clientes").update(dados).eq("id", editandoId);
        setSalvoId(editandoId);
      } else {
        const { data } = await supabase.from("clientes").insert(dados).select("id").single();
        setSalvoId(data.id);
      }
      await carregar();
      setTimeout(() => setSalvoId(null), 1800);
      setPainelAberto(false);
    } catch (err) {
      setErros({ _geral: "Erro ao salvar. Tente novamente." });
      console.error(err);
    } finally { setSalvando(false); }
  }

  async function toggleAtivo(c) {
    try {
      await supabase.from("clientes").update({ ativo: !c.ativo }).eq("id", c.id);
      setClientes((prev) => prev.map((cl) => cl.id === c.id ? { ...cl, ativo: !c.ativo } : cl));
    } catch (err) { console.error(err); }
  }

  return (
    <div style={s.app}>
      <style>{fonts}</style>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      <div style={s.topBar}>
        <div>
          <div style={s.pageTitle}>Cadastro de Clientes</div>
          <div style={s.pageSub}>Clientes cadastrados para fiado e controle</div>
        </div>
        <button onClick={abrirNovo} style={s.btnNovo}><Plus size={16} /> Novo cliente</button>
      </div>

      <div style={s.body}>
        <div style={s.leftCol}>
          <div style={s.searchWrap}>
            <Search size={16} color={C.textFaint} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou contato…" style={s.searchInput} />
            {busca && <button onClick={() => setBusca("")} style={s.clearBtn}><X size={14} /></button>}
          </div>

          {carregando ? (
            <div style={s.loading}><Loader2 size={24} color={C.accent} style={{ animation: "spin 1s linear infinite" }} /></div>
          ) : (
            <div style={s.tabela}>
              <div style={s.tabelaHeader}>
                <span style={{ flex: 1 }}>Nome</span>
                <span style={{ flex: 1 }}>Contato</span>
                <span style={{ width: 130, textAlign: "right" }}>Saldo fiado</span>
                <span style={{ width: 72 }}></span>
              </div>
              {clientesFiltrados.length === 0 ? (
                <div style={s.empty}>
                  <Users size={28} color={C.textFaint} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.textMain, marginTop: 8 }}>Nenhum cliente encontrado</div>
                </div>
              ) : clientesFiltrados.map((c) => (
                <div key={c.id} style={{ ...s.tabelaRow, ...(salvoId === c.id ? s.rowSalvo : {}), opacity: c.ativo ? 1 : 0.5 }}>
                  <div style={{ flex: 1 }}>
                    <div style={s.clienteNome}>
                      {c.nome}
                      {!c.ativo && <span style={s.tagInativo}>inativo</span>}
                    </div>
                  </div>
                  <span style={{ flex: 1, fontSize: 13, color: C.textFaint }}>{c.contato || "—"}</span>
                  <span style={{ width: 130, textAlign: "right", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: c.saldo_devedor > 0 ? C.red : C.green }}>
                    {formatBRL(c.saldo_devedor)}
                  </span>
                  <div style={{ width: 72, display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <button onClick={() => toggleAtivo(c)} style={s.btnToggle} title={c.ativo ? "Desativar" : "Ativar"}>
                      {c.ativo ? <ToggleRight size={20} color={C.green} /> : <ToggleLeft size={20} color={C.textFaint} />}
                    </button>
                    <button onClick={() => abrirEdicao(c)} style={s.btnEditar} title="Editar">
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={s.rodape}>{clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? "s" : ""}</div>
        </div>

        {painelAberto && (
          <div style={s.painel}>
            <div style={s.painelHeader}>
              <span style={s.painelTitulo}>{editandoId ? "Editar cliente" : "Novo cliente"}</span>
              <button onClick={() => setPainelAberto(false)} style={s.btnFechar}><X size={18} /></button>
            </div>
            <div style={s.painelBody}>
              <Campo label="Nome *" erro={erros.nome}>
                <input ref={nomeRef} value={form.nome} onChange={(e) => setField("nome", e.target.value)}
                  placeholder="Ex: Maria das Graças"
                  style={{ ...s.input, ...(erros.nome ? s.inputErro : {}) }} />
              </Campo>
              <Campo label="Contato (opcional)">
                <input value={form.contato} onChange={(e) => setField("contato", e.target.value)}
                  placeholder="(11) 99999-0000" inputMode="tel" style={s.input} />
              </Campo>
              <div style={s.toggleRow} onClick={() => setField("ativo", !form.ativo)}>
                <div>
                  <div style={s.toggleLabel}>Cliente ativo</div>
                  <div style={s.toggleDesc}>Clientes inativos não aparecem no PDV para fiado</div>
                </div>
                {form.ativo ? <ToggleRight size={26} color={C.green} /> : <ToggleLeft size={26} color={C.textFaint} />}
              </div>
              {erros._geral && <div style={s.erroGeral}>{erros._geral}</div>}
            </div>
            <div style={s.painelFooter}>
              <button onClick={() => setPainelAberto(false)} style={s.btnCancelar} disabled={salvando}>Cancelar</button>
              <button onClick={salvar} style={s.btnSalvar} disabled={salvando}>
                {salvando
                  ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Salvando…</>
                  : <><Check size={16} /> {editandoId ? "Salvar" : "Cadastrar"}</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Campo({ label, erro, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={s.label}>{label}</label>
      {children}
      {erro && <span style={s.erroText}>{erro}</span>}
    </div>
  );
}

const fonts = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');`;
const C = { bg: "#FFF", bgSubtle: "#F7F5F2", border: "#E2DED7", textMain: "#15120F", textFaint: "#8C8579", accent: "#1C5F8C", accentSoft: "#E8F0F6", green: "#2E7D4F", red: "#C23B2E" };
const s = {
  app: { fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", height: "100%" },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "24px 28px 0", gap: 12 },
  pageTitle: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: C.textMain },
  pageSub: { fontSize: 13, color: C.textFaint, marginTop: 2 },
  btnNovo: { display: "flex", alignItems: "center", gap: 6, background: C.accent, color: "#FFF", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", cursor: "pointer", flexShrink: 0 },
  body: { display: "flex", flex: 1, minHeight: 0 },
  leftCol: { flex: 1, display: "flex", flexDirection: "column", padding: 28, gap: 12, overflowY: "auto" },
  searchWrap: { display: "flex", alignItems: "center", gap: 8, background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 9, padding: "9px 12px" },
  searchInput: { flex: 1, background: "transparent", border: "none", outline: "none", color: C.textMain, fontSize: 13.5, fontFamily: "'Inter', sans-serif" },
  clearBtn: { background: "transparent", border: "none", color: C.textFaint, cursor: "pointer", padding: 0, display: "flex" },
  loading: { display: "flex", justifyContent: "center", padding: 60 },
  tabela: { background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 12, overflow: "hidden" },
  tabelaHeader: { display: "flex", gap: 12, padding: "10px 16px", background: C.bgSubtle, fontSize: 11.5, fontWeight: 700, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.04em", alignItems: "center" },
  tabelaRow: { display: "flex", gap: 12, padding: "13px 16px", borderBottom: `1px solid ${C.border}`, alignItems: "center" },
  rowSalvo: { background: "#E7F4EC" },
  clienteNome: { fontSize: 14, fontWeight: 700, color: C.textMain, display: "flex", alignItems: "center", gap: 8 },
  tagInativo: { fontSize: 10, fontWeight: 700, background: C.bgSubtle, color: C.textFaint, borderRadius: 4, padding: "1px 5px" },
  btnToggle: { background: "transparent", border: "none", cursor: "pointer", padding: 2, display: "flex" },
  btnEditar: { display: "flex", alignItems: "center", justifyContent: "center", background: C.bgSubtle, border: `1px solid ${C.border}`, borderRadius: 7, padding: 6, color: C.textMain, cursor: "pointer" },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", padding: 40 },
  rodape: { fontSize: 12, color: C.textFaint, textAlign: "right" },
  painel: { width: 320, flexShrink: 0, borderLeft: `1.5px solid ${C.border}`, display: "flex", flexDirection: "column", background: "#FFF" },
  painelHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: C.bgSubtle },
  painelTitulo: { fontSize: 15, fontWeight: 700, color: C.textMain },
  btnFechar: { background: "transparent", border: "none", color: C.textFaint, cursor: "pointer", display: "flex" },
  painelBody: { flex: 1, padding: 20, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" },
  label: { fontSize: 12, fontWeight: 700, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: { background: C.bgSubtle, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.textMain, fontSize: 14, fontFamily: "'Inter', sans-serif", outline: "none" },
  inputErro: { borderColor: C.red, background: "#FDECEA" },
  erroText: { fontSize: 12, color: C.red, fontWeight: 500 },
  erroGeral: { fontSize: 12.5, color: C.red, fontWeight: 600, background: "#FDECEA", borderRadius: 8, padding: "8px 10px" },
  toggleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", background: C.bgSubtle, border: `1.5px solid ${C.border}`, borderRadius: 9, padding: "12px 14px", cursor: "pointer" },
  toggleLabel: { fontSize: 13.5, fontWeight: 700, color: C.textMain },
  toggleDesc: { fontSize: 11.5, color: C.textFaint, marginTop: 2 },
  painelFooter: { display: "flex", gap: 10, padding: "14px 20px", borderTop: `1px solid ${C.border}`, background: C.bgSubtle },
  btnCancelar: { flex: 1, background: "#FFF", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "10px", fontSize: 13.5, fontWeight: 700, color: C.textMain, cursor: "pointer" },
  btnSalvar: { flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: C.accent, color: "#FFF", border: "none", borderRadius: 8, padding: "10px", fontSize: 13.5, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", cursor: "pointer" },
};
