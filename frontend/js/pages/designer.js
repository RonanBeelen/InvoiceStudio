/**
 * Designer page module
 * Extracted from designer.html, adapted for dashboard
 */

let designer = null;
let templateId = null;
let isEdit = false;
let savedTemplateSnapshot = null;

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
    const existing = document.querySelectorAll('.notification');
    existing.forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 3000);
}

/**
 * Initialize designer page
 */
export async function initDesigner() {
    // Get query parameters for template_id
    const queryParams = router.getQueryParams();
    const templateIdFromUrl = queryParams.template_id;

    // If editing an existing template, skip choice screen
    if (templateIdFromUrl) {
        renderDesignerUI();
        await loadPdfmeAndStart(templateIdFromUrl);
    } else {
        // Show choice screen for new templates
        showChoiceScreen();
    }
}

/**
 * Show the choice screen with two options
 */
function showChoiceScreen() {
    const html = `
        <div id="choice-screen" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: calc(100vh - 60px); padding: var(--space-xl);">
            <div style="max-width: 700px; width: 100%; text-align: center;">
                <h1 style="font-size: 32px; color: var(--color-text-primary); margin-bottom: var(--space-sm); display: flex; align-items: center; justify-content: center; gap: var(--space-md);">
                    <i data-lucide="palette"></i>
                    Template Designer
                </h1>
                <p style="color: var(--color-text-secondary); font-size: 16px; margin-bottom: var(--space-xl);">
                    Hoe wil je beginnen?
                </p>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-lg); margin-bottom: var(--space-xl);">
                    <button id="choice-blank" class="choice-card" style="
                        background: var(--color-white);
                        border: 2px solid var(--gray-200);
                        border-radius: var(--radius-xl);
                        padding: var(--space-xl) var(--space-lg);
                        cursor: pointer;
                        transition: all 250ms ease;
                        text-align: center;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: var(--space-md);
                    ">
                        <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(0, 143, 122, 0.1); display: flex; align-items: center; justify-content: center;">
                            <i data-lucide="pencil" style="width: 32px; height: 32px; color: var(--color-shamrock);"></i>
                        </div>
                        <div style="font-size: 20px; font-weight: 600; color: var(--color-text-primary);">Blank Canvas</div>
                        <div style="font-size: 14px; color: var(--color-text-secondary); line-height: 1.5;">Start from scratch and design your template</div>
                    </button>

                    <button id="choice-template" class="choice-card" style="
                        background: var(--color-white);
                        border: 2px solid var(--gray-200);
                        border-radius: var(--radius-xl);
                        padding: var(--space-xl) var(--space-lg);
                        cursor: pointer;
                        transition: all 250ms ease;
                        text-align: center;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: var(--space-md);
                    ">
                        <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(0, 143, 122, 0.1); display: flex; align-items: center; justify-content: center;">
                            <i data-lucide="layout-template" style="width: 32px; height: 32px; color: var(--color-shamrock);"></i>
                        </div>
                        <div style="font-size: 20px; font-weight: 600; color: var(--color-text-primary);">Choose Template</div>
                        <div style="font-size: 14px; color: var(--color-text-secondary); line-height: 1.5;">Start from a pre-made invoice template and customize it</div>
                    </button>

                    <button id="choice-ai" class="choice-card" style="
                        background: var(--color-white);
                        border: 2px solid var(--gray-200);
                        border-radius: var(--radius-xl);
                        padding: var(--space-xl) var(--space-lg);
                        cursor: pointer;
                        transition: all 250ms ease;
                        text-align: center;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: var(--space-md);
                    ">
                        <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(0, 143, 122, 0.1); display: flex; align-items: center; justify-content: center;">
                            <i data-lucide="sparkles" style="width: 32px; height: 32px; color: var(--color-shamrock);"></i>
                        </div>
                        <div style="font-size: 20px; font-weight: 600; color: var(--color-text-primary);">AI Scan</div>
                        <div style="font-size: 14px; color: var(--color-text-secondary); line-height: 1.5;">Upload an existing invoice and let AI generate a template</div>
                    </button>
                </div>

                <a href="#/templates" style="color: var(--color-text-secondary); font-size: 14px; text-decoration: none;">
                    <i data-lucide="arrow-left" style="width: 14px; height: 14px; vertical-align: -2px;"></i>
                    Back to Templates
                </a>
            </div>
        </div>
    `;

    router.render(html);
    lucide.createIcons();

    // Add hover effects
    document.querySelectorAll('.choice-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-5px)';
            card.style.boxShadow = '0 10px 30px rgba(0, 143, 122, 0.2)';
            card.style.borderColor = 'var(--color-shamrock)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = 'none';
            card.style.borderColor = 'var(--gray-200)';
        });
    });

    // Handle "Zelf ontwerpen" click
    document.getElementById('choice-blank').addEventListener('click', () => {
        renderDesignerUI();
        loadPdfmeAndStart(null);
    });

    // Handle "Kiezen uit template" click
    document.getElementById('choice-template').addEventListener('click', () => {
        showTemplateSelection();
    });

    // Handle "AI Scan" click
    document.getElementById('choice-ai').addEventListener('click', () => {
        showAiUploadScreen();
    });
}

