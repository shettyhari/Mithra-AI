import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from "recharts";
import {
  DollarSign, Plus, Trash2, TrendingUp, TrendingDown, Sparkles, Edit2,
  PiggyBank, RefreshCw, ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type Category = { id: number; name: string; emoji: string; color: string; type: string; monthlyBudget?: string };
type Transaction = {
  id: number; title: string; amount: string; type: string; date: string;
  categoryId?: number; note?: string; category?: Category;
};
type Summary = {
  income: number; expenses: number; balance: number;
  byCategory: (Category & { spent: number; budget: number; remaining: number | null })[];
  dailyData: { date: string; amount: number }[];
  month: string;
};

export default function BudgetPage() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showCatDialog, setShowCatDialog] = useState(false);
  const [aiAdvice, setAiAdvice] = useState("");
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [txnForm, setTxnForm] = useState({
    title: "", amount: "", type: "expense", date: new Date().toISOString().slice(0,10),
    categoryId: "", note: "",
  });
  const [catForm, setCatForm] = useState({ name: "", emoji: "💰", color: "#8b5cf6", type: "expense", monthlyBudget: "" });
  const [activeTab, setActiveTab] = useState<"overview"|"transactions"|"categories">("overview");

  const auth = async () => {
    const tok = await getToken();
    return { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), "Content-Type": "application/json" };
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumR, txnR, catR] = await Promise.all([
        fetch(`${BASE}/api/budget/summary`, { headers: await auth() }),
        fetch(`${BASE}/api/budget/transactions`, { headers: await auth() }),
        fetch(`${BASE}/api/budget/categories`, { headers: await auth() }),
      ]);
      if (sumR.ok) setSummary(await sumR.json());
      if (txnR.ok) setTransactions(await txnR.json());
      if (catR.ok) setCategories(await catR.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addTransaction = async () => {
    if (!txnForm.title || !txnForm.amount) return;
    const r = await fetch(`${BASE}/api/budget/transactions`, {
      method: "POST", headers: await auth(),
      body: JSON.stringify({ ...txnForm, amount: parseFloat(txnForm.amount), categoryId: txnForm.categoryId ? parseInt(txnForm.categoryId) : undefined }),
    });
    if (r.ok) {
      await load();
      setShowAdd(false);
      setTxnForm({ title: "", amount: "", type: "expense", date: new Date().toISOString().slice(0,10), categoryId: "", note: "" });
      toast({ title: `${txnForm.type === "income" ? "Income" : "Expense"} added!` });
    }
  };

  const deleteTransaction = async (id: number) => {
    const r = await fetch(`${BASE}/api/budget/transactions/${id}`, { method: "DELETE", headers: await auth() });
    if (r.ok) { setTransactions(prev => prev.filter(t => t.id !== id)); await load(); }
  };

  const addCategory = async () => {
    if (!catForm.name) return;
    const r = await fetch(`${BASE}/api/budget/categories`, {
      method: "POST", headers: await auth(),
      body: JSON.stringify({ ...catForm, monthlyBudget: catForm.monthlyBudget || null }),
    });
    if (r.ok) {
      const cat = await r.json();
      setCategories(prev => [...prev, cat]);
      setCatForm({ name: "", emoji: "💰", color: "#8b5cf6", type: "expense", monthlyBudget: "" });
      toast({ title: "Category added!" });
    }
  };

  const deleteCategory = async (id: number) => {
    const r = await fetch(`${BASE}/api/budget/categories/${id}`, { method: "DELETE", headers: await auth() });
    if (r.ok) setCategories(prev => prev.filter(c => c.id !== id));
  };

  const getAdvice = async () => {
    setLoadingAdvice(true);
    try {
      const r = await fetch(`${BASE}/api/budget/ai-advice`, { method: "POST", headers: await auth(), body: "{}" });
      if (r.ok) { const d = await r.json(); setAiAdvice(d.advice); }
    } finally { setLoadingAdvice(false); }
  };

  const EMOJIS = ["💰","🍔","🚗","🏠","👕","✈️","💊","🎮","📱","🐾","🎓","💼"];
  const COLORS = ["#8b5cf6","#10b981","#f59e0b","#ef4444","#3b82f6","#ec4899","#14b8a6","#f97316"];

  const now = new Date();
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Budget Tracker</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{monthLabel}</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add Transaction
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-fit">
        {(["overview","transactions","categories"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize",
              activeTab === tab ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : (
        <>
          {activeTab === "overview" && summary && (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "Income", value: summary.income, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                  { label: "Expenses", value: summary.expenses, icon: TrendingDown, color: "text-red-500", bg: "bg-red-500/10" },
                  { label: "Balance", value: summary.balance, icon: PiggyBank, color: summary.balance >= 0 ? "text-emerald-500" : "text-red-500", bg: summary.balance >= 0 ? "bg-emerald-500/10" : "bg-red-500/10" },
                ].map(card => (
                  <div key={card.label} className="bg-card border border-border rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-muted-foreground font-medium">{card.label}</span>
                      <div className={cn("p-2 rounded-xl", card.bg)}>
                        <card.icon className={cn("w-4 h-4", card.color)} />
                      </div>
                    </div>
                    <p className={cn("text-2xl font-bold", card.color)}>
                      ${Math.abs(card.value).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
              </div>

              {/* Spending chart */}
              {summary.dailyData.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Daily Spending (Last 30 Days)</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={summary.dailyData}>
                      <defs>
                        <linearGradient id="spending" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                      <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Spent"]} labelFormatter={d => `Date: ${d}`} />
                      <Area type="monotone" dataKey="amount" stroke="#8b5cf6" fill="url(#spending)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Category breakdown */}
              {summary.byCategory.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Category Breakdown</h3>
                  <div className="space-y-3">
                    {summary.byCategory.map(cat => (
                      <div key={cat.id} className="flex items-center gap-3">
                        <span className="text-lg w-6">{cat.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground">{cat.name}</span>
                            <span className="text-sm text-muted-foreground">
                              ${cat.spent.toFixed(2)}{cat.budget > 0 ? ` / $${cat.budget.toFixed(2)}` : ""}
                            </span>
                          </div>
                          {cat.budget > 0 && (
                            <div className="h-1.5 bg-muted rounded-full">
                              <div className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, (cat.spent / cat.budget) * 100)}%`,
                                  backgroundColor: cat.spent > cat.budget ? "#ef4444" : cat.color,
                                }} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Advice */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">AI Financial Advice</h3>
                  <Button size="sm" variant="outline" onClick={getAdvice} disabled={loadingAdvice} className="gap-1.5 text-xs">
                    {loadingAdvice ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Get Advice
                  </Button>
                </div>
                {aiAdvice ? (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{aiAdvice}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Click "Get Advice" to receive personalized financial tips based on your spending.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === "transactions" && (
            <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
              {transactions.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No transactions yet. Add your first one!</p>
                </div>
              ) : (
                transactions.slice(0, 50).map(txn => (
                  <div key={txn.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors group">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0",
                      txn.type === "income" ? "bg-emerald-500/10" : "bg-red-500/10")}>
                      {txn.category?.emoji ?? (txn.type === "income" ? "📈" : "💸")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{txn.title}</p>
                      <p className="text-xs text-muted-foreground">{txn.date}{txn.category ? ` · ${txn.category.name}` : ""}</p>
                    </div>
                    <span className={cn("text-sm font-semibold tabular-nums",
                      txn.type === "income" ? "text-emerald-500" : "text-red-500")}>
                      {txn.type === "income" ? "+" : "-"}${parseFloat(txn.amount).toFixed(2)}
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteTransaction(txn.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "categories" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categories.map(cat => (
                  <div key={cat.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ backgroundColor: cat.color + "20" }}>
                      {cat.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{cat.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-xs capitalize">{cat.type}</Badge>
                        {cat.monthlyBudget && (
                          <span className="text-xs text-muted-foreground">Budget: ${parseFloat(cat.monthlyBudget).toFixed(0)}/mo</span>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteCategory(cat.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={() => setShowCatDialog(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Add Category
              </Button>
            </div>
          )}
        </>
      )}

      {/* Add Transaction Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              {["expense","income"].map(t => (
                <button key={t} onClick={() => setTxnForm(p => ({ ...p, type: t }))}
                  className={cn("flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-all border",
                    txnForm.type === t
                      ? t === "income" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-500" : "bg-red-500/15 border-red-500/30 text-red-500"
                      : "bg-muted/30 border-transparent text-muted-foreground")}>
                  {t}
                </button>
              ))}
            </div>
            <Input placeholder="Description" value={txnForm.title}
              onChange={e => setTxnForm(p => ({ ...p, title: e.target.value }))} />
            <Input placeholder="Amount" type="number" step="0.01" value={txnForm.amount}
              onChange={e => setTxnForm(p => ({ ...p, amount: e.target.value }))} />
            <Input type="date" value={txnForm.date}
              onChange={e => setTxnForm(p => ({ ...p, date: e.target.value }))} />
            {categories.length > 0 && (
              <select
                value={txnForm.categoryId}
                onChange={e => setTxnForm(p => ({ ...p, categoryId: e.target.value }))}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                <option value="">No category</option>
                {categories.filter(c => c.type === txnForm.type).map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                ))}
              </select>
            )}
            <Input placeholder="Note (optional)" value={txnForm.note}
              onChange={e => setTxnForm(p => ({ ...p, note: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addTransaction}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={showCatDialog} onOpenChange={setShowCatDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Category name" value={catForm.name}
              onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} />
            <div className="flex gap-2">
              {["expense","income"].map(t => (
                <button key={t} onClick={() => setCatForm(p => ({ ...p, type: t }))}
                  className={cn("flex-1 py-2 rounded-xl text-sm font-medium capitalize border transition-all",
                    catForm.type === t ? "bg-primary/15 border-primary/30 text-primary" : "bg-muted/30 border-transparent text-muted-foreground")}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              {EMOJIS.map(em => (
                <button key={em} onClick={() => setCatForm(p => ({ ...p, emoji: em }))}
                  className={cn("w-9 h-9 rounded-xl text-lg flex items-center justify-center",
                    catForm.emoji === em ? "ring-2 ring-primary bg-primary/10" : "bg-muted/50 hover:bg-muted")}>
                  {em}
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setCatForm(p => ({ ...p, color: c }))}
                  className={cn("w-7 h-7 rounded-full", catForm.color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "")}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <Input placeholder="Monthly budget (optional)" type="number" value={catForm.monthlyBudget}
              onChange={e => setCatForm(p => ({ ...p, monthlyBudget: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCatDialog(false)}>Cancel</Button>
            <Button onClick={addCategory}>Add Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
