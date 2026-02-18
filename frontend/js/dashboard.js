/**
 * Dashboard initialization and route handlers
 */

// ===== Auth Guard =====
(async function checkAuth() {
    try {
        const session = await auth.getSession();
        if (!session) {
            window.location.href = '/login';
            return;
        }

        // Display user info in sidebar
        const userEmailEl = document.getElementById('user-email');
        const userInfoEl = document.getElementById('user-info');
        if (userEmailEl && session.user) {
            userEmailEl.textContent = session.user.email;
            userInfoEl.style.display = 'flex';
        }

        // Logout button
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            auth.signOut();
        });
    } catch (e) {
        console.error('Auth check failed:', e);
        window.location.href = '/login';
    }
})();

// Set content area for router
router.setContentArea(document.getElementById('content-area'));

// ========== Route Handlers ==========

// HOME PAGE - Enhanced Dashboard
router.register('home', async () => {
    const html = `
        <div style="padding: var(--space-lg); max-width: 1400px; margin: 0 auto;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-xl); flex-wrap: wrap; gap: var(--space-md);">
                <div>
                    <h1 style="display: flex; align-items: center; gap: var(--space-md); font-size: 32px; color: var(--color-dark-green); margin-bottom: var(--space-sm);">
                        <i data-lucide="layout-dashboard"></i>
                        Dashboard
                    </h1>
                    <p style="color: var(--color-text-secondary);">
                        Overview of your invoices, quotes, and templates
                    </p>
                </div>
                <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap;">
                    <a href="#/new-document" class="btn-primary" style="display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-sm) var(--space-lg); text-decoration: none; font-size: 14px;">
                        <i data-lucide="file-plus" style="width: 16px; height: 16px;"></i> New Invoice
                    </a>
                    <a href="#/new-document?type=quote" class="btn-secondary" style="display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-sm) var(--space-lg); text-decoration: none; font-size: 14px;">
                        <i data-lucide="file-text" style="width: 16px; height: 16px;"></i> New Quote
                    </a>
                </div>
            </div>

            <div id="dash-loading" class="loading">
                <div class="loader-pulse">
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__dot"></div>
                </div>
                <p>Loading dashboard...</p>
            </div>

            <div id="dash-content" style="display: none;">
                <!-- Stat cards -->
                <div id="dash-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-xl);"></div>

                <!-- Two-column details -->
                <div id="dash-details" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: var(--space-xl);"></div>
            </div>
        </div>
    `;

    router.render(html);
    lucide.createIcons();

    try {
        const stats = await api.getDashboardStats();

        document.getElementById('dash-loading').style.display = 'none';
        document.getElementById('dash-content').style.display = 'block';

        // Format currency helper
        const fmtCurrency = (n) => Number(n || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

        // Stat cards
        document.getElementById('dash-stats').innerHTML = `
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(0, 143, 122, 0.1);">
                    <i data-lucide="file-text" style="color: var(--color-shamrock);"></i>
                </div>
                <div class="stat-value">${stats.total_invoices}</div>
                <div class="stat-label">Invoices</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(26, 178, 145, 0.1);">
                    <i data-lucide="file-check" style="color: var(--color-mountain-meadow);"></i>
                </div>
                <div class="stat-value">${stats.total_quotes}</div>
                <div class="stat-label">Quotes</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(34, 139, 34, 0.1);">
                    <i data-lucide="euro" style="color: #228B22;"></i>
                </div>
                <div class="stat-value" style="font-size: 22px;">&euro; ${fmtCurrency(stats.revenue_this_month)}</div>
                <div class="stat-label">Revenue this month</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(255, 152, 0, 0.1);">
                    <i data-lucide="clock" style="color: #FF9800;"></i>
                </div>
                <div class="stat-value" style="font-size: 22px;">&euro; ${fmtCurrency(stats.outstanding_amount)}</div>
                <div class="stat-label">Outstanding</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(0, 61, 51, 0.1);">
                    <i data-lucide="users" style="color: var(--color-dark-green);"></i>
                </div>
                <div class="stat-value">${stats.total_customers}</div>
                <div class="stat-label">Customers</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(0, 143, 122, 0.1);">
                    <i data-lucide="layout-template" style="color: var(--color-shamrock);"></i>
                </div>
                <div class="stat-value">${stats.total_templates}</div>
                <div class="stat-label">Templates</div>
            </div>
        `;

        // Recent documents
        const recentDocsHtml = stats.recent_documents.length > 0
            ? stats.recent_documents.map(doc => {
                const statusMap = {
                    concept: 'badge-concept',
                    sent: 'badge-sent',
                    paid: 'badge-paid',
                    accepted: 'badge-accepted',
                    overdue: 'badge-overdue',
                    rejected: 'badge-rejected',
                };
                const badgeClass = statusMap[doc.status] || 'badge-concept';
                const typeIcon = doc.document_type === 'invoice' ? 'file-text' : 'file-check';
                const amount = Number(doc.total_amount || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                return `
                    <div class="template-mini-item">
                        <i data-lucide="${typeIcon}" style="color: var(--color-shamrock); flex-shrink: 0;"></i>
                        <div class="template-mini-info" style="min-width: 0;">
                            <div class="template-mini-name">${escapeHtmlDash(doc.document_number || 'Draft')}</div>
                            <div class="template-mini-date">${escapeHtmlDash(doc.customer_name || '—')} &middot; &euro; ${amount}</div>
                        </div>
                        <span class="status-badge ${badgeClass}" style="font-size: 11px; padding: 2px 8px; flex-shrink: 0;">
                            ${doc.status || 'concept'}
                        </span>
                    </div>
                `;
            }).join('')
            : '<p style="color: var(--color-text-secondary); text-align: center; padding: var(--space-md);">No documents yet. Create your first invoice!</p>';

        // Most used templates
        const mostUsedHtml = stats.most_used_templates.length > 0
            ? stats.most_used_templates.map(t => `
                <div class="template-mini-item">
                    <i data-lucide="zap" style="color: var(--color-mountain-meadow); flex-shrink: 0;"></i>
                    <div class="template-mini-info">
                        <div class="template-mini-name">${escapeHtmlDash(t.name)}</div>
                        <div class="template-mini-date">${t.usage_count}x used</div>
                    </div>
                    <a href="#/new-document?template_id=${t.id}" class="template-mini-action" title="Use template">
                        <i data-lucide="arrow-right"></i>
                    </a>
                </div>
            `).join('')
            : '<p style="color: var(--color-text-secondary); text-align: center; padding: var(--space-md);">No usage data yet</p>';

        document.getElementById('dash-details').innerHTML = `
            <div class="dashboard-section">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-md);">
                    <h2 style="font-size: 18px; display: flex; align-items: center; gap: var(--space-sm);">
                        <i data-lucide="clock"></i>
                        Recent Documents
                    </h2>
                    <a href="#/documents" style="font-size: 13px; color: var(--color-shamrock); text-decoration: none;">View all &rarr;</a>
                </div>
                <div class="template-mini-list">
                    ${recentDocsHtml}
                </div>
            </div>

            <div class="dashboard-section">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-md);">
                    <h2 style="font-size: 18px; display: flex; align-items: center; gap: var(--space-sm);">
                        <i data-lucide="trending-up"></i>
                        Most Used Templates
                    </h2>
                    <a href="#/templates" style="font-size: 13px; color: var(--color-shamrock); text-decoration: none;">View all &rarr;</a>
                </div>
                <div class="template-mini-list">
                    ${mostUsedHtml}
                </div>
            </div>
        `;

        lucide.createIcons();

    } catch (error) {
        console.error('Failed to load dashboard:', error);
        document.getElementById('dash-loading').innerHTML = `
            <i data-lucide="alert-circle" style="width: 48px; height: 48px; color: var(--color-error);"></i>
            <p style="color: var(--color-error); margin-top: var(--space-md);">Failed to load dashboard: ${error.message}</p>
        `;
        lucide.createIcons();
    }
});

// Helper: escape HTML for safe rendering
function escapeHtmlDash(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper: date formatting
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('nl-NL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// NEW DOCUMENT PAGE - Create invoices and quotes
router.register('new-document', async () => {
    const module = await import('/js/pages/new-document.js');
    await module.initNewDocument();
});

// DOCUMENTS PAGE - Document history and management
router.register('documents', async () => {
    const module = await import('/js/pages/documents.js');
    await module.initDocuments();
});

// TEMPLATES PAGE - Template library (browse, edit, delete)
router.register('templates', async () => {
    const module = await import('/js/pages/library.js');
    await module.initLibrary();
});

// CUSTOMERS PAGE - Customer address book
router.register('customers', async () => {
    const module = await import('/js/pages/customers.js');
    await module.initCustomers();
});

// SETTINGS PAGE - Company details and preferences
router.register('settings', async () => {
    const module = await import('/js/pages/settings.js');
    await module.initSettings();
});

// DESIGNER PAGE - Template editor (accessed from Templates page)
router.register('designer', async () => {
    const module = await import('/js/pages/designer.js');
    await module.initDesigner();
});

// Backward compatibility aliases
router.register('generator', async () => {
    window.location.hash = '#/new-document';
});
router.register('library', async () => {
    window.location.hash = '#/templates';
});

// ========== Health Check for Status Indicator ==========

async function checkHealth() {
    const statusEl = document.getElementById('status');
    if (!statusEl) return;

    try {
        const data = await api.checkHealth();

        if (data.status === 'healthy') {
            statusEl.innerHTML = `
                <i data-lucide="check-circle" style="color: var(--color-success);"></i>
                <span>All services online</span>
            `;
        } else {
            const issues = [];
            if (!data.supabase_connected) issues.push('Supabase');
            if (!data.node_service_connected) issues.push('PDF Service');

            statusEl.innerHTML = `
                <i data-lucide="alert-triangle" style="color: var(--color-error);"></i>
                <span>Issues: ${issues.join(', ')}</span>
            `;
        }

        lucide.createIcons();
    } catch (error) {
        statusEl.innerHTML = `
            <i data-lucide="x-circle" style="color: var(--color-error);"></i>
            <span>Backend offline</span>
        `;
        lucide.createIcons();
    }
}

// Initial health check
checkHealth();

// Check health every 60 seconds
setInterval(checkHealth, 60000);

// Initialize Lucide icons
lucide.createIcons();
