/**
 * Shared confirm dialog component
 * Extracted from customers.js / price-library.js pattern
 */

export function showConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'danger' }) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-content" style="max-width: 440px;">
                <div class="modal-header">
                    <h2 style="display: flex; align-items: center; gap: var(--space-sm);">
                        <i data-lucide="${variant === 'danger' ? 'alert-triangle' : 'archive'}" style="width: 22px; height: 22px; color: ${variant === 'danger' ? 'var(--color-error)' : '#d69e2e'};"></i>
                        ${title}
                    </h2>
                    <button class="modal-close-btn" id="confirm-close">
                        <i data-lucide="x" style="width: 20px; height: 20px;"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: var(--space-lg) var(--space-xl);">
                    <p style="color: var(--color-text-secondary); line-height: 1.6; font-size: 15px;">${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="confirm-cancel">${cancelLabel}</button>
                    <button class="${variant === 'danger' ? 'btn-danger' : 'btn-warning'}" id="confirm-action" style="padding: var(--space-sm) var(--space-xl);">
                        ${confirmLabel}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        lucide.createIcons();

        const close = (result) => {
            overlay.remove();
            resolve(result);
        };
        document.getElementById('confirm-action').addEventListener('click', () => close(true));
        document.getElementById('confirm-cancel').addEventListener('click', () => close(false));
        document.getElementById('confirm-close').addEventListener('click', () => close(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    });
}
