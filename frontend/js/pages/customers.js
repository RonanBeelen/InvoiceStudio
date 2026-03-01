/**
 * Customers Page - Customer address book with CRUD and search
 */

let searchTimeout = null;
let selectedCustomers = new Set();
let showingArchived = false;

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

function showConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'danger' }) {
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

export async function initCustomers() {
    const html = `
        <div style="padding: var(--space-lg); max-width: 1400px; margin: 0 auto;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-xl); flex-wrap: wrap; gap: var(--space-md);">
                <div>
                    <h1 style="display: flex; align-items: center; gap: var(--space-md); font-size: 32px; color: var(--color-dark-green); margin-bottom: var(--space-sm);">
                        <i data-lucide="users"></i>
                        Customers
                    </h1>
                    <p style="color: var(--color-text-secondary);">
                        Manage your customer address book
                    </p>
                </div>
                <div style="display: flex; gap: var(--space-md);">
                    <button class="btn-secondary" id="toggle-archived-btn" style="display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-md) var(--space-xl);">
                        <i data-lucide="archive"></i>
                        Archived
                    </button>
                    <button class="btn-secondary" id="import-customers-btn" style="display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-md) var(--space-xl);">
                        <i data-lucide="upload"></i>
                        Import
                    </button>
                    <button class="btn-primary" id="add-customer-btn" style="display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-md) var(--space-xl);">
                        <i data-lucide="plus"></i>
                        Add Customer
                    </button>
                </div>
            </div>

            <!-- Search bar -->
            <div style="margin-bottom: var(--space-lg);">
                <div style="position: relative; max-width: 400px;">
                    <i data-lucide="search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; color: var(--color-text-secondary);"></i>
                    <input type="text" id="customer-search" class="form-input" placeholder="Search customers..." style="padding-left: 40px;">
                </div>
            </div>

            <!-- Selection bar -->
            <div id="customer-selection-bar" class="bulk-selection-bar" style="display: none;">
                <div style="display: flex; align-items: center; gap: var(--space-md);">
                    <input type="checkbox" id="customer-select-all" class="bulk-checkbox">
                    <span id="customer-selected-count" style="font-weight: var(--font-weight-semibold); color: var(--color-text-primary);"></span>
                </div>
                <div style="display: flex; gap: var(--space-sm);">
                    <button class="btn-warning" id="customer-archive-selected" style="display: flex; align-items: center; gap: var(--space-xs); padding: var(--space-sm) var(--space-lg);">
                        <i data-lucide="archive" style="width: 16px; height: 16px;"></i>
                        Archive
                    </button>
                    <button class="btn-danger" id="customer-delete-selected" style="display: flex; align-items: center; gap: var(--space-xs); padding: var(--space-sm) var(--space-lg);">
                        <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                        Delete
                    </button>
                </div>
            </div>

            <!-- Loading -->
            <div id="customers-loading" class="loading">
                <div class="loader-pulse">
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__dot"></div>
                </div>
                <p>Loading customers...</p>
            </div>

            <!-- Customer grid -->
            <div id="customers-grid" class="card-grid card-grid--4" style="display: none;"></div>

            <!-- Empty state -->
            <div id="customers-empty" style="display: none; text-align: center; padding: var(--space-2xl);" class="dashboard-section">
                <i data-lucide="user-plus" style="width: 64px; height: 64px; color: var(--color-text-secondary); margin-bottom: var(--space-md);"></i>
                <h2 style="color: var(--color-text-secondary); margin-bottom: var(--space-sm);">No customers yet</h2>
                <p style="color: var(--color-text-secondary); margin-bottom: var(--space-lg);">Add your first customer to get started.</p>
                <button class="btn-primary" onclick="document.getElementById('add-customer-btn').click()">
                    <i data-lucide="plus"></i> Add Customer
                </button>
            </div>
        </div>
    `;

    router.render(html);
    lucide.createIcons();

    // Load customers
    await loadCustomers();

    // Setup event handlers
    document.getElementById('add-customer-btn').addEventListener('click', () => openCustomerModal());
    document.getElementById('import-customers-btn').addEventListener('click', () => openImportModal());

    document.getElementById('toggle-archived-btn').addEventListener('click', () => {
        showingArchived = !showingArchived;
        const btn = document.getElementById('toggle-archived-btn');
        if (showingArchived) {
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-warning');
            btn.innerHTML = '<i data-lucide="arrow-left"></i> Back to Active';
        } else {
            btn.classList.remove('btn-warning');
            btn.classList.add('btn-secondary');
            btn.innerHTML = '<i data-lucide="archive"></i> Archived';
        }
        lucide.createIcons();
        loadCustomers(document.getElementById('customer-search')?.value || '');
    });

    document.getElementById('customer-select-all').addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.customer-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            if (e.target.checked) selectedCustomers.add(cb.dataset.id);
            else selectedCustomers.delete(cb.dataset.id);
        });
        updateCustomerSelectionBar();
    });

    document.getElementById('customer-archive-selected').addEventListener('click', () => bulkArchiveSelectedCustomers());
    document.getElementById('customer-delete-selected').addEventListener('click', () => bulkDeleteSelectedCustomers());

    document.getElementById('customer-search').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => loadCustomers(e.target.value), 300);
    });
}

