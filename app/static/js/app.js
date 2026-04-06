/* ════════════════════════════════════════════
   Coach Remise en Forme — JS Frontend
   ════════════════════════════════════════════ */

const API = '';  // même origine
let TOKEN = localStorage.getItem('coach_token') || null;
let currentUser = null;
let weightChartMini = null;
let weightChartFull = null;
let activityChart = null;
let currentShoppingList = null;
let currentShoppingWeek = null;

// ── Utils ─────────────────────────────────────────────────────────────────────

async function api(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Erreur serveur');
  return data;
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#sidebar ul li a').forEach(a => a.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`)?.classList.add('active');
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}

function showSuccess(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

function hideMsg(id) {
  document.getElementById(id)?.classList.add('hidden');
}

function getMondayOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0=dim, 1=lun, ..., 6=sam
  // Dimanche → prochain lundi (+1), autres jours → lundi de la semaine en cours
  const diff = day === 0 ? 1 : -(day - 1);
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Auth ──────────────────────────────────────────────────────────────────────

document.getElementById('go-register').addEventListener('click', e => {
  e.preventDefault();
  showPage('page-register');
});

document.getElementById('go-login').addEventListener('click', e => {
  e.preventDefault();
  showPage('page-login');
});

document.getElementById('form-login').addEventListener('submit', async e => {
  e.preventDefault();
  hideMsg('login-error');
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  try {
    const data = await api('POST', '/api/auth/login', { username, password });
    TOKEN = data.access_token;
    localStorage.setItem('coach_token', TOKEN);
    await loadApp();
  } catch (err) {
    showError('login-error', err.message);
  }
});

document.getElementById('form-register').addEventListener('submit', async e => {
  e.preventDefault();
  hideMsg('register-error');
  const body = {
    username: document.getElementById('reg-username').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    password: document.getElementById('reg-password').value,
    full_name: document.getElementById('reg-fullname').value.trim() || null,
    height_cm: parseFloat(document.getElementById('reg-height').value) || null,
    target_weight: parseFloat(document.getElementById('reg-target').value) || null
  };
  try {
    await api('POST', '/api/auth/register', body);
    const loginData = await api('POST', '/api/auth/login', { username: body.username, password: body.password });
    TOKEN = loginData.access_token;
    localStorage.setItem('coach_token', TOKEN);
    await loadApp();
  } catch (err) {
    showError('register-error', err.message);
  }
});

document.getElementById('btn-logout').addEventListener('click', () => {
  TOKEN = null;
  localStorage.removeItem('coach_token');
  currentUser = null;
  showPage('page-login');
});

// ── App init ──────────────────────────────────────────────────────────────────

async function loadApp() {
  try {
    currentUser = await api('GET', '/api/auth/me');
    document.getElementById('sidebar-username').textContent =
      currentUser.full_name || currentUser.username;
    showPage('page-app');
    showTab('dashboard');
    loadDashboard();
    // Afficher le lien register uniquement pour l'admin
    if (currentUser.is_admin) {
      document.getElementById('nav-admin').style.display = '';
    }
    // Pré-remplir la date du lundi courant
    const monday = getMondayOfWeek();
    document.getElementById('ci-date').value = monday;
    document.getElementById('meals-week-date').value = monday;
    document.getElementById('shopping-week-date').value = monday;
    document.getElementById('sport-week-date').value = monday;
  } catch {
    TOKEN = null;
    localStorage.removeItem('coach_token');
    showPage('page-login');
  }
}

// Sidebar navigation
document.querySelectorAll('[data-tab]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const tab = link.dataset.tab;
    showTab(tab);
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'checkin') loadCheckinHistory();
    if (tab === 'progress') loadProgress();
    if (tab === 'recipes') loadRecipes();
    if (tab === 'admin') loadAdminUsers();
    if (tab === 'sport') loadSport(document.getElementById('sport-week-date').value);
  });
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

