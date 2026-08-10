import React, { useState } from "react";
import {
  Package, Users, BarChart2, Warehouse, BookUser, ShoppingCart
} from "lucide-react";
import CadastroProdutos from "./erp/CadastroProdutos";
import CadastroClientes from "./erp/CadastroClientes";
import FechamentoDia from "./erp/FechamentoDia";
import Estoque from "./erp/Estoque";
import Fiado from "./erp/Fiado";

const MENU = [
  { id: "fechamento", label: "Fechamento do Dia", icon: BarChart2 },
  { id: "estoque", label: "Estoque", icon: Warehouse },
  { id: "fiado", label: "Fiado", icon: BookUser },
  { id: "produtos", label: "Cadastro de Produtos", icon: Package },
  { id: "clientes", label: "Cadastro de Clientes", icon: Users },
];

const COMPONENTES = {
  fechamento: FechamentoDia,
  estoque: Estoque,
  fiado: Fiado,
  produtos: CadastroProdutos,
  clientes: CadastroClientes,
};

const C = {
  bg: "#FFFFFF", bgSubtle: "#F7F5F2", bgSidebar: "#15120F",
  border: "#E2DED7", borderSidebar: "#2A2520",
  textMain: "#15120F", textFaint: "#8C8579",
  textSidebarActive: "#FFFFFF", textSidebarInactive: "#A6957F",
  accent: "#1C5F8C", accentSoft: "#E8F0F6",
  violet: "#6B5B95",
  activeBg: "#2A2520",
};

export default function ERPLayout() {
  const [modulo, setModulo] = useState("fechamento");
  const Componente = COMPONENTES[modulo];

  return (
    <div style={s.shell}>
      <style>{fonts}</style>

      {/* SIDEBAR */}
      <aside style={s.sidebar}>
        {/* Logo */}
        <div style={s.sidebarBrand}>
          <LogoMark />
          <div>
            <div style={s.sidebarBrandName}>AuroraMoon</div>
            <div style={s.sidebarBrandSub}>Painel Gerencial</div>
          </div>
        </div>

        {/* Menu */}
        <nav style={s.nav}>
          {MENU.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setModulo(id)}
              style={{
                ...s.navItem,
                ...(modulo === id ? s.navItemActive : {}),
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Botão PDV */}
        <div style={s.sidebarFooter}>
          <a href="/pdv" style={s.linkPDV}>
            <ShoppingCart size={16} />
            <span>Ir para o PDV</span>
          </a>
        </div>
      </aside>

      {/* CONTEÚDO */}
      <main style={s.content}>
        <Componente />
      </main>
    </div>
  );
}

function LogoMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 100 100" fill="none">
      <g stroke="#1C5F8C" strokeWidth="3.5" strokeLinecap="round">
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          return (
            <line key={i}
              x1={50 + Math.cos(angle) * 34} y1={50 + Math.sin(angle) * 34}
              x2={50 + Math.cos(angle) * 44} y2={50 + Math.sin(angle) * 44}
            />
          );
        })}
      </g>
      <circle cx="50" cy="50" r="26" fill="#15120F" stroke="#1C5F8C" strokeWidth="3" />
      <path d="M 62 30 A 22 22 0 1 0 62 70 A 17 17 0 1 1 62 30 Z" fill="#6B5B95" />
    </svg>
  );
}

const fonts = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');`;

const s = {
  shell: {
    fontFamily: "'Inter', sans-serif",
    display: "flex",
    minHeight: "100vh",
    width: "100%",
    background: C.bg,
  },
  sidebar: {
    width: 240,
    flexShrink: 0,
    background: C.bgSidebar,
    display: "flex",
    flexDirection: "column",
    borderRight: `1px solid ${C.borderSidebar}`,
  },
  sidebarBrand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "20px 18px",
    borderBottom: `1px solid ${C.borderSidebar}`,
  },
  sidebarBrandName: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 700, fontSize: 16,
    color: "#FFF8F0",
  },
  sidebarBrandSub: { fontSize: 11, color: C.textSidebarInactive, marginTop: 1 },
  nav: { flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "12px 10px" },
  navItem: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 12px",
    background: "transparent",
    border: "none",
    borderRadius: 8,
    color: C.textSidebarInactive,
    fontSize: 13.5, fontWeight: 600,
    fontFamily: "'Inter', sans-serif",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
  },
  navItemActive: {
    background: C.activeBg,
    color: C.textSidebarActive,
  },
  sidebarFooter: {
    padding: "14px 10px",
    borderTop: `1px solid ${C.borderSidebar}`,
  },
  linkPDV: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "10px 14px",
    color: "#FFF8F0",
    fontSize: 13, fontWeight: 700,
    textDecoration: "none",
    borderRadius: 8,
    background: C.accent,
    border: "none",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    overflow: "auto",
    background: C.bgSubtle,
  },
};
