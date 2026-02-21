/**
 * Settings Page - Company details and preferences
 */

let savedSettingsSnapshot = null;

const NUMBER_FORMAT_PRESETS = [
    { value: '{PREFIX}-{YEAR}-{SEQ:3}', label: 'F-2026-001', description: 'Prefix-Year-Sequence' },
    { value: '{YEAR}-{SEQ:3}', label: '2026-001', description: 'Year-Sequence' },
    { value: '{SEQ:4}', label: '0001', description: 'Simple sequence' },
    { value: '{PREFIX}-{SEQ:4}', label: 'F-0001', description: 'Prefix-Sequence' },
];

function formatPreviewNumber(format, prefix, nextNum) {
    const year = new Date().getFullYear().toString();
    let result = format.replace('{YEAR}', year).replace('{PREFIX}', prefix);
    const seqMatch = result.match(/\{SEQ:(\d+)\}/);
    if (seqMatch) {
        result = result.replace(seqMatch[0], String(nextNum).padStart(parseInt(seqMatch[1]), '0'));
    } else {
        result = result.replace('{SEQ}', String(nextNum));
    }
    return result;
}

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

export async function initSettings() {
    const html = `
        <div style="padding: var(--space-lg); max-width: 900px; margin: 0 auto;">
            <div style="margin-bottom: var(--space-xl);">
                <h1 style="display: flex; align-items: center; gap: var(--space-md); font-size: 32px; color: var(--color-dark-green); margin-bottom: var(--space-sm);">
                    <i data-lucide="settings"></i>
                    Settings
                </h1>
                <p style="color: var(--color-text-secondary);">
                    Company details, invoice numbering, and preferences
                </p>
            </div>

            <div id="settings-loading" class="loading">
                <div class="loader-pulse">
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__dot"></div>
                </div>
                <p>Loading settings...</p>
            </div>

            <form id="settings-form" style="display: none;">
                <!-- Basic Company Info -->
                <div class="settings-section">
                    <div class="settings-section-header">
                        <i data-lucide="building-2"></i>
                        <h2>Company Details</h2>
                    </div>

                    <div class="settings-grid">
                        <div class="form-group settings-full-width">
                            <label class="form-label" for="company_name">Company name</label>
                            <input type="text" id="company_name" class="form-input" placeholder="Your company name">
                        </div>

                        <div class="form-group settings-full-width">
                            <label class="form-label" for="address">Address</label>
                            <input type="text" id="address" class="form-input" placeholder="Street and number">
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="postal_code">Postal code</label>
                            <input type="text" id="postal_code" class="form-input" placeholder="1234 AB">
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="city">City</label>
                            <input type="text" id="city" class="form-input" placeholder="City">
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="kvk_number">KvK number</label>
                            <input type="text" id="kvk_number" class="form-input" placeholder="12345678">
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="btw_number">BTW number</label>
                            <input type="text" id="btw_number" class="form-input" placeholder="NL123456789B01">
                        </div>

                        <div class="form-group settings-full-width">
                            <label class="form-label" for="iban">IBAN</label>
                            <input type="text" id="iban" class="form-input" placeholder="NL00 BANK 0000 0000 00">
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="phone">Phone</label>
                            <input type="text" id="phone" class="form-input" placeholder="+31 6 12345678">
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="email">Email</label>
                            <input type="email" id="email" class="form-input" placeholder="info@company.nl">
                        </div>
                    </div>
                </div>

                <!-- Invoice Numbering -->
                <div class="settings-section">
                    <div class="settings-section-header">
                        <i data-lucide="hash"></i>
                        <h2>Document Numbering</h2>
                    </div>

                    <div class="settings-grid">
                        <div class="form-group">
                            <label class="form-label" for="invoice_number_format">Invoice format</label>
                            <select id="invoice_number_format" class="form-input">
                                ${NUMBER_FORMAT_PRESETS.map(p => `<option value="${p.value}">${p.label} (${p.description})</option>`).join('')}
                            </select>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Preview</label>
                            <div class="number-preview" id="invoice-number-preview">F-2026-001</div>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="invoice_number_prefix">Invoice prefix</label>
                            <input type="text" id="invoice_number_prefix" class="form-input" placeholder="F" maxlength="10">
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="invoice_number_next">Next invoice number</label>
                            <input type="number" id="invoice_number_next" class="form-input" min="1" value="1">
                        </div>

                        <div class="settings-divider"></div>

                        <div class="form-group">
                            <label class="form-label" for="quote_number_format">Quote format</label>
                            <select id="quote_number_format" class="form-input">
                                ${NUMBER_FORMAT_PRESETS.map(p => `<option value="${p.value}">${p.label} (${p.description})</option>`).join('')}
                            </select>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Preview</label>
                            <div class="number-preview" id="quote-number-preview">O-2026-001</div>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="quote_number_prefix">Quote prefix</label>
                            <input type="text" id="quote_number_prefix" class="form-input" placeholder="O" maxlength="10">
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="quote_number_next">Next quote number</label>
                            <input type="number" id="quote_number_next" class="form-input" min="1" value="1">
                        </div>
                    </div>
                </div>

                <!-- Advanced Section (collapsed by default) -->
                <div class="settings-section">
                    <div class="settings-section-header settings-toggle" id="advanced-toggle">
                        <i data-lucide="sliders-horizontal"></i>
                        <h2>Advanced</h2>
                        <i data-lucide="chevron-down" class="toggle-icon" id="advanced-chevron"></i>
                    </div>

                    <div class="settings-advanced-content" id="advanced-content" style="display: none;">
                        <div class="settings-grid">
                            <div class="form-group settings-full-width">
                                <label class="form-label">Company logo</label>
                                <div class="logo-upload-area" id="logo-upload-area">
                                    <div class="logo-preview" id="logo-preview" style="display: none;">
                                        <img id="logo-image" alt="Logo">
                                        <button type="button" class="logo-remove-btn" id="logo-remove-btn">
                                            <i data-lucide="x"></i>
                                        </button>
                                    </div>
                                    <div class="logo-placeholder" id="logo-placeholder">
                                        <i data-lucide="upload"></i>
                                        <span>Click or drag to upload logo</span>
                                        <span style="font-size: 12px; color: var(--color-text-secondary);">PNG, JPG, SVG (max 2MB)</span>
                                    </div>
                                    <input type="file" id="logo-file-input" accept="image/png,image/jpeg,image/svg+xml" style="display: none;">
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label" for="brand_color_primary">Primary color</label>
                                <div class="color-input-wrapper">
                                    <input type="color" id="brand_color_primary" class="color-input" value="#000000">
                                    <input type="text" id="brand_color_primary_hex" class="form-input color-hex-input" value="#000000" maxlength="7">
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label" for="brand_color_secondary">Secondary color</label>
                                <div class="color-input-wrapper">
                                    <input type="color" id="brand_color_secondary" class="color-input" value="#008F7A">
                                    <input type="text" id="brand_color_secondary_hex" class="form-input color-hex-input" value="#008F7A" maxlength="7">
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label" for="brand_color_tertiary">Accent color</label>
                                <div class="color-input-wrapper">
                                    <input type="color" id="brand_color_tertiary" class="color-input" value="#4DDFB5">
                                    <input type="text" id="brand_color_tertiary_hex" class="form-input color-hex-input" value="#4DDFB5" maxlength="7">
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label" for="brand_color_4">Color 4</label>
                                <div class="color-input-wrapper">
                                    <input type="color" id="brand_color_4" class="color-input" value="#1AB291">
                                    <input type="text" id="brand_color_4_hex" class="form-input color-hex-input" value="#1AB291" maxlength="7">
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label" for="brand_color_5">Color 5</label>
                                <div class="color-input-wrapper">
                                    <input type="color" id="brand_color_5" class="color-input" value="#003D33">
                                    <input type="text" id="brand_color_5_hex" class="form-input color-hex-input" value="#003D33" maxlength="7">
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label" for="default_payment_terms_days">Payment terms (days)</label>
                                <input type="number" id="default_payment_terms_days" class="form-input" min="0" max="365" value="30">
                            </div>

                            <div class="form-group">
                                <label class="form-label" for="default_btw_percentage">Default BTW %</label>
                                <select id="default_btw_percentage" class="form-input">
                                    <option value="21">21% (Standard)</option>
                                    <option value="9">9% (Low)</option>
                                    <option value="0">0% (Exempt)</option>
                                </select>
                            </div>

                            <div class="form-group settings-full-width">
                                <label class="form-label" for="footer_text">Invoice footer text</label>
                                <textarea id="footer_text" class="form-input" rows="3" placeholder="Custom footer text for invoices (e.g., payment instructions, terms)"></textarea>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Email Settings -->
                <div class="settings-section">
                    <div class="settings-section-header settings-toggle" id="email-toggle">
                        <i data-lucide="mail"></i>
                        <h2>Email Settings</h2>
                        <i data-lucide="chevron-down" class="toggle-icon" id="email-chevron"></i>
                    </div>

                    <div id="email-content" style="display: none;">
                        <p style="color: var(--color-text-secondary); font-size: 13px; margin-bottom: var(--space-lg);">
                            Configure email templates for sending invoices and quotes. Use placeholders: <code>{NUMBER}</code>, <code>{COMPANY}</code>, <code>{CUSTOMER}</code>, <code>{TOTAL}</code>, <code>{DUE_DATE}</code>, <code>{DATE}</code>
                        </p>
                        <div class="settings-grid">
                            <div class="form-group">
                                <label class="form-label" for="email_from_name">From name</label>
                                <input type="text" id="email_from_name" class="form-input" placeholder="Company name">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="email_from_address">From email</label>
                                <input type="email" id="email_from_address" class="form-input" placeholder="invoices@yourdomain.com">
                            </div>
                            <div class="form-group settings-full-width">
                                <label class="form-label" for="email_reply_to">Reply-to email</label>
                                <input type="email" id="email_reply_to" class="form-input" placeholder="Leave empty to use company email">
                            </div>

                            <div class="settings-divider"></div>

                            <div class="form-group settings-full-width">
                                <label class="form-label" for="email_invoice_subject">Invoice email subject</label>
                                <input type="text" id="email_invoice_subject" class="form-input" placeholder="Invoice {NUMBER} from {COMPANY}">
                            </div>
                            <div class="form-group settings-full-width">
                                <label class="form-label" for="email_invoice_body">Invoice email body</label>
                                <textarea id="email_invoice_body" class="form-input" rows="5" placeholder="Dear {CUSTOMER},\n\nPlease find attached invoice {NUMBER}..."></textarea>
                            </div>

                            <div class="settings-divider"></div>

                            <div class="form-group settings-full-width">
                                <label class="form-label" for="email_quote_subject">Quote email subject</label>
                                <input type="text" id="email_quote_subject" class="form-input" placeholder="Quote {NUMBER} from {COMPANY}">
                            </div>
                            <div class="form-group settings-full-width">
                                <label class="form-label" for="email_quote_body">Quote email body</label>
                                <textarea id="email_quote_body" class="form-input" rows="5" placeholder="Dear {CUSTOMER},\n\nPlease find attached our quote {NUMBER}..."></textarea>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Save Button -->
                <div style="display: flex; justify-content: flex-end; margin-top: var(--space-lg); gap: var(--space-md);">
                    <button type="submit" class="action-btn edit-btn" style="flex: none; padding: var(--space-md) var(--space-xl); font-size: 16px;" id="save-btn">
                        <i data-lucide="save"></i>
                        Save Settings
                    </button>
                </div>
            </form>
        </div>
    `;

    router.render(html);
    lucide.createIcons();

    // Load existing settings
    await loadSettings();

    // Setup event handlers
    setupEventHandlers();

    // Register dirty state guard for unsaved changes detection
    savedSettingsSnapshot = captureSettingsSnapshot();
    router.setDirtyGuard(
        () => captureSettingsSnapshot() !== savedSettingsSnapshot,
        () => saveSettings()
    );
}

