/**
 * Activity Panel Component
 * Vertical timeline showing document history (created, updated, sent, etc.)
 */

const ACTION_CONFIG = {
    created:        { icon: 'plus-circle',  color: 'var(--color-shamrock)',     label: 'Created' },
    updated:        { icon: 'pencil',       color: 'var(--color-mountain-meadow)', label: 'Updated' },
    status_changed: { icon: 'refresh-cw',   color: '#6366f1',                  label: 'Status changed' },
    sent:           { icon: 'send',         color: '#3b82f6',                  label: 'Sent' },
    reminder_sent:  { icon: 'bell',         color: '#f59e0b',                  label: 'Reminder sent' },
    marked_sent:    { icon: 'check-circle', color: 'var(--color-shamrock)',     label: 'Marked as sent' },
    deleted:        { icon: 'trash-2',      color: 'var(--color-error)',        label: 'Deleted' },
    email_replied:  { icon: 'mail',         color: '#8b5cf6',                  label: 'Email reply' },
    payment_confirmed: { icon: 'banknote',  color: '#10b981',                  label: 'Payment confirmed' },
};

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
    return new Date(isoDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Opens an activity timeline panel for a document.
 * @param {string} documentId
 * @param {string} documentNumber - for the title
 */
export async function openActivityPanel(documentId, documentNumber) {
    document.getElementById('activity-modal')?.remove();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'activity-modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; max-height: 80vh; display: flex; flex-direction: column;">
            <div class="modal-header">
                <h2><i data-lucide="clock" style="width: 20px; height: 20px;"></i> Activity — ${escapeHtml(documentNumber)}</h2>
                <button class="modal-close-btn" id="activity-modal-close">
                    <i data-lucide="x" style="width: 20px; height: 20px;"></i>
                </button>
            </div>
            <div id="activity-timeline-body" style="flex: 1; overflow-y: auto; padding: var(--space-lg) var(--space-xl);">
                <div style="text-align: center; padding: var(--space-xl); color: var(--color-text-secondary);">Loading...</div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    lucide.createIcons();

    const close = () => modal.remove();
    document.getElementById('activity-modal-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    // Load activity
    const body = document.getElementById('activity-timeline-body');
    try {
        const entries = await api.getDocumentActivity(documentId, 50);

        if (!entries || entries.length === 0) {
            body.innerHTML = `
                <div style="text-align: center; padding: var(--space-xl); color: var(--color-text-secondary);">
                    <i data-lucide="inbox" style="width: 32px; height: 32px; margin-bottom: var(--space-sm);"></i>
                    <p>No activity yet</p>
                </div>`;
            lucide.createIcons();
            return;
        }

        body.innerHTML = `<div class="activity-timeline">${entries.map(renderEntry).join('')}</div>`;
        lucide.createIcons();
    } catch (err) {
        body.innerHTML = `<div style="text-align: center; padding: var(--space-xl); color: var(--color-error);">Failed to load activity</div>`;
    }
}

function renderEntry(entry) {
    const config = ACTION_CONFIG[entry.action] || { icon: 'circle', color: 'var(--color-text-secondary)', label: entry.action };
    const detail = entry.detail || {};

    let description = config.label;
    if (entry.action === 'sent' && detail.recipient) {
        description = `Sent to ${escapeHtml(detail.recipient)}`;
    } else if (entry.action === 'reminder_sent' && detail.recipient) {
        description = `Reminder sent to ${escapeHtml(detail.recipient)}`;
    } else if (entry.action === 'status_changed' && detail.fields) {
        description = 'Status updated';
    } else if (entry.action === 'created' && detail.document_number) {
        description = `Created ${escapeHtml(detail.document_number)}`;
    } else if (entry.action === 'marked_sent') {
        description = `Marked as sent${detail.recipient && detail.recipient !== 'manual' ? ` (${escapeHtml(detail.recipient)})` : ''}`;
    }

    return `
        <div class="activity-entry">
            <div class="activity-icon" style="background: ${config.color}20; color: ${config.color};">
                <i data-lucide="${config.icon}" style="width: 16px; height: 16px;"></i>
            </div>
            <div class="activity-content">
                <div class="activity-desc">${description}</div>
                <div class="activity-time">${relativeTime(entry.created_at)}</div>
            </div>
        </div>
    `;
}