async function loadCustomers(query = '') {
    const loading = document.getElementById('customers-loading');
    const grid = document.getElementById('customers-grid');
    const empty = document.getElementById('customers-empty');

    loading.style.display = 'block';
    grid.style.display = 'none';
    empty.style.display = 'none';

    try {
        const customers = await api.getCustomers(query, !showingArchived);

        loading.style.display = 'none';

        if (customers.length === 0) {
            empty.style.display = 'block';
            lucide.createIcons();
            return;
        }

        grid.style.display = 'grid';
        grid.innerHTML = customers.map(c => renderCustomerCard(c)).join('');
        lucide.createIcons();

        // Attach card event handlers
        grid.querySelectorAll('.customer-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openCustomerModal(btn.dataset.id));
        });

        grid.querySelectorAll('.customer-archive-btn').forEach(btn => {
            btn.addEventListener('click', () => archiveCustomer(btn.dataset.id, btn.dataset.name));
        });

        grid.querySelectorAll('.customer-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteCustomer(btn.dataset.id, btn.dataset.name));
        });

        // Checkbox selection handlers
        selectedCustomers.clear();
        updateCustomerSelectionBar();

        grid.querySelectorAll('.customer-checkbox').forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked) selectedCustomers.add(cb.dataset.id);
                else selectedCustomers.delete(cb.dataset.id);
                updateCustomerSelectionBar();
            });
        });
    } catch (error) {
        console.error('Failed to load customers:', error);
        loading.innerHTML = `
            <i data-lucide="alert-circle" style="width: 48px; height: 48px; color: var(--color-error);"></i>
            <p style="color: var(--color-error); margin-top: var(--space-md);">Failed to load customers: ${error.message}</p>
        `;
        lucide.createIcons();
    }
}