function captureSettingsSnapshot() {
    const fields = [
        'company_name', 'address', 'postal_code', 'city', 'kvk_number', 'btw_number',
        'iban', 'phone', 'email', 'invoice_number_format', 'invoice_number_prefix',
        'invoice_number_next', 'quote_number_format', 'quote_number_prefix',
        'quote_number_next', 'default_payment_terms_days', 'default_btw_percentage',
        'footer_text', 'brand_color_primary', 'brand_color_secondary',
        'brand_color_tertiary', 'brand_color_4', 'brand_color_5',
        'email_from_name', 'email_from_address', 'email_reply_to',
        'email_invoice_subject', 'email_invoice_body',
        'email_quote_subject', 'email_quote_body'
    ];
    const values = {};
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) values[id] = el.value;
    });
    values._logo = document.getElementById('logo-image')?.src || '';
    return JSON.stringify(values);
}

async function loadSettings() {
    try {
        const settings = await api.getSettings();

        document.getElementById('settings-loading').style.display = 'none';
        document.getElementById('settings-form').style.display = 'block';

        // Basic fields
        const basicFields = [
            'company_name', 'address', 'postal_code', 'city',
            'kvk_number', 'btw_number', 'iban', 'phone', 'email'
        ];
        basicFields.forEach(field => {
            const el = document.getElementById(field);
            if (el && settings[field]) el.value = settings[field];
        });

        // Numbering fields
        const numberFields = [
            'invoice_number_prefix', 'invoice_number_next',
            'quote_number_prefix', 'quote_number_next'
        ];
        numberFields.forEach(field => {
            const el = document.getElementById(field);
            if (el && settings[field] !== undefined && settings[field] !== null) el.value = settings[field];
        });

        // Number format selects
        if (settings.invoice_number_format) {
            const invFmt = document.getElementById('invoice_number_format');
            const matchingOption = Array.from(invFmt.options).find(o => o.value === settings.invoice_number_format);
            if (matchingOption) invFmt.value = settings.invoice_number_format;
            else invFmt.value = NUMBER_FORMAT_PRESETS[0].value;
        }
        if (settings.quote_number_format) {
            const qFmt = document.getElementById('quote_number_format');
            const matchingOption = Array.from(qFmt.options).find(o => o.value === settings.quote_number_format);
            if (matchingOption) qFmt.value = settings.quote_number_format;
            else qFmt.value = NUMBER_FORMAT_PRESETS[0].value;
        }

        // Advanced fields
        if (settings.default_payment_terms_days !== undefined) {
            document.getElementById('default_payment_terms_days').value = settings.default_payment_terms_days;
        }
        if (settings.default_btw_percentage !== undefined) {
            document.getElementById('default_btw_percentage').value = String(parseFloat(settings.default_btw_percentage));
        }
        if (settings.footer_text) {
            document.getElementById('footer_text').value = settings.footer_text;
        }

        // Colors
        if (settings.brand_color_primary) {
            document.getElementById('brand_color_primary').value = settings.brand_color_primary;
            document.getElementById('brand_color_primary_hex').value = settings.brand_color_primary;
        }
        if (settings.brand_color_secondary) {
            document.getElementById('brand_color_secondary').value = settings.brand_color_secondary;
            document.getElementById('brand_color_secondary_hex').value = settings.brand_color_secondary;
        }
        if (settings.brand_color_tertiary) {
            document.getElementById('brand_color_tertiary').value = settings.brand_color_tertiary;
            document.getElementById('brand_color_tertiary_hex').value = settings.brand_color_tertiary;
        }
        if (settings.brand_color_4) {
            document.getElementById('brand_color_4').value = settings.brand_color_4;
            document.getElementById('brand_color_4_hex').value = settings.brand_color_4;
        }
        if (settings.brand_color_5) {
            document.getElementById('brand_color_5').value = settings.brand_color_5;
            document.getElementById('brand_color_5_hex').value = settings.brand_color_5;
        }

        // Logo
        if (settings.logo_base64) {
            showLogoPreview(settings.logo_base64);
        }

        // Email settings
        const emailFields = [
            'email_from_name', 'email_from_address', 'email_reply_to',
            'email_invoice_subject', 'email_invoice_body',
            'email_quote_subject', 'email_quote_body'
        ];
        emailFields.forEach(field => {
            const el = document.getElementById(field);
            if (el && settings[field]) el.value = settings[field];
        });

        // Update number previews
        updateNumberPreviews();

        lucide.createIcons();
    } catch (error) {
        console.error('Failed to load settings:', error);
        document.getElementById('settings-loading').innerHTML = `
            <i data-lucide="alert-circle" style="width: 48px; height: 48px; color: var(--color-error);"></i>
            <p style="color: var(--color-error); margin-top: var(--space-md);">Failed to load settings: ${error.message}</p>
        `;
        lucide.createIcons();
    }
}