async function loadDashboard() {
  try {
    const stats = await api('GET', '/api/checkins/stats');
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    const name = currentUser.full_name?.split(' ')[0] || currentUser.username;
    document.getElementById('dashboard-greeting').textContent =
      `${greet} ${name} ! 👋 Voici ton suivi de la semaine.`;

    if (stats.length === 0) {
      document.getElementById('dash-weight').textContent = '—';
      document.getElementById('dash-delta').textContent = '—';
      document.getElementById('dash-steps').textContent = '—';
      document.getElementById('dash-sport').textContent = '—';
      return;
    }

    const latest = stats[0];
    document.getElementById('dash-weight').textContent =
      latest.weight_kg ? latest.weight_kg + ' kg' : '—';
    document.getElementById('dash-steps').textContent =
      latest.steps_per_day ? latest.steps_per_day.toLocaleString('fr-FR') : '—';
    document.getElementById('dash-sport').textContent =
      latest.sport_sessions != null ? latest.sport_sessions + ' séances' : '—';

    if (latest.weight_delta != null) {
      const sign = latest.weight_delta > 0 ? '+' : '';
      document.getElementById('dash-delta').textContent = sign + latest.weight_delta + ' kg';
    }

    // Tendance banner
    const banner = document.getElementById('dash-trend-banner');
    if (latest.trend === 'positive') {
      banner.style.background = '#dcfce7';
      banner.style.color = '#15803d';
      banner.textContent = '🎉 Bonne semaine ! Tu es sur la bonne voie.';
    } else if (latest.trend === 'negative') {
      banner.style.background = '#fee2e2';
      banner.style.color = '#dc2626';
      banner.textContent = '💪 Semaine difficile — c\'est normal, on repart ! Regarde les tendances sur plusieurs semaines.';
    } else {
      banner.style.background = '#f1f5f9';
      banner.style.color = '#475569';
      banner.textContent = '↔️ Stable cette semaine — continue sur ta lancée !';
    }

    // Mini chart
    const labels = [...stats].reverse().map(s => formatDate(s.week_date));
    const weights = [...stats].reverse().map(s => s.weight_kg);

    if (weightChartMini) weightChartMini.destroy();
    const ctx = document.getElementById('chart-weight-mini').getContext('2d');
    weightChartMini = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Poids (kg)',
          data: weights,
          borderColor: '#4f7ef8',
          backgroundColor: 'rgba(79,126,248,.1)',
          tension: .4,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#4f7ef8'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: v => v + ' kg' } }
        }
      }
    });
  } catch (err) {
    console.error('Dashboard error', err);
  }
}

// ── Check-in ──────────────────────────────────────────────────────────────────

// Emoji rating
['energy', 'mood'].forEach(type => {
  document.getElementById('rating-' + type).querySelectorAll('span').forEach(span => {
    span.addEventListener('click', () => {
      document.getElementById('ci-' + type).value = span.dataset.val;
      document.getElementById('rating-' + type).querySelectorAll('span').forEach(s => {
        s.classList.toggle('selected', s.dataset.val <= span.dataset.val);
      });
    });
  });
});

document.getElementById('form-checkin').addEventListener('submit', async e => {
  e.preventDefault();
  hideMsg('checkin-error');
  hideMsg('checkin-success');

  const body = {
    week_date: document.getElementById('ci-date').value,
    weight_kg: parseFloat(document.getElementById('ci-weight').value) || null,
    steps_per_day: parseInt(document.getElementById('ci-steps').value) || null,
    sport_sessions: parseInt(document.getElementById('ci-sessions').value) || 0,
    sport_minutes: parseInt(document.getElementById('ci-minutes').value) || 0,
    energy_level: parseInt(document.getElementById('ci-energy').value) || null,
    mood: parseInt(document.getElementById('ci-mood').value) || null,
    notes: document.getElementById('ci-notes').value.trim() || null
  };

  try {
    await api('POST', '/api/checkins/', body);
    showSuccess('checkin-success', '✅ Check-in enregistré avec succès !');
    document.getElementById('form-checkin').reset();
    document.getElementById('ci-date').value = getMondayOfWeek();
    document.querySelectorAll('.emoji-rating span').forEach(s => s.classList.remove('selected'));
    loadCheckinHistory();
  } catch (err) {
    showError('checkin-error', err.message);
  }
});

