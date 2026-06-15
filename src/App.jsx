import { useState, useMemo, useEffect } from "react";

const CATEGORIES = {
  entrada: [
    { id: "salario", label: "Salário", icon: "💼" },
    { id: "freelance", label: "Freelance", icon: "💻" },
    { id: "beneficio", label: "Benefício / INSS", icon: "🏛️" },
    { id: "outros_entrada", label: "Outros", icon: "➕" },
  ],
  saida: [
    { id: "moradia", label: "Moradia", icon: "🏠" },
    { id: "alimentacao", label: "Alimentação", icon: "🛒" },
    { id: "transporte", label: "Transporte", icon: "🚌" },
    { id: "saude", label: "Saúde", icon: "💊" },
    { id: "educacao", label: "Educação", icon: "📚" },
    { id: "lazer", label: "Lazer", icon: "🎮" },
    { id: "parcela", label: "Parcela / Crédito", icon: "💳" },
    { id: "outros_saida", label: "Outros", icon: "➖" },
  ],
};

const RECURRENCE = [
  { id: "unica", label: "Única vez" },
  { id: "mensal", label: "Todo mês" },
  { id: "semanal", label: "Toda semana" },
];

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
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
  } catch {
    return { transactions: [], balance: 0 };
  }
}

function saveData(data) {
  try {
    localStorage.setItem("finapp_v1", JSON.stringify(data));
  } catch {}
}

function getTransactionsForMonth(transactions, year, month) {
  const results = [];
  for (const t of transactions) {
    if (t.recurrence === "unica") {
      const d = new Date(t.date + "T00:00:00");
      if (d.getFullYear() === year && d.getMonth() === month) {
        results.push({ ...t, displayDate: t.date });
      }
    } else if (t.recurrence === "mensal") {
      const startDate = new Date(t.date + "T00:00:00");
      const startMonth = startDate.getFullYear() * 12 + startDate.getMonth();
      const targetMonth = year * 12 + month;
      if (targetMonth >= startMonth) {
        const day = startDate.getDate().toString().padStart(2, "0");
        const mon = (month + 1).toString().padStart(2, "0");
        results.push({ ...t, displayDate: `${year}-${mon}-${day}` });
      }
    } else if (t.recurrence === "semanal") {
      const startDate = new Date(t.date + "T00:00:00");
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      let cur = new Date(startDate);
      while (cur <= lastDay) {
        if (cur >= firstDay && cur >= startDate) {
          const dd = cur.getDate().toString().padStart(2, "0");
          const mm = (cur.getMonth() + 1).toString().padStart(2, "0");
          results.push({ ...t, displayDate: `${year}-${mm}-${dd}` });
        }
        cur.setDate(cur.getDate() + 7);
      }
    }
  }
  return results.sort((a, b) => a.displayDate.localeCompare(b.displayDate));
}

function getCategoryInfo(type, catId) {
  const list = CATEGORIES[type] || [];
  return list.find(c => c.id === catId) || { label: catId || "Geral", icon: "•" };
}

