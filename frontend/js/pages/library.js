/**
 * Library page module
 * Extracted from library.html and library.js, adapted for dashboard
 */
import { showConfirmDialog } from '/js/components/confirm-dialog.js';

let templates = [];
let showingArchived = false;

// --- Persistent preview cache (localStorage) ---
const PREVIEW_CACHE_PREFIX = 'tpl_preview_';

function getPersistedPreview(templateId, updatedAt) {
    try {
        const raw = localStorage.getItem(PREVIEW_CACHE_PREFIX + templateId);
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (entry.updatedAt === updatedAt) return entry.dataUrl;
        // Stale entry — remove it
        localStorage.removeItem(PREVIEW_CACHE_PREFIX + templateId);
        return null;
    } catch { return null; }
}

function setPersistedPreview(templateId, updatedAt, dataUrl) {
    try {
        localStorage.setItem(PREVIEW_CACHE_PREFIX + templateId, JSON.stringify({ updatedAt, dataUrl }));
    } catch {
        // localStorage full — silently ignore
    }
}

function deletePersistedPreview(templateId) {
    localStorage.removeItem(PREVIEW_CACHE_PREFIX + templateId);
}

export function invalidatePreviewCache(templateId) {
    if (templateId) {
        deletePersistedPreview(templateId);
    } else {
        // Clear all preview cache entries
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(PREVIEW_CACHE_PREFIX)) keys.push(key);
        }
        keys.forEach(k => localStorage.removeItem(k));
    }
}

// Listen for data changes from other pages to invalidate cache selectively
if (window.appEvents) {
    window.appEvents.on(AppEvent.TEMPLATE_SAVED, (detail) => {
        if (detail?.id) deletePersistedPreview(detail.id);
    });
    window.appEvents.on(AppEvent.TEMPLATE_DELETED, (detail) => {
        if (detail?.id) deletePersistedPreview(detail.id);
    });
}

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelectorAll('.notification');
    existing.forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Vandaag';
    } else if (diffDays === 1) {
        return 'Gisteren';
    } else if (diffDays < 7) {
        return `${diffDays} dagen geleden`;
    } else {
        return date.toLocaleDateString('nl-NL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

/**
 * Extract field names from template schema
 */
function extractFieldNames(template) {
    try {
        const schemas = template.template_json?.schemas;
        if (!schemas || !schemas[0]) return [];

        const pageSchema = schemas[0];

        let fields;
        if (!Array.isArray(pageSchema)) {
            // pdfme v4: object with field names as keys
            fields = Object.keys(pageSchema);
        } else {
            // Legacy format: array with name property
            fields = pageSchema.map(field => field.name || 'unnamed');
        }

        return [...new Set(fields)];
    } catch (error) {
        console.error('Error extracting field names:', error);
        return [];
    }
}

/**
 * Ensure pdfjs-dist is loaded (same v4.4.168 as designer to avoid version conflicts)
 */
let _pdfjsLib = null;
async function ensurePdfjsLoaded() {
    if (_pdfjsLib) return;

    _pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/+esm');
    _pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';
    console.log('[Library] pdfjs-dist 4.4.168 loaded');
}

/**
 * Render a base64 PDF to a data URL image
 */
async function pdfToImageDataUrl(base64Pdf, desiredWidth = 400) {
    await ensurePdfjsLoaded();

    // Decode base64 to Uint8Array
    const pdfData = atob(base64Pdf);
    const uint8Array = new Uint8Array(pdfData.length);
    for (let i = 0; i < pdfData.length; i++) {
        uint8Array[i] = pdfData.charCodeAt(i);
    }

    // Load and render first page
    const pdf = await _pdfjsLib.getDocument({ data: uint8Array }).promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 1 });
    const scale = desiredWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    // Render to offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

    return canvas.toDataURL('image/png');
}

/**
 * Load inline preview for a single template card
 */