function setupEventHandlers() {
    // Advanced toggle
    document.getElementById('advanced-toggle').addEventListener('click', () => {
        const content = document.getElementById('advanced-content');
        const chevron = document.getElementById('advanced-chevron');
        const isOpen = content.style.display !== 'none';
        content.style.display = isOpen ? 'none' : 'block';
        chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
        lucide.createIcons();
    });

    // Email settings toggle
    document.getElementById('email-toggle').addEventListener('click', () => {
        const content = document.getElementById('email-content');
        const chevron = document.getElementById('email-chevron');
        const isOpen = content.style.display !== 'none';
        content.style.display = isOpen ? 'none' : 'block';
        chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
        lucide.createIcons();
    });

    // Number format previews
    ['invoice_number_format', 'invoice_number_prefix', 'invoice_number_next',
     'quote_number_format', 'quote_number_prefix', 'quote_number_next'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateNumberPreviews);
    });

    // Color sync (color picker <-> hex input)
    setupColorSync('brand_color_primary');
    setupColorSync('brand_color_secondary');
    setupColorSync('brand_color_tertiary');
    setupColorSync('brand_color_4');
    setupColorSync('brand_color_5');

    // Logo upload
    const logoArea = document.getElementById('logo-upload-area');
    const logoInput = document.getElementById('logo-file-input');

    logoArea.addEventListener('click', (e) => {
        if (e.target.closest('.logo-remove-btn')) return;
        logoInput.click();
    });

    logoArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        logoArea.classList.add('drag-over');
    });

    logoArea.addEventListener('dragleave', () => {
        logoArea.classList.remove('drag-over');
    });

    logoArea.addEventListener('drop', (e) => {
        e.preventDefault();
        logoArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleLogoFile(e.dataTransfer.files[0]);
        }
    });

    logoInput.addEventListener('change', () => {
        if (logoInput.files.length > 0) {
            handleLogoFile(logoInput.files[0]);
        }
    });

    document.getElementById('logo-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('logo-preview').style.display = 'none';
        document.getElementById('logo-placeholder').style.display = 'flex';
        document.getElementById('logo-image').src = '';
        document.getElementById('logo-file-input').value = '';
    });

    // Save form
    document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveSettings();
    });
}

