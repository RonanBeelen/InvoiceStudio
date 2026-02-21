/**
 * Automations Page — Manage recurring invoice rules
 */

function showNotification(message, type = 'success') {
    const existing = document.querySelector('.settings-notification');
    if (existing) existing.remove();
    const notif = document.createElement('div');
    notif.className = `settings-notification settings-notification-${type}`;
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.classList.add('show'), 10);
    setTimeout(() => {
        notif.classList.remove('show');
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function relativeTime(isoDate) {
    if (!isoDate) return '';
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(isoDate);
}

const FREQ_LABELS = {
    weekly: 'Weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    yearly: 'Yearly',
    custom: 'Custom',
};

export async function initAutomations() {
    const html = `
        <div style="padding: var(--space-lg); max-width: 1400px; margin: 0 auto;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-xl); flex-wrap: wrap; gap: var(--space-md);">
                <div>
                    <h1 style="display: flex; align-items: center; gap: var(--space-md); font-size: 32px; color: var(--color-dark-green); margin-bottom: var(--space-sm);">
                        <i data-lucide="repeat"></i>
                        Automations
                    </h1>
                    <p style="color: var(--color-text-secondary);">
                        Manage recurring invoices and automated document generation
                    </p>
                </div>
                <button class="btn-primary" id="new-automation-btn" style="display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-md) var(--space-xl);">
                    <i data-lucide="plus"></i> New Automation
                </button>
            </div>

            <!-- Loading -->
            <div id="auto-loading" class="loading">
                <div class="loader-pulse">
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__dot"></div>
                </div>
                <p>Loading automations...</p>
            </div>

            <!-- Automations list -->
            <div id="auto-list" style="display: none;"></div>

            <!-- Empty state -->
            <div id="auto-empty" class="dashboard-section" style="display: none; text-align: center; padding: var(--space-2xl);">
                <i data-lucide="repeat" style="width: 64px; height: 64px; color: var(--color-text-secondary); margin-bottom: var(--space-md);"></i>
                <h2 style="color: var(--color-text-secondary); margin-bottom: var(--space-sm);">No automations yet</h2>
                <p style="color: var(--color-text-secondary); margin-bottom: var(--space-lg);">Create a recurring rule to automatically generate invoices on a schedule.</p>
            </div>
        </div>
    `;

    router.render(html);
    lucide.createIcons();

    document.getElementById('new-automation-btn').addEventListener('click', () => openCreateModal());

    await loadAutomations();
}

async function loadAutomations() {
    const loading = document.getElementById('auto-loading');
    const list = document.getElementById('auto-list');
    const empty = document.getElementById('auto-empty');

    loading.style.display = 'block';
    list.style.display = 'none';
    empty.style.display = 'none';

    try {
        const rules = await api.getAutomations();

        loading.style.display = 'none';

        if (!rules || rules.length === 0) {
            empty.style.display = 'block';
            lucide.createIcons();
            return;
        }

        list.style.display = 'block';
        list.innerHTML = `
            <div class="auto-grid">
                ${rules.map(rule => {
                    const freqLabel = FREQ_LABELS[rule.frequency] || rule.frequency;
                    const statusClass = rule.is_active ? 'badge-active' : 'badge-paused';
                    const statusLabel = rule.is_active ? 'Active' : 'Paused';
                    const nextRun = rule.is_active ? formatDate(rule.next_run_at) : '—';

                    return `
                        <div class="auto-card dashboard-section">
                            <div class="auto-card-header">
                                <div class="auto-card-title">
                                    <i data-lucide="repeat" style="width: 18px; height: 18px; color: var(--color-shamrock);"></i>
                                    <strong>${escapeHtml(rule.name)}</strong>
                                </div>
                                <span class="status-badge ${statusClass}">${statusLabel}</span>
                            </div>
                            <div class="auto-card-body">
                                <div class="auto-card-row">
                                    <span class="auto-card-label">Frequency</span>
                                    <span class="auto-freq-badge">${freqLabel}</span>
                                </div>
                                <div class="auto-card-row">
                                    <span class="auto-card-label">Next run</span>
                                    <span>${nextRun}</span>
                                </div>
                                <div class="auto-card-row">
                                    <span class="auto-card-label">Last run</span>
                                    <span>${rule.last_run_at ? relativeTime(rule.last_run_at) : 'Never'}</span>
                                </div>
                                <div class="auto-card-row">
                                    <span class="auto-card-label">Runs</span>
                                    <span>${rule.occurrences_count || 0}${rule.max_occurrences ? ' / ' + rule.max_occurrences : ''}</span>
                                </div>
                                ${rule.auto_send ? `
                                    <div class="auto-card-row">
                                        <span class="auto-card-label">Auto-send</span>
                                        <span style="color: var(--color-shamrock);">
                                            <i data-lucide="check" style="width: 14px; height: 14px;"></i> Enabled
                                        </span>
                                    </div>
                                ` : ''}
                            </div>
                            <div class="auto-card-actions">
                                ${rule.is_active ? `
                                    <button class="btn-secondary auto-trigger-btn" data-id="${rule.id}" style="font-size: 12px; padding: 4px 12px;">
                                        <i data-lucide="play" style="width: 14px; height: 14px;"></i> Run Now
                                    </button>
                                    <button class="btn-secondary auto-pause-btn" data-id="${rule.id}" style="font-size: 12px; padding: 4px 12px;">
                                        <i data-lucide="pause" style="width: 14px; height: 14px;"></i> Pause
                                    </button>
                                ` : `
                                    <button class="btn-primary auto-resume-btn" data-id="${rule.id}" style="font-size: 12px; padding: 4px 12px;">
                                        <i data-lucide="play" style="width: 14px; height: 14px;"></i> Resume
                                    </button>
                                `}
                                <button class="btn-secondary auto-history-btn" data-id="${rule.id}" data-name="${escapeHtml(rule.name)}" style="font-size: 12px; padding: 4px 12px;">
                                    <i data-lucide="clock" style="width: 14px; height: 14px;"></i> History
                                </button>
                                <button class="btn-secondary auto-edit-btn" data-id="${rule.id}" style="font-size: 12px; padding: 4px 12px;">
                                    <i data-lucide="pencil" style="width: 14px; height: 14px;"></i>
                                </button>
                                <button class="btn-secondary auto-delete-btn" data-id="${rule.id}" data-name="${escapeHtml(rule.name)}" style="font-size: 12px; padding: 4px 12px; color: var(--color-error);">
                                    <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        lucide.createIcons();
        bindActions(rules);

    } catch (error) {
        console.error('Failed to load automations:', error);
        loading.innerHTML = `
            <i data-lucide="alert-circle" style="width: 48px; height: 48px; color: var(--color-error);"></i>
            <p style="color: var(--color-error); margin-top: var(--space-md);">Failed to load automations: ${error.message}</p>
        `;
        lucide.createIcons();
    }
}

function bindActions(rules) {
    // Trigger
    document.querySelectorAll('.auto-trigger-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin" style="width:14px;height:14px;"></i> Running...';
            lucide.createIcons();
            try {
                const result = await api.triggerAutomation(id);
                showNotification(`Created ${result.document_number || 'new document'}`);
                await loadAutomations();
            } catch (e) {
                showNotification('Failed to trigger automation', 'error');
                btn.disabled = false;
                btn.innerHTML = '<i data-lucide="play" style="width:14px;height:14px;"></i> Run Now';
                lucide.createIcons();
            }
        });
    });

    // Pause
    document.querySelectorAll('.auto-pause-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                await api.pauseAutomation(btn.dataset.id);
                showNotification('Automation paused');
                await loadAutomations();
            } catch (e) {
                showNotification('Failed to pause', 'error');
            }
        });
    });

    // Resume
    document.querySelectorAll('.auto-resume-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                await api.resumeAutomation(btn.dataset.id);
                showNotification('Automation resumed');
                await loadAutomations();
            } catch (e) {
                showNotification('Failed to resume', 'error');
            }
        });
    });

    // Delete
    document.querySelectorAll('.auto-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const name = btn.dataset.name;
            if (!confirm(`Delete automation "${name}"?`)) return;
            try {
                await api.deleteAutomation(btn.dataset.id);
                showNotification('Automation deleted');
                await loadAutomations();
            } catch (e) {
                showNotification('Failed to delete', 'error');
            }
        });
    });

    // Edit
    document.querySelectorAll('.auto-edit-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const rule = rules.find(r => r.id === btn.dataset.id);
            if (rule) openEditModal(rule);
        });
    });

    // History
    document.querySelectorAll('.auto-history-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            openHistoryPanel(btn.dataset.id, btn.dataset.name);
        });
    });
}

