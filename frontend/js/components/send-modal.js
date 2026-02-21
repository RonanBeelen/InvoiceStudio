/**
 * Send Document Modal
 * Shows recipient, subject, body fields pre-filled from customer + settings.
 * Supports: send via email, send reminder, mark as sent.
 */

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'success') {
    const existing = document.querySelector('.settings-notification');
    if (existing) existing.remove();
    const notif = document.createElement('div');
    notif.className = `settings-notification settings-notification-${type}`;
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.classList.add('show'), 10);
    setTimeout(() => { notif.classList.remove('show'); setTimeout(() => notif.remove(), 300); }, 3000);
}

/**
 * Opens the send document modal.
 * @param {object} doc - The document object (from API)
 * @param {object} options - { onSent?: function }
 */
export async function openSendModal(doc, options = {}) {
    document.getElementById('send-modal')?.remove();

    // Pre-fetch customer email if available
    let customerEmail = '';
    let customerName = '';
    if (doc.customer_id) {
        try {
            const customer = await api.getCustomer(doc.customer_id);
            customerEmail = customer?.email || '';
            customerName = customer?.name || '';
        } catch (e) { /* ignore */ }
    }

    // Use last_sent_email as fallback
    if (!customerEmail && doc.last_sent_email) {
        customerEmail = doc.last_sent_email;
    }

    const isReminder = doc.status === 'sent' || doc.sent_at;
    const title = isReminder ? 'Send Reminder' : 'Send Document';
    const docLabel = `${doc.document_type === 'invoice' ? 'Invoice' : 'Quote'} ${doc.document_number}`;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'send-modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 580px;">
            <div class="modal-header">
                <h2><i data-lucide="mail" style="width: 20px; height: 20px;"></i> ${title}</h2>
                <button class="modal-close-btn" id="send-modal-close">
                    <i data-lucide="x" style="width: 20px; height: 20px;"></i>
                </button>
            </div>
            <div class="modal-body">
                <div style="background: var(--gray-50); padding: var(--space-md); border-radius: var(--radius-md); margin-bottom: var(--space-lg); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${escapeHtml(docLabel)}</strong>
                        ${doc.customer_name ? `<span style="color: var(--color-text-secondary);"> — ${escapeHtml(doc.customer_name)}</span>` : ''}
                    </div>
                    <span style="font-family: var(--font-mono); font-weight: var(--font-weight-semibold); color: var(--color-shamrock);">
                        &euro; ${Number(doc.total_amount || 0).toFixed(2).replace('.', ',')}
                    </span>
                </div>

                <div class="form-group" style="margin-bottom: var(--space-md);">
                    <label class="form-label" for="send-email">Recipient email *</label>
                    <input type="email" id="send-email" class="form-input" value="${escapeHtml(customerEmail)}" placeholder="recipient@example.com" required>
                </div>

                <div class="form-group" style="margin-bottom: var(--space-md);">
                    <label class="form-label" for="send-name">Recipient name</label>
                    <input type="text" id="send-name" class="form-input" value="${escapeHtml(customerName)}" placeholder="Contact name">
                </div>

                <div class="form-group" style="margin-bottom: var(--space-md);">
                    <label class="form-label" for="send-subject">Subject</label>
                    <input type="text" id="send-subject" class="form-input" placeholder="Auto-generated from settings">
                </div>

                <div class="form-group" style="margin-bottom: var(--space-md);">
                    <label class="form-label" for="send-body">Message</label>
                    <textarea id="send-body" class="form-input" rows="6" placeholder="Auto-generated from settings"></textarea>
                </div>

                ${!doc.pdf_url ? `
                    <div style="background: rgba(229, 62, 62, 0.08); border: 1px solid rgba(229, 62, 62, 0.2); padding: var(--space-md); border-radius: var(--radius-md); color: var(--color-error); font-size: 13px; margin-bottom: var(--space-md);">
                        <i data-lucide="alert-triangle" style="width: 16px; height: 16px; vertical-align: -3px;"></i>
                        No PDF generated yet. Generate a PDF before sending.
                    </div>
                ` : ''}

                <div id="send-result" style="display: none;"></div>
            </div>
            <div class="modal-footer" style="flex-wrap: wrap; gap: var(--space-sm);">
                <button class="btn-secondary" id="send-mark-sent" style="margin-right: auto; font-size: 13px;">
                    <i data-lucide="check" style="width: 14px; height: 14px;"></i> Mark as Sent
                </button>
                <button class="btn-secondary" id="send-modal-cancel">Cancel</button>
                <button class="btn-primary" id="send-modal-submit" ${!doc.pdf_url ? 'disabled' : ''}>
                    <i data-lucide="send" style="width: 16px; height: 16px;"></i>
                    ${isReminder ? 'Send Reminder' : 'Send'}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    lucide.createIcons();

    const close = () => modal.remove();
    document.getElementById('send-modal-close').addEventListener('click', close);
    document.getElementById('send-modal-cancel').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    // Send button
    document.getElementById('send-modal-submit').addEventListener('click', async () => {
        const email = document.getElementById('send-email').value.trim();
        if (!email) {
            document.getElementById('send-email').focus();
            return;
        }

        const btn = document.getElementById('send-modal-submit');
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner-inline" style="width: 16px; height: 16px; border-width: 2px;"></div> Sending...';

        try {
            const data = {
                recipient_email: email,
                recipient_name: document.getElementById('send-name').value.trim(),
                subject: document.getElementById('send-subject').value.trim(),
                body_text: document.getElementById('send-body').value.trim(),
            };

            const result = isReminder
                ? await api.sendReminder(doc.id, data)
                : await api.sendDocument(doc.id, data);

            showSendResult('success', `Document sent to ${email}`);
            showNotification('Document sent successfully!');
            if (options.onSent) options.onSent(result);
            setTimeout(close, 1500);
        } catch (error) {
            showSendResult('error', error.message);
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="send" style="width: 16px; height: 16px;"></i> ${isReminder ? 'Send Reminder' : 'Send'}`;
            lucide.createIcons();
        }
    });

    // Mark as sent button
    document.getElementById('send-mark-sent').addEventListener('click', async () => {
        const btn = document.getElementById('send-mark-sent');
        btn.disabled = true;
        btn.textContent = 'Marking...';

        try {
            const email = document.getElementById('send-email').value.trim();
            await api.markDocumentSent(doc.id, { recipient_email: email || undefined });
            showNotification('Document marked as sent');
            if (options.onSent) options.onSent();
            close();
        } catch (error) {
            showNotification('Failed: ' + error.message, 'error');
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="check" style="width: 14px; height: 14px;"></i> Mark as Sent';
            lucide.createIcons();
        }
    });

    function showSendResult(type, message) {
        const el = document.getElementById('send-result');
        el.style.display = 'block';
        el.className = type === 'success'
            ? 'send-result-success'
            : 'send-result-error';
        el.innerHTML = `
            <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" style="width: 16px; height: 16px;"></i>
            ${escapeHtml(message)}
        `;
        lucide.createIcons();
    }

    // Focus email field
    document.getElementById('send-email').focus();
}