async function loadCheckinHistory() {
  try {
    const checkins = await api('GET', '/api/checkins/');
    const stats = await api('GET', '/api/checkins/stats');
    const statsMap = {};
    stats.forEach(s => { statsMap[s.week_date] = s; });

    const container = document.getElementById('checkin-history');
    if (checkins.length === 0) {
      container.innerHTML = '<p class="empty-msg">Aucun check-in pour l\'instant.</p>';
      return;
    }

    container.innerHTML = checkins.map(c => {
      const s = statsMap[c.week_date] || {};
      const deltaHtml = s.weight_delta != null
        ? `<span class="hi-delta ${s.trend === 'positive' ? 'delta-pos' : s.trend === 'negative' ? 'delta-neg' : 'delta-neutral'}">${s.weight_delta > 0 ? '+' : ''}${s.weight_delta} kg</span>`
        : '';
      const trendIcon = s.trend === 'positive' ? '✅' : s.trend === 'negative' ? '⚠️' : '↔️';
      return `
        <div class="history-item">
          <span class="hi-date">Sem. du ${formatDate(c.week_date)}</span>
          <span class="hi-weight">${c.weight_kg ? c.weight_kg + ' kg' : '—'}</span>
          ${deltaHtml}
          <div class="hi-badges">
            ${c.steps_per_day ? `<span class="badge">🚶 ${c.steps_per_day.toLocaleString('fr-FR')} pas</span>` : ''}
            ${c.sport_sessions ? `<span class="badge">💪 ${c.sport_sessions} séances</span>` : ''}
            ${c.energy_level ? `<span class="badge">⚡ Énergie ${c.energy_level}/5</span>` : ''}
            ${trendIcon !== '—' ? `<span class="badge">${trendIcon} ${s.trend === 'positive' ? 'En baisse' : s.trend === 'negative' ? 'En hausse' : 'Stable'}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Checkin history error', err);
  }
}

// ── Repas ─────────────────────────────────────────────────────────────────────

document.getElementById('btn-load-meals').addEventListener('click', () => {
  loadMeals(document.getElementById('meals-week-date').value);
});

document.getElementById('btn-add-meal').addEventListener('click', async () => {
  hideMsg('meals-error');
  const weekDate = document.getElementById('meals-week-date').value;
  if (!weekDate) { showError('meals-error', 'Sélectionne une semaine d\'abord'); return; }

  const body = {
    week_date: weekDate,
    day_of_week: document.getElementById('meal-day').value,
    meal_type: document.getElementById('meal-type').value,
    recipe_name: document.getElementById('meal-recipe').value.trim(),
    calories: parseInt(document.getElementById('meal-cal').value) || null,
    proteins_g: parseFloat(document.getElementById('meal-prot').value) || null,
  };

  if (!body.recipe_name) { showError('meals-error', 'Indique une recette'); return; }

  try {
    await api('POST', '/api/meals/', body);
    document.getElementById('meal-recipe').value = '';
    document.getElementById('meal-cal').value = '';
    document.getElementById('meal-prot').value = '';
    showSuccess('meals-success', '✅ Repas ajouté !');
    loadMeals(weekDate);
  } catch (err) {
    showError('meals-error', err.message);
  }
});

document.getElementById('btn-gen-shopping').addEventListener('click', async () => {
  const weekDate = document.getElementById('meals-week-date').value;
  if (!weekDate) return;
  try {
    await api('POST', `/api/meals/generate-shopping/${weekDate}`);
    showSuccess('meals-success', '🛒 Liste de courses générée ! Va dans l\'onglet Courses.');
  } catch (err) {
    showError('meals-error', err.message);
  }
});

async function loadMeals(weekDate) {
  if (!weekDate) return;
  try {
    const meals = await api('GET', `/api/meals/week/${weekDate}`);
    const grid = document.getElementById('meals-grid');

    const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    const byDay = {};
    days.forEach(d => { byDay[d] = []; });
    meals.forEach(m => {
      if (byDay[m.day_of_week.toLowerCase()]) byDay[m.day_of_week.toLowerCase()].push(m);
    });

    grid.innerHTML = days.map(day => `
      <div class="meal-day-col">
        <div class="meal-day-header">${day}</div>
        ${byDay[day].length === 0
          ? '<div class="meal-item" style="color:#94a3b8;font-style:italic;font-size:.75rem">vide</div>'
          : byDay[day].map(m => `
            <div class="meal-item">
              <button class="meal-delete" onclick="deleteMeal(${m.id}, '${weekDate}')">✕</button>
              <div class="meal-type-label">${m.meal_type}</div>
              <div class="meal-recipe">${m.recipe_name}</div>
              ${m.calories ? `<div style="color:#94a3b8;font-size:.7rem">${m.calories} kcal${m.proteins_g ? ' · ' + m.proteins_g + 'g prot.' : ''}</div>` : ''}
            </div>
          `).join('')
        }
      </div>
    `).join('');
  } catch (err) {
    console.error('Meals error', err);
  }
}

async function deleteMeal(id, weekDate) {
  try {
    await api('DELETE', `/api/meals/${id}`);
    loadMeals(weekDate);
  } catch (err) {
    alert(err.message);
  }
}

// ── Courses ───────────────────────────────────────────────────────────────────

document.getElementById('btn-load-shopping').addEventListener('click', () => {
  loadShopping(document.getElementById('shopping-week-date').value);
});

document.getElementById('btn-add-shop-item').addEventListener('click', async () => {
  const name = document.getElementById('shop-item-name').value.trim();
  const qty = document.getElementById('shop-item-qty').value.trim();
  if (!name) return;

  const weekDate = document.getElementById('shopping-week-date').value;
  if (!weekDate) { showError('shopping-error', 'Sélectionne une semaine'); return; }

  let items = currentShoppingList ? JSON.parse(currentShoppingList.items) : [];
  items.push({ name, qty: qty || '', done: false });

  try {
    if (currentShoppingList) {
      await api('POST', '/api/shopping/', {
        week_date: weekDate,
        items: JSON.stringify(items)
      });
    } else {
      await api('POST', '/api/shopping/', {
        week_date: weekDate,
        items: JSON.stringify(items)
      });
    }
    document.getElementById('shop-item-name').value = '';
    document.getElementById('shop-item-qty').value = '';
    loadShopping(weekDate);
  } catch (err) {
    showError('shopping-error', err.message);
  }
});

async function loadShopping(weekDate) {
  if (!weekDate) return;
  currentShoppingWeek = weekDate;
  const container = document.getElementById('shopping-list-container');
  hideMsg('shopping-error');

  try {
    const shopping = await api('GET', `/api/shopping/week/${weekDate}`);
    currentShoppingList = shopping;
    const items = JSON.parse(shopping.items);

    if (items.length === 0) {
      container.innerHTML = '<p class="empty-msg">Liste vide.</p>';
      return;
    }

    container.innerHTML = items.map((item, idx) => `
      <div class="shop-item ${item.done ? 'done' : ''}" id="shop-${idx}">
        <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleShopItem(${idx})" />
        <span class="shop-name">${item.name}</span>
        <span class="shop-qty">${item.qty || ''}</span>
      </div>
    `).join('');
  } catch {
    currentShoppingList = null;
    container.innerHTML = '<p class="empty-msg">Aucune liste pour cette semaine. Génère-la depuis le plan de repas ou ajoute des articles manuellement.</p>';
  }
}

async function toggleShopItem(idx) {
  if (!currentShoppingWeek) return;
  try {
    await api('PATCH', `/api/shopping/week/${currentShoppingWeek}/item/${idx}`);
    loadShopping(currentShoppingWeek);
  } catch (err) {
    console.error(err);
  }
}

// ── Progression ───────────────────────────────────────────────────────────────

async function loadProgress() {
  try {
    const stats = await api('GET', '/api/checkins/stats');
    if (stats.length === 0) {
      document.getElementById('progress-table-container').innerHTML =
        '<p class="empty-msg">Aucune donnée pour l\'instant.</p>';
      return;
    }

    const reversed = [...stats].reverse();
    const labels = reversed.map(s => formatDate(s.week_date));

    // Courbe poids
    if (weightChartFull) weightChartFull.destroy();
    const ctx1 = document.getElementById('chart-weight-full').getContext('2d');
    weightChartFull = new Chart(ctx1, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Poids (kg)',
          data: reversed.map(s => s.weight_kg),
          borderColor: '#4f7ef8',
          backgroundColor: 'rgba(79,126,248,.1)',
          tension: .4,
          fill: true,
          pointRadius: 5,
          pointBackgroundColor: reversed.map(s =>
            s.trend === 'positive' ? '#16a34a' :
            s.trend === 'negative' ? '#dc2626' : '#94a3b8'
          )
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { title: { display: true, text: 'Évolution du poids' } },
        scales: { y: { ticks: { callback: v => v + ' kg' } } }
      }
    });

    // Graphique activité
    if (activityChart) activityChart.destroy();
    const ctx2 = document.getElementById('chart-activity').getContext('2d');
    activityChart = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Séances sport',
            data: reversed.map(s => s.sport_sessions || 0),
            backgroundColor: '#2dd4a0',
            yAxisID: 'y1'
          },
          {
            label: 'Pas/jour (×1000)',
            data: reversed.map(s => s.steps_per_day ? Math.round(s.steps_per_day / 1000) : null),
            backgroundColor: 'rgba(79,126,248,.6)',
            type: 'line',
            tension: .4,
            yAxisID: 'y2'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { title: { display: true, text: 'Activité physique' } },
        scales: {
          y1: { position: 'left', title: { display: true, text: 'Séances' } },
          y2: { position: 'right', title: { display: true, text: 'Pas ×1000' }, grid: { drawOnChartArea: false } }
        }
      }
    });

    // Tableau
    document.getElementById('progress-table-container').innerHTML = `
      <table class="progress-table" style="margin-top:1.5rem">
        <thead>
          <tr>
            <th>Semaine</th>
            <th>Poids</th>
            <th>Évolution</th>
            <th>Pas/jour</th>
            <th>Sport</th>
            <th>Énergie</th>
            <th>Humeur</th>
            <th>Tendance</th>
          </tr>
        </thead>
        <tbody>
          ${stats.map(s => `
            <tr>
              <td>${formatDate(s.week_date)}</td>
              <td>${s.weight_kg ? s.weight_kg + ' kg' : '—'}</td>
              <td class="${s.trend === 'positive' ? 'trend-pos' : s.trend === 'negative' ? 'trend-neg' : 'trend-stable'}">
                ${s.weight_delta != null ? (s.weight_delta > 0 ? '+' : '') + s.weight_delta + ' kg' : '—'}
              </td>
              <td>${s.steps_per_day ? s.steps_per_day.toLocaleString('fr-FR') : '—'}</td>
              <td>${s.sport_sessions != null ? s.sport_sessions : '—'}</td>
              <td>${s.energy_level ? '⭐'.repeat(s.energy_level) : '—'}</td>
              <td>${s.mood ? '😊'.repeat(s.mood) : '—'}</td>
              <td>${s.trend === 'positive' ? '✅ Baisse' : s.trend === 'negative' ? '⚠️ Hausse' : s.trend === 'stable' ? '↔️ Stable' : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

  } catch (err) {
    console.error('Progress error', err);
  }
}