async function loadInlinePreview(template) {
    const previewArea = document.querySelector(`.card-sectioned[data-id="${template.id}"] .template-preview`);
    if (!previewArea) return;

    try {
        const updatedAt = template.updated_at || template.created_at;

        // 1. Check persistent cache first
        const cached = getPersistedPreview(template.id, updatedAt);
        if (cached) {
            previewArea.innerHTML = `<img src="${cached}" alt="Template preview" class="template-thumbnail" />`;
            return;
        }

        // 2. Fetch preview PDF from API
        console.log(`[Library] Fetching preview for template: ${template.name}`);
        const result = await api.getTemplatePreview(template.id);

        // 3. Render PDF to image
        const dataUrl = await pdfToImageDataUrl(result.pdf);

        // 4. Persist in localStorage for next visit
        setPersistedPreview(template.id, updatedAt, dataUrl);

        // 5. Show the image
        previewArea.innerHTML = `<img src="${dataUrl}" alt="Template preview" class="template-thumbnail" />`;

    } catch (error) {
        console.error(`[Library] Failed to load preview for ${template.name}:`, error);
        previewArea.innerHTML = `
            <div class="template-placeholder">
                <i data-lucide="alert-triangle" style="width: 32px; height: 32px; color: var(--color-text-secondary);"></i>
                <p style="font-size:11px;color:var(--color-text-secondary);margin-top:var(--space-xs);">Preview niet beschikbaar</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

/**
 * Load inline previews for all templates without thumbnails
 */
async function loadInlinePreviews() {
    const templatesNeedingPreview = templates.filter(t => !t.thumbnail_base64);
    if (templatesNeedingPreview.length === 0) return;

    console.log(`[Library] Loading previews for ${templatesNeedingPreview.length} template(s)...`);

    // Load 3 previews at a time (parallel with concurrency limit)
    const CONCURRENCY = 3;
    for (let i = 0; i < templatesNeedingPreview.length; i += CONCURRENCY) {
        const batch = templatesNeedingPreview.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(t => loadInlinePreview(t)));
    }

    console.log('[Library] All previews loaded');
}

/**
 * Render a single template card
 */
function renderTemplateCard(template) {
    const fields = extractFieldNames(template);
    const visibleFields = fields.slice(0, 10);
    const extraCount = fields.length - visibleFields.length;
    const tooltipHtml = visibleFields.length > 0
        ? visibleFields.map(field => `<span class="field-badge">${field}</span>`).join('')
          + (extraCount > 0 ? `<span class="field-badge" style="color:var(--color-text-secondary);">+${extraCount} meer</span>` : '')
        : '<span class="field-badge" style="color:var(--color-text-secondary);">Geen velden</span>';

    // Thumbnail, cached preview, or loading spinner
    let thumbnailHtml;
    if (template.thumbnail_base64) {
        thumbnailHtml = `<img src="data:image/png;base64,${template.thumbnail_base64}"
                 alt="Template preview"
                 class="template-thumbnail" />`;
    } else {
        thumbnailHtml = `<div class="template-placeholder" style="flex-direction:column;">
                <div class="loader-pulse loader-pulse--mini">
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__dot"></div>
                </div>
                <p style="font-size:12px;color:var(--color-text-secondary);">Preview laden...</p>
           </div>`;
    }

    return `
        <div class="card-sectioned dashboard-section" data-id="${template.id}">
            <div class="template-preview">
                ${thumbnailHtml}
            </div>
            <div class="card-header" style="border-bottom: none; padding-bottom: 0;">
                <div class="card-title">
                    <i data-lucide="file-text" style="width: 18px; height: 18px; color: var(--color-shamrock);"></i>
                    <strong>${template.name}</strong>
                </div>
                <div class="fields-badge-wrapper">
                    <span class="auto-freq-badge">${fields.length} fields</span>
                    <div class="fields-tooltip">
                        ${tooltipHtml}
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="card-row">
                    <span class="card-label">Created</span>
                    <span>${formatDate(template.created_at)}</span>
                </div>
            </div>
            <div class="card-actions">
                <button class="btn-secondary" style="font-size: 12px; padding: 4px 12px;" onclick="editTemplateFromLibrary('${template.id}')">
                    <i data-lucide="pencil" style="width: 14px; height: 14px;"></i> Edit
                </button>
                ${showingArchived ? `
                    <button class="btn-primary" style="font-size: 12px; padding: 4px 12px;" onclick="restoreTemplateFromLibrary('${template.id}')">
                        <i data-lucide="archive-restore" style="width: 14px; height: 14px;"></i> Restore
                    </button>
                ` : `
                    <button class="btn-secondary" style="font-size: 12px; padding: 4px 12px; color: #d69e2e;" onclick="archiveTemplateFromLibrary('${template.id}', '${template.name.replace(/'/g, "\\'")}')">
                        <i data-lucide="archive" style="width: 14px; height: 14px;"></i>
                    </button>
                `}
                <button class="btn-secondary" style="font-size: 12px; padding: 4px 12px; color: var(--color-error);" onclick="deleteTemplateFromLibrary('${template.id}', '${template.name.replace(/'/g, "\\'")}')">
                    <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                </button>
            </div>
        </div>
    `;
}

/**
 * Attach fixed-position tooltip hover listeners to all field badges
 */
function attachFieldTooltipListeners() {
    document.querySelectorAll('.fields-badge-wrapper').forEach(wrapper => {
        const tooltip = wrapper.querySelector('.fields-tooltip');
        if (!tooltip) return;

        wrapper.addEventListener('mouseenter', () => {
            const rect = wrapper.getBoundingClientRect();
            tooltip.style.top = (rect.bottom + 6) + 'px';
            // Align right edge with badge right edge, clamp to viewport
            const left = Math.max(4, rect.right - tooltip.offsetWidth || rect.right - 200);
            tooltip.style.left = left + 'px';
            tooltip.classList.add('visible');
        });

        wrapper.addEventListener('mouseleave', () => {
            tooltip.classList.remove('visible');
        });
    });
}

/**
 * Render all templates
 */
function renderTemplates(containerId, emptyStateId, statsId) {
    const grid = document.getElementById(containerId);
    const emptyState = document.getElementById(emptyStateId);
    const stats = document.getElementById(statsId);

    if (!grid) return;

    if (templates.length === 0) {
        // Show empty state
        if (emptyState) emptyState.style.display = 'block';
        grid.style.display = 'none';
        if (stats) stats.style.display = 'none';
    } else {
        // Show templates
        if (emptyState) emptyState.style.display = 'none';
        grid.style.display = 'grid';
        if (stats) stats.style.display = 'flex';

        // Update stats
        const countEl = document.getElementById('template-count');
        if (countEl) countEl.textContent = templates.length;

        // Render cards
        grid.innerHTML = templates.map(renderTemplateCard).join('');

        // Initialize Lucide icons after rendering
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Attach tooltip hover listeners
        attachFieldTooltipListeners();

        // Load inline previews for templates without thumbnails
        loadInlinePreviews();
    }
}

/**
 * Edit template - navigate to designer in dashboard
 */
window.editTemplateFromLibrary = function(templateId) {
    router.navigate('designer', { template_id: templateId });
};

/**
 * Delete template with confirmation
 */
window.deleteTemplateFromLibrary = async function(templateId, templateName) {
    const confirmed = await showConfirmDialog({
        title: 'Template Verwijderen',
        message: `"${templateName}" permanent verwijderen? Dit kan niet ongedaan worden gemaakt.`,
        confirmLabel: 'Verwijderen',
        variant: 'danger',
    });
    if (!confirmed) return;

    try {
        await api.deleteTemplate(templateId);
        showNotification('Template verwijderd', 'success');
        templates = templates.filter(t => t.id !== templateId);
        deletePersistedPreview(templateId);
        renderTemplates('templates-grid', 'empty-state', 'stats');
    } catch (error) {
        console.error('Failed to delete template:', error);
        showNotification('Fout bij verwijderen: ' + error.message, 'error');
    }
};

window.archiveTemplateFromLibrary = async function(templateId, templateName) {
    const confirmed = await showConfirmDialog({
        title: 'Template Archiveren',
        message: `"${templateName}" archiveren? Het wordt verborgen maar kan later hersteld worden.`,
        confirmLabel: 'Archiveren',
        variant: 'warning',
    });
    if (!confirmed) return;

    try {
        await api.archiveTemplate(templateId);
        showNotification('Template gearchiveerd', 'success');
        templates = templates.filter(t => t.id !== templateId);
        renderTemplates('templates-grid', 'empty-state', 'stats');
    } catch (error) {
        showNotification('Fout bij archiveren: ' + error.message, 'error');
    }
};

window.restoreTemplateFromLibrary = async function(templateId) {
    try {
        await api.restoreTemplate(templateId);
        showNotification('Template hersteld', 'success');
        templates = templates.filter(t => t.id !== templateId);
        renderTemplates('templates-grid', 'empty-state', 'stats');
    } catch (error) {
        showNotification('Fout bij herstellen: ' + error.message, 'error');
    }
};

/**
 * Initialize library page
 */
export async function initLibrary() {
    const html = `
        <div style="padding: var(--space-lg); max-width: 1400px; margin: 0 auto;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-xl); flex-wrap: wrap; gap: var(--space-md);">
                <div>
                    <h1 style="display: flex; align-items: center; gap: var(--space-md); font-size: 32px; color: var(--color-dark-green); margin-bottom: var(--space-sm);">
                        <i data-lucide="library"></i>
                        Template Library
                    </h1>
                    <p style="color: var(--color-text-secondary);">
                        Manage and create your invoice templates
                    </p>
                </div>
                <div style="display: flex; align-items: center; gap: var(--space-md);">
                    <div id="stats" style="display: none; align-items: center; gap: var(--space-sm);">
                        <i data-lucide="file-text" style="width: 20px; height: 20px; color: var(--color-shamrock);"></i>
                        <span id="template-count" style="font-size: 16px; font-weight: var(--font-weight-semibold); color: var(--color-shamrock);">0</span>
                        <span style="font-size: 14px; color: var(--color-text-secondary);">Templates</span>
                    </div>
                    <button class="btn-secondary" id="toggle-archived-btn" style="display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-md) var(--space-xl);">
                        <i data-lucide="archive"></i> Archived
                    </button>
                    <a href="#/designer" class="btn-primary" style="display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-md) var(--space-xl); text-decoration: none;">
                        <i data-lucide="sparkles"></i> Nieuwe Template
                    </a>
                </div>
            </div>

            <div id="loading-library" class="loading" style="background: var(--color-white); border-radius: var(--radius-xl); box-shadow: var(--shadow-md);">
                <div class="loader-pulse">
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__dot"></div>
                </div>
                <p>Templates laden...</p>
            </div>

            <div id="templates-grid" class="card-grid" style="display: none; margin-bottom: var(--space-xl);">
                <!-- Templates will be inserted here -->
            </div>

            <div id="empty-state" style="display: none; background: var(--color-white); border-radius: var(--radius-xl); padding: var(--space-2xl) var(--space-xl); text-align: center; box-shadow: var(--shadow-md);">
                <div style="margin-bottom: var(--space-lg);">
                    <i data-lucide="inbox" style="width: 64px; height: 64px; color: var(--color-text-secondary); opacity: 0.5;"></i>
                </div>
                <h2 style="color: var(--color-text-primary); margin-bottom: var(--space-sm);">Nog geen templates</h2>
                <p style="color: var(--color-text-secondary); margin-bottom: var(--space-lg);">Maak je eerste template met de visuele designer</p>
                <a href="#/designer" class="btn btn-primary">
                    <i data-lucide="sparkles"></i> Maak je eerste template
                </a>
            </div>
        </div>
    `;

    router.render(html);

    document.getElementById('toggle-archived-btn').addEventListener('click', async () => {
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
        try {
            templates = await api.getTemplates(showingArchived);
            const loading = document.getElementById('loading-library');
            if (loading) loading.style.display = 'none';
            renderTemplates('templates-grid', 'empty-state', 'stats');
        } catch (error) {
            showNotification('Fout bij laden: ' + error.message, 'error');
        }
    });

    // Load templates
    try {
        templates = await api.getTemplates(showingArchived);
        console.log(`[Library] Loaded ${templates.length} templates`);

        // Hide loading
        const loading = document.getElementById('loading-library');
        if (loading) loading.style.display = 'none';

        // Render templates
        renderTemplates('templates-grid', 'empty-state', 'stats');
    } catch (error) {
        console.error('Failed to load templates:', error);
        showNotification('Fout bij laden van templates: ' + error.message, 'error');

        // Show empty state on error
        const loading = document.getElementById('loading-library');
        if (loading) loading.style.display = 'none';

        const emptyState = document.getElementById('empty-state');
        if (emptyState) emptyState.style.display = 'block';
    }
}