export default function App() {
  const [view, setView] = useState("dashboard");
  const [transactions, setTransactions] = useState(() => loadData().transactions || []);
  const [balance, setBalance] = useState(() => loadData().balance || 0);
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [editingId, setEditingId] = useState(null);

  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());

  useEffect(() => {
    saveData({ transactions, balance });
  }, [transactions, balance]);

  const emptyForm = {
    type: "saida",
    description: "",
    amount: "",
    date: todayStr(),
    category: "",
    recurrence: "unica",
    note: "",
  };
  const [form, setForm] = useState(emptyForm);

  const monthTransactions = useMemo(
    () => getTransactionsForMonth(transactions, viewYear, viewMonth),
    [transactions, viewYear, viewMonth]
  );

  const monthEntradas = monthTransactions.filter(t => t.type === "entrada");
  const monthSaidas = monthTransactions.filter(t => t.type === "saida");
  const totalEntradas = monthEntradas.reduce((s, t) => s + t.amount, 0);
  const totalSaidas = monthSaidas.reduce((s, t) => s + t.amount, 0);
  const monthResult = totalEntradas - totalSaidas;

  const projectedBalance = useMemo(() => {
    const todayISO = todayStr();
    const upcoming = monthTransactions.filter(t => t.displayDate >= todayISO);
    let proj = balance;
    for (const t of upcoming) {
      if (t.type === "entrada") proj += t.amount;
      else proj -= t.amount;
    }
    return proj;
  }, [monthTransactions, balance]);

  const forecast = useMemo(() => {
    const result = [];
    for (let i = 0; i < 6; i++) {
      let m = (now.getMonth() + i) % 12;
      let y = now.getFullYear() + Math.floor((now.getMonth() + i) / 12);
      const txs = getTransactionsForMonth(transactions, y, m);
      const entradas = txs.filter(t => t.type === "entrada").reduce((s, t) => s + t.amount, 0);
      const saidas = txs.filter(t => t.type === "saida").reduce((s, t) => s + t.amount, 0);
      result.push({ label: `${MONTHS[m]}/${y}`, entradas, saidas, saldo: entradas - saidas });
    }
    return result;
  }, [transactions]);

  function handleSave() {
    if (!form.description || !form.amount || !form.date || !form.category) return;
    const amount = parseFloat(form.amount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) return;

    if (editingId) {
      setTransactions(prev => prev.map(t =>
        t.id === editingId ? { ...form, amount, id: editingId } : t
      ));
      setEditingId(null);
    } else {
      const newT = { ...form, amount, id: generateId() };
      setTransactions(prev => [...prev, newT]);
      if (form.date <= todayStr()) {
        if (form.type === "entrada") setBalance(b => b + amount);
        else setBalance(b => b - amount);
      }
    }
    setForm(emptyForm);
    setView("dashboard");
  }

  function handleDelete(id) {
    setTransactions(prev => prev.filter(t => t.id !== id));
  }

  function handleEdit(t) {
    setForm({
      type: t.type,
      description: t.description,
      amount: String(t.amount),
      date: t.date,
      category: t.category,
      recurrence: t.recurrence,
      note: t.note || "",
    });
    setEditingId(t.id);
    setView("add");
  }

  function changeMonth(dir) {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewMonth(m);
    setViewYear(y);
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
            balance={balance}
            projectedBalance={projectedBalance}
            totalEntradas={totalEntradas}
            totalSaidas={totalSaidas}
            monthResult={monthResult}
            monthTransactions={monthTransactions}
            editingBalance={editingBalance}
            balanceInput={balanceInput}
            setEditingBalance={setEditingBalance}
            setBalanceInput={setBalanceInput}
            setBalance={setBalance}
            viewMonth={viewMonth}
            viewYear={viewYear}
            changeMonth={changeMonth}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
        {view === "add" && (
          <AddForm
            form={form}
            setForm={setForm}
            onSave={handleSave}
            onCancel={() => { setForm(emptyForm); setEditingId(null); setView("dashboard"); }}
            editing={!!editingId}
          />
        )}
        {view === "history" && (
          <History
            filterType={filterType}
            setFilterType={setFilterType}
            filtered={filtered}
            onEdit={handleEdit}
            onDelete={handleDelete}
            viewMonth={viewMonth}
            viewYear={viewYear}
            changeMonth={changeMonth}
          />
        )}
        {view === "forecast" && (
          <Forecast forecast={forecast} />
        )}
      </div>

      <nav style={styles.nav}>
        {[
          { id: "dashboard", icon: "🏠", label: "Início" },
          { id: "add", icon: "➕", label: "Lançar" },
          { id: "history", icon: "📋", label: "Extrato" },
          { id: "forecast", icon: "📈", label: "Previsão" },
        ].map(tab => (
          <button
            key={tab.id}
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

function Dashboard({
  balance, projectedBalance, totalEntradas, totalSaidas, monthResult,
  monthTransactions, editingBalance, balanceInput,
  setEditingBalance, setBalanceInput, setBalance,
  viewMonth, viewYear, changeMonth, onEdit, onDelete
}) {
  const today = todayStr();
  const upcoming = monthTransactions.filter(t => t.displayDate >= today).slice(0, 5);

  return (
    <div>
      <div style={styles.monthNav}>
        <button style={styles.monthBtn} onClick={() => changeMonth(-1)}>‹</button>
        <span style={styles.monthTitle}>{MONTHS[viewMonth]} {viewYear}</span>
        <button style={styles.monthBtn} onClick={() => changeMonth(1)}>›</button>
      </div>

      <div style={styles.balanceCard}>
        <div style={styles.balanceLabel}>Saldo atual na conta</div>
        {editingBalance ? (
          <div style={styles.balanceEditRow}>
            <span style={styles.balanceEditPrefix}>R$</span>
            <input
              style={styles.balanceEditInput}
              value={balanceInput}
              onChange={e => setBalanceInput(e.target.value)}
              placeholder="0,00"
              autoFocus
              inputMode="decimal"
            />
            <button style={styles.balanceSaveBtn} onClick={() => {
              const v = parseFloat(balanceInput.replace(",", "."));
              if (!isNaN(v)) setBalance(v);
              setEditingBalance(false);
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
          <div style={{ ...styles.summaryValue, color: monthResult >= 0 ? "#22c55e" : "#f87171" }}>{formatBRL(monthResult)}</div>
        </div>
      </div>

      <div style={styles.sectionTitle}>Próximos lançamentos</div>
      {upcoming.length === 0 ? (
        <div style={styles.emptyMsg}>Nenhum lançamento futuro neste mês.</div>
      ) : (
        <div style={styles.txList}>
          {upcoming.map((t, i) => (
            <TxRow key={t.id + t.displayDate + i} t={t} onEdit={onEdit} onDelete={onDelete} showDate />
          ))}
        </div>
      )}
    </div>
  );
}

function AddForm({ form, setForm, onSave, onCancel, editing }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const cats = CATEGORIES[form.type] || [];
  const canSave = form.description && form.amount && form.date && form.category;

  return (
    <div>
      <div style={styles.formTitle}>{editing ? "Editar lançamento" : "Novo lançamento"}</div>

      <div style={styles.typeToggle}>
        <button
          style={{ ...styles.typeBtn, ...(form.type === "entrada" ? styles.typeBtnEntrada : styles.typeBtnOff) }}
          onClick={() => { set("type", "entrada"); set("category", ""); }}
        >📥 Entrada</button>
        <button
          style={{ ...styles.typeBtn, ...(form.type === "saida" ? styles.typeBtnSaida : styles.typeBtnOff) }}
          onClick={() => { set("type", "saida"); set("category", ""); }}
        >📤 Gasto</button>
      </div>

      <label style={styles.label}>Descrição</label>
      <input
        style={styles.input}
        placeholder="Ex: Aluguel, Supermercado..."
        value={form.description}
        onChange={e => set("description", e.target.value)}
      />

      <label style={styles.label}>Valor (R$)</label>
      <input
        style={styles.input}
        placeholder="0,00"
        value={form.amount}
        onChange={e => set("amount", e.target.value)}
        inputMode="decimal"
      />

      <label style={styles.label}>Data</label>
      <input
        style={styles.input}
        type="date"
        value={form.date}
        onChange={e => set("date", e.target.value)}
      />

      <label style={styles.label}>Repetição</label>
      <div style={styles.recurrenceRow}>
        {RECURRENCE.map(r => (
          <button
            key={r.id}
            style={{ ...styles.recBtn, ...(form.recurrence === r.id ? styles.recBtnActive : {}) }}
            onClick={() => set("recurrence", r.id)}
          >{r.label}</button>
        ))}
      </div>

      <label style={styles.label}>Categoria</label>
      <div style={styles.catGrid}>
        {cats.map(c => (
          <button
            key={c.id}
            style={{ ...styles.catBtn, ...(form.category === c.id ? styles.catBtnActive : {}) }}
            onClick={() => set("category", c.id)}
          >
            <span>{c.icon}</span>
            <span style={styles.catLabel}>{c.label}</span>
          </button>
        ))}
      </div>

      <label style={styles.label}>Observação (opcional)</label>
      <input
        style={styles.input}
        placeholder="Anotação extra..."
        value={form.note}
        onChange={e => set("note", e.target.value)}
      />

      <div style={styles.formBtns}>
        <button style={styles.cancelBtn} onClick={onCancel}>Cancelar</button>
        <button
          style={{ ...styles.saveBtn, opacity: canSave ? 1 : 0.4 }}
          onClick={canSave ? onSave : undefined}
        >{editing ? "Salvar" : "Adicionar"}</button>
      </div>
    </div>
  );
}

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
          <button
            key={v}
            style={{ ...styles.filterBtn, ...(filterType === v ? styles.filterBtnActive : {}) }}
            onClick={() => setFilterType(v)}
          >{l}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={styles.emptyMsg}>Nenhum lançamento encontrado.</div>
      ) : (
        <div style={styles.txList}>
          {filtered.map((t, i) => (
            <TxRow key={t.id + t.displayDate + i} t={t} onEdit={onEdit} onDelete={onDelete} showDate />
          ))}
        </div>
      )}
    </div>
  );
}

function Forecast({ forecast }) {
  const maxVal = Math.max(...forecast.map(f => Math.max(f.entradas, f.saidas)), 1);

  return (
    <div>
      <div style={styles.formTitle}>Previsão — próximos 6 meses</div>
      <div style={styles.forecastList}>
        {forecast.map((f, i) => (
          <div key={i} style={styles.forecastCard}>
            <div style={styles.forecastMonthLabel}>{f.label}</div>
            <div style={styles.forecastBars}>
              <div style={styles.forecastBarWrap}>
                <div style={{ ...styles.forecastBar, height: `${(f.entradas / maxVal) * 80}px`, background: "#22c55e" }} />
                <span style={styles.forecastBarLabel}>{formatBRL(f.entradas)}</span>
                <span style={styles.forecastBarTitle}>Entradas</span>
              </div>
              <div style={styles.forecastBarWrap}>
                <div style={{ ...styles.forecastBar, height: `${(f.saidas / maxVal) * 80}px`, background: "#f87171" }} />
                <span style={styles.forecastBarLabel}>{formatBRL(f.saidas)}</span>
                <span style={styles.forecastBarTitle}>Gastos</span>
              </div>
            </div>
            <div style={{ ...styles.forecastResult, color: f.saldo >= 0 ? "#22c55e" : "#f87171" }}>
              {f.saldo >= 0 ? "+" : ""}{formatBRL(f.saldo)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TxRow({ t, onEdit, onDelete, showDate }) {
  const cat = getCategoryInfo(t.type, t.category);
  const [open, setOpen] = useState(false);

  return (
    <div style={styles.txRow} onClick={() => setOpen(o => !o)}>
      <div style={styles.txMain}>
        <div style={styles.txIcon}>{cat.icon}</div>
        <div style={styles.txInfo}>
          <div style={styles.txDesc}>{t.description}</div>
          <div style={styles.txMeta}>
            {showDate && <span>{formatDate(t.displayDate || t.date)}</span>}
            <span>{cat.label}</span>
            {t.recurrence !== "unica" && <span>🔁</span>}
          </div>
        </div>
        <div style={{ ...styles.txAmount, color: t.type === "entrada" ? "#22c55e" : "#f87171" }}>
          {t.type === "entrada" ? "+" : "-"}{formatBRL(t.amount)}
        </div>
      </div>
      {open && (
        <div style={styles.txActions}>
          {t.note && <div style={styles.txNote}>📝 {t.note}</div>}
          <div style={styles.txBtns}>
            <button style={styles.txEditBtn} onClick={e => { e.stopPropagation(); onEdit(t); }}>✏️ Editar</button>
            <button style={styles.txDelBtn} onClick={e => { e.stopPropagation(); onDelete(t.id); }}>🗑️ Excluir</button>
          </div>
        </div>
      )}
    </div>
  );
}

const BRAND = "#6366f1";
const BRAND_DARK = "#4f46e5";
const BG = "#0f0f13";
const SURFACE = "#1a1a24";
const SURFACE2 = "#22223a";
const TEXT = "#f1f1f5";
const MUTED = "#8888a8";

const styles = {
  root: {
    fontFamily: "'Inter', system-ui, sans-serif",
    background: BG,
    minHeight: "100dvh",
    color: TEXT,
    display: "flex",
    flexDirection: "column",
    maxWidth: 480,
    margin: "0 auto",
    position: "relative",
  },
  header: {
    background: SURFACE,
    borderBottom: `1px solid ${SURFACE2}`,
    padding: "14px 20px",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  headerInner: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  logo: { fontSize: 20, fontWeight: 700, letterSpacing: -0.5 },
  monthLabel: { fontSize: 13, color: MUTED },
  content: { flex: 1, overflowY: "auto", padding: "16px 16px 100px" },
  nav: {
    position: "fixed",
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: 480,
    background: SURFACE,
    borderTop: `1px solid ${SURFACE2}`,
    display: "flex",
    justifyContent: "space-around",
    padding: "8px 0 max(8px, env(safe-area-inset-bottom))",
    zIndex: 20,
  },
  navBtn: {
    background: "none", border: "none", color: MUTED,
    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    cursor: "pointer", padding: "4px 12px", borderRadius: 8,
  },
  navBtnActive: { color: BRAND },
  navIcon: { fontSize: 22 },
  navLabel: { fontSize: 10, fontWeight: 500 },
  monthNav: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 16 },
  monthBtn: { background: SURFACE2, border: "none", color: TEXT, fontSize: 20, cursor: "pointer", borderRadius: 8, padding: "4px 12px" },
  monthTitle: { fontSize: 16, fontWeight: 700 },
  balanceCard: {
    background: `linear-gradient(135deg, ${BRAND_DARK} 0%, #7c3aed 100%)`,
    borderRadius: 16, padding: "20px 20px 16px", marginBottom: 16,
  },
  balanceLabel: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 },
  balanceValueRow: { display: "flex", alignItems: "center", gap: 10 },
  balanceValue: { fontSize: 32, fontWeight: 800, letterSpacing: -1 },
  editBalanceBtn: { background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", borderRadius: 8, padding: "4px 8px", fontSize: 14 },
  balanceEditRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  balanceEditPrefix: { fontSize: 18, fontWeight: 700 },
  balanceEditInput: {
    background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)",
    borderRadius: 8, padding: "6px 10px", color: TEXT, fontSize: 24, fontWeight: 700,
    width: 140, outline: "none",
  },
  balanceSaveBtn: { background: "#22c55e", border: "none", color: "#fff", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700 },
  balanceCancelBtn: { background: "rgba(255,255,255,0.15)", border: "none", color: TEXT, borderRadius: 8, padding: "6px 10px", cursor: "pointer" },
  projectedRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.15)" },
  projectedLabel: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  projectedValue: { fontSize: 16, fontWeight: 700 },
  summaryRow: { display: "flex", gap: 10, marginBottom: 20 },
  summaryCard: { flex: 1, background: SURFACE, borderRadius: 12, padding: "12px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  summaryIcon: { fontSize: 20 },
  summaryLabel: { fontSize: 11, color: MUTED },
  summaryValue: { fontSize: 14, fontWeight: 700 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: MUTED, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  emptyMsg: { color: MUTED, textAlign: "center", padding: "30px 0", fontSize: 14 },
  txList: { display: "flex", flexDirection: "column", gap: 8 },
  txRow: { background: SURFACE, borderRadius: 12, padding: "12px 14px", cursor: "pointer" },
  txMain: { display: "flex", alignItems: "center", gap: 12 },
  txIcon: { fontSize: 22, width: 36, textAlign: "center" },
  txInfo: { flex: 1, minWidth: 0 },
  txDesc: { fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  txMeta: { fontSize: 11, color: MUTED, display: "flex", gap: 8, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: 700, whiteSpace: "nowrap" },
  txActions: { borderTop: `1px solid ${SURFACE2}`, marginTop: 10, paddingTop: 10 },
  txNote: { fontSize: 12, color: MUTED, marginBottom: 8 },
  txBtns: { display: "flex", gap: 8 },
  txEditBtn: { background: SURFACE2, border: "none", color: TEXT, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 },
  txDelBtn: { background: "rgba(239,68,68,0.15)", border: "none", color: "#f87171", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 },
  formTitle: { fontSize: 18, fontWeight: 800, marginBottom: 20 },
  typeToggle: { display: "flex", gap: 10, marginBottom: 18 },
  typeBtn: { flex: 1, padding: "12px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700 },
  typeBtnEntrada: { background: "rgba(34,197,94,0.2)", color: "#22c55e", border: "2px solid #22c55e" },
  typeBtnSaida: { background: "rgba(248,113,113,0.2)", color: "#f87171", border: "2px solid #f87171" },
  typeBtnOff: { background: SURFACE, color: MUTED, border: "2px solid transparent" },
  label: { display: "block", fontSize: 12, color: MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 },
  input: {
    width: "100%", background: SURFACE, border: `1px solid ${SURFACE2}`, borderRadius: 10,
    padding: "12px 14px", color: TEXT, fontSize: 15, marginBottom: 14, outline: "none", boxSizing: "border-box",
  },
  recurrenceRow: { display: "flex", gap: 8, marginBottom: 14 },
  recBtn: { flex: 1, padding: "8px 4px", borderRadius: 8, border: `1px solid ${SURFACE2}`, background: SURFACE, color: MUTED, cursor: "pointer", fontSize: 11, fontWeight: 600 },
  recBtnActive: { background: "rgba(99,102,241,0.2)", color: BRAND, border: `1px solid ${BRAND}` },
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
  forecastCard: { background: SURFACE, borderRadius: 14, padding: "16px", display: "flex", alignItems: "center", gap: 16 },
  forecastMonthLabel: { fontSize: 13, fontWeight: 700, minWidth: 48 },
  forecastBars: { flex: 1, display: "flex", gap: 16, alignItems: "flex-end", height: 96 },
  forecastBarWrap: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, justifyContent: "flex-end" },
  forecastBar: { width: "100%", borderRadius: "4px 4px 0 0", minHeight: 4 },
  forecastBarLabel: { fontSize: 9, color: MUTED, textAlign: "center" },
  forecastBarTitle: { fontSize: 9, color: MUTED },
  forecastResult: { fontSize: 14, fontWeight: 800, minWidth: 72, textAlign: "right" },
};