// ── Admin ─────────────────────────────────────────────────────────────────────

document.getElementById('btn-admin-create').addEventListener('click', async () => {
  hideMsg('admin-create-error');
  hideMsg('admin-create-success');
  const username = document.getElementById('adm-username').value.trim();
  const email = document.getElementById('adm-email').value.trim();
  const password = document.getElementById('adm-password').value;
  const full_name = document.getElementById('adm-fullname').value.trim() || null;
  const is_admin = document.getElementById('adm-role').value === 'admin';

  if (!username || !email || !password) {
    showError('admin-create-error', 'Nom d\'utilisateur, email et mot de passe sont obligatoires');
    return;
  }
  try {
    const user = await api('POST', '/api/auth/register', { username, email, password, full_name, is_admin });
    showSuccess('admin-create-success', `Compte créé : ${user.username} (${user.is_admin ? 'admin' : 'utilisateur'})`);
    document.getElementById('adm-username').value = '';
    document.getElementById('adm-email').value = '';
    document.getElementById('adm-password').value = '';
    document.getElementById('adm-fullname').value = '';
    document.getElementById('adm-role').value = 'user';
    loadAdminUsers();
  } catch (err) {
    showError('admin-create-error', err.message);
  }
});

// Modal édition
let editingUserId = null;