/**
 * Show template selection grid with PDF previews
 */
async function showTemplateSelection() {
    const html = `
        <div style="display: flex; flex-direction: column; align-items: center; min-height: calc(100vh - 60px); padding: var(--space-xl);">
            <div style="max-width: 900px; width: 100%;">
                <div style="display: flex; align-items: center; gap: var(--space-lg); margin-bottom: var(--space-xl);">
                    <button id="back-to-choice" style="
                        background: none;
                        border: none;
                        cursor: pointer;
                        color: var(--color-text-secondary);
                        font-size: 14px;
                        display: flex;
                        align-items: center;
                        gap: var(--space-xs);
                        padding: var(--space-sm) var(--space-md);
                        border-radius: var(--radius-md);
                        transition: all 150ms ease;
                    ">
                        <i data-lucide="arrow-left" style="width: 16px; height: 16px;"></i>
                        Terug
                    </button>
                    <h1 style="font-size: 28px; color: var(--color-text-primary); margin: 0; display: flex; align-items: center; gap: var(--space-md);">
                        <i data-lucide="layout-template"></i>
                        Kies een template
                    </h1>
                </div>

                <div id="templates-loading" class="loading">
                    <div class="loader-pulse">
                        <div class="loader-pulse__ring"></div>
                        <div class="loader-pulse__ring"></div>
                        <div class="loader-pulse__ring"></div>
                        <div class="loader-pulse__dot"></div>
                    </div>
                    <p>Templates laden...</p>
                </div>

                <div id="templates-grid" style="display: none; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-lg);"></div>
            </div>
        </div>
    `;

    router.render(html);
    lucide.createIcons();

    // Back button handler
    document.getElementById('back-to-choice').addEventListener('click', () => {
        showChoiceScreen();
    });
    document.getElementById('back-to-choice').addEventListener('mouseenter', (e) => {
        e.currentTarget.style.background = 'var(--color-background)';
    });
    document.getElementById('back-to-choice').addEventListener('mouseleave', (e) => {
        e.currentTarget.style.background = 'none';
    });

    // Load template index and render cards with previews
    try {
        const response = await fetch('/templates/index.json');
        const templates = await response.json();

        const grid = document.getElementById('templates-grid');
        grid.innerHTML = templates.map(t => `
            <button class="template-choice-card" data-file="${t.file}" style="
                background: var(--color-white);
                border: 2px solid var(--gray-200);
                border-radius: var(--radius-xl);
                padding: 0;
                cursor: pointer;
                transition: all 250ms ease;
                text-align: center;
                display: flex;
                flex-direction: column;
                align-items: center;
                overflow: hidden;
            ">
                <div class="preview-container" data-file="${t.file}" style="
                    width: 100%;
                    height: 320px;
                    background: var(--gray-100);
                    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.06);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-bottom: 1px solid var(--gray-300);
                    overflow: hidden;
                ">
                    <div class="loader-pulse loader-pulse--mini">
                        <div class="loader-pulse__ring"></div>
                        <div class="loader-pulse__ring"></div>
                        <div class="loader-pulse__ring"></div>
                        <div class="loader-pulse__dot"></div>
                    </div>
                </div>
                <div style="padding: var(--space-md) var(--space-lg) var(--space-lg);">
                    <div style="font-size: 18px; font-weight: 600; color: var(--color-text-primary); margin-bottom: var(--space-xs);">${t.name}</div>
                    <div style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; margin-bottom: var(--space-sm);">${t.description}</div>
                    <div style="font-size: 11px; color: var(--color-shamrock); background: rgba(0, 143, 122, 0.08); padding: 4px 12px; border-radius: 20px; display: inline-block;">${t.style}</div>
                </div>
            </button>
        `).join('');

        document.getElementById('templates-loading').style.display = 'none';
        grid.style.display = 'grid';

        lucide.createIcons();

        // Add hover effects and click handlers
        grid.querySelectorAll('.template-choice-card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-5px)';
                card.style.boxShadow = '0 10px 30px rgba(0, 143, 122, 0.2)';
                card.style.borderColor = 'var(--color-shamrock)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = 'none';
                card.style.borderColor = 'var(--gray-200)';
            });
            card.addEventListener('click', async () => {
                const file = card.dataset.file;
                await loadPresetTemplate(file);
            });
        });

        // Load previews asynchronously
        loadTemplatePreviews(templates);
    } catch (error) {
        document.getElementById('templates-loading').innerHTML = `
            <p style="color: var(--color-error);">Fout bij het laden van templates: ${error.message}</p>
        `;
    }
}

