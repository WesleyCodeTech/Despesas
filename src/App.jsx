import { useState, useMemo, useEffect } from "react";
 
// ─── CONSTANTS ───────────────────────────────────────────────────────────────
 
const CATEGORIES = {
  entrada: [
    { id: "salario",       label: "Salário",       icon: "💼" },
    { id: "freelance",     label: "Freelance",     icon: "💻" },
    { id: "beneficio",     label: "Benefício/INSS",icon: "🏛️" },
    { id: "outros_entrada",label: "Outros",        icon: "➕" },
  ],
  saida: [
    { id: "moradia",    label: "Moradia",          icon: "🏠" },
    { id: "alimentacao",label: "Alimentação",      icon: "🛒" },
    { id: "transporte", label: "Transporte",       icon: "🚌" },
    { id: "saude",      label: "Saúde",            icon: "💊" },
    { id: "educacao",   label: "Educação",         icon: "📚" },
    { id: "lazer",      label: "Lazer",            icon: "🎮" },
    { id: "parcela",    label: "Parcela/Crédito",  icon: "💳" },
    { id: "outros_saida",label: "Outros",          icon: "➖" },
  ],
};
 
const RECURRENCE = [
  { id: "unica",    label: "Única vez" },
  { id: "mensal",   label: "Todo mês"  },
  { id: "semanal",  label: "Toda semana" },
  { id: "parcelado",label: "Parcelado" },
];
 
const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
 
// ─── UTILS ───────────────────────────────────────────────────────────────────
 
function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}
 
function parseNum(str) {
  if (str === undefined || str === null || str === "") return NaN;
  return parseFloat(String(str).replace(",", "."));
}
 
function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}
 
function todayStr() {
  return new Date().toISOString().split("T")[0];
}
 
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}
 
function loadData() {
  try {
    const saved = localStorage.getItem("finapp_v1");
    return saved ? JSON.parse(saved) : { transactions: [], balance: 0 };
  } catch { return { transactions: [], balance: 0 }; }
}
 
function saveData(data) {
  try { localStorage.setItem("finapp_v1", JSON.stringify(data)); } catch {}
}
 
function getTransactionsForMonth(transactions, year, month) {
  const results = [];
  for (const t of transactions) {
    if (t.recurrence === "unica") {
      const d = new Date(t.date + "T00:00:00");
      if (d.getFullYear() === year && d.getMonth() === month)
        results.push({ ...t, displayDate: t.date });
    } else if (t.recurrence === "mensal") {
      const start = new Date(t.date + "T00:00:00");
      if (year * 12 + month >= start.getFullYear() * 12 + start.getMonth()) {
        const day = start.getDate().toString().padStart(2, "0");
        const mon = (month + 1).toString().padStart(2, "0");
        results.push({ ...t, displayDate: `${year}-${mon}-${day}` });
      }
    } else if (t.recurrence === "semanal") {
      const startDate = new Date(t.date + "T00:00:00");
      const firstDay = new Date(year, month, 1);
      const lastDay  = new Date(year, month + 1, 0);
      let cur = new Date(startDate);
      while (cur <= lastDay) {
        if (cur >= firstDay && cur >= startDate) {
          const dd = cur.getDate().toString().padStart(2, "0");
          const mm = (cur.getMonth() + 1).toString().padStart(2, "0");
          results.push({ ...t, displayDate: `${year}-${mm}-${dd}` });
        }
        cur.setDate(cur.getDate() + 7);
      }
    } else if (t.recurrence === "parcelado") {
      const startDate  = new Date(t.date + "T00:00:00");
      const startMonth = startDate.getFullYear() * 12 + startDate.getMonth();
      const targetMonth = year * 12 + month;
      const total = t.totalInstallments || 1;
      const idx   = targetMonth - startMonth;
      if (idx >= 0 && idx < total) {
        const day = startDate.getDate().toString().padStart(2, "0");
        const mon = (month + 1).toString().padStart(2, "0");
        results.push({ ...t, displayDate: `${year}-${mon}-${day}`, installmentNumber: idx + 1 });
      }
    }
  }
  return results.sort((a, b) => a.displayDate.localeCompare(b.displayDate));
}
 
function getCategoryInfo(type, catId) {
  const list = CATEGORIES[type] || [];
  return list.find(c => c.id === catId) || { label: catId || "Geral", icon: "•" };
}
 
// ─── ACCUMULATED FORECAST ────────────────────────────────────────────────────
 
function getAccumulatedForecast(transactions, currentBalance, numMonths = 6) {
  const now = new Date();
  const result = [];
  let running = currentBalance;
  for (let i = 0; i < numMonths; i++) {
    const d     = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const year  = d.getFullYear();
    const month = d.getMonth();
    const txs   = getTransactionsForMonth(transactions, year, month);
    const entradas = txs.filter(t => t.type === "entrada").reduce((s, t) => s + t.amount, 0);
    const saidas   = txs.filter(t => t.type === "saida").reduce((s, t) => s + t.amount, 0);
    const net    = entradas - saidas;
    const carryIn = running;
    running += net;
    result.push({ year, month, label: `${MONTHS[month]}/${year}`, entradas, saidas, net, carryIn, accumulated: running });
  }
  return result;
}
 
// ─── TIPS ENGINE ─────────────────────────────────────────────────────────────
 
