// ===== CATEGORIES =====
var EXPENSE_CATEGORIES = [
  { id: 'food',          label: 'Food',    icon: '🍔', color: '#f59e0b' },
  { id: 'housing',       label: 'Housing', icon: '🏠', color: '#3b82f6' },
  { id: 'transport',     label: 'Travel',  icon: '🚗', color: '#8b5cf6' },
  { id: 'entertainment', label: 'Fun',     icon: '🎮', color: '#ec4899' },
  { id: 'health',        label: 'Health',  icon: '💊', color: '#10b981' },
  { id: 'shopping',      label: 'Shop',    icon: '🛍️', color: '#f97316' },
  { id: 'bills',         label: 'Bills',   icon: '📄', color: '#6b7280' },
  { id: 'other',         label: 'Other',   icon: '📦', color: '#9ca3af' },
];

var INCOME_CATEGORIES = [
  { id: 'salary',     label: 'Salary',  icon: '💼', color: '#4ade80' },
  { id: 'freelance',  label: 'Freelance',icon: '💻', color: '#34d399' },
  { id: 'investment', label: 'Invest',  icon: '📈', color: '#6ee7b7' },
  { id: 'gift',       label: 'Gift',    icon: '🎁', color: '#a7f3d0' },
  { id: 'other_inc',  label: 'Other',   icon: '💰', color: '#4ade80' },
];

// ===== STATE =====
var state = {
  transactions: [],
  currentView: 'home',
  currentMonth: '',
  form: { type: 'expense', amount: '', category: '', description: '', date: '' }
};

// ===== CHART INSTANCES =====
var charts = {};

// ===== INIT =====
function init() {
  var saved = localStorage.getItem('budget-transactions');
  if (saved) {
    try { state.transactions = JSON.parse(saved); } catch(e) { state.transactions = []; }
  }

  var now = new Date();
  state.currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  state.form.date = now.toISOString().split('T')[0];

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(function() {});
  }

  // Nav listeners
  document.querySelectorAll('.nav-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      navigateTo(btn.dataset.view);
    });
  });

  // Event delegation for form inputs
  document.getElementById('app').addEventListener('input', function(e) {
    if (e.target.id === 'amount-input') state.form.amount = e.target.value;
    if (e.target.id === 'desc-input') state.form.description = e.target.value;
    if (e.target.id === 'date-input') state.form.date = e.target.value;
  });

  render();
}

// ===== NAVIGATION =====
function navigateTo(view) {
  state.currentView = view;
  render();
}

// ===== HELPERS =====
function saveTransactions() {
  localStorage.setItem('budget-transactions', JSON.stringify(state.transactions));
}