document.getElementById('modal-edit-cancel').addEventListener('click', () => {
  document.getElementById('modal-edit-user').classList.add('hidden');
});
document.getElementById('modal-edit-save').addEventListener('click', async () => {
  hideMsg('modal-edit-error');
  hideMsg('modal-edit-success');
  const email = document.getElementById('modal-email').value.trim();
  const password = document.getElementById('modal-password').value;
  if (!email && !password) {
    showError('modal-edit-error', 'Remplis au moins un champ');
    return;
  }
  const body = {};
  if (email) body.email = email;
  if (password) body.password = password;
  try {
    await api('PATCH', `/api/auth/users/${editingUserId}/credentials`, body);
    showSuccess('modal-edit-success', 'Mis à jour avec succès');
    document.getElementById('modal-email').value = '';
    document.getElementById('modal-password').value = '';
    loadAdminUsers();
  } catch (err) {
    showError('modal-edit-error', err.message);
  }
});

function openEditModal(userId, username) {
  editingUserId = userId;
  document.getElementById('modal-edit-title').textContent = `Modifier : ${username}`;
  document.getElementById('modal-email').value = '';
  document.getElementById('modal-password').value = '';
  hideMsg('modal-edit-error');
  hideMsg('modal-edit-success');
  document.getElementById('modal-edit-user').classList.remove('hidden');
}