function getTips(monthResult, accumulated, monthSaidas, totalEntradas) {
  const tips = [];
  const savingsRate = totalEntradas > 0 ? (monthResult / totalEntradas) * 100 : 0;
 
  // --- resultado do mês ---
  if (totalEntradas === 0 && monthSaidas.length > 0) {
    tips.push({ icon: "💡", type: "warning",
      text: "Você tem gastos cadastrados mas nenhuma entrada neste mês. Registre suas receitas para ver o balanço completo." });
  } else if (monthResult < 0) {
    tips.push({ icon: "🚨", type: "danger",
      text: `Seus gastos superam as entradas em ${formatBRL(Math.abs(monthResult))} este mês.` });
    const byCat = {};
    for (const t of monthSaidas) byCat[t.category] = (byCat[t.category] || 0) + t.amount;
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    if (top) {
      const cat = getCategoryInfo("saida", top[0]);
      tips.push({ icon: cat.icon, type: "warning",
        text: `${cat.label} é seu maior gasto (${formatBRL(top[1])}). Reduzir aqui ajudaria a equilibrar o orçamento.` });
    }
  } else if (monthResult === 0) {
    tips.push({ icon: "⚖️", type: "neutral",
      text: "Entradas e saídas zeradas. Tente criar uma pequena sobra para emergências." });
  } else {
    if (savingsRate >= 20) {
      tips.push({ icon: "🏆", type: "success",
        text: `Você está guardando ${savingsRate.toFixed(0)}% da renda (${formatBRL(monthResult)}). Excelente! Considere investir parte disso.` });
    } else {
      tips.push({ icon: "✅", type: "success",
        text: `Sobram ${formatBRL(monthResult)} este mês. Tente chegar a 20% de reserva — faltam ${formatBRL(totalEntradas * 0.2 - monthResult)}.` });
    }
  }
 
  // --- acumulado ---
  if (accumulated < 0) {
    tips.push({ icon: "📉", type: "danger",
      text: `Déficit acumulado de ${formatBRL(Math.abs(accumulated))}. Priorize cortar gastos variáveis antes de novos compromissos.` });
  } else if (accumulated >= 500 && monthResult >= 0) {
    tips.push({ icon: "🏦", type: "info",
      text: `Acúmulo de ${formatBRL(accumulated)} nos seus registros. Uma aplicação de liquidez diária (CDB, Nubank etc.) rende mais que a conta corrente.` });
  } else if (accumulated > 0 && accumulated < 500 && monthResult >= 0) {
    tips.push({ icon: "🐷", type: "info",
      text: `${formatBRL(accumulated)} acumulados. Continue poupando — tente montar uma reserva de 3 meses de gastos (${formatBRL(3 * (monthSaidas.reduce((s,t) => s + t.amount, 0)))}).` });
  }
 
  return tips;
}
 
// ─── APP ─────────────────────────────────────────────────────────────────────
 