function renderCustomerCard(customer) {
    const address = [customer.address, [customer.postal_code, customer.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');

    return `
        <div class="card-sectioned dashboard-section" data-customer-id="${customer.id}">
            <div class="card-header" style="padding-bottom: var(--space-sm);">
                <div class="card-title" style="flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0; flex: 1;">
                    <div style="display: flex; align-items: center; gap: var(--space-sm); min-width: 0; width: 100%;">
                        <i data-lucide="user" style="width: 18px; height: 18px; color: var(--color-shamrock); flex-shrink: 0;"></i>
                        <strong class="copyable-field" data-copy="${escapeHtml(customer.name)}" style="display: inline-flex; align-items: center; gap: 4px; min-width: 0;">
                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(customer.name)}</span>
                            <i data-lucide="copy" class="copy-hint" style="width: 12px; height: 12px; flex-shrink: 0;"></i>
                        </strong>
                    </div>
                    ${customer.company_name ? `<span class="copyable-field" data-copy="${escapeHtml(customer.company_name)}" style="display: inline-flex; align-items: center; gap: 4px; max-width: 100%; min-width: 0;"><span style="font-size: 12px; color: var(--color-shamrock); font-weight: var(--font-weight-semibold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(customer.company_name)}</span><i data-lucide="copy" class="copy-hint" style="width: 12px; height: 12px; flex-shrink: 0;"></i></span>` : ''}
                </div>
                <input type="checkbox" class="bulk-checkbox customer-checkbox" data-id="${customer.id}" style="flex-shrink: 0;">
            </div>
            <div class="card-body" style="padding-top: var(--space-sm);">
                ${address ? `
                    <div class="card-row">
                        <i data-lucide="map-pin" style="width: 14px; height: 14px; color: var(--color-text-secondary); flex-shrink: 0;"></i>
                        <span class="copyable-field" data-copy="${escapeHtml(address)}">${escapeHtml(address)}<i data-lucide="copy" class="copy-hint" style="width: 12px; height: 12px; flex-shrink: 0;"></i></span>
                    </div>
                ` : ''}
                ${customer.email ? `
                    <div class="card-row">
                        <i data-lucide="mail" style="width: 14px; height: 14px; color: var(--color-text-secondary); flex-shrink: 0;"></i>
                        <span class="copyable-field" data-copy="${escapeHtml(customer.email)}">${escapeHtml(customer.email)}<i data-lucide="copy" class="copy-hint" style="width: 12px; height: 12px; flex-shrink: 0;"></i></span>
                    </div>
                ` : ''}
                ${customer.phone ? `
                    <div class="card-row">
                        <i data-lucide="phone" style="width: 14px; height: 14px; color: var(--color-text-secondary); flex-shrink: 0;"></i>
                        <span class="copyable-field" data-copy="${escapeHtml(customer.phone)}">${escapeHtml(customer.phone)}<i data-lucide="copy" class="copy-hint" style="width: 12px; height: 12px; flex-shrink: 0;"></i></span>
                    </div>
                ` : ''}
                ${customer.tax_id ? `
                    <div class="card-row">
                        <span class="card-label">Tax ID</span>
                        <span>${escapeHtml(customer.tax_id)}</span>
                    </div>
                ` : ''}
            </div>
            <div class="card-actions">
                <button class="btn-secondary customer-edit-btn" data-id="${customer.id}" style="font-size: 12px; padding: 4px 12px;">
                    <i data-lucide="pencil" style="width: 14px; height: 14px;"></i> Edit
                </button>
                ${showingArchived ? `
                    <button class="btn-primary customer-restore-btn" data-id="${customer.id}" style="font-size: 12px; padding: 4px 12px;">
                        <i data-lucide="archive-restore" style="width: 14px; height: 14px;"></i> Restore
                    </button>
                ` : `
                    <button class="btn-secondary customer-archive-btn" data-id="${customer.id}" data-name="${escapeHtml(customer.name)}" style="font-size: 12px; padding: 4px 12px; color: #d69e2e;">
                        <i data-lucide="archive" style="width: 14px; height: 14px;"></i>
                    </button>
                `}
                <button class="btn-secondary customer-delete-btn" data-id="${customer.id}" data-name="${escapeHtml(customer.name)}" style="font-size: 12px; padding: 4px 12px; color: var(--color-error);">
                    <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                </button>
            </div>
        </div>
    `;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== Copy to Clipboard ====================

document.addEventListener('click', function(e) {
    const field = e.target.closest('.copyable-field');
    if (!field) return;
    e.stopPropagation();
    const text = field.dataset.copy;
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
        const icon = field.querySelector('.copy-hint');
        if (icon) {
            icon.setAttribute('data-lucide', 'check');
            lucide.createIcons();
            setTimeout(() => {
                icon.setAttribute('data-lucide', 'copy');
                lucide.createIcons();
            }, 1500);
        }
    });
});

// ==================== Import: Column Mapping Config ====================

const CUSTOMER_COLUMN_MAP_CONFIG = [
    { field: 'name',         label: 'Name *',      required: true,
      aliases: ['name','naam','full name','volledige naam','contact','contactpersoon','contact name','display name'] },
    { field: 'company_name', label: 'Company Name', required: false,
      aliases: ['company','bedrijf','bedrijfsnaam','organization','organisatie','company name','organisation','firma'] },
    { field: 'email',        label: 'Email',        required: false,
      aliases: ['email','e-mail','e-mailadres','emailadres','mail','email address'] },
    { field: 'phone',        label: 'Phone',        required: false,
      aliases: ['phone','mobile','telefoon','mobiel','business phone','tel','telefoonnummer','phone number','mobiel nummer','gsm','mobile phone'] },
    { field: 'address',      label: 'Address',      required: false,
      aliases: ['address','adres','street','straat','street address','straatadres','address line 1','business street'] },
    { field: 'postal_code',  label: 'Postal Code',  required: false,
      aliases: ['postal code','postcode','zip','zip code','postnummer','business postal code'] },
    { field: 'city',         label: 'City',         required: false,
      aliases: ['city','stad','gemeente','plaats','woonplaats','town','business city'] },
    { field: 'country',      label: 'Country',      required: false,
      aliases: ['country','land','country name','business country','business country/region'] },
    { field: 'tax_id',       label: 'Tax ID / BTW', required: false,
      aliases: ['vat','btw','btw-nummer','btwnummer','tax id','vat number','vat no','btw nummer','tax number','kvk','fiscaal nummer'] },
    { field: 'notes',        label: 'Notes',        required: false,
      aliases: ['notes','notities','opmerkingen','memo','comment','comments','remarks','toelichting','note'] },
];

function autoDetectCustomerColumnMapping(headers) {
    const mapping = {};
    const usedColumns = new Set();
    const normalized = headers.map(h =>
        (h || '').toString().toLowerCase().trim().replace(/[^a-z0-9\s\-\/]/g, '').trim()
    );

    // Phase 1: exact match
    for (const config of CUSTOMER_COLUMN_MAP_CONFIG) {
        for (let i = 0; i < normalized.length; i++) {
            if (usedColumns.has(i)) continue;
            if (config.aliases.includes(normalized[i])) {
                mapping[config.field] = i;
                usedColumns.add(i);
                break;
            }
        }
    }

    // Phase 2: contains match for still-unmapped fields
    for (const config of CUSTOMER_COLUMN_MAP_CONFIG) {
        if (mapping[config.field] !== undefined) continue;
        for (let i = 0; i < normalized.length; i++) {
            if (usedColumns.has(i)) continue;
            const h = normalized[i];
            if (config.aliases.some(alias => h.includes(alias) || alias.includes(h))) {
                mapping[config.field] = i;
                usedColumns.add(i);
                break;
            }
        }
    }

    return mapping;
}

function parseVCards(text) {
    // Unfold continuation lines (RFC 6350: lines starting with space/tab are continuations)
    const unfolded = text.replace(/\r?\n[ \t]/g, '');
    const blocks = unfolded.split(/BEGIN:VCARD/i).slice(1);
    const customers = [];
    const errors = [];

    blocks.forEach((block, idx) => {
        try {
            const lines = block.split(/\r?\n/);

            const get = (prefix) => {
                const up = prefix.toUpperCase();
                for (const line of lines) {
                    const lineUp = line.toUpperCase();
                    if (lineUp.startsWith(up + ':') || lineUp.startsWith(up + ';')) {
                        return line.substring(line.indexOf(':') + 1).trim();
                    }
                }
                return '';
            };

            const getAll = (prefix) => {
                const up = prefix.toUpperCase();
                const results = [];
                for (const line of lines) {
                    const lineUp = line.toUpperCase();
                    if (lineUp.startsWith(up + ':') || lineUp.startsWith(up + ';')) {
                        results.push(line.substring(line.indexOf(':') + 1).trim());
                    }
                }
                return results;
            };

            const fn = get('FN');
            if (!fn) return; // skip contacts with no name

            // ADR format (RFC 6350): PO Box;Extended;Street;City;Region;Postal;Country
            const adrRaw = get('ADR');
            let address = '', city = '', postal_code = '', country = '';
            if (adrRaw) {
                const parts = adrRaw.split(';');
                address     = (parts[2] || '').trim();
                city        = (parts[3] || '').trim();
                postal_code = (parts[5] || '').trim();
                country     = (parts[6] || '').trim();
            }

            const org = get('ORG').split(';')[0].trim(); // ORG can have dept after semicolon

            customers.push({
                name:         fn,
                company_name: org || null,
                email:        getAll('EMAIL')[0] || null,
                phone:        getAll('TEL')[0] || null,
                address:      address || null,
                postal_code:  postal_code || null,
                city:         city || null,
                country:      country || null,
                notes:        get('NOTE') || null,
            });
        } catch (e) {
            errors.push({ row: idx + 1, error: e.message });
        }
    });

    return { customers, errors };
}

// ==================== Import Modal ====================

function openImportModal() {
    let parsedData   = null;  // { headers: string[], rows: any[][] } for CSV/XLSX
    let vcardResult  = null;  // { customers: [...], errors: [...] } for vCard
    let isVCard      = false;
    let columnMapping = {};

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    const content = document.createElement('div');
    content.className = 'modal-content';
    content.style.maxWidth = '620px';
    modal.appendChild(content);

    // ---- Step 1: Upload ----
    function renderUploadStep() {
        content.style.maxWidth = '620px';
        content.innerHTML = `
            <div class="modal-header">
                <h2 style="display: flex; align-items: center; gap: var(--space-sm);">
                    <i data-lucide="upload" style="width: 22px; height: 22px;"></i>
                    Import Customers
                </h2>
                <button class="modal-close-btn" id="imp-close">
                    <i data-lucide="x" style="width: 20px; height: 20px;"></i>
                </button>
            </div>
            <div class="modal-body">
                <div id="imp-dropzone" style="border: 2px dashed var(--gray-300); border-radius: var(--radius-lg); padding: var(--space-2xl); text-align: center; cursor: pointer; transition: border-color 0.2s, background 0.2s;">
                    <i data-lucide="users" style="width: 48px; height: 48px; color: var(--color-shamrock); margin-bottom: var(--space-md);"></i>
                    <p style="font-size: 16px; font-weight: var(--font-weight-semibold); color: var(--color-text-primary); margin-bottom: var(--space-sm);">
                        Drop your file here or click to browse
                    </p>
                    <p style="font-size: 13px; color: var(--color-text-secondary);">
                        Supports <strong>.csv</strong>, <strong>.xlsx</strong>, <strong>.xls</strong> (spreadsheets) and <strong>.vcf</strong> (vCard / Google Contacts / iPhone)
                    </p>
                    <input type="file" id="imp-file-input" accept=".csv,.xlsx,.xls,.vcf" style="display: none;">
                </div>
                <div id="imp-file-info" style="display: none; margin-top: var(--space-md); padding: var(--space-md); background: var(--gray-50); border-radius: var(--radius-md);"></div>
                <div id="imp-error" style="display: none; margin-top: var(--space-md); padding: var(--space-md); background: rgba(229,62,62,0.08); border: 1px solid rgba(229,62,62,0.2); border-radius: var(--radius-md); color: var(--color-error); font-size: 14px;"></div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" id="imp-cancel">Cancel</button>
                <button class="btn-primary" id="imp-next" disabled>Next →</button>
            </div>
        `;
        lucide.createIcons();
        wireUploadStep();
    }

    function wireUploadStep() {
        document.getElementById('imp-close').addEventListener('click', () => modal.remove());
        document.getElementById('imp-cancel').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        const dropzone = document.getElementById('imp-dropzone');
        const fileInput = document.getElementById('imp-file-input');

        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--color-shamrock)';
            dropzone.style.background = 'rgba(0,143,122,0.04)';
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.style.borderColor = 'var(--gray-300)';
            dropzone.style.background = '';
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--gray-300)';
            dropzone.style.background = '';
            if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) handleFile(e.target.files[0]);
        });
    }

    function showFileInfo(name, rowCount, colCount) {
        const infoDiv = document.getElementById('imp-file-info');
        infoDiv.style.display = 'block';
        infoDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: var(--space-md);">
                <i data-lucide="file-check" style="width: 24px; height: 24px; color: var(--color-shamrock); flex-shrink: 0;"></i>
                <div>
                    <div style="font-weight: var(--font-weight-semibold);">${escapeHtml(name)}</div>
                    <div style="font-size: 13px; color: var(--color-text-secondary);">
                        ${rowCount} contact${rowCount !== 1 ? 's' : ''}${colCount ? `, ${colCount} column${colCount !== 1 ? 's' : ''}` : ''}
                    </div>
                </div>
            </div>
        `;
        lucide.createIcons();
    }

    function setNextButton(label, handler) {
        const btn = document.getElementById('imp-next');
        btn.disabled = false;
        btn.textContent = label;
        btn.onclick = handler;
    }

    function handleFile(file) {
        const errorDiv = document.getElementById('imp-error');
        const nextBtn  = document.getElementById('imp-next');
        errorDiv.style.display = 'none';
        nextBtn.disabled = true;

        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!['.csv', '.xlsx', '.xls', '.vcf'].includes(ext)) {
            errorDiv.textContent = `Unsupported file type "${ext}". Use .csv, .xlsx, .xls, or .vcf.`;
            errorDiv.style.display = 'block';
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            errorDiv.textContent = 'File is too large (max 5 MB).';
            errorDiv.style.display = 'block';
            return;
        }

        if (ext === '.vcf') {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const result = parseVCards(e.target.result);
                    if (result.customers.length === 0) {
                        errorDiv.textContent = 'No valid vCard contacts found. Make sure the file contains BEGIN:VCARD entries with a name (FN).';
                        errorDiv.style.display = 'block';
                        return;
                    }
                    vcardResult = result;
                    isVCard = true;
                    parsedData = null;
                    showFileInfo(file.name, result.customers.length, null);
                    setNextButton('Next: Preview →', () => renderPreviewStep());
                } catch (err) {
                    errorDiv.textContent = 'Failed to parse vCard: ' + err.message;
                    errorDiv.style.display = 'block';
                }
            };
            reader.readAsText(file);
        } else {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const workbook = XLSX.read(e.target.result, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                    if (jsonData.length < 2) {
                        errorDiv.textContent = 'File must have at least a header row and one data row.';
                        errorDiv.style.display = 'block';
                        return;
                    }

                    const headers = jsonData[0].map(h => String(h).trim());
                    const rows = jsonData.slice(1).filter(row =>
                        row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
                    );

                    if (rows.length === 0) {
                        errorDiv.textContent = 'No data rows found in the file.';
                        errorDiv.style.display = 'block';
                        return;
                    }

                    parsedData = { headers, rows };
                    isVCard = false;
                    vcardResult = null;
                    columnMapping = autoDetectCustomerColumnMapping(headers);
                    showFileInfo(file.name, rows.length, headers.length);
                    setNextButton('Next: Map Columns →', () => renderMapStep());
                } catch (err) {
                    errorDiv.textContent = 'Failed to parse file: ' + err.message;
                    errorDiv.style.display = 'block';
                }
            };
            reader.readAsArrayBuffer(file);
        }
    }

    // ---- Step 2: Map Columns (CSV/XLSX only) ----
    function renderMapStep() {
        content.style.maxWidth = '700px';

        const optionsHtml = (selectedIdx) => {
            const parts = ['<option value="-1">-- Skip --</option>'];
            parsedData.headers.forEach((h, i) => {
                const sel = selectedIdx === i ? 'selected' : '';
                parts.push(`<option value="${i}" ${sel}>${escapeHtml(h)}</option>`);
            });
            return parts.join('');
        };

        const rows = CUSTOMER_COLUMN_MAP_CONFIG.map(cfg => {
            const badge = cfg.required
                ? `<span style="color: var(--color-error); font-size: 11px; font-weight: normal; margin-left: 4px;">(required)</span>`
                : '';
            const selIdx = columnMapping[cfg.field] !== undefined ? columnMapping[cfg.field] : -1;
            return `
                <div style="display: flex; align-items: center; gap: var(--space-md); padding: var(--space-sm) 0; border-bottom: 1px solid var(--gray-100);">
                    <div style="width: 160px; font-size: 14px; font-weight: var(--font-weight-semibold); flex-shrink: 0;">
                        ${cfg.label}${badge}
                    </div>
                    <div style="color: var(--color-text-secondary);">←</div>
                    <select class="form-input imp-col-select" data-field="${cfg.field}" style="flex: 1;">
                        ${optionsHtml(selIdx)}
                    </select>
                </div>
            `;
        }).join('');

        content.innerHTML = `
            <div class="modal-header">
                <h2 style="display: flex; align-items: center; gap: var(--space-sm);">
                    <i data-lucide="columns-3" style="width: 22px; height: 22px;"></i>
                    Map Columns
                </h2>
                <button class="modal-close-btn" id="imp-close">
                    <i data-lucide="x" style="width: 20px; height: 20px;"></i>
                </button>
            </div>
            <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
                <p style="font-size: 14px; color: var(--color-text-secondary); margin-bottom: var(--space-lg);">
                    Found <strong>${parsedData.rows.length}</strong> rows. Match your file's columns to customer fields:
                </p>
                ${rows}
                <div id="imp-map-error" style="display: none; margin-top: var(--space-md); padding: var(--space-md); background: rgba(229,62,62,0.08); border: 1px solid rgba(229,62,62,0.2); border-radius: var(--radius-md); color: var(--color-error); font-size: 14px;"></div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" id="imp-back">← Back</button>
                <button class="btn-primary" id="imp-preview">Preview →</button>
            </div>
        `;
        lucide.createIcons();

        document.getElementById('imp-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        document.querySelectorAll('.imp-col-select').forEach(sel => {
            sel.addEventListener('change', () => {
                const field = sel.dataset.field;
                const val = parseInt(sel.value);
                if (val === -1) delete columnMapping[field];
                else columnMapping[field] = val;
            });
        });

        document.getElementById('imp-back').addEventListener('click', () => renderUploadStep());

        document.getElementById('imp-preview').addEventListener('click', () => {
            const errDiv = document.getElementById('imp-map-error');
            if (columnMapping.name === undefined) {
                errDiv.textContent = 'The "Name" field is required — please map it to a column.';
                errDiv.style.display = 'block';
                return;
            }
            errDiv.style.display = 'none';
            renderPreviewStep();
        });
    }

    // ---- Build customers from mapping ----
    function buildCustomersFromMapping() {
        const valid = [];
        const skipped = [];

        for (let i = 0; i < parsedData.rows.length; i++) {
            const row = parsedData.rows[i];
            const get = (field) => {
                if (columnMapping[field] === undefined) return null;
                const v = row[columnMapping[field]];
                const s = (v !== null && v !== undefined) ? String(v).trim() : '';
                return s || null;
            };

            const name = get('name');
            if (!name) {
                skipped.push({ row: i + 2, reason: 'Missing name' });
                continue;
            }

            valid.push({
                name,
                company_name: get('company_name'),
                email:        get('email'),
                phone:        get('phone'),
                address:      get('address'),
                postal_code:  get('postal_code'),
                city:         get('city'),
                country:      get('country'),
                tax_id:       get('tax_id'),
                notes:        get('notes'),
            });
        }

        return { valid, skipped };
    }

    // ---- Step 3: Preview + Confirm ----
    function renderPreviewStep() {
        content.style.maxWidth = '780px';

        let customers, skipped;
        if (isVCard) {
            customers = vcardResult.customers;
            skipped   = vcardResult.errors.map((e, i) => ({ row: i + 1, reason: e.error || 'Parse error' }));
        } else {
            const built = buildCustomersFromMapping();
            customers = built.valid;
            skipped   = built.skipped;
        }

        // Cap at 500
        let capped = false;
        if (customers.length > 500) {
            customers = customers.slice(0, 500);
            capped = true;
        }

        const preview = customers.slice(0, 5);
        const totalCount = customers.length;

        const previewRows = preview.map(c => `
            <tr>
                <td style="padding: 6px 10px; font-size: 13px; border-bottom: 1px solid var(--gray-100);">${escapeHtml(c.name || '')}</td>
                <td style="padding: 6px 10px; font-size: 13px; border-bottom: 1px solid var(--gray-100);">${escapeHtml(c.company_name || '')}</td>
                <td style="padding: 6px 10px; font-size: 13px; border-bottom: 1px solid var(--gray-100);">${escapeHtml(c.email || '')}</td>
                <td style="padding: 6px 10px; font-size: 13px; border-bottom: 1px solid var(--gray-100);">${escapeHtml(c.phone || '')}</td>
                <td style="padding: 6px 10px; font-size: 13px; border-bottom: 1px solid var(--gray-100);">${escapeHtml([c.city, c.country].filter(Boolean).join(', ') || '')}</td>
            </tr>
        `).join('');

        const skippedNote = skipped.length > 0
            ? `<div style="margin-top: var(--space-md); padding: var(--space-sm) var(--space-md); background: rgba(214,158,46,0.08); border: 1px solid rgba(214,158,46,0.25); border-radius: var(--radius-md); font-size: 13px; color: #92400e;">
                <strong>${skipped.length}</strong> row${skipped.length !== 1 ? 's' : ''} will be skipped (missing name or parse error).
               </div>`
            : '';

        const cappedNote = capped
            ? `<div style="margin-top: var(--space-sm); padding: var(--space-sm) var(--space-md); background: rgba(214,158,46,0.08); border: 1px solid rgba(214,158,46,0.25); border-radius: var(--radius-md); font-size: 13px; color: #92400e;">
                File has more than 500 contacts. Only the first 500 will be imported.
               </div>`
            : '';

        content.innerHTML = `
            <div class="modal-header">
                <h2 style="display: flex; align-items: center; gap: var(--space-sm);">
                    <i data-lucide="eye" style="width: 22px; height: 22px;"></i>
                    Preview Import
                </h2>
                <button class="modal-close-btn" id="imp-close">
                    <i data-lucide="x" style="width: 20px; height: 20px;"></i>
                </button>
            </div>
            <div class="modal-body">
                <p style="font-size: 14px; color: var(--color-text-secondary); margin-bottom: var(--space-md);">
                    <strong>${totalCount}</strong> customer${totalCount !== 1 ? 's' : ''} ready to import.
                    ${customers.length > 5 ? `Showing first 5 of ${totalCount}.` : ''}
                </p>
                <div style="overflow-x: auto; border: 1px solid var(--gray-200); border-radius: var(--radius-md);">
                    <table style="width: 100%; border-collapse: collapse; min-width: 480px;">
                        <thead>
                            <tr style="background: var(--gray-50);">
                                <th style="padding: 8px 10px; font-size: 12px; text-align: left; border-bottom: 2px solid var(--gray-200);">Name</th>
                                <th style="padding: 8px 10px; font-size: 12px; text-align: left; border-bottom: 2px solid var(--gray-200);">Company</th>
                                <th style="padding: 8px 10px; font-size: 12px; text-align: left; border-bottom: 2px solid var(--gray-200);">Email</th>
                                <th style="padding: 8px 10px; font-size: 12px; text-align: left; border-bottom: 2px solid var(--gray-200);">Phone</th>
                                <th style="padding: 8px 10px; font-size: 12px; text-align: left; border-bottom: 2px solid var(--gray-200);">City / Country</th>
                            </tr>
                        </thead>
                        <tbody>${previewRows}</tbody>
                    </table>
                </div>
                ${skippedNote}
                ${cappedNote}
                <div id="imp-confirm-error" style="display: none; margin-top: var(--space-md); padding: var(--space-md); background: rgba(229,62,62,0.08); border: 1px solid rgba(229,62,62,0.2); border-radius: var(--radius-md); color: var(--color-error); font-size: 14px;"></div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" id="imp-back">${isVCard ? '← Back' : '← Edit Mapping'}</button>
                <button class="btn-primary" id="imp-confirm" style="display: flex; align-items: center; gap: var(--space-xs);" ${totalCount === 0 ? 'disabled' : ''}>
                    <i data-lucide="user-plus" style="width: 16px; height: 16px;"></i>
                    Import ${totalCount} Customer${totalCount !== 1 ? 's' : ''}
                </button>
            </div>
        `;
        lucide.createIcons();

        document.getElementById('imp-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        document.getElementById('imp-back').addEventListener('click', () => {
            if (isVCard) renderUploadStep();
            else renderMapStep();
        });
        document.getElementById('imp-confirm').addEventListener('click', () => executeImport(customers, skipped));
    }

    // ---- Execute ----
    async function executeImport(customers, preSkipped) {
        if (customers.length === 0) return;

        const confirmBtn = document.getElementById('imp-confirm');
        const errorDiv   = document.getElementById('imp-confirm-error');
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i data-lucide="loader-2" style="width: 16px; height: 16px;"></i> Importing...';
        lucide.createIcons();

        try {
            // Strip null/empty fields before sending
            const payload = customers.map(c => {
                const clean = {};
                for (const [k, v] of Object.entries(c)) {
                    if (v !== null && v !== undefined && String(v).trim() !== '') clean[k] = String(v).trim();
                }
                return clean;
            });

            const result = await api.bulkCreateCustomers(payload);
            const allErrors = [
                ...preSkipped.map((s, i) => ({ row: s.row || i + 1, error: s.reason || 'Skipped' })),
                ...(result.errors || []),
            ];
            renderResultStep({ created: result.created, errors: allErrors });
        } catch (err) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `<i data-lucide="user-plus" style="width: 16px; height: 16px;"></i> Import ${customers.length} Customer${customers.length !== 1 ? 's' : ''}`;
            lucide.createIcons();
            errorDiv.textContent = 'Import failed: ' + err.message;
            errorDiv.style.display = 'block';
        }
    }

    // ---- Result ----
    function renderResultStep({ created, errors }) {
        content.style.maxWidth = '560px';
        const success   = created > 0;
        const iconName  = success ? 'check-circle' : 'alert-circle';
        const iconColor = success ? 'var(--color-shamrock)' : 'var(--color-error)';

        const errorSection = errors.length > 0
            ? `<div style="margin-top: var(--space-lg);">
                <p style="font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); margin-bottom: var(--space-sm);">
                    ${errors.length} row${errors.length !== 1 ? 's' : ''} skipped or failed:
                </p>
                <div style="max-height: 160px; overflow-y: auto; background: var(--gray-50); border-radius: var(--radius-md); padding: var(--space-sm);">
                    ${errors.map(e =>
                        `<div style="font-size: 13px; padding: 3px 0; color: var(--color-text-secondary);">
                            Row ${e.row}: ${escapeHtml(e.error || '')}${e.name ? ' — ' + escapeHtml(e.name) : ''}
                        </div>`
                    ).join('')}
                </div>
               </div>`
            : '';

        content.innerHTML = `
            <div class="modal-header">
                <h2 style="display: flex; align-items: center; gap: var(--space-sm);">
                    <i data-lucide="${iconName}" style="color: ${iconColor};"></i>
                    Import Complete
                </h2>
                <button class="modal-close-btn" id="imp-close">
                    <i data-lucide="x" style="width: 20px; height: 20px;"></i>
                </button>
            </div>
            <div class="modal-body">
                <div style="text-align: center; padding: var(--space-lg) 0;">
                    <div style="font-size: 52px; font-weight: var(--font-weight-bold); color: var(--color-shamrock);">${created}</div>
                    <div style="font-size: 16px; color: var(--color-text-secondary);">customer${created !== 1 ? 's' : ''} imported successfully</div>
                </div>
                ${errorSection}
            </div>
            <div class="modal-footer">
                <button class="btn-primary" id="imp-done">Done</button>
            </div>
        `;
        lucide.createIcons();

        document.getElementById('imp-close').addEventListener('click', () => modal.remove());
        document.getElementById('imp-done').addEventListener('click', async () => {
            modal.remove();
            await loadCustomers(document.getElementById('customer-search')?.value || '');
        });
    }

    document.body.appendChild(modal);
    renderUploadStep();
}