function getMonthTransactions(month) {
  return state.transactions.filter(function(t) { return t.date.startsWith(month); });
}

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function fmtDate(dateStr) {
  var d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtMonth(month) {
  var parts = month.split('-');
  return new Date(parts[0], parts[1] - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function shiftMonth(month, delta) {
  var parts = month.split('-').map(Number);
  var d = new Date(parts[0], parts[1] - 1 + delta, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function getCat(id) {
  return EXPENSE_CATEGORIES.concat(INCOME_CATEGORIES).find(function(c) { return c.id === id; }) ||
    { label: 'Other', icon: '📦', color: '#9ca3af' };
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ===== RENDER =====
function render() {
  var app = document.getElementById('app');

  document.querySelectorAll('.nav-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.view === state.currentView);
  });

  switch (state.currentView) {
    case 'home':         app.innerHTML = renderHome(); break;
    case 'add':          app.innerHTML = renderAdd(); break;
    case 'transactions': app.innerHTML = renderTransactions(); break;
    case 'reports':      app.innerHTML = renderReports(); break;
  }

  if (state.currentView === 'reports') {
    requestAnimationFrame(initCharts);
  }
}

// ===== HOME =====
function renderHome() {
  var txs = getMonthTransactions(state.currentMonth);
  var income   = txs.filter(function(t) { return t.type === 'income'; }).reduce(function(s, t) { return s + t.amount; }, 0);
  var expenses = txs.filter(function(t) { return t.type === 'expense'; }).reduce(function(s, t) { return s + t.amount; }, 0);
  var balance  = income - expenses;

  var recent = txs.slice().sort(function(a, b) { return b.date < a.date ? -1 : 1; }).slice(0, 5);

  var pct = income > 0 ? Math.min(Math.round((expenses / income) * 100), 100) : 0;
  var over = expenses > income;

  return '<div class="view home-view">' +
    monthNav() +
    '<div class="balance-card">' +
      '<div class="balance-label">Balance</div>' +
      '<div class="balance-amount' + (balance < 0 ? ' negative' : '') + '">' + fmt(balance) + '</div>' +
    '</div>' +
    '<div class="stats-row">' +
      '<div class="stat-card income"><div class="stat-label">Income</div><div class="stat-amount">' + fmt(income) + '</div></div>' +
      '<div class="stat-card expense"><div class="stat-label">Expenses</div><div class="stat-amount">' + fmt(expenses) + '</div></div>' +
    '</div>' +
    (income > 0 ?
      '<div class="progress-section">' +
        '<div class="progress-label"><span>Spent</span><span>' + pct + '% of income</span></div>' +
        '<div class="progress-bar"><div class="progress-fill' + (over ? ' over' : '') + '" style="width:' + pct + '%"></div></div>' +
      '</div>'
    : '') +
    '<div class="section-header"><h3>Recent Transactions</h3>' +
      (recent.length > 0 ? '<button class="see-all" onclick="navigateTo(\'transactions\')">See all</button>' : '') +
    '</div>' +
    (recent.length === 0 ?
      '<div class="empty-state"><div class="empty-icon">💳</div><p>No transactions this month</p>' +
      '<button class="btn-primary expense-btn" onclick="navigateTo(\'add\')" style="max-width:200px;margin:0 auto">Add your first</button></div>'
    :
      '<div class="transaction-list">' + recent.map(txItem).join('') + '</div>'
    ) +
  '</div>';
}

// ===== TRANSACTION ITEM =====
function txItem(t) {
  var cat = getCat(t.category);
  return '<div class="transaction-item">' +
    '<div class="tx-icon" style="background:' + cat.color + '20;color:' + cat.color + '">' + cat.icon + '</div>' +
    '<div class="tx-info">' +
      '<div class="tx-desc">' + esc(t.description || cat.label) + '</div>' +
      '<div class="tx-date">' + fmtDate(t.date) + '</div>' +
    '</div>' +
    '<div class="tx-amount ' + t.type + '">' + (t.type === 'expense' ? '-' : '+') + fmt(t.amount) + '</div>' +
    '<button class="tx-delete" onclick="deleteTransaction(\'' + t.id + '\')">×</button>' +
  '</div>';
}

// ===== ADD =====
function renderAdd() {
  var isExp = state.form.type === 'expense';
  var cats = isExp ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return '<div class="view add-view">' +
    '<h2 class="view-title">Add Transaction</h2>' +
    '<div class="type-toggle">' +
      '<button class="' + (isExp ? 'active expense' : '') + '" onclick="setFormType(\'expense\')">Expense</button>' +
      '<button class="' + (!isExp ? 'active income' : '') + '" onclick="setFormType(\'income\')">Income</button>' +
    '</div>' +
    '<div class="amount-input-wrapper">' +
      '<span class="currency-symbol">$</span>' +
      '<input type="number" id="amount-input" class="amount-input" placeholder="0.00" value="' + esc(state.form.amount) + '" inputmode="decimal" step="0.01" min="0">' +
    '</div>' +
    '<div class="form-section">' +
      '<label class="form-label">Category</label>' +
      '<div class="category-grid">' +
        cats.map(function(cat) {
          var sel = state.form.category === cat.id;
          return '<button class="category-btn' + (sel ? ' selected' : '') + '" ' +
            (sel ? 'style="background:' + cat.color + '25;border-color:' + cat.color + '"' : '') +
            ' onclick="selectCategory(\'' + cat.id + '\')">' +
            '<span class="cat-icon">' + cat.icon + '</span>' +
            '<span class="cat-label">' + cat.label + '</span>' +
          '</button>';
        }).join('') +
      '</div>' +
    '</div>' +
    '<div class="form-section">' +
      '<label class="form-label" for="desc-input">Description (optional)</label>' +
      '<input type="text" id="desc-input" class="form-input" placeholder="What was this for?" value="' + esc(state.form.description) + '">' +
    '</div>' +
    '<div class="form-section">' +
      '<label class="form-label" for="date-input">Date</label>' +
      '<input type="date" id="date-input" class="form-input" value="' + state.form.date + '">' +
    '</div>' +
    '<button class="btn-primary btn-save ' + (isExp ? 'expense-btn' : 'income-btn') + '" onclick="saveTransaction()">' +
      'Save ' + (isExp ? 'Expense' : 'Income') +
    '</button>' +
  '</div>';
}

// ===== TRANSACTIONS =====
function renderTransactions() {
  var txs = getMonthTransactions(state.currentMonth).slice().sort(function(a, b) { return b.date < a.date ? -1 : 1; });

  var grouped = {};
  txs.forEach(function(t) {
    if (!grouped[t.date]) grouped[t.date] = [];
    grouped[t.date].push(t);
  });

  var dates = Object.keys(grouped).sort(function(a, b) { return b < a ? -1 : 1; });

  return '<div class="view transactions-view">' +
    monthNav() +
    (txs.length === 0 ?
      '<div class="empty-state"><div class="empty-icon">📋</div><p>No transactions this month</p>' +
      '<button class="btn-primary expense-btn" onclick="navigateTo(\'add\')" style="max-width:200px;margin:0 auto">Add Transaction</button></div>'
    :
      '<div class="transaction-list">' +
        dates.map(function(date) {
          return '<div class="date-group">' +
            '<div class="date-header">' + fmtDate(date) + '</div>' +
            grouped[date].map(txItem).join('') +
          '</div>';
        }).join('') +
      '</div>'
    ) +
  '</div>';
}

// ===== REPORTS =====
function renderReports() {
  var txs = getMonthTransactions(state.currentMonth);
  var expenses = txs.filter(function(t) { return t.type === 'expense'; });
  var totalExp = expenses.reduce(function(s, t) { return s + t.amount; }, 0);

  var byCategory = {};
  expenses.forEach(function(t) {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  });

  var sortedCats = Object.keys(byCategory).map(function(id) {
    return { id: id, amount: byCategory[id] };
  }).sort(function(a, b) { return b.amount - a.amount; });

  var hasData = txs.length > 0;

  return '<div class="view reports-view">' +
    monthNav() +
    (!hasData ?
      '<div class="empty-state"><div class="empty-icon">📊</div><p>No data for this month</p>' +
      '<button class="btn-primary expense-btn" onclick="navigateTo(\'add\')" style="max-width:200px;margin:0 auto">Add Transaction</button></div>'
    :
      (expenses.length > 0 ?
        '<div class="card">' +
          '<div class="card-title">Spending by Category</div>' +
          '<div class="chart-container"><canvas id="donut-chart"></canvas></div>' +
          '<div class="category-breakdown">' +
            sortedCats.map(function(item) {
              var cat = getCat(item.id);
              var pct = totalExp > 0 ? Math.round((item.amount / totalExp) * 100) : 0;
              return '<div class="breakdown-item">' +
                '<div class="breakdown-left">' +
                  '<span class="breakdown-icon" style="background:' + cat.color + '20;color:' + cat.color + '">' + cat.icon + '</span>' +
                  '<span class="breakdown-label">' + cat.label + '</span>' +
                '</div>' +
                '<div class="breakdown-right">' +
                  '<span class="breakdown-pct">' + pct + '%</span>' +
                  '<span class="breakdown-amount">' + fmt(item.amount) + '</span>' +
                '</div>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>'
      : '') +
      '<div class="card">' +
        '<div class="card-title">Last 6 Months</div>' +
        '<div class="chart-container"><canvas id="bar-chart"></canvas></div>' +
      '</div>'
    ) +
  '</div>';
}

// ===== MONTH NAV HELPER =====
function monthNav() {
  return '<div class="month-nav">' +
    '<button class="month-btn" onclick="changeMonth(\'prev\')">‹</button>' +
    '<h2 class="month-title">' + fmtMonth(state.currentMonth) + '</h2>' +
    '<button class="month-btn" onclick="changeMonth(\'next\')">›</button>' +
  '</div>';
}

// ===== CHARTS =====
function initCharts() {
  Object.values(charts).forEach(function(c) { c.destroy(); });
  charts = {};

  Chart.defaults.color = '#94a3b8';

  // Donut chart
  var donutEl = document.getElementById('donut-chart');
  if (donutEl) {
    var txs = getMonthTransactions(state.currentMonth);
    var expenses = txs.filter(function(t) { return t.type === 'expense'; });
    var byCategory = {};
    expenses.forEach(function(t) { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });
    var entries = Object.keys(byCategory).map(function(id) { return { id: id, amount: byCategory[id] }; })
      .sort(function(a, b) { return b.amount - a.amount; });

    if (entries.length > 0) {
      charts.donut = new Chart(donutEl, {
        type: 'doughnut',
        data: {
          labels: entries.map(function(e) { return getCat(e.id).label; }),
          datasets: [{
            data: entries.map(function(e) { return e.amount; }),
            backgroundColor: entries.map(function(e) { return getCat(e.id).color; }),
            borderColor: '#1a1a24',
            borderWidth: 3,
          }]
        },
        options: {
          responsive: true,
          cutout: '65%',
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: function(ctx) { return ' ' + fmt(ctx.raw); } } }
          }
        }
      });
    }
  }

  // Bar chart — last 6 months
  var barEl = document.getElementById('bar-chart');
  if (barEl) {
    var months = [];
    for (var i = 5; i >= 0; i--) {
      var d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    }

    var incomeData = months.map(function(m) {
      return state.transactions.filter(function(t) { return t.type === 'income' && t.date.startsWith(m); })
        .reduce(function(s, t) { return s + t.amount; }, 0);
    });
    var expenseData = months.map(function(m) {
      return state.transactions.filter(function(t) { return t.type === 'expense' && t.date.startsWith(m); })
        .reduce(function(s, t) { return s + t.amount; }, 0);
    });
    var labels = months.map(function(m) {
      var p = m.split('-');
      return new Date(p[0], p[1] - 1).toLocaleDateString('en-US', { month: 'short' });
    });

    charts.bar = new Chart(barEl, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Income',   data: incomeData,  backgroundColor: '#4ade8040', borderColor: '#4ade80', borderWidth: 2, borderRadius: 6 },
          { label: 'Expenses', data: expenseData, backgroundColor: '#f8717140', borderColor: '#f87171', borderWidth: 2, borderRadius: 6 }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#94a3b8', boxRadius: 4 } },
          tooltip: { callbacks: { label: function(ctx) { return ' ' + ctx.dataset.label + ': ' + fmt(ctx.raw); } } }
        },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: '#2d2d3d' } },
          y: { ticks: { color: '#94a3b8', callback: function(v) { return '$' + v.toLocaleString(); } }, grid: { color: '#2d2d3d' } }
        }
      }
    });
  }
}