export default function App() {
  const [view, setView] = useState("dashboard");
  const [transactions, setTransactions] = useState(() => loadData().transactions || []);
  const [balance, setBalance]           = useState(() => loadData().balance || 0);
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput]     = useState("");
  const [filterType, setFilterType]         = useState("all");
  const [editingId, setEditingId]           = useState(null);
 
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
 
  useEffect(() => { saveData({ transactions, balance }); }, [transactions, balance]);
 
  const emptyForm = {
    type: "saida", description: "", amount: "", date: todayStr(),
    category: "", recurrence: "unica", note: "",
    installmentMode: "parcela", purchaseTotal: "", totalInstallments: "",
    linkedDebts: [],
  };
  const [form, setForm] = useState(emptyForm);
 
  const monthTransactions = useMemo(
    () => getTransactionsForMonth(transactions, viewYear, viewMonth),
    [transactions, viewYear, viewMonth]
  );
 
  const monthEntradas = monthTransactions.filter(t => t.type === "entrada");
  const monthSaidas   = monthTransactions.filter(t => t.type === "saida");
  const totalEntradas = monthEntradas.reduce((s, t) => s + t.amount, 0);
  const totalSaidas   = monthSaidas.reduce((s, t) => s + t.amount, 0);
  const monthResult   = totalEntradas - totalSaidas;
 
  // Carry-over acumulado de todos os meses ANTES do mês visualizado
  const carryOver = useMemo(() => {
    const targetM = viewYear * 12 + viewMonth;
    const startMs = transactions.map(t => {
      const d = new Date(t.date + "T00:00:00");
      return d.getFullYear() * 12 + d.getMonth();
    });
    if (startMs.length === 0) return 0;
    const earliestM = Math.min(...startMs);
    let carry = 0;
    for (let m = earliestM; m < targetM; m++) {
      const y  = Math.floor(m / 12);
      const mo = m % 12;
      const txs = getTransactionsForMonth(transactions, y, mo);
      const e = txs.filter(t => t.type === "entrada").reduce((s, t) => s + t.amount, 0);
      const s = txs.filter(t => t.type === "saida").reduce((s, t) => s + t.amount, 0);
      carry += e - s;
    }
    return carry;
  }, [transactions, viewYear, viewMonth]);
 
  const accumulated = monthResult + carryOver;
 
  // Plano do mês: quais entradas cobrem quais saídas
  const monthPlan = useMemo(() => {
    const saidaById = {};
    for (const t of monthSaidas) saidaById[t.id] = t;
 
    const entradaPlans = monthEntradas.map(e => {
      const linked      = (e.linkedDebts || []).map(id => saidaById[id]).filter(Boolean);
      const linkedTotal = linked.reduce((s, t) => s + t.amount, 0);
      return { entrada: e, linked, linkedTotal, leftover: e.amount - linkedTotal };
    });
 
    const linkedIds    = new Set(monthEntradas.flatMap(e => e.linkedDebts || []));
    const unlinkedSaidas = monthSaidas.filter(t => !linkedIds.has(t.id));
 
    return { entradaPlans, unlinkedSaidas };
  }, [monthEntradas, monthSaidas]);
 
  const tips = useMemo(
    () => getTips(monthResult, accumulated, monthSaidas, totalEntradas),
    [monthResult, accumulated, monthSaidas, totalEntradas]
  );
 
  const projectedBalance = useMemo(() => {
    const todayISO = todayStr();
    const upcoming = monthTransactions.filter(t => t.displayDate >= todayISO);
    let proj = balance;
    for (const t of upcoming) proj += t.type === "entrada" ? t.amount : -t.amount;
    return proj;
  }, [monthTransactions, balance]);
 
  const forecast = useMemo(
    () => getAccumulatedForecast(transactions, balance),
    [transactions, balance]
  );
 
  function handleSave() {
    if (!form.description || !form.date || !form.category) return;
    let amount, totalInstallments = null, purchaseTotal = null;
 
    if (form.recurrence === "parcelado") {
      const n = parseInt(form.totalInstallments, 10);
      if (!n || n < 1) return;
      totalInstallments = n;
      if (form.installmentMode === "total") {
        const total = parseNum(form.purchaseTotal);
        if (isNaN(total) || total <= 0) return;
        amount = Math.round((total / n) * 100) / 100;
        purchaseTotal = Math.round(total * 100) / 100;
      } else {
        amount = parseNum(form.amount);
        if (isNaN(amount) || amount <= 0) return;
        purchaseTotal = Math.round(amount * n * 100) / 100;
      }
    } else {
      amount = parseNum(form.amount);
      if (isNaN(amount) || amount <= 0) return;
    }
 
    const payload = {
      type: form.type, description: form.description, amount,
      date: form.date, category: form.category, recurrence: form.recurrence,
      note: form.note, totalInstallments, purchaseTotal,
      linkedDebts: form.type === "entrada" ? (form.linkedDebts || []) : [],
    };
 
    if (editingId) {
      setTransactions(prev => prev.map(t => t.id === editingId ? { ...payload, id: editingId } : t));
      setEditingId(null);
    } else {
      const newT = { ...payload, id: generateId() };
      setTransactions(prev => [...prev, newT]);
      if (form.date <= todayStr())
        setBalance(b => form.type === "entrada" ? b + amount : b - amount);
    }
    setForm(emptyForm);
    setView("dashboard");
  }
 
  function handleDelete(id) { setTransactions(prev => prev.filter(t => t.id !== id)); }
 
  function handleEdit(t) {
    setForm({
      type: t.type, description: t.description, amount: String(t.amount),
      date: t.date, category: t.category, recurrence: t.recurrence,
      note: t.note || "", installmentMode: "parcela",
      purchaseTotal: t.purchaseTotal ? String(t.purchaseTotal) : "",
      totalInstallments: t.totalInstallments ? String(t.totalInstallments) : "",
      linkedDebts: t.linkedDebts || [],
    });
    setEditingId(t.id);
    setView("add");
  }
 
  function changeMonth(dir) {
    let m = viewMonth + dir, y = viewYear;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setViewMonth(m); setViewYear(y);
  }
 
  const filtered = filterType === "all"
    ? monthTransactions
    : monthTransactions.filter(t => t.type === filterType);
 
  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <span style={styles.logo}>💰 Finança</span>
          <span style={styles.monthLabel}>{MONTHS[viewMonth]}/{viewYear}</span>
        </div>
      </div>
 
      <div style={styles.content}>
        {view === "dashboard" && (
          <Dashboard
            balance={balance} projectedBalance={projectedBalance}
            totalEntradas={totalEntradas} totalSaidas={totalSaidas}
            monthResult={monthResult} carryOver={carryOver}
            accumulated={accumulated} monthPlan={monthPlan} tips={tips}
            monthTransactions={monthTransactions}
            editingBalance={editingBalance} balanceInput={balanceInput}
            setEditingBalance={setEditingBalance} setBalanceInput={setBalanceInput}
            setBalance={setBalance} viewMonth={viewMonth} viewYear={viewYear}
            changeMonth={changeMonth} onEdit={handleEdit} onDelete={handleDelete}
          />
        )}
        {view === "add" && (
          <AddForm
            form={form} setForm={setForm} onSave={handleSave}
            onCancel={() => { setForm(emptyForm); setEditingId(null); setView("dashboard"); }}
            editing={!!editingId} monthSaidas={monthSaidas}
          />
        )}
        {view === "history" && (
          <History
            filterType={filterType} setFilterType={setFilterType}
            filtered={filtered} onEdit={handleEdit} onDelete={handleDelete}
            viewMonth={viewMonth} viewYear={viewYear} changeMonth={changeMonth}
          />
        )}
        {view === "forecast" && <Forecast forecast={forecast} />}
      </div>
 
      <nav style={styles.nav}>
        {[
          { id: "dashboard", icon: "🏠", label: "Início"   },
          { id: "add",       icon: "➕", label: "Lançar"   },
          { id: "history",   icon: "📋", label: "Extrato"  },
          { id: "forecast",  icon: "📈", label: "Previsão" },
        ].map(tab => (
          <button key={tab.id}
            style={{ ...styles.navBtn, ...(view === tab.id ? styles.navBtnActive : {}) }}
            onClick={() => { setForm(emptyForm); setEditingId(null); setView(tab.id); }}
          >
            <span style={styles.navIcon}>{tab.icon}</span>
            <span style={styles.navLabel}>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
 
// ─── DASHBOARD ───────────────────────────────────────────────────────────────
 
function Dashboard({
  balance, projectedBalance, totalEntradas, totalSaidas, monthResult,
  carryOver, accumulated, monthPlan, tips,
  monthTransactions, editingBalance, balanceInput,
  setEditingBalance, setBalanceInput, setBalance,
  viewMonth, viewYear, changeMonth, onEdit, onDelete
}) {
  const today   = todayStr();
  const upcoming = monthTransactions.filter(t => t.displayDate >= today).slice(0, 5);
  const [showPlan, setShowPlan] = useState(false);
 
  return (
    <div>
      <div style={styles.monthNav}>
        <button style={styles.monthBtn} onClick={() => changeMonth(-1)}>‹</button>
        <span style={styles.monthTitle}>{MONTHS[viewMonth]} {viewYear}</span>
        <button style={styles.monthBtn} onClick={() => changeMonth(1)}>›</button>
      </div>
 
      {/* Saldo */}
      <div style={styles.balanceCard}>
        <div style={styles.balanceLabel}>Saldo atual na conta</div>
        {editingBalance ? (
          <div style={styles.balanceEditRow}>
            <span style={styles.balanceEditPrefix}>R$</span>
            <input style={styles.balanceEditInput} value={balanceInput}
              onChange={e => setBalanceInput(e.target.value)} placeholder="0,00" autoFocus inputMode="decimal" />
            <button style={styles.balanceSaveBtn} onClick={() => {
              const v = parseFloat(balanceInput.replace(",", "."));
              if (!isNaN(v)) setBalance(v); setEditingBalance(false);
            }}>✓</button>
            <button style={styles.balanceCancelBtn} onClick={() => setEditingBalance(false)}>✕</button>
          </div>
        ) : (
          <div style={styles.balanceValueRow}>
            <span style={styles.balanceValue}>{formatBRL(balance)}</span>
            <button style={styles.editBalanceBtn} onClick={() => { setBalanceInput(String(balance)); setEditingBalance(true); }}>✏️</button>
          </div>
        )}
        <div style={styles.projectedRow}>
          <span style={styles.projectedLabel}>Saldo previsto fim do mês</span>
          <span style={{ ...styles.projectedValue, color: projectedBalance >= 0 ? "#22c55e" : "#f87171" }}>
            {formatBRL(projectedBalance)}
          </span>
        </div>
      </div>
 
      {/* Resumo 3 cards */}
      <div style={styles.summaryRow}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryIcon}>📥</div>
          <div style={styles.summaryLabel}>Entradas</div>
          <div style={{ ...styles.summaryValue, color: "#22c55e" }}>{formatBRL(totalEntradas)}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryIcon}>📤</div>
          <div style={styles.summaryLabel}>Gastos</div>
          <div style={{ ...styles.summaryValue, color: "#f87171" }}>{formatBRL(totalSaidas)}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryIcon}>{monthResult >= 0 ? "✅" : "⚠️"}</div>
          <div style={styles.summaryLabel}>Resultado</div>
          <div style={{ ...styles.summaryValue, color: monthResult >= 0 ? "#22c55e" : "#f87171" }}>
            {formatBRL(monthResult)}
          </div>
        </div>
      </div>
 
      {/* Balanço + carry-over */}
      <MonthResultCard
        monthResult={monthResult} carryOver={carryOver} accumulated={accumulated}
        monthPlan={monthPlan} showPlan={showPlan} setShowPlan={setShowPlan}
      />
 
      {/* Dicas */}
      {tips.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={styles.sectionTitle}>💡 Dicas financeiras</div>
          {tips.map((tip, i) => <TipCard key={i} tip={tip} />)}
        </div>
      )}
 
      {/* Próximos lançamentos */}
      <div style={styles.sectionTitle}>Próximos lançamentos</div>
      {upcoming.length === 0
        ? <div style={styles.emptyMsg}>Nenhum lançamento futuro neste mês.</div>
        : <div style={styles.txList}>
            {upcoming.map((t, i) => (
              <TxRow key={t.id + t.displayDate + i} t={t} onEdit={onEdit} onDelete={onDelete} showDate />
            ))}
          </div>
      }
    </div>
  );
}
 