/**
 * Load and render PDF previews for each template card
 */
async function loadTemplatePreviews(templates) {
    // Load pdf.js and user settings in parallel
    const [pdfjsLib, settings] = await Promise.all([
        import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/+esm'),
        api.getSettings().catch(() => ({}))
    ]);
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';

    // Generate preview for each template in parallel
    const promises = templates.map(async (t) => {
        const container = document.querySelector(`.preview-container[data-file="${t.file}"]`);
        if (!container) return;

        try {
            // Fetch template JSON and apply brand colors
            const templateRes = await fetch(`/templates/${t.file}`);
            let templateJson = await templateRes.json();
            templateJson = applyBrandColors(templateJson, settings);

            // Generate PDF preview via backend
            const headers = { 'Content-Type': 'application/json' };
            if (window.auth) {
                const session = await window.auth.getSession();
                if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
            }
            const previewRes = await fetch('/api/preview', {
                method: 'POST',
                headers,
                body: JSON.stringify({ template: templateJson })
            });
            const previewData = await previewRes.json();

            if (!previewData.success || !previewData.pdf) {
                container.innerHTML = '<p style="color: var(--color-text-secondary); font-size: 12px;">Preview niet beschikbaar</p>';
                return;
            }

            // Render PDF page 1 to canvas using pdf.js
            const pdfData = atob(previewData.pdf);
            const pdfArray = new Uint8Array(pdfData.length);
            for (let i = 0; i < pdfData.length; i++) {
                pdfArray[i] = pdfData.charCodeAt(i);
            }

            const pdf = await pdfjsLib.getDocument({ data: pdfArray }).promise;
            const page = await pdf.getPage(1);

            // Scale to fit container width
            const containerWidth = container.offsetWidth;
            const viewport = page.getViewport({ scale: 1 });
            const scale = (containerWidth - 20) / viewport.width;
            const scaledViewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            canvas.width = scaledViewport.width;
            canvas.height = scaledViewport.height;
            canvas.style.maxWidth = '100%';
            canvas.style.maxHeight = '100%';
            canvas.style.objectFit = 'contain';
            canvas.style.borderRadius = 'var(--radius-lg) var(--radius-lg) 0 0';

            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

            container.innerHTML = '';
            container.appendChild(canvas);
        } catch (err) {
            console.error(`Preview failed for ${t.file}:`, err);
            container.innerHTML = '<p style="color: var(--color-text-secondary); font-size: 12px;">Preview niet beschikbaar</p>';
        }
    });

    await Promise.all(promises);
}

/**
 * Calculate relative luminance of a hex color (WCAG formula)
 */