function setupColorSync(baseId) {
    const colorInput = document.getElementById(baseId);
    const hexInput = document.getElementById(`${baseId}_hex`);

    colorInput.addEventListener('input', () => {
        hexInput.value = colorInput.value;
    });

    hexInput.addEventListener('input', () => {
        if (/^#[0-9A-Fa-f]{6}$/.test(hexInput.value)) {
            colorInput.value = hexInput.value;
        }
    });
}

function updateNumberPreviews() {
    const invFmt = document.getElementById('invoice_number_format').value;
    const invPrefix = document.getElementById('invoice_number_prefix').value || 'F';
    const invNext = parseInt(document.getElementById('invoice_number_next').value) || 1;
    document.getElementById('invoice-number-preview').textContent = formatPreviewNumber(invFmt, invPrefix, invNext);

    const qFmt = document.getElementById('quote_number_format').value;
    const qPrefix = document.getElementById('quote_number_prefix').value || 'O';
    const qNext = parseInt(document.getElementById('quote_number_next').value) || 1;
    document.getElementById('quote-number-preview').textContent = formatPreviewNumber(qFmt, qPrefix, qNext);
}

async function extractColorsFromImage(dataUrl) {
    // Dynamically load ColorThief if not already loaded
    if (!window.ColorThief) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.4.0/color-thief.umd.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const colorThief = new ColorThief();
                const palette = colorThief.getPalette(img, 5);
                const hexColors = palette.map(([r, g, b]) =>
                    '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
                );
                resolve(hexColors);
            } catch (e) {
                console.warn('[Settings] Color extraction failed:', e);
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
    });
}