// ===== ACTIONS =====
function changeMonth(dir) {
  state.currentMonth = shiftMonth(state.currentMonth, dir === 'prev' ? -1 : 1);
  render();
}

function setFormType(type) {
  state.form.type = type;
  state.form.category = '';
  render();
}

function selectCategory(id) {
  state.form.category = id;
  render();
}

function saveTransaction() {
  var amount = parseFloat(state.form.amount);
  if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
  if (!state.form.category)   { showToast('Select a category', 'error'); return; }
  if (!state.form.date)       { showToast('Select a date', 'error'); return; }

  state.transactions.push({
    id: uid(),
    type: state.form.type,
    amount: amount,
    category: state.form.category,
    description: state.form.description.trim(),
    date: state.form.date
  });

  saveTransactions();

  state.form = {
    type: 'expense',
    amount: '',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  };

  showToast('Saved!', 'success');
  navigateTo('home');
}

function deleteTransaction(id) {
  if (!confirm('Delete this transaction?')) return;
  state.transactions = state.transactions.filter(function(t) { return t.id !== id; });
  saveTransactions();
  render();
}

// ===== TOAST =====
function showToast(msg, type) {
  var existing = document.querySelector('.toast');
  if (existing) existing.remove();
  var el = document.createElement('div');
  el.className = 'toast toast-' + (type || 'success');
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(function() { el.classList.add('show'); });
  setTimeout(function() {
    el.classList.remove('show');
    setTimeout(function() { el.remove(); }, 300);
  }, 2500);
}

// ===== ESCAPE HTML =====
function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== START =====
document.addEventListener('DOMContentLoaded', init);