function getLuminance(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const toLinear = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Apply user's brand colors to a template JSON.
 * Replaces the default accent colors with the user's settings colors,
 * then auto-fixes text contrast against backgrounds.
 */
function applyBrandColors(templateJson, settings) {
    const colorMap = {};

    // Map default template accent colors → user's brand colors
    if (settings.brand_color_5) {
        colorMap['#003D33'] = settings.brand_color_5;
        colorMap['#00524A'] = settings.brand_color_5;
    }
    if (settings.brand_color_secondary) colorMap['#008F7A'] = settings.brand_color_secondary;
    if (settings.brand_color_tertiary) colorMap['#4DDFB5'] = settings.brand_color_tertiary;
    if (settings.brand_color_4) colorMap['#1AB291'] = settings.brand_color_4;

    if (Object.keys(colorMap).length === 0) return templateJson;

    const json = JSON.parse(JSON.stringify(templateJson));

    // Step 1: Replace brand colors
    for (const schema of json.schemas) {
        for (const field of Object.values(schema)) {
            for (const prop of ['fontColor', 'color', 'borderColor']) {
                if (field[prop]) {
                    const normalized = field[prop].toUpperCase();
                    for (const [from, to] of Object.entries(colorMap)) {
                        if (normalized === from.toUpperCase()) {
                            field[prop] = to;
                        }
                    }
                }
            }
        }
    }

    // Step 2: Auto-fix text contrast against backgrounds
    for (const schema of json.schemas) {
        const entries = Object.entries(schema);

        for (const [key, field] of entries) {
            if (field.type !== 'text' || !field.fontColor) continue;

            // Find the background color behind this text element
            // by checking which rectangles overlap its position
            let bgColor = '#FFFFFF'; // default = white paper
            const tx = field.position.x;
            const ty = field.position.y;

            for (const [k2, f2] of entries) {
                if (k2 === key) break; // only check elements rendered before this text
                if (f2.type === 'rectangle' && f2.color && f2.position) {
                    if (tx >= f2.position.x && tx < f2.position.x + f2.width &&
                        ty >= f2.position.y && ty < f2.position.y + f2.height) {
                        bgColor = f2.color; // last overlapping rect wins (topmost)
                    }
                }
            }

            // Calculate WCAG contrast ratio
            try {
                const bgLum = getLuminance(bgColor);
                const fgLum = getLuminance(field.fontColor);
                const lighter = Math.max(bgLum, fgLum);
                const darker = Math.min(bgLum, fgLum);
                const ratio = (lighter + 0.05) / (darker + 0.05);

                if (ratio < 3) {
                    // Poor contrast — pick black or white based on background
                    field.fontColor = bgLum > 0.5 ? '#000000' : '#FFFFFF';
                }
            } catch (e) {
                // Invalid color format, skip
            }
        }
    }

    return json;
}

/**
 * Load a preset template file and start the designer
 */
async function loadPresetTemplate(filename) {
    renderDesignerUI();
    const loadingText = document.getElementById('loading-text');

    try {
        loadingText.textContent = 'Template laden...';
        const [response, settings] = await Promise.all([
            fetch(`/templates/${filename}`),
            api.getSettings().catch(() => ({}))
        ]);
        let template = await response.json();
        template = applyBrandColors(template, settings);
        await loadPdfmeAndStart(null, template);
    } catch (error) {
        showNotification('Fout bij laden template: ' + error.message, 'error');
        await loadPdfmeAndStart(null, null);
    }
}

/**
 * Show AI upload screen
 */
function showAiUploadScreen() {
    const html = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: calc(100vh - 60px); padding: var(--space-xl);">
            <div style="max-width: 600px; width: 100%; text-align: center;">
                <h1 style="font-size: 32px; color: var(--color-text-primary); margin-bottom: var(--space-sm); display: flex; align-items: center; justify-content: center; gap: var(--space-md);">
                    <i data-lucide="sparkles"></i>
                    AI Template Scan
                </h1>
                <p style="color: var(--color-text-secondary); font-size: 16px; margin-bottom: var(--space-xl);">
                    Upload an existing invoice or quote and AI will create a template from it
                </p>

                <div id="ai-upload-area" class="logo-upload-area" style="min-height: 200px; margin-bottom: var(--space-lg);">
                    <div id="ai-upload-placeholder" style="display: flex; flex-direction: column; align-items: center; gap: var(--space-md); color: var(--color-text-secondary);">
                        <i data-lucide="upload" style="width: 48px; height: 48px;"></i>
                        <span style="font-size: 16px; font-weight: var(--font-weight-semibold);">Drop your file here or click to upload</span>
                        <span style="font-size: 13px;">PDF, PNG, or JPG (max 10MB)</span>
                    </div>
                    <input type="file" id="ai-file-input" accept="application/pdf,image/png,image/jpeg" style="display: none;">
                </div>

                <div id="ai-file-info" style="display: none; margin-bottom: var(--space-lg); padding: var(--space-md); background: var(--gray-50); border-radius: var(--radius-md); display: none;">
                    <span id="ai-file-name" style="font-weight: var(--font-weight-semibold);"></span>
                </div>

                <div class="loader-ai" id="ai-processing" style="display: none;">
                    <div class="loader-ai__visual">
                        <div class="loader-pulse__ring"></div>
                        <div class="loader-pulse__ring"></div>
                        <div class="loader-pulse__ring"></div>
                        <div class="loader-pulse__dot"></div>
                        <div class="loader-ai__orbit"></div>
                    </div>
                    <div class="loader-ai__text">
                        <span class="loader-ai__status active" data-phase="0">Document uploaden...</span>
                        <span class="loader-ai__status" data-phase="1">Document analyseren...</span>
                        <span class="loader-ai__status" data-phase="2">Layout herkennen...</span>
                        <span class="loader-ai__status" data-phase="3">Template genereren...</span>
                        <span class="loader-ai__status" data-phase="4">Bijna klaar...</span>
                    </div>
                    <div class="loader-ai__phases">
                        <div class="loader-ai__phase-dot current" data-phase="0"></div>
                        <div class="loader-ai__phase-dot" data-phase="1"></div>
                        <div class="loader-ai__phase-dot" data-phase="2"></div>
                        <div class="loader-ai__phase-dot" data-phase="3"></div>
                        <div class="loader-ai__phase-dot" data-phase="4"></div>
                    </div>
                    <span class="loader-ai__subtitle">Dit kan 5-15 seconden duren</span>
                </div>

                <div id="ai-result" style="display: none;"></div>

                <div style="margin-top: var(--space-lg);">
                    <button id="ai-back-btn" style="background: none; border: none; cursor: pointer; color: var(--color-text-secondary); font-size: 14px;">
                        <i data-lucide="arrow-left" style="width: 14px; height: 14px; vertical-align: -2px;"></i>
                        Back
                    </button>
                </div>
            </div>
        </div>
    `;

    router.render(html);
    lucide.createIcons();

    const uploadArea = document.getElementById('ai-upload-area');
    const fileInput = document.getElementById('ai-file-input');

    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) handleAiFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) handleAiFile(fileInput.files[0]);
    });

    document.getElementById('ai-back-btn').addEventListener('click', () => showChoiceScreen());

    // Show remaining AI generations (async, non-blocking)
    (async () => {
        try {
            const rateLimit = await api.getAiRateLimit();
            const infoEl = document.createElement('p');
            infoEl.style.cssText = 'text-align: center; font-size: 13px; color: var(--color-text-secondary); margin-top: var(--space-md);';
            infoEl.textContent = `${rateLimit.remaining} van ${rateLimit.limit} AI generaties over deze maand`;
            if (rateLimit.remaining === 0) {
                infoEl.style.color = 'var(--color-error, #e53e3e)';
            }
            document.getElementById('ai-upload-area')?.parentNode?.appendChild(infoEl);
        } catch (e) {
            console.warn('[Designer] Could not fetch AI rate limit:', e);
        }
    })();
}

async function handleAiFile(file) {
    if (file.size > 10 * 1024 * 1024) {
        showNotification('File must be smaller than 10MB', 'error');
        return;
    }

    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.type)) {
        showNotification('Only PDF, PNG, and JPG files are supported', 'error');
        return;
    }

    // Show processing state
    document.getElementById('ai-upload-area').style.display = 'none';
    const fileInfo = document.getElementById('ai-file-info');
    fileInfo.style.display = 'block';
    document.getElementById('ai-file-name').textContent = file.name;

    const processing = document.getElementById('ai-processing');
    processing.style.display = 'flex';

    // Smooth AI status text transitions
    const phases = processing.querySelectorAll('.loader-ai__status');
    const phaseDots = processing.querySelectorAll('.loader-ai__phase-dot');
    let currentPhase = 0;
    const msgInterval = setInterval(() => {
        if (currentPhase >= phases.length - 1) return;

        // Exit current text
        phases[currentPhase].classList.remove('active');
        phases[currentPhase].classList.add('exit');

        // Mark current dot as reached (completed)
        phaseDots[currentPhase].classList.remove('current');
        phaseDots[currentPhase].classList.add('reached');

        currentPhase++;

        // Enter new text with slight delay for overlap
        setTimeout(() => {
            phases[currentPhase].classList.add('active');
            phaseDots[currentPhase].classList.add('current');
        }, 200);
    }, 3000);

    try {
        const result = await api.generateTemplateFromImage(file);

        clearInterval(msgInterval);
        processing.style.display = 'none';

        // Show result with options
        const resultDiv = document.getElementById('ai-result');
        const fieldCount = Object.keys(result.template_json.schemas[0] || {}).length;
        const varFields = result.suggested_variable_fields || [];

        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <div style="background: rgba(77, 223, 181, 0.1); border: 2px solid var(--color-shamrock); border-radius: var(--radius-lg); padding: var(--space-xl); text-align: center;">
                <i data-lucide="check-circle" style="width: 48px; height: 48px; color: var(--color-shamrock); margin-bottom: var(--space-md);"></i>
                <h2 style="color: var(--color-shamrock); margin-bottom: var(--space-sm);">Template Generated!</h2>
                <p style="color: var(--color-text-secondary); margin-bottom: var(--space-lg);">
                    ${fieldCount} elements detected, ${varFields.length} variable fields identified
                </p>
                ${varFields.length > 0 ? `
                    <div style="margin-bottom: var(--space-lg); text-align: left;">
                        <p style="font-size: 13px; font-weight: var(--font-weight-semibold); margin-bottom: var(--space-sm);">Variable fields:</p>
                        <div style="display: flex; flex-wrap: wrap; gap: var(--space-xs);">
                            ${varFields.map(f => `<span class="field-badge">${f}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                <div style="display: flex; gap: var(--space-md); justify-content: center;">
                    <button class="btn-primary" id="ai-edit-btn" style="display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-md) var(--space-xl);">
                        <i data-lucide="edit"></i> Edit in Designer
                    </button>
                    <button class="btn-secondary" id="ai-save-btn" style="display: flex; align-items: center; gap: var(--space-sm);">
                        <i data-lucide="save"></i> Save Template
                    </button>
                </div>
            </div>
        `;

        lucide.createIcons();

        // Edit in Designer
        document.getElementById('ai-edit-btn').addEventListener('click', () => {
            renderDesignerUI();
            loadPdfmeAndStart(null, result.template_json);
        });

        // Save directly
        document.getElementById('ai-save-btn').addEventListener('click', async () => {
            const btn = document.getElementById('ai-save-btn');
            btn.disabled = true;
            btn.textContent = 'Saving...';

            try {
                const templateName = file.name.replace(/\.[^/.]+$/, '') + ' (AI)';
                await api.createTemplate({
                    name: templateName,
                    description: 'Generated by AI from uploaded document',
                    template_json: result.template_json,
                });
                showNotification('Template saved!', 'success');
                window.location.hash = '#/templates';
            } catch (error) {
                showNotification('Failed to save: ' + error.message, 'error');
                btn.disabled = false;
                btn.textContent = 'Save Template';
            }
        });

    } catch (error) {
        clearInterval(msgInterval);
        processing.style.display = 'none';
        document.getElementById('ai-upload-area').style.display = 'flex';
        fileInfo.style.display = 'none';

        if (error.status === 429 && error.rateLimit) {
            const resetDate = new Date(error.rateLimit.resets_at);
            const resetStr = resetDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
            showNotification(
                `AI limiet bereikt (${error.rateLimit.used}/${error.rateLimit.limit} per maand). Reset op ${resetStr}.`,
                'error'
            );
        } else {
            showNotification('AI analysis failed: ' + error.message, 'error');
        }
    }
}

/**
 * Render the designer UI (header + loading + container)
 */
function renderDesignerUI() {
    const html = `
        <div style="display: flex; flex-direction: column; height: calc(100vh - 60px); padding: var(--space-lg);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg); background: var(--color-white); padding: var(--space-lg); border-radius: var(--radius-lg); box-shadow: var(--shadow-md);">
                <h1 id="page-title" style="font-size: 28px; color: var(--color-text-primary); margin: 0; display: flex; align-items: center; gap: var(--space-md);">
                    <i data-lucide="palette"></i>
                    Template Designer
                </h1>
                <div style="display: flex; gap: var(--space-md); align-items: center;">
                    <input type="text" id="template-name" class="template-name-input"
                           placeholder="Template naam" required
                           style="padding: var(--space-sm) var(--space-md); border: 2px solid var(--gray-200); border-radius: var(--radius-md); font-size: 14px; min-width: 250px; font-family: var(--font-family);">
                    <button id="save-btn" class="btn btn-primary">
                        <i data-lucide="save"></i> Opslaan
                    </button>
                </div>
            </div>

            <div id="loading-designer" class="loading" style="flex: 1; background: var(--color-white); border-radius: var(--radius-lg); box-shadow: var(--shadow-md);">
                <div class="loader-pulse">
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__dot"></div>
                </div>
                <p id="loading-text">Libraries laden...</p>
            </div>

            <div id="designer" style="flex: 1; overflow: hidden; background: var(--color-white); border-radius: var(--radius-lg); box-shadow: var(--shadow-md); display: none;">
            </div>
        </div>
    `;

    router.render(html);
    lucide.createIcons();
}

/**
 * Inject brand color swatches next to every color field in pdfme's property panel.
 * pdfme uses form-render + rc-color-picker + antd Input for color fields.
 * Uses a MutationObserver to detect when pdfme renders/re-renders the panel.
 */
function setupBrandColorInjection(container, brandColors) {
    if (!brandColors || brandColors.length === 0) return;

    const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
    ).set;

    const injectSwatches = () => {
        // form-render renders color fields as:
        //   rc-color-picker-trigger (color preview) + antd Input (hex text input)
        // We find text inputs whose value looks like a hex color
        container.querySelectorAll('input').forEach(input => {
            if (!/^#[0-9A-Fa-f]{3,8}$/i.test(input.value)) return;

            // Walk up to the form field wrapper to avoid duplicates
            const fieldWrapper = input.closest('[class*="fr-"]')
                || input.closest('[class*="color"]')
                || input.parentElement;
            if (!fieldWrapper || fieldWrapper.querySelector('.brand-swatches-row')) return;

            const row = document.createElement('div');
            row.className = 'brand-swatches-row';

            brandColors.forEach(color => {
                const swatch = document.createElement('button');
                swatch.type = 'button';
                swatch.className = 'brand-swatch-inline';
                swatch.style.background = color;
                swatch.title = color;
                swatch.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Set value via native setter to trigger React 16 state update
                    nativeSetter.call(input, color);
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                });
                row.appendChild(swatch);
            });

            fieldWrapper.appendChild(row);
        });
    };

    // Debounced observer to avoid excessive calls
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(injectSwatches, 150);
    });

    observer.observe(container, { childList: true, subtree: true });
    setTimeout(injectSwatches, 1000);
}