function showExtractedPalette(colors) {
    let strip = document.getElementById('extracted-palette');
    if (!strip) {
        strip = document.createElement('div');
        strip.id = 'extracted-palette';
        strip.style.cssText = 'display: flex; gap: 8px; margin-top: 12px; align-items: center;';
        document.getElementById('logo-upload-area').insertAdjacentElement('afterend', strip);
    }
    strip.innerHTML = `
        <span style="font-size: 12px; color: var(--color-text-secondary);">Gevonden kleuren:</span>
        ${colors.map(c => `<div style="width: 28px; height: 28px; border-radius: 6px; background: ${c}; border: 2px solid var(--gray-200);" title="${c}"></div>`).join('')}
    `;
}

function handleLogoFile(file) {
    if (file.size > 2 * 1024 * 1024) {
        showNotification('Logo file must be smaller than 2MB', 'error');
        return;
    }

    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
        showNotification('Only PNG, JPG, and SVG files are allowed', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const dataUrl = e.target.result;
        showLogoPreview(dataUrl);

        // Extract dominant colors from the logo
        const colors = await extractColorsFromImage(dataUrl);
        if (colors && colors.length >= 5) {
            const fields = ['brand_color_primary', 'brand_color_secondary', 'brand_color_tertiary', 'brand_color_4', 'brand_color_5'];
            fields.forEach((id, i) => {
                document.getElementById(id).value = colors[i];
                document.getElementById(`${id}_hex`).value = colors[i];
            });
            showExtractedPalette(colors);
            showNotification('Kleuren uit logo gehaald');
        }
    };
    reader.readAsDataURL(file);
}