async function openCustomerModal(customerId = null) {
    const isEdit = !!customerId;
    let customer = {};

    if (isEdit) {
        try {
            customer = await api.getCustomer(customerId);
        } catch (error) {
            showNotification('Failed to load customer', 'error');
            return;
        }
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'customer-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${isEdit ? 'Edit Customer' : 'Add Customer'}</h2>
                <button class="modal-close-btn" id="modal-close">
                    <i data-lucide="x" style="width: 20px; height: 20px;"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="customer-form">
                    <div class="settings-grid">
                        <div class="form-group settings-full-width">
                            <label class="form-label" for="cust_name">Name *</label>
                            <input type="text" id="cust_name" class="form-input" required value="${escapeHtml(customer.name || '')}">
                        </div>
                        <div class="form-group settings-full-width">
                            <label class="form-label" for="cust_company_name">Company name</label>
                            <input type="text" id="cust_company_name" class="form-input" value="${escapeHtml(customer.company_name || '')}">
                        </div>
                        <div class="form-group settings-full-width">
                            <label class="form-label" for="cust_address">Address</label>
                            <input type="text" id="cust_address" class="form-input" value="${escapeHtml(customer.address || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="cust_postal_code">Postal code</label>
                            <input type="text" id="cust_postal_code" class="form-input" value="${escapeHtml(customer.postal_code || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="cust_city">City</label>
                            <input type="text" id="cust_city" class="form-input" value="${escapeHtml(customer.city || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="cust_email">Email</label>
                            <input type="email" id="cust_email" class="form-input" value="${escapeHtml(customer.email || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="cust_phone">Phone</label>
                            <input type="text" id="cust_phone" class="form-input" value="${escapeHtml(customer.phone || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="cust_tax_id">Tax ID (BTW)</label>
                            <input type="text" id="cust_tax_id" class="form-input" value="${escapeHtml(customer.tax_id || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="cust_country">Country</label>
                            <input type="text" id="cust_country" class="form-input" value="${escapeHtml(customer.country || 'Nederland')}">
                        </div>
                        <div class="form-group settings-full-width">
                            <label class="form-label" for="cust_notes">Notes</label>
                            <textarea id="cust_notes" class="form-input" rows="2">${escapeHtml(customer.notes || '')}</textarea>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" id="modal-cancel">Cancel</button>
                <button class="btn-primary" id="modal-save">
                    ${isEdit ? 'Save Changes' : 'Add Customer'}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    lucide.createIcons();

    // Focus first field
    document.getElementById('cust_name').focus();

    // Close handlers
    const closeModal = () => modal.remove();
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Save handler
    document.getElementById('modal-save').addEventListener('click', async () => {
        const name = document.getElementById('cust_name').value.trim();
        if (!name) {
            document.getElementById('cust_name').focus();
            return;
        }

        const data = {
            name,
            company_name: document.getElementById('cust_company_name').value.trim(),
            address: document.getElementById('cust_address').value.trim(),
            postal_code: document.getElementById('cust_postal_code').value.trim(),
            city: document.getElementById('cust_city').value.trim(),
            country: document.getElementById('cust_country').value.trim() || 'Nederland',
            email: document.getElementById('cust_email').value.trim(),
            phone: document.getElementById('cust_phone').value.trim(),
            tax_id: document.getElementById('cust_tax_id').value.trim(),
            notes: document.getElementById('cust_notes').value.trim(),
        };

        const saveBtn = document.getElementById('modal-save');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            if (isEdit) {
                await api.updateCustomer(customerId, data);
                showNotification('Customer updated successfully!');
            } else {
                await api.createCustomer(data);
                showNotification('Customer added successfully!');
            }
            closeModal();
            await loadCustomers(document.getElementById('customer-search')?.value || '');
        } catch (error) {
            showNotification('Failed to save customer: ' + error.message, 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = isEdit ? 'Save Changes' : 'Add Customer';
        }
    });
}

function updateCustomerSelectionBar() {
    const bar = document.getElementById('customer-selection-bar');
    const countEl = document.getElementById('customer-selected-count');
    const selectAllCb = document.getElementById('customer-select-all');
    const allCheckboxes = document.querySelectorAll('.customer-checkbox');

    if (selectedCustomers.size > 0) {
        bar.style.display = 'flex';
        countEl.textContent = `${selectedCustomers.size} selected`;
        selectAllCb.checked = allCheckboxes.length > 0 && selectedCustomers.size === allCheckboxes.length;
        selectAllCb.indeterminate = selectedCustomers.size > 0 && selectedCustomers.size < allCheckboxes.length;
    } else {
        bar.style.display = 'none';
        selectAllCb.checked = false;
        selectAllCb.indeterminate = false;
    }
}

async function bulkArchiveSelectedCustomers() {
    const count = selectedCustomers.size;
    if (count === 0) return;
    const confirmed = await showConfirmDialog({
        title: 'Archive Customers',
        message: `Archive ${count} customer${count > 1 ? 's' : ''}? They will be hidden but can be restored later.`,
        confirmLabel: 'Archive',
        variant: 'warning',
    });
    if (!confirmed) return;

    try {
        const result = await api.bulkArchiveCustomers([...selectedCustomers]);
        showNotification(`${result.archived} customer${result.archived !== 1 ? 's' : ''} archived`);
        selectedCustomers.clear();
        await loadCustomers(document.getElementById('customer-search')?.value || '');
    } catch (error) {
        showNotification('Failed to archive: ' + error.message, 'error');
    }
}

async function bulkDeleteSelectedCustomers() {
    const count = selectedCustomers.size;
    if (count === 0) return;
    const confirmed = await showConfirmDialog({
        title: 'Delete Customers',
        message: `Permanently delete ${count} customer${count > 1 ? 's' : ''}? This action cannot be undone.`,
        confirmLabel: 'Delete',
        variant: 'danger',
    });
    if (!confirmed) return;

    try {
        const result = await api.bulkDeleteCustomers([...selectedCustomers]);
        showNotification(`${result.deleted} customer${result.deleted !== 1 ? 's' : ''} permanently deleted`);
        selectedCustomers.clear();
        await loadCustomers(document.getElementById('customer-search')?.value || '');
    } catch (error) {
        showNotification('Failed to delete: ' + error.message, 'error');
    }
}

async function archiveCustomer(customerId, customerName) {
    const confirmed = await showConfirmDialog({
        title: 'Archive Customer',
        message: `Archive "${customerName}"? It will be hidden but can be restored later.`,
        confirmLabel: 'Archive',
        variant: 'warning',
    });
    if (!confirmed) return;

    try {
        await api.archiveCustomer(customerId);
        showNotification('Customer archived');
        await loadCustomers(document.getElementById('customer-search')?.value || '');
    } catch (error) {
        showNotification('Failed to archive customer: ' + error.message, 'error');
    }
}

async function deleteCustomer(customerId, customerName) {
    const confirmed = await showConfirmDialog({
        title: 'Delete Customer',
        message: `Permanently delete "${customerName}"? This action cannot be undone.`,
        confirmLabel: 'Delete',
        variant: 'danger',
    });
    if (!confirmed) return;

    try {
        await api.deleteCustomer(customerId);
        showNotification('Customer permanently deleted');
        await loadCustomers(document.getElementById('customer-search')?.value || '');
    } catch (error) {
        showNotification('Failed to delete customer: ' + error.message, 'error');
    }
}