/**
 * Load pdfme libraries and start the designer
 * @param {string|null} editTemplateId - template ID to edit from the database
 * @param {object|null} presetTemplate - preset template JSON to load
 */
async function loadPdfmeAndStart(editTemplateId, presetTemplate = null) {
    try {
        const loadingText = document.getElementById('loading-text');
        loadingText.textContent = 'pdfme laden (dit kan even duren)...';

        // Import pdfme UI from CDN
        const { Designer } = await import('https://cdn.jsdelivr.net/npm/@pdfme/ui@4.5.2/+esm');

        // Import ALL available schema types individually
        const {
            text,
            multiVariableText,
            image,
            svg,
            line,
            rectangle,
            ellipse,
            table
        } = await import('https://cdn.jsdelivr.net/npm/@pdfme/schemas@4.5.2/+esm');

        // Create comprehensive plugins object with ALL schema types
        const plugins = {
            text,
            multiVariableText,
            image,
            svg,
            line,
            rectangle,
            ellipse,
            table
        };

        console.log('✓ pdfme loaded with', Object.keys(plugins).length, 'schema types!');

        // Load template if editing existing
        if (editTemplateId) {
            await loadTemplate(editTemplateId, Designer, plugins);
        } else {
            await initializeDesigner(presetTemplate, Designer, plugins);
        }

    } catch (error) {
        console.error('Error loading designer:', error);
        const loading = document.getElementById('loading-designer');
        loading.innerHTML = `
            <p style="color: var(--color-error); font-size: 18px;"><i data-lucide="x-circle"></i> Fout</p>
            <p style="margin: 10px 0; color: var(--color-text-secondary);">${error.message}</p>
            <pre style="background: var(--color-white); padding: 10px; border-radius: 4px; font-size: 11px; max-width: 600px; overflow: auto; color: var(--color-text-primary);">${error.stack}</pre>
            <p style="margin-top: 20px;"><button class="btn btn-secondary" onclick="router.navigate('library')">← Terug naar Library</button></p>
        `;
        lucide.createIcons();
    }
}