function showLogoPreview(dataUrl) {
    const preview = document.getElementById('logo-preview');
    const placeholder = document.getElementById('logo-placeholder');
    const img = document.getElementById('logo-image');

    img.src = dataUrl;
    preview.style.display = 'flex';
    placeholder.style.display = 'none';
}

async function saveSettings() {
    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<div class="spinner-inline" style="width: 20px; height: 20px; border-width: 2px;"></div> Saving...';

    try {
        const data = {
            company_name: document.getElementById('company_name').value,
            address: document.getElementById('address').value,
            postal_code: document.getElementById('postal_code').value,
            city: document.getElementById('city').value,
            country: 'Nederland',
            kvk_number: document.getElementById('kvk_number').value,
            btw_number: document.getElementById('btw_number').value,
            iban: document.getElementById('iban').value,
            phone: document.getElementById('phone').value,
            email: document.getElementById('email').value,
            invoice_number_format: document.getElementById('invoice_number_format').value,
            invoice_number_next: parseInt(document.getElementById('invoice_number_next').value) || 1,
            invoice_number_prefix: document.getElementById('invoice_number_prefix').value || 'F',
            quote_number_format: document.getElementById('quote_number_format').value,
            quote_number_next: parseInt(document.getElementById('quote_number_next').value) || 1,
            quote_number_prefix: document.getElementById('quote_number_prefix').value || 'O',
            brand_color_primary: document.getElementById('brand_color_primary').value,
            brand_color_secondary: document.getElementById('brand_color_secondary').value,
            brand_color_tertiary: document.getElementById('brand_color_tertiary').value,
            brand_color_4: document.getElementById('brand_color_4').value,
            brand_color_5: document.getElementById('brand_color_5').value,
            default_payment_terms_days: parseInt(document.getElementById('default_payment_terms_days').value) || 30,
            default_btw_percentage: parseFloat(document.getElementById('default_btw_percentage').value) || 21,
            footer_text: document.getElementById('footer_text').value,
            email_from_name: document.getElementById('email_from_name').value,
            email_from_address: document.getElementById('email_from_address').value,
            email_reply_to: document.getElementById('email_reply_to').value,
            email_invoice_subject: document.getElementById('email_invoice_subject').value,
            email_invoice_body: document.getElementById('email_invoice_body').value,
            email_quote_subject: document.getElementById('email_quote_subject').value,
            email_quote_body: document.getElementById('email_quote_body').value,
        };

        // Logo
        const logoImg = document.getElementById('logo-image');
        if (logoImg.src && logoImg.src.startsWith('data:')) {
            data.logo_base64 = logoImg.src;
        } else if (!logoImg.src || logoImg.src === window.location.href) {
            data.logo_base64 = null;
        }

        await api.updateSettings(data);
        savedSettingsSnapshot = captureSettingsSnapshot();
        showNotification('Settings saved successfully!');
    } catch (error) {
        console.error('Failed to save settings:', error);
        showNotification('Failed to save settings: ' + error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i data-lucide="save"></i> Save Settings';
        lucide.createIcons();
    }
}