async function openCreateModal(prefill = {}) {
    // Fetch invoices for source document picker
    let documents = [];
    try {
        documents = await api.getDocuments({ type: 'invoice' });
    } catch (e) { /* empty list fallback */ }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-content" style="max-width: 560px;">
            <div class="modal-header">
                <h2 style="display: flex; align-items: center; gap: var(--space-sm);">
                    <i data-lucide="repeat" style="width: 20px; height: 20px;"></i>
                    New Automation
                </h2>
                <button class="modal-close-btn" id="auto-modal-close">
                    <i data-lucide="x" style="width: 20px; height: 20px;"></i>
                </button>
            </div>
            <div class="modal-body">
                <div style="display: flex; flex-direction: column; gap: var(--space-lg);">
                    <div>
                        <label class="form-label">Name</label>
                        <input type="text" class="form-input" id="auto-name" placeholder="e.g. Monthly hosting invoice" value="${escapeHtml(prefill.name || '')}">
                    </div>
                    <div>
                        <label class="form-label">Source Document</label>
                        <select class="form-input" id="auto-source-doc">
                            <option value="">Select an invoice...</option>
                            ${documents.map(d => `
                                <option value="${d.id}" ${prefill.source_document_id === d.id ? 'selected' : ''}>
                                    ${escapeHtml(d.document_number)} — ${escapeHtml(d.customer_name || 'No customer')} (€${Number(d.total_amount||0).toFixed(2)})
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Frequency</label>
                        <select class="form-input" id="auto-frequency">
                            <option value="weekly">Weekly</option>
                            <option value="monthly" selected>Monthly</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="yearly">Yearly</option>
                            <option value="custom">Custom (days)</option>
                        </select>
                    </div>
                    <div id="auto-day-of-month-row">
                        <label class="form-label">Day of month (1-28)</label>
                        <input type="number" class="form-input" id="auto-day-of-month" min="1" max="28" value="1">
                    </div>
                    <div id="auto-interval-row" style="display: none;">
                        <label class="form-label">Interval (days)</label>
                        <input type="number" class="form-input" id="auto-interval-days" min="1" max="365" value="30">
                    </div>
                    <div style="display: flex; gap: var(--space-lg);">
                        <div style="flex: 1;">
                            <label class="form-label">End date (optional)</label>
                            <input type="date" class="form-input" id="auto-end-date">
                        </div>
                        <div style="flex: 1;">
                            <label class="form-label">Max runs (optional)</label>
                            <input type="number" class="form-input" id="auto-max-occ" min="1" placeholder="Unlimited">
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: var(--space-sm);">
                        <input type="checkbox" id="auto-auto-send" style="width: 18px; height: 18px;">
                        <label for="auto-auto-send" style="font-size: 14px;">Auto-send via email after creation</label>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" id="auto-modal-cancel">Cancel</button>
                <button class="btn-primary" id="auto-modal-save">Create Automation</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    lucide.createIcons();

    // Show/hide conditional fields
    const freqSelect = document.getElementById('auto-frequency');
    const dayRow = document.getElementById('auto-day-of-month-row');
    const intervalRow = document.getElementById('auto-interval-row');

    function toggleFields() {
        const f = freqSelect.value;
        dayRow.style.display = f === 'monthly' ? 'block' : 'none';
        intervalRow.style.display = f === 'custom' ? 'block' : 'none';
    }
    freqSelect.addEventListener('change', toggleFields);
    toggleFields();

    // Close handlers
    const close = () => overlay.remove();
    document.getElementById('auto-modal-close').addEventListener('click', close);
    document.getElementById('auto-modal-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // Save
    document.getElementById('auto-modal-save').addEventListener('click', async () => {
        const sourceDocId = document.getElementById('auto-source-doc').value;
        if (!sourceDocId) {
            showNotification('Please select a source document', 'error');
            return;
        }

        const data = {
            name: document.getElementById('auto-name').value || undefined,
            source_document_id: sourceDocId,
            frequency: freqSelect.value,
            day_of_month: freqSelect.value === 'monthly' ? parseInt(document.getElementById('auto-day-of-month').value) || 1 : undefined,
            interval_days: freqSelect.value === 'custom' ? parseInt(document.getElementById('auto-interval-days').value) || 30 : undefined,
            auto_send: document.getElementById('auto-auto-send').checked,
            end_date: document.getElementById('auto-end-date').value || undefined,
            max_occurrences: parseInt(document.getElementById('auto-max-occ').value) || undefined,
        };

        const saveBtn = document.getElementById('auto-modal-save');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Creating...';

        try {
            await api.createAutomation(data);
            close();
            showNotification('Automation created');
            await loadAutomations();
        } catch (e) {
            showNotification(`Failed: ${e.message}`, 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Create Automation';
        }
    });
}

async function openEditModal(rule) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-content" style="max-width: 560px;">
            <div class="modal-header">
                <h2 style="display: flex; align-items: center; gap: var(--space-sm);">
                    <i data-lucide="pencil" style="width: 20px; height: 20px;"></i>
                    Edit Automation
                </h2>
                <button class="modal-close-btn" id="auto-edit-close">
                    <i data-lucide="x" style="width: 20px; height: 20px;"></i>
                </button>
            </div>
            <div class="modal-body">
                <div style="display: flex; flex-direction: column; gap: var(--space-lg);">
                    <div>
                        <label class="form-label">Name</label>
                        <input type="text" class="form-input" id="edit-name" value="${escapeHtml(rule.name || '')}">
                    </div>
                    <div>
                        <label class="form-label">Frequency</label>
                        <select class="form-input" id="edit-frequency">
                            <option value="weekly" ${rule.frequency==='weekly'?'selected':''}>Weekly</option>
                            <option value="monthly" ${rule.frequency==='monthly'?'selected':''}>Monthly</option>
                            <option value="quarterly" ${rule.frequency==='quarterly'?'selected':''}>Quarterly</option>
                            <option value="yearly" ${rule.frequency==='yearly'?'selected':''}>Yearly</option>
                            <option value="custom" ${rule.frequency==='custom'?'selected':''}>Custom (days)</option>
                        </select>
                    </div>
                    <div id="edit-day-row" style="${rule.frequency==='monthly'?'':'display:none;'}">
                        <label class="form-label">Day of month (1-28)</label>
                        <input type="number" class="form-input" id="edit-day-of-month" min="1" max="28" value="${rule.day_of_month||1}">
                    </div>
                    <div id="edit-interval-row" style="${rule.frequency==='custom'?'':'display:none;'}">
                        <label class="form-label">Interval (days)</label>
                        <input type="number" class="form-input" id="edit-interval-days" min="1" max="365" value="${rule.interval_days||30}">
                    </div>
                    <div style="display: flex; gap: var(--space-lg);">
                        <div style="flex: 1;">
                            <label class="form-label">End date (optional)</label>
                            <input type="date" class="form-input" id="edit-end-date" value="${rule.end_date||''}">
                        </div>
                        <div style="flex: 1;">
                            <label class="form-label">Max runs (optional)</label>
                            <input type="number" class="form-input" id="edit-max-occ" min="1" value="${rule.max_occurrences||''}" placeholder="Unlimited">
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: var(--space-sm);">
                        <input type="checkbox" id="edit-auto-send" style="width: 18px; height: 18px;" ${rule.auto_send?'checked':''}>
                        <label for="edit-auto-send" style="font-size: 14px;">Auto-send via email after creation</label>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" id="auto-edit-cancel">Cancel</button>
                <button class="btn-primary" id="auto-edit-save">Save Changes</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    lucide.createIcons();

    const freqSelect = document.getElementById('edit-frequency');
    const dayRow = document.getElementById('edit-day-row');
    const intervalRow = document.getElementById('edit-interval-row');
    freqSelect.addEventListener('change', () => {
        dayRow.style.display = freqSelect.value === 'monthly' ? 'block' : 'none';
        intervalRow.style.display = freqSelect.value === 'custom' ? 'block' : 'none';
    });

    const close = () => overlay.remove();
    document.getElementById('auto-edit-close').addEventListener('click', close);
    document.getElementById('auto-edit-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    document.getElementById('auto-edit-save').addEventListener('click', async () => {
        const data = {
            name: document.getElementById('edit-name').value,
            frequency: freqSelect.value,
            day_of_month: freqSelect.value === 'monthly' ? parseInt(document.getElementById('edit-day-of-month').value) || 1 : null,
            interval_days: freqSelect.value === 'custom' ? parseInt(document.getElementById('edit-interval-days').value) || 30 : null,
            auto_send: document.getElementById('edit-auto-send').checked,
            end_date: document.getElementById('edit-end-date').value || null,
            max_occurrences: parseInt(document.getElementById('edit-max-occ').value) || null,
        };

        const btn = document.getElementById('auto-edit-save');
        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
            await api.updateAutomation(rule.id, data);
            close();
            showNotification('Automation updated');
            await loadAutomations();
        } catch (e) {
            showNotification(`Failed: ${e.message}`, 'error');
            btn.disabled = false;
            btn.textContent = 'Save Changes';
        }
    });
}

async function openHistoryPanel(ruleId, ruleName) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-content" style="max-width: 640px;">
            <div class="modal-header">
                <h2 style="display: flex; align-items: center; gap: var(--space-sm);">
                    <i data-lucide="clock" style="width: 20px; height: 20px;"></i>
                    Run History — ${escapeHtml(ruleName)}
                </h2>
                <button class="modal-close-btn" id="history-close">
                    <i data-lucide="x" style="width: 20px; height: 20px;"></i>
                </button>
            </div>
            <div class="modal-body" id="history-body">
                <div style="text-align: center; padding: var(--space-lg); color: var(--color-text-secondary);">Loading...</div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    lucide.createIcons();

    const close = () => overlay.remove();
    document.getElementById('history-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    try {
        const runs = await api.getAutomationRuns(ruleId, 50);
        const body = document.getElementById('history-body');

        if (!runs || runs.length === 0) {
            body.innerHTML = `
                <div style="text-align: center; padding: var(--space-xl); color: var(--color-text-secondary);">
                    <i data-lucide="inbox" style="width: 32px; height: 32px; margin-bottom: var(--space-sm);"></i>
                    <p>No runs yet</p>
                </div>
            `;
        } else {
            body.innerHTML = `
                <table class="docs-table" style="font-size: 13px;">
                    <thead>
                        <tr>
                            <th>Scheduled</th>
                            <th>Status</th>
                            <th>Document</th>
                            <th>Duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${runs.map(r => {
                            const statusMap = {
                                completed: 'badge-paid',
                                failed: 'badge-rejected',
                                running: 'badge-sent',
                                pending: 'badge-concept',
                                skipped: 'badge-concept',
                            };
                            const duration = r.started_at && r.completed_at
                                ? `${Math.round((new Date(r.completed_at) - new Date(r.started_at)) / 1000)}s`
                                : '—';

                            return `
                                <tr>
                                    <td>${formatDate(r.scheduled_at)}</td>
                                    <td><span class="status-badge ${statusMap[r.status] || 'badge-concept'}">${r.status}</span></td>
                                    <td>${r.created_document_id ? '<i data-lucide="file-check" style="width:14px;height:14px;color:var(--color-shamrock);"></i>' : '—'}</td>
                                    <td>${duration}</td>
                                </tr>
                                ${r.error_message ? `<tr><td colspan="4" style="color: var(--color-error); font-size: 12px; padding-top: 0;">${escapeHtml(r.error_message)}</td></tr>` : ''}
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        }
        lucide.createIcons();
    } catch (e) {
        document.getElementById('history-body').innerHTML = `
            <div style="padding: var(--space-md); color: var(--color-error);">Failed to load history: ${e.message}</div>
        `;
    }
}

// Export the create modal for use from documents page
export { openCreateModal };