/**
 * Load template for editing
 */
async function loadTemplate(id, Designer, plugins) {
    const loadingText = document.getElementById('loading-text');

    try {
        loadingText.textContent = 'Template laden...';
        const template = await api.getTemplate(id);

        document.getElementById('template-name').value = template.name;
        document.getElementById('page-title').innerHTML = '<i data-lucide="edit"></i> Bewerken';
        lucide.createIcons();

        templateId = id;
        isEdit = true;

        await initializeDesigner(template.template_json, Designer, plugins);
    } catch (error) {
        showNotification('Fout: ' + error.message, 'error');
        await initializeDesigner(null, Designer, plugins);
    }
}

/**
 * Initialize pdfme Designer
 */
async function initializeDesigner(template, Designer, plugins) {
    const container = document.getElementById('designer');
    const loading = document.getElementById('loading-designer');

    const defaultTemplate = {
        basePdf: { width: 210, height: 297, padding: [10, 10, 10, 10] },
        schemas: [{}]
    };

    designer = new Designer({
        domContainer: container,
        template: template || defaultTemplate,
        plugins: plugins
    });

    // Inject brand color swatches into pdfme's color inputs
    try {
        const settings = await api.getSettings();
        const brandColors = [
            settings.brand_color_primary,
            settings.brand_color_secondary,
            settings.brand_color_tertiary,
            settings.brand_color_4,
            settings.brand_color_5
        ].filter(c => c);
        if (brandColors.length > 0) setupBrandColorInjection(container, brandColors);
    } catch (e) {
        console.warn('[Designer] Could not load brand colors:', e);
    }

    // Experimental: Try to enable snap/guidelines in the designer
    // pdfme uses Moveable internally for element manipulation and @scena/react-guides for rulers.
    // We attempt to patch these for better snapping behavior.
    requestAnimationFrame(() => {
        setTimeout(() => {
            try {
                // Attempt 1: Find the Moveable instance and enable element-to-element snapping
                const moveableEl = container.querySelector('.moveable-control-box');
                if (moveableEl && moveableEl.__reactFiber$) {
                    // Walk the React fiber tree to find the Moveable component instance
                    let fiber = moveableEl.__reactFiber$;
                    let moveableInstance = null;
                    let maxDepth = 30;
                    while (fiber && maxDepth-- > 0) {
                        if (fiber.stateNode && fiber.stateNode.moveable) {
                            moveableInstance = fiber.stateNode.moveable;
                            break;
                        }
                        if (fiber.memoizedProps && fiber.memoizedProps.snappable !== undefined) {
                            moveableInstance = fiber.stateNode;
                            break;
                        }
                        fiber = fiber.return;
                    }
                    if (moveableInstance) {
                        // Try to set elementGuidelines for snapping to other elements
                        const targets = container.querySelectorAll('.moveable-area, [class*="schema"]');
                        if (targets.length > 0) {
                            moveableInstance.elementGuidelines = Array.from(targets);
                            console.log('Snap: element guidelines patched on Moveable instance');
                        }
                    }
                }

                // Attempt 2: Find React fiber on the container to access internal __reactFiber keys
                const fiberKeys = Object.keys(container).filter(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
                if (fiberKeys.length > 0) {
                    console.log('Snap: React fiber keys found on container:', fiberKeys);
                    // pdfme's internals are not easily patchable from outside, logging for debug
                }

                // Fallback: Add fixed guidelines via @scena/react-guides instances
                // The guides component renders ruler elements; we try to find them and add guide positions
                const guideElements = container.querySelectorAll('[class*="guide"], [class*="ruler"], .scena-guides');
                if (guideElements.length > 0) {
                    console.log('Snap: Found guide elements:', guideElements.length);
                    guideElements.forEach(el => {
                        const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
                        if (fiberKey) {
                            let fiber = el[fiberKey];
                            let maxDepth = 20;
                            while (fiber && maxDepth-- > 0) {
                                if (fiber.stateNode && typeof fiber.stateNode.loadGuides === 'function') {
                                    // Horizontal guides: center (148.5mm) and margins (10mm, 287mm)
                                    // Vertical guides: center (105mm), margins (10mm, 20mm, 190mm, 200mm)
                                    const isHorizontal = el.classList.contains('horizontal') ||
                                        el.getAttribute('data-direction') === 'horizontal' ||
                                        (el.style && el.style.width > el.style.height);
                                    if (isHorizontal) {
                                        fiber.stateNode.loadGuides([148.5, 10, 287]);
                                    } else {
                                        fiber.stateNode.loadGuides([105, 10, 20, 190, 200]);
                                    }
                                    console.log('Snap: Loaded guides on', isHorizontal ? 'horizontal' : 'vertical', 'ruler');
                                    break;
                                }
                                fiber = fiber.return;
                            }
                        }
                    });
                }

                // Note: If neither approach works, pdfme v4's Designer does not expose
                // a public API for snap guidelines. The Moveable and @scena/react-guides
                // instances are deeply encapsulated within pdfme's React component tree.
                // A more reliable approach would require forking @pdfme/ui or using
                // the pdfme Designer options if they add snap support in a future version.
                console.log('Snap: Guidelines setup attempted (experimental)');
            } catch (err) {
                console.warn('Snap: Could not patch guidelines (experimental):', err.message);
            }
        }, 500);
    });

    loading.style.display = 'none';
    container.style.display = 'block';

    showNotification('Designer klaar!', 'success');

    // Setup save button handler
    setupSaveHandler();

    // Register dirty state guard for unsaved changes detection
    savedTemplateSnapshot = JSON.stringify(designer.getTemplate());
    router.setDirtyGuard(
        () => designer ? JSON.stringify(designer.getTemplate()) !== savedTemplateSnapshot : false,
        async () => {
            const nameInput = document.getElementById('template-name');
            const name = nameInput?.value?.trim();
            if (!name) throw new Error('Template naam is verplicht');
            const data = { name, description: '', template_json: designer.getTemplate() };
            if (isEdit) {
                await api.updateTemplate(templateId, data);
            } else {
                const result = await api.createTemplate(data);
                templateId = result.id;
                isEdit = true;
            }
            savedTemplateSnapshot = JSON.stringify(designer.getTemplate());
        }
    );
}

/**
 * Setup save button handler
 */
function setupSaveHandler() {
    const saveBtn = document.getElementById('save-btn');

    saveBtn.onclick = async () => {
        const nameInput = document.getElementById('template-name');
        const name = nameInput.value.trim();

        if (!name) {
            showNotification('Vul naam in', 'error');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> Bezig...';
        lucide.createIcons();

        try {
            const data = {
                name,
                description: '',
                template_json: designer.getTemplate()
            };

            const result = isEdit
                ? await api.updateTemplate(templateId, data)
                : await api.createTemplate(data);

            showNotification(isEdit ? 'Bijgewerkt!' : 'Opgeslagen!', 'success');
            savedTemplateSnapshot = JSON.stringify(designer.getTemplate());

            if (!isEdit) {
                templateId = result.id;
                isEdit = true;
                // Update URL with template_id
                router.navigate('designer', { template_id: result.id });
            }
        } catch (error) {
            showNotification('Fout: ' + error.message, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i data-lucide="save"></i> Opslaan';
            lucide.createIcons();
        }
    };
}
