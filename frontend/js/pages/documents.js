/**
 * Documents Page - Document history, filtering, and status management
 */
import { openSendModal } from '/js/components/send-modal.js';
import { openActivityPanel } from '/js/components/activity-panel.js';

let currentFilters = { type: '', status: '' };

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

function formatCurrency(amount) {
    return Number(amount || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getBadgeClass(status) {
    const map = {
        concept: 'badge-concept',
        sent: 'badge-sent',
        paid: 'badge-paid',
        accepted: 'badge-accepted',
        overdue: 'badge-overdue',
        rejected: 'badge-rejected',
    };
    return map[status] || 'badge-concept';
}

export async function initDocuments() {
    const html = `
        <div style="padding: var(--space-lg); max-width: 1400px; margin: 0 auto;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-xl); flex-wrap: wrap; gap: var(--space-md);">
                <div>
                    <h1 style="display: flex; align-items: center; gap: var(--space-md); font-size: 32px; color: var(--color-dark-green); margin-bottom: var(--space-sm);">
                        <i data-lucide="files"></i>
                        Documents
                    </h1>
                    <p style="color: var(--color-text-secondary);">
                        Overview of all invoices and quotes
                    </p>
                </div>
                <a href="#/new-document" class="btn-primary" style="display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-md) var(--space-xl); text-decoration: none;">
                    <i data-lucide="plus"></i> New Document
                </a>
            </div>

            <!-- Filters -->
            <div style="display: flex; gap: var(--space-md); margin-bottom: var(--space-lg); flex-wrap: wrap;">
                <select id="filter-type" class="form-input" style="max-width: 180px;">
                    <option value="">All types</option>
                    <option value="invoice">Invoices</option>
                    <option value="quote">Quotes</option>
                </select>
                <select id="filter-status" class="form-input" style="max-width: 180px;">
                    <option value="">All statuses</option>
                    <option value="concept">Concept</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                </select>
            </div>

            <!-- Loading -->
            <div id="docs-loading" class="loading">
                <div class="loader-pulse">
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__dot"></div>
                </div>
                <p>Loading documents...</p>
            </div>

            <!-- Documents table -->
            <div id="docs-table-container" class="dashboard-section" style="display: none; padding: 0; overflow: hidden;">
                <div style="overflow-x: auto;">
                    <table class="docs-table" id="docs-table">
                        <thead>
                            <tr>
                                <th>Number</th>
                                <th>Type</th>
                                <th>Date</th>
                                <th>Customer</th>
                                <th style="text-align: right;">Amount</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="docs-tbody"></tbody>
                    </table>
                </div>
            </div>

            <!-- Empty state -->
            <div id="docs-empty" class="dashboard-section" style="display: none; text-align: center; padding: var(--space-2xl);">
                <i data-lucide="file-x" style="width: 64px; height: 64px; color: var(--color-text-secondary); margin-bottom: var(--space-md);"></i>
                <h2 style="color: var(--color-text-secondary); margin-bottom: var(--space-sm);">No documents found</h2>
                <p style="color: var(--color-text-secondary); margin-bottom: var(--space-lg);">Create your first invoice or quote to get started.</p>
                <a href="#/new-document" class="btn-primary" style="text-decoration: none; display: inline-flex; align-items: center; gap: var(--space-sm);">
                    <i data-lucide="plus"></i> New Document
                </a>
            </div>
        </div>
    `;

    router.render(html);
    lucide.createIcons();

    // Load documents
    await loadDocuments();

    // Filter handlers
    document.getElementById('filter-type').addEventListener('change', (e) => {
        currentFilters.type = e.target.value;
        loadDocuments();
    });
    document.getElementById('filter-status').addEventListener('change', (e) => {
        currentFilters.status = e.target.value;
        loadDocuments();
    });
}

async function loadDocuments() {
    const loading = document.getElementById('docs-loading');
    const table = document.getElementById('docs-table-container');
    const empty = document.getElementById('docs-empty');

    loading.style.display = 'block';
    table.style.display = 'none';
    empty.style.display = 'none';

    try {
        const filters = {};
        if (currentFilters.type) filters.type = currentFilters.type;
        if (currentFilters.status) filters.status = currentFilters.status;

        const documents = await api.getDocuments(filters);

        loading.style.display = 'none';

        if (documents.length === 0) {
            empty.style.display = 'block';
            lucide.createIcons();
            return;
        }

        table.style.display = 'block';
        const tbody = document.getElementById('docs-tbody');
        tbody.innerHTML = documents.map(doc => `
            <tr>
                <td>
                    <strong>${escapeHtml(doc.document_number)}</strong>
                </td>
                <td>
                    <span class="status-badge ${doc.document_type === 'invoice' ? 'badge-sent' : 'badge-concept'}">
                        ${doc.document_type === 'invoice' ? 'Invoice' : 'Quote'}
                    </span>
                </td>
                <td>${formatDate(doc.date)}</td>
                <td>${escapeHtml(doc.customer_name || '—')}</td>
                <td style="text-align: right; font-family: var(--font-mono); font-weight: var(--font-weight-semibold);">
                    &euro; ${formatCurrency(doc.total_amount)}
                </td>
                <td>
                    <select class="status-select status-badge ${getBadgeClass(doc.status)}" data-id="${doc.id}" data-current="${doc.status}">
                        <option value="concept" ${doc.status === 'concept' ? 'selected' : ''}>Concept</option>
                        <option value="sent" ${doc.status === 'sent' ? 'selected' : ''}>Sent</option>
                        ${doc.document_type === 'invoice' ? `
                            <option value="paid" ${doc.status === 'paid' ? 'selected' : ''}>Paid</option>
                            <option value="overdue" ${doc.status === 'overdue' ? 'selected' : ''}>Overdue</option>
                        ` : `
                            <option value="accepted" ${doc.status === 'accepted' ? 'selected' : ''}>Accepted</option>
                            <option value="rejected" ${doc.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                        `}
                    </select>
                </td>
                <td>
                    <div style="display: flex; gap: 4px;">
                        <button class="doc-action-btn doc-edit-btn" data-id="${doc.id}" title="Edit">
                            <i data-lucide="pencil" style="width: 16px; height: 16px;"></i>
                        </button>
                        ${doc.pdf_url ? `
                            <a href="${doc.pdf_url}" target="_blank" class="doc-action-btn" title="Download PDF">
                                <i data-lucide="download" style="width: 16px; height: 16px;"></i>
                            </a>
                        ` : ''}
                        ${doc.status !== 'concept' || doc.pdf_url ? `
                            <button class="doc-action-btn doc-send-btn" data-id="${doc.id}" title="${doc.sent_at ? 'Send Reminder' : 'Send'}">
                                <i data-lucide="mail" style="width: 16px; height: 16px;"></i>
                            </button>
                        ` : ''}
                        ${doc.document_type === 'invoice' && !doc.recurring_rule_id ? `
                            <button class="doc-action-btn doc-recurring-btn" data-id="${doc.id}" title="Make Recurring">
                                <i data-lucide="repeat" style="width: 16px; height: 16px;"></i>
                            </button>
                        ` : ''}
                        <button class="doc-action-btn doc-activity-btn" data-id="${doc.id}" data-number="${escapeHtml(doc.document_number)}" title="Activity">
                            <i data-lucide="clock" style="width: 16px; height: 16px;"></i>
                        </button>
                        <button class="doc-action-btn doc-delete-btn" data-id="${doc.id}" data-number="${escapeHtml(doc.document_number)}" title="Delete">
                            <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        lucide.createIcons();

        // Status change handlers
        tbody.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const docId = e.target.dataset.id;
                const newStatus = e.target.value;
                try {
                    await api.updateDocument(docId, { status: newStatus });
                    // Update badge styling
                    e.target.className = `status-select status-badge ${getBadgeClass(newStatus)}`;
                    showNotification('Status updated');
                } catch (error) {
                    showNotification('Failed to update status', 'error');
                    e.target.value = e.target.dataset.current;
                }
            });
        });

        // Edit handlers
        tbody.querySelectorAll('.doc-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const docId = btn.dataset.id;
                window.location.hash = `#/new-document?edit=${docId}`;
            });
        });

        // Send handlers
        tbody.querySelectorAll('.doc-send-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const docId = btn.dataset.id;
                const doc = documents.find(d => d.id === docId);
                if (!doc) return;
                openSendModal(doc, {
                    onSent: () => loadDocuments(),
                });
            });
        });

        // Make Recurring handlers
        tbody.querySelectorAll('.doc-recurring-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const docId = btn.dataset.id;
                const doc = documents.find(d => d.id === docId);
                if (!doc) return;
                const { openCreateModal } = await import('/js/pages/automations.js');
                openCreateModal({
                    source_document_id: doc.id,
                    name: `Recurring ${doc.document_number}`,
                });
            });
        });

        // Activity handlers
        tbody.querySelectorAll('.doc-activity-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                openActivityPanel(btn.dataset.id, btn.dataset.number);
            });
        });

        // Delete handlers
        tbody.querySelectorAll('.doc-delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const docId = btn.dataset.id;
                const docNum = btn.dataset.number;
                if (!confirm(`Delete document ${docNum}?`)) return;
                try {
                    await api.deleteDocument(docId);
                    showNotification('Document deleted');
                    await loadDocuments();
                } catch (error) {
                    showNotification('Failed to delete document', 'error');
                }
            });
        });
    } catch (error) {
        console.error('Failed to load documents:', error);
        loading.innerHTML = `
            <i data-lucide="alert-circle" style="width: 48px; height: 48px; color: var(--color-error);"></i>
            <p style="color: var(--color-error); margin-top: var(--space-md);">Failed to load documents: ${error.message}</p>
        `;
        lucide.createIcons();
    }
}