async function toggleUserActive(userId, isActive) {
  try {
    await api('PATCH', `/api/auth/users/${userId}/toggle-active`);
    loadAdminUsers();
  } catch (err) {
    alert(err.message);
  }
}

async function loadAdminUsers() {
  const container = document.getElementById('admin-users-list');
  try {
    const users = await api('GET', '/api/auth/users');
    container.innerHTML = `
      <table class="progress-table">
        <thead>
          <tr>
            <th>Utilisateur</th>
            <th>Email</th>
            <th>Rôle</th>
            <th>Créé le</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td><strong>${u.username}</strong>${u.full_name ? '<br><small>' + u.full_name + '</small>' : ''}</td>
              <td>${u.email}</td>
              <td>
                <select class="role-select" data-uid="${u.id}" ${u.id === currentUser.id ? 'disabled' : ''}>
                  <option value="user" ${!u.is_admin ? 'selected' : ''}>Utilisateur</option>
                  <option value="admin" ${u.is_admin ? 'selected' : ''}>Admin</option>
                </select>
              </td>
              <td>${formatDate(u.created_at?.split('T')[0])}</td>
              <td>
                <span class="badge" style="background:${u.is_active ? '#dcfce7' : '#fee2e2'};color:${u.is_active ? '#15803d' : '#dc2626'}">
                  ${u.is_active ? 'Actif' : 'Bloqué'}
                </span>
              </td>
              <td style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center">
                ${u.id !== currentUser.id ? `
                  <button class="btn-secondary" style="font-size:.73rem;padding:.25rem .5rem" onclick="openEditModal(${u.id}, '${u.username}')">✏️ Modifier</button>
                  <button class="btn-secondary" style="font-size:.73rem;padding:.25rem .5rem;background:${u.is_active ? '#fff7ed' : '#f0fdf4'};color:${u.is_active ? '#c2410c' : '#15803d'}" onclick="toggleUserActive(${u.id}, ${u.is_active})">${u.is_active ? '🔒 Bloquer' : '🔓 Débloquer'}</button>
                  <button class="btn-secondary" style="font-size:.73rem;padding:.25rem .5rem" onclick="impersonateUser(${u.id}, '${u.username}')">👤 Impersonnifier</button>
                  <button class="meal-delete" onclick="deleteUser(${u.id}, '${u.username}')">✕</button>
                ` : '<span style="color:var(--text-light);font-size:.8rem">Toi</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    // Listener changement de rôle
    container.querySelectorAll('.role-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        const uid = parseInt(sel.dataset.uid);
        const is_admin = sel.value === 'admin';
        try {
          await api('PATCH', `/api/auth/users/${uid}/role`, { is_admin });
        } catch (err) {
          alert(err.message);
          loadAdminUsers();
        }
      });
    });
  } catch (err) {
    container.innerHTML = '<p class="empty-msg">Erreur au chargement.</p>';
  }
}

async function impersonateUser(userId, username) {
  if (!confirm(`Se connecter en tant que "${username}" ?`)) return;
  try {
    const data = await api('POST', `/api/auth/users/${userId}/impersonate`);
    TOKEN = data.access_token;
    localStorage.setItem('coach_token', TOKEN);
    await loadApp();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteUser(userId, username) {
  if (!confirm(`Supprimer le compte "${username}" et toutes ses données ?`)) return;
  try {
    await api('DELETE', `/api/auth/users/${userId}`);
    loadAdminUsers();
  } catch (err) {
    alert(err.message);
  }
}

// ── Sport ─────────────────────────────────────────────────────────────────────

const EXERCISE_IMAGES = {
  // Marche / cardio
  'marche': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Walking_exercise.jpg/320px-Walking_exercise.jpg',
  // Renforcement
  'planche': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Plank_exercise.jpg/320px-Plank_exercise.jpg',
  'gainage': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Plank_exercise.jpg/320px-Plank_exercise.jpg',
  'pompes': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Pushup.jpg/320px-Pushup.jpg',
  'push-up': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Pushup.jpg/320px-Pushup.jpg',
  'squat': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Squats.jpg/320px-Squats.jpg',
  'crunch': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Crunches.jpg/320px-Crunches.jpg',
  'abdominaux': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Crunches.jpg/320px-Crunches.jpg',
  'abdo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Crunches.jpg/320px-Crunches.jpg',
};

const EXERCISE_TYPE_EMOJI = {
  'marche': '🚶', 'cardio': '🏃', 'renforcement': '💪',
  'étirement': '🧘', 'stretching': '🧘', 'repos': '😴'
};

function getExerciseImage(ex) {
  if (ex.image_url) return ex.image_url;
  const key = ex.exercise_name.toLowerCase().split(' ')[0];
  for (const [k, url] of Object.entries(EXERCISE_IMAGES)) {
    if (key.includes(k) || ex.exercise_name.toLowerCase().includes(k)) return url;
  }
  return null;
}

document.getElementById('btn-load-sport').addEventListener('click', () => {
  loadSport(document.getElementById('sport-week-date').value);
});

async function loadSport(weekDate) {
  if (!weekDate) return;
  const container = document.getElementById('sport-container');
  try {
    const exercises = await api('GET', `/api/exercises/week/${weekDate}`);
    if (exercises.length === 0) {
      container.innerHTML = '<p class="empty-msg">Aucun programme pour cette semaine — importe un plan depuis l\'onglet Import Claude.</p>';
      return;
    }

    const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    const byDay = {};
    DAYS.forEach(d => { byDay[d] = []; });
    exercises.forEach(e => {
      const d = e.day_of_week.toLowerCase();
      if (byDay[d]) byDay[d].push(e);
    });

    container.innerHTML = DAYS.filter(d => byDay[d].length > 0).map(day => `
      <div class="sport-day">
        <div class="sport-day-header">${day.charAt(0).toUpperCase() + day.slice(1)}</div>
        <div class="sport-exercises">
          ${byDay[day].map(ex => {
            const img = getExerciseImage(ex);
            const emoji = EXERCISE_TYPE_EMOJI[ex.exercise_type?.toLowerCase()] || '🏋️';
            return `
              <div class="exercise-card ${ex.done ? 'exercise-done' : ''}" id="ex-${ex.id}">
                <div class="exercise-check">
                  <input type="checkbox" ${ex.done ? 'checked' : ''} onchange="toggleExercise(${ex.id}, '${weekDate}')" />
                </div>
                ${img ? `<img class="exercise-img" src="${img}" alt="${ex.exercise_name}" onerror="this.style.display='none'" />` : `<div class="exercise-emoji">${emoji}</div>`}
                <div class="exercise-info">
                  <div class="exercise-name">${emoji} ${ex.exercise_name}</div>
                  <div class="exercise-meta">
                    ${ex.sets ? `<span>${ex.sets} séries</span>` : ''}
                    ${ex.reps_or_duration ? `<span>${ex.reps_or_duration}</span>` : ''}
                    <span class="exercise-type-badge">${ex.exercise_type || ''}</span>
                  </div>
                  ${ex.description ? `<p class="exercise-desc">${ex.description}</p>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<p class="empty-msg">Erreur au chargement.</p>';
  }
}

async function toggleExercise(id, weekDate) {
  try {
    await api('PATCH', `/api/exercises/${id}/toggle`);
    loadSport(weekDate);
  } catch (err) {
    console.error(err);
  }
}

// ── Import Claude ─────────────────────────────────────────────────────────────

document.getElementById('btn-import').addEventListener('click', async () => {
  hideMsg('import-error');
  hideMsg('import-success');
  const raw = document.getElementById('import-json').value.trim();
  if (!raw) { showError('import-error', 'Colle un JSON valide'); return; }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    showError('import-error', 'JSON invalide — vérifie la syntaxe');
    return;
  }

  try {
    const res = await api('POST', '/api/meals/bulk', data);
    showSuccess('import-success',
      `✅ Importé : ${res.meals_imported} repas · ${res.shopping_items} articles de courses · ${res.recipes_imported} recettes · ${res.exercises_imported} exercices`
    );
    document.getElementById('import-json').value = '';
    // Mettre à jour la date de la semaine dans les autres onglets
    if (data.week_date) {
      document.getElementById('meals-week-date').value = data.week_date;
      document.getElementById('shopping-week-date').value = data.week_date;
    }
  } catch (err) {
    showError('import-error', err.message);
  }
});

// ── Recettes ──────────────────────────────────────────────────────────────────

async function loadRecipes() {
  const container = document.getElementById('recipes-container');
  try {
    const recipes = await api('GET', '/api/recipes/');
    if (recipes.length === 0) {
      container.innerHTML = '<p class="empty-msg">Aucune recette — importe un plan depuis l\'onglet Import Claude.</p>';
      return;
    }
    container.innerHTML = recipes.map(r => {
      const ingredients = JSON.parse(r.ingredients || '[]');
      const steps = JSON.parse(r.steps || '[]');
      const total = (r.prep_time || 0) + (r.cook_time || 0);
      return `
        <div class="recipe-card">
          <div class="recipe-header">
            <div>
              <div class="recipe-title">${r.name}</div>
              ${r.cuisine ? `<div class="recipe-cuisine">${r.cuisine}</div>` : ''}
            </div>
            <button class="meal-delete" onclick="deleteRecipe(${r.id})">✕</button>
          </div>
          <div class="recipe-meta">
            ${r.servings ? `<span>👥 ${r.servings} portions</span>` : ''}
            ${total ? `<span>⏱️ ${total} min</span>` : ''}
            ${r.calories_per_serving ? `<span>🔥 ${r.calories_per_serving} kcal</span>` : ''}
            ${r.proteins_per_serving ? `<span>💪 ${r.proteins_per_serving}g prot.</span>` : ''}
          </div>
          ${ingredients.length > 0 ? `
            <details>
              <summary>Ingrédients (${ingredients.length})</summary>
              <ul class="recipe-ingredients">
                ${ingredients.map(i => `<li><b>${i.qty}</b> ${i.name}</li>`).join('')}
              </ul>
            </details>` : ''}
          ${steps.length > 0 ? `
            <details>
              <summary>Préparation (${steps.length} étapes)</summary>
              <ol class="recipe-steps">
                ${steps.map(s => `<li>${s}</li>`).join('')}
              </ol>
            </details>` : ''}
          ${r.notes ? `<p class="recipe-notes">${r.notes}</p>` : ''}
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = '<p class="empty-msg">Erreur au chargement des recettes.</p>';
  }
}

async function deleteRecipe(id) {
  try {
    await api('DELETE', `/api/recipes/${id}`);
    loadRecipes();
  } catch (err) {
    alert(err.message);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

if (TOKEN) {
  loadApp();
} else {
  showPage('page-login');
}