// ─── MONTH RESULT CARD ───────────────────────────────────────────────────────
 
function MonthResultCard({ monthResult, carryOver, accumulated, monthPlan, showPlan, setShowPlan }) {
  const hasPlan = monthPlan.entradaPlans.some(p => p.linked.length > 0) || monthPlan.unlinkedSaidas.length > 0;
 
  return (
    <div style={styles.resultCard}>
      <div style={styles.resultCardHeader}>
        <span style={styles.resultCardTitle}>📊 Balanço do Mês</span>
        {hasPlan && (
          <button style={styles.planToggleBtn} onClick={() => setShowPlan(s => !s)}>
            {showPlan ? "Fechar ▲" : "Ver plano ▼"}
          </button>
        )}
      </div>
 
      <div style={styles.resultRows}>
        <div style={styles.resultRow}>
          <span style={styles.resultRowLabel}>Resultado do mês</span>
          <span style={{ ...styles.resultRowValue, color: monthResult >= 0 ? "#22c55e" : "#f87171" }}>
            {monthResult >= 0 ? "+" : ""}{formatBRL(monthResult)}
          </span>
        </div>
        {carryOver !== 0 && (
          <div style={styles.resultRow}>
            <span style={styles.resultRowLabel}>Carry de meses anteriores</span>
            <span style={{ ...styles.resultRowValue, color: carryOver >= 0 ? "#22c55e" : "#f87171", fontSize: 13 }}>
              {carryOver >= 0 ? "+" : ""}{formatBRL(carryOver)}
            </span>
          </div>
        )}
        <div style={{ ...styles.resultRow, borderTop: `1px solid ${SURFACE2}`, paddingTop: 10, marginTop: 4 }}>
          <span style={{ ...styles.resultRowLabel, fontWeight: 700, color: TEXT }}>Acumulado total</span>
          <span style={{ ...styles.resultRowValue, color: accumulated >= 0 ? "#22c55e" : "#f87171", fontSize: 20 }}>
            {accumulated >= 0 ? "+" : ""}{formatBRL(accumulated)}
          </span>
        </div>
      </div>
 
      {showPlan && (
        <div style={styles.planSection}>
          {monthPlan.entradaPlans.map((ep, i) => {
            const cat = getCategoryInfo("entrada", ep.entrada.category);
            return (
              <div key={ep.entrada.id + i} style={styles.planEntrada}>
                <div style={styles.planEntradaHeader}>
                  <span style={{ fontWeight: 700 }}>{cat.icon} {ep.entrada.description}</span>
                  <span style={{ color: "#22c55e", fontWeight: 800 }}>{formatBRL(ep.entrada.amount)}</span>
                </div>
                {ep.linked.length > 0 ? ep.linked.map((s, j) => {
                  const sc = getCategoryInfo("saida", s.category);
                  return (
                    <div key={s.id + j} style={styles.planLinkedItem}>
                      <span style={{ color: MUTED }}>{sc.icon} {s.description}</span>
                      <span style={{ color: "#f87171" }}>−{formatBRL(s.amount)}</span>
                    </div>
                  );
                }) : (
                  <div style={{ ...styles.planLinkedItem, color: MUTED, fontStyle: "italic", fontSize: 12 }}>
                    Nenhuma conta vinculada a esta entrada
                  </div>
                )}
                <div style={styles.planLeftover}>
                  <span style={{ fontSize: 12 }}>{ep.leftover >= 0 ? "✅ Sobra" : "⚠️ Falta"}</span>
                  <span style={{ color: ep.leftover >= 0 ? "#22c55e" : "#f87171", fontWeight: 800 }}>
                    {formatBRL(Math.abs(ep.leftover))}
                  </span>
                </div>
              </div>
            );
          })}
          {monthPlan.unlinkedSaidas.length > 0 && (
            <div style={styles.planUnlinked}>
              <div style={{ color: MUTED, fontSize: 12, marginBottom: 8 }}>⚠️ Gastos sem entrada vinculada:</div>
              {monthPlan.unlinkedSaidas.map((s, i) => {
                const sc = getCategoryInfo("saida", s.category);
                return (
                  <div key={s.id + i} style={styles.planLinkedItem}>
                    <span style={{ color: MUTED }}>{sc.icon} {s.description}</span>
                    <span style={{ color: "#f87171" }}>−{formatBRL(s.amount)}</span>
                  </div>
                );
              })}
            </div>
          )}
          {monthPlan.entradaPlans.length === 0 && monthPlan.unlinkedSaidas.length === 0 && (
            <div style={{ color: MUTED, fontSize: 13, padding: "8px 0" }}>
              Nenhum lançamento cadastrado neste mês.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
 
// ─── TIP CARD ────────────────────────────────────────────────────────────────
 
function TipCard({ tip }) {
  const colors = {
    success: { bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.3)",   text: "#22c55e" },
    danger:  { bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.3)",   text: "#f87171" },
    warning: { bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)",  text: "#fbbf24" },
    info:    { bg: "rgba(99,102,241,0.1)",  border: "rgba(99,102,241,0.3)",  text: BRAND     },
    neutral: { bg: SURFACE,                 border: SURFACE2,                text: MUTED     },
  };
  const c = colors[tip.type] || colors.info;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8, display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{ fontSize: 18, lineHeight: 1.4 }}>{tip.icon}</span>
      <span style={{ fontSize: 13, color: c.text, lineHeight: 1.55 }}>{tip.text}</span>
    </div>
  );
}
 
// ─── ADD FORM ────────────────────────────────────────────────────────────────
 
function AddForm({ form, setForm, onSave, onCancel, editing, monthSaidas }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const cats = CATEGORIES[form.type] || [];
 
  const isParcelado   = form.recurrence === "parcelado";
  const totalN        = parseInt(form.totalInstallments, 10);
  const purchaseTotalNum = parseNum(form.purchaseTotal);
  const amountNum     = parseNum(form.amount);
 
  let preview = null;
  if (isParcelado && totalN > 0) {
    if (form.installmentMode === "total" && !isNaN(purchaseTotalNum) && purchaseTotalNum > 0)
      preview = `${totalN}x de ${formatBRL(purchaseTotalNum / totalN)}`;
    else if (form.installmentMode !== "total" && !isNaN(amountNum) && amountNum > 0)
      preview = `Total da compra: ${formatBRL(amountNum * totalN)} em ${totalN}x`;
  }
 
  // Debt linker
  const linkedDebts = form.linkedDebts || [];
  const toggleDebt  = (id) => set("linkedDebts",
    linkedDebts.includes(id) ? linkedDebts.filter(d => d !== id) : [...linkedDebts, id]
  );
  const linkedTotal = monthSaidas.filter(s => linkedDebts.includes(s.id)).reduce((sum, s) => sum + s.amount, 0);
  const incomeAmt   = isParcelado
    ? (form.installmentMode === "total"
        ? (!isNaN(purchaseTotalNum) && totalN > 0 ? purchaseTotalNum / totalN : 0)
        : (!isNaN(amountNum) ? amountNum : 0))
    : (!isNaN(amountNum) ? amountNum : 0);
  const leftover = incomeAmt - linkedTotal;
 
  const canSave = (() => {
    if (!form.description || !form.date || !form.category) return false;
    if (isParcelado) {
      if (!totalN || totalN < 1) return false;
      return form.installmentMode === "total"
        ? !isNaN(purchaseTotalNum) && purchaseTotalNum > 0
        : !isNaN(amountNum) && amountNum > 0;
    }
    return !isNaN(amountNum) && amountNum > 0;
  })();
 
  return (
    <div>
      <div style={styles.formTitle}>{editing ? "Editar lançamento" : "Novo lançamento"}</div>
 
      <div style={styles.typeToggle}>
        <button style={{ ...styles.typeBtn, ...(form.type === "entrada" ? styles.typeBtnEntrada : styles.typeBtnOff) }}
          onClick={() => { set("type", "entrada"); set("category", ""); set("linkedDebts", []); }}>
          📥 Entrada</button>
        <button style={{ ...styles.typeBtn, ...(form.type === "saida" ? styles.typeBtnSaida : styles.typeBtnOff) }}
          onClick={() => { set("type", "saida"); set("category", ""); set("linkedDebts", []); }}>
          📤 Gasto</button>
      </div>
 
      <label style={styles.label}>Descrição</label>
      <input style={styles.input} placeholder="Ex: Salário, Aluguel, Supermercado..."
        value={form.description} onChange={e => set("description", e.target.value)} />
 
      {!isParcelado && (
        <>
          <label style={styles.label}>Valor (R$)</label>
          <input style={styles.input} placeholder="0,00" value={form.amount}
            onChange={e => set("amount", e.target.value)} inputMode="decimal" />
        </>
      )}
 
      <label style={styles.label}>{isParcelado ? "Data da 1ª parcela" : "Data"}</label>
      <input style={styles.input} type="date" value={form.date} onChange={e => set("date", e.target.value)} />
 
      <label style={styles.label}>Repetição</label>
      <div style={styles.recurrenceRow}>
        {RECURRENCE.map(r => (
          <button key={r.id}
            style={{ ...styles.recBtn, ...(form.recurrence === r.id ? styles.recBtnActive : {}) }}
            onClick={() => { set("recurrence", r.id); if (r.id === "parcelado" && form.type === "saida" && !form.category) set("category", "parcela"); }}>
            {r.label}</button>
        ))}
      </div>
 
      {isParcelado && (
        <div style={styles.installmentBox}>
          <label style={styles.label}>Número de parcelas</label>
          <input style={styles.input} placeholder="Ex: 12" value={form.totalInstallments}
            onChange={e => set("totalInstallments", e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
          <div style={styles.installmentModeRow}>
            <button style={{ ...styles.installmentModeBtn, ...(form.installmentMode !== "total" ? styles.installmentModeBtnActive : {}) }}
              onClick={() => set("installmentMode", "parcela")}>Sei o valor da parcela</button>
            <button style={{ ...styles.installmentModeBtn, ...(form.installmentMode === "total" ? styles.installmentModeBtnActive : {}) }}
              onClick={() => set("installmentMode", "total")}>Sei o valor total</button>
          </div>
          {form.installmentMode === "total" ? (
            <>
              <label style={styles.label}>Valor total da compra (R$)</label>
              <input style={styles.input} placeholder="Ex: 1000,00" value={form.purchaseTotal}
                onChange={e => set("purchaseTotal", e.target.value)} inputMode="decimal" />
            </>
          ) : (
            <>
              <label style={styles.label}>Valor de cada parcela (R$)</label>
              <input style={styles.input} placeholder="Ex: 83,33" value={form.amount}
                onChange={e => set("amount", e.target.value)} inputMode="decimal" />
            </>
          )}
          {preview && <div style={styles.installmentPreview}>🧮 {preview}</div>}
        </div>
      )}
 
      <label style={styles.label}>Categoria</label>
      <div style={styles.catGrid}>
        {cats.map(c => (
          <button key={c.id}
            style={{ ...styles.catBtn, ...(form.category === c.id ? styles.catBtnActive : {}) }}
            onClick={() => set("category", c.id)}>
            <span>{c.icon}</span>
            <span style={styles.catLabel}>{c.label}</span>
          </button>
        ))}
      </div>
 
      {/* Vinculador de dívidas — só para entradas */}
      {form.type === "entrada" && (
        <div style={styles.debtLinkerBox}>
          <div style={styles.debtLinkerTitle}>💳 Quais contas vai pagar com essa entrada?</div>
          {monthSaidas.length === 0 ? (
            <div style={{ color: MUTED, fontSize: 13, padding: "10px 0 4px" }}>
              Nenhum gasto cadastrado neste mês ainda. Adicione seus gastos primeiro.
            </div>
          ) : (
            <>
              {monthSaidas.map((s, i) => {
                const cat     = getCategoryInfo("saida", s.category);
                const checked = linkedDebts.includes(s.id);
                return (
                  <div key={s.id + i}
                    style={{ ...styles.debtItem, ...(checked ? styles.debtItemChecked : {}) }}
                    onClick={() => toggleDebt(s.id)}>
                    <span style={styles.debtCheckbox}>{checked ? "✅" : "⬜"}</span>
                    <span style={styles.debtDesc}>{cat.icon} {s.description}</span>
                    <span style={{ color: "#f87171", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
                      {formatBRL(s.amount)}
                    </span>
                  </div>
                );
              })}
              <div style={styles.debtSummary}>
                <div style={styles.debtSummaryRow}>
                  <span style={{ color: MUTED, fontSize: 13 }}>Total da entrada</span>
                  <span style={{ color: "#22c55e", fontWeight: 700 }}>{formatBRL(incomeAmt)}</span>
                </div>
                <div style={styles.debtSummaryRow}>
                  <span style={{ color: MUTED, fontSize: 13 }}>Contas vinculadas</span>
                  <span style={{ color: "#f87171", fontWeight: 700 }}>−{formatBRL(linkedTotal)}</span>
                </div>
                <div style={{ ...styles.debtSummaryRow, borderTop: `1px solid ${SURFACE2}`, paddingTop: 8, marginTop: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>
                    {leftover >= 0 ? "✅ Vai sobrar" : "⚠️ Vai faltar"}
                  </span>
                  <span style={{ color: leftover >= 0 ? "#22c55e" : "#f87171", fontWeight: 800, fontSize: 18 }}>
                    {formatBRL(Math.abs(leftover))}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
 
      <label style={styles.label}>Observação (opcional)</label>
      <input style={styles.input} placeholder="Anotação extra..." value={form.note}
        onChange={e => set("note", e.target.value)} />
 
      <div style={styles.formBtns}>
        <button style={styles.cancelBtn} onClick={onCancel}>Cancelar</button>
        <button style={{ ...styles.saveBtn, opacity: canSave ? 1 : 0.4 }} onClick={canSave ? onSave : undefined}>
          {editing ? "Salvar" : "Adicionar"}
        </button>
      </div>
    </div>
  );
}
 
// ─── HISTORY ─────────────────────────────────────────────────────────────────
 
function History({ filterType, setFilterType, filtered, onEdit, onDelete, viewMonth, viewYear, changeMonth }) {
  return (
    <div>
      <div style={styles.monthNav}>
        <button style={styles.monthBtn} onClick={() => changeMonth(-1)}>‹</button>
        <span style={styles.monthTitle}>{MONTHS[viewMonth]} {viewYear}</span>
        <button style={styles.monthBtn} onClick={() => changeMonth(1)}>›</button>
      </div>
      <div style={styles.filterRow}>
        {[["all","Todos"],["entrada","Entradas"],["saida","Gastos"]].map(([v,l]) => (
          <button key={v}
            style={{ ...styles.filterBtn, ...(filterType === v ? styles.filterBtnActive : {}) }}
            onClick={() => setFilterType(v)}>{l}</button>
        ))}
      </div>
      {filtered.length === 0
        ? <div style={styles.emptyMsg}>Nenhum lançamento encontrado.</div>
        : <div style={styles.txList}>
            {filtered.map((t, i) => (
              <TxRow key={t.id + t.displayDate + i} t={t} onEdit={onEdit} onDelete={onDelete} showDate />
            ))}
          </div>
      }
    </div>
  );
}
 
// ─── FORECAST ────────────────────────────────────────────────────────────────
 
function Forecast({ forecast }) {
  const maxVal = Math.max(...forecast.map(f => Math.max(f.entradas, f.saidas)), 1);
 
  return (
    <div>
      <div style={styles.formTitle}>Previsão — próximos 6 meses</div>
      <div style={{ color: MUTED, fontSize: 12, marginBottom: 16 }}>
        O acumulado considera o saldo atual e o resultado de cada mês.
      </div>
      <div style={styles.forecastList}>
        {forecast.map((f, i) => (
          <div key={i} style={styles.forecastCard}>
            <div style={{ minWidth: 52 }}>
              <div style={styles.forecastMonthLabel}>{f.label}</div>
              {i === 0 && <div style={{ fontSize: 10, color: MUTED }}>este mês</div>}
            </div>
            <div style={styles.forecastBars}>
              <div style={styles.forecastBarWrap}>
                <div style={{ ...styles.forecastBar, height: `${(f.entradas / maxVal) * 72}px`, background: "#22c55e" }} />
                <span style={{ ...styles.forecastBarLabel, color: "#22c55e" }}>{formatBRL(f.entradas)}</span>
                <span style={styles.forecastBarTitle}>Entradas</span>
              </div>
              <div style={styles.forecastBarWrap}>
                <div style={{ ...styles.forecastBar, height: `${(f.saidas / maxVal) * 72}px`, background: "#f87171" }} />
                <span style={{ ...styles.forecastBarLabel, color: "#f87171" }}>{formatBRL(f.saidas)}</span>
                <span style={styles.forecastBarTitle}>Gastos</span>
              </div>
            </div>
            <div style={{ textAlign: "right", minWidth: 80 }}>
              <div style={{ ...styles.forecastResult, color: f.net >= 0 ? "#22c55e" : "#f87171" }}>
                {f.net >= 0 ? "+" : ""}{formatBRL(f.net)}
              </div>
              <div style={{ fontSize: 10, color: MUTED, marginBottom: 4 }}>este mês</div>
              <div style={{ ...styles.forecastResult, fontSize: 13, color: f.accumulated >= 0 ? "#a5b4fc" : "#fca5a5" }}>
                {f.accumulated >= 0 ? "+" : ""}{formatBRL(f.accumulated)}
              </div>
              <div style={{ fontSize: 10, color: MUTED }}>acumulado</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
 
// ─── TX ROW ──────────────────────────────────────────────────────────────────
 
function TxRow({ t, onEdit, onDelete, showDate }) {
  const cat       = getCategoryInfo(t.type, t.category);
  const [open, setOpen] = useState(false);
  const isParcelado = t.recurrence === "parcelado";
  const hasLinked   = t.type === "entrada" && (t.linkedDebts || []).length > 0;
 
  return (
    <div style={styles.txRow} onClick={() => setOpen(o => !o)}>
      <div style={styles.txMain}>
        <div style={styles.txIcon}>{cat.icon}</div>
        <div style={styles.txInfo}>
          <div style={styles.txDesc}>{t.description}</div>
          <div style={styles.txMeta}>
            {showDate && <span>{formatDate(t.displayDate || t.date)}</span>}
            <span>{cat.label}</span>
            {isParcelado && t.installmentNumber
              ? <span style={styles.installmentBadge}>💳 {t.installmentNumber}/{t.totalInstallments}</span>
              : t.recurrence !== "unica" ? <span>🔁</span> : null}
            {hasLinked && <span style={styles.linkedBadge}>📎 {t.linkedDebts.length} vinculada{t.linkedDebts.length > 1 ? "s" : ""}</span>}
          </div>
        </div>
        <div style={{ ...styles.txAmount, color: t.type === "entrada" ? "#22c55e" : "#f87171" }}>
          {t.type === "entrada" ? "+" : "-"}{formatBRL(t.amount)}
        </div>
      </div>
      {open && (
        <div style={styles.txActions}>
          {isParcelado && t.purchaseTotal && (
            <div style={styles.txNote}>🧾 Compra total: {formatBRL(t.purchaseTotal)} em {t.totalInstallments}x</div>
          )}
          {t.note && <div style={styles.txNote}>📝 {t.note}</div>}
          <div style={styles.txBtns}>
            <button style={styles.txEditBtn} onClick={e => { e.stopPropagation(); onEdit(t); }}>✏️ Editar</button>
            <button style={styles.txDelBtn}  onClick={e => { e.stopPropagation(); onDelete(t.id); }}>🗑️ Excluir</button>
          </div>
        </div>
      )}
    </div>
  );
}
 
// ─── STYLES ──────────────────────────────────────────────────────────────────
 
const BRAND      = "#6366f1";
const BRAND_DARK = "#4f46e5";
const BG         = "#0f0f13";
const SURFACE    = "#1a1a24";
const SURFACE2   = "#22223a";
const TEXT       = "#f1f1f5";
const MUTED      = "#8888a8";
 
const styles = {
  root: { fontFamily: "'Inter', system-ui, sans-serif", background: BG, minHeight: "100dvh", color: TEXT, display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto", position: "relative" },
  header: { background: SURFACE, borderBottom: `1px solid ${SURFACE2}`, padding: "14px 20px", position: "sticky", top: 0, zIndex: 10 },
  headerInner: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  logo: { fontSize: 20, fontWeight: 700, letterSpacing: -0.5 },
  monthLabel: { fontSize: 13, color: MUTED },
  content: { flex: 1, overflowY: "auto", padding: "16px 16px 100px" },
  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: SURFACE, borderTop: `1px solid ${SURFACE2}`, display: "flex", justifyContent: "space-around", padding: "8px 0 max(8px, env(safe-area-inset-bottom))", zIndex: 20 },
  navBtn: { background: "none", border: "none", color: MUTED, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", padding: "4px 12px", borderRadius: 8 },
  navBtnActive: { color: BRAND },
  navIcon: { fontSize: 22 },
  navLabel: { fontSize: 10, fontWeight: 500 },
  monthNav: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 16 },
  monthBtn: { background: SURFACE2, border: "none", color: TEXT, fontSize: 20, cursor: "pointer", borderRadius: 8, padding: "4px 12px" },
  monthTitle: { fontSize: 16, fontWeight: 700 },
  balanceCard: { background: `linear-gradient(135deg, ${BRAND_DARK} 0%, #7c3aed 100%)`, borderRadius: 16, padding: "20px 20px 16px", marginBottom: 16 },
  balanceLabel: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 },
  balanceValueRow: { display: "flex", alignItems: "center", gap: 10 },
  balanceValue: { fontSize: 32, fontWeight: 800, letterSpacing: -1 },
  editBalanceBtn: { background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", borderRadius: 8, padding: "4px 8px", fontSize: 14 },
  balanceEditRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  balanceEditPrefix: { fontSize: 18, fontWeight: 700 },
  balanceEditInput: { background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 8, padding: "6px 10px", color: TEXT, fontSize: 24, fontWeight: 700, width: 140, outline: "none" },
  balanceSaveBtn: { background: "#22c55e", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700 },
  balanceCancelBtn: { background: "rgba(255,255,255,0.15)", border: "none", color: TEXT, borderRadius: 8, padding: "6px 10px", cursor: "pointer" },
  projectedRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.15)" },
  projectedLabel: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  projectedValue: { fontSize: 16, fontWeight: 700 },
  summaryRow: { display: "flex", gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, background: SURFACE, borderRadius: 12, padding: "12px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  summaryIcon: { fontSize: 20 },
  summaryLabel: { fontSize: 11, color: MUTED },
  summaryValue: { fontSize: 14, fontWeight: 700 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: MUTED, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  emptyMsg: { color: MUTED, textAlign: "center", padding: "30px 0", fontSize: 14 },
  txList: { display: "flex", flexDirection: "column", gap: 8 },
  txRow: { background: SURFACE, borderRadius: 12, padding: "12px 14px", cursor: "pointer" },
  txMain: { display: "flex", alignItems: "center", gap: 12 },
  txIcon: { fontSize: 22, width: 36, textAlign: "center" },
  txInfo: { flex: 1, minWidth: 0 },
  txDesc: { fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  txMeta: { fontSize: 11, color: MUTED, display: "flex", gap: 8, marginTop: 2, flexWrap: "wrap" },
  txAmount: { fontSize: 15, fontWeight: 700, whiteSpace: "nowrap" },
  txActions: { borderTop: `1px solid ${SURFACE2}`, marginTop: 10, paddingTop: 10 },
  txNote: { fontSize: 12, color: MUTED, marginBottom: 8 },
  txBtns: { display: "flex", gap: 8 },
  txEditBtn: { background: SURFACE2, border: "none", color: TEXT, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 },
  txDelBtn: { background: "rgba(239,68,68,0.15)", border: "none", color: "#f87171", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 },
  // Result Card
  resultCard: { background: SURFACE, borderRadius: 14, padding: "14px 16px", marginBottom: 16 },
  resultCardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  resultCardTitle: { fontWeight: 700, fontSize: 14 },
  planToggleBtn: { background: "rgba(99,102,241,0.15)", border: `1px solid ${BRAND}`, color: BRAND, borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 },
  resultRows: { display: "flex", flexDirection: "column", gap: 8 },
  resultRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  resultRowLabel: { color: MUTED, fontSize: 13 },
  resultRowValue: { fontWeight: 700, fontSize: 15 },
  planSection: { borderTop: `1px solid ${SURFACE2}`, marginTop: 14, paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 },
  planEntrada: { background: BG, borderRadius: 10, padding: "12px 14px" },
  planEntradaHeader: { display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8 },
  planLinkedItem: { display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" },
  planLeftover: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTop: `1px solid ${SURFACE2}` },
  planUnlinked: { background: "rgba(239,68,68,0.06)", borderRadius: 10, padding: "10px 14px", border: `1px solid rgba(239,68,68,0.2)` },
  // Debt Linker
  debtLinkerBox: { background: SURFACE2, borderRadius: 12, padding: "14px", marginBottom: 14 },
  debtLinkerTitle: { fontWeight: 700, fontSize: 13, marginBottom: 12, color: TEXT },
  debtItem: { display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", borderRadius: 10, marginBottom: 6, cursor: "pointer", border: `1px solid transparent`, background: BG },
  debtItemChecked: { border: `1px solid ${BRAND}`, background: "rgba(99,102,241,0.1)" },
  debtCheckbox: { fontSize: 16, flexShrink: 0 },
  debtDesc: { flex: 1, fontSize: 13, fontWeight: 600 },
  debtSummary: { background: SURFACE, borderRadius: 10, padding: "12px 14px", marginTop: 10, display: "flex", flexDirection: "column", gap: 6 },
  debtSummaryRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  // Form
  formTitle: { fontSize: 18, fontWeight: 800, marginBottom: 20 },
  typeToggle: { display: "flex", gap: 10, marginBottom: 18 },
  typeBtn: { flex: 1, padding: "12px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700 },
  typeBtnEntrada: { background: "rgba(34,197,94,0.2)", color: "#22c55e", border: "2px solid #22c55e" },
  typeBtnSaida: { background: "rgba(248,113,113,0.2)", color: "#f87171", border: "2px solid #f87171" },
  typeBtnOff: { background: SURFACE, color: MUTED, border: "2px solid transparent" },
  label: { display: "block", fontSize: 12, color: MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 },
  input: { width: "100%", background: SURFACE, border: `1px solid ${SURFACE2}`, borderRadius: 10, padding: "12px 14px", color: TEXT, fontSize: 15, marginBottom: 14, outline: "none", boxSizing: "border-box" },
  recurrenceRow: { display: "flex", gap: 8, marginBottom: 14 },
  recBtn: { flex: 1, padding: "8px 4px", borderRadius: 8, border: `1px solid ${SURFACE2}`, background: SURFACE, color: MUTED, cursor: "pointer", fontSize: 11, fontWeight: 600 },
  recBtnActive: { background: "rgba(99,102,241,0.2)", color: BRAND, border: `1px solid ${BRAND}` },
  installmentBox: { background: SURFACE2, borderRadius: 12, padding: "14px 14px 4px", marginBottom: 14 },
  installmentModeRow: { display: "flex", gap: 8, marginBottom: 14 },
  installmentModeBtn: { flex: 1, padding: "8px 6px", borderRadius: 8, border: `1px solid ${SURFACE}`, background: BG, color: MUTED, cursor: "pointer", fontSize: 11, fontWeight: 600 },
  installmentModeBtnActive: { background: "rgba(99,102,241,0.2)", color: BRAND, border: `1px solid ${BRAND}` },
  installmentPreview: { background: "rgba(99,102,241,0.15)", color: BRAND, borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 700, textAlign: "center", marginBottom: 14 },
  installmentBadge: { background: "rgba(99,102,241,0.18)", color: BRAND, borderRadius: 6, padding: "1px 6px", fontWeight: 700 },
  linkedBadge: { background: "rgba(34,197,94,0.15)", color: "#22c55e", borderRadius: 6, padding: "1px 6px", fontWeight: 600 },
  catGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 },
  catBtn: { background: SURFACE, border: `1px solid ${SURFACE2}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: TEXT },
  catBtnActive: { background: "rgba(99,102,241,0.2)", border: `1px solid ${BRAND}`, color: BRAND },
  catLabel: { fontSize: 12, fontWeight: 600 },
  formBtns: { display: "flex", gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, padding: "14px", background: SURFACE, border: "none", borderRadius: 12, color: MUTED, cursor: "pointer", fontSize: 15, fontWeight: 700 },
  saveBtn: { flex: 2, padding: "14px", background: BRAND, border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", fontSize: 15, fontWeight: 800 },
  filterRow: { display: "flex", gap: 8, marginBottom: 16 },
  filterBtn: { padding: "8px 16px", borderRadius: 20, border: `1px solid ${SURFACE2}`, background: SURFACE, color: MUTED, cursor: "pointer", fontSize: 13, fontWeight: 600 },
  filterBtnActive: { background: BRAND, color: "#fff", border: `1px solid ${BRAND}` },
  forecastList: { display: "flex", flexDirection: "column", gap: 12 },
  forecastCard: { background: SURFACE, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "flex-end", gap: 14 },
  forecastMonthLabel: { fontSize: 13, fontWeight: 700 },
  forecastBars: { flex: 1, display: "flex", gap: 12, alignItems: "flex-end", height: 88 },
  forecastBarWrap: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, justifyContent: "flex-end" },
  forecastBar: { width: "100%", borderRadius: "4px 4px 0 0", minHeight: 4 },
  forecastBarLabel: { fontSize: 9, textAlign: "center" },
  forecastBarTitle: { fontSize: 9, color: MUTED },
  forecastResult: { fontSize: 15, fontWeight: 800 },
};
