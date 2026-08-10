import React from "react";
import PDVVenda from "./PDVVenda";
import ERPLayout from "./ERPLayout";

/**
 * Roteador raiz — sem dependência de biblioteca externa.
 * /        → ERP  (root abre o painel gerencial)
 * /pdv     → PDV  (tela de caixa)
 */
export default function App() {
  const path = window.location.pathname;
  if (path.startsWith("/pdv")) return <PDVVenda />;
  return <ERPLayout />;
}
