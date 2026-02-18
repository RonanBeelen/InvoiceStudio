/**
 * Template Library Logic
 * Handles template listing, editing, and deletion
 */

let templates = [];

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

        // Get unique field names from first page schema
        const fields = schemas[0].map(field => field.name || 'unnamed');
        return [...new Set(fields)].slice(0, 5); // Max 5 fields displayed
    } catch (error) {
        console.error('Error extracting field names:', error);
        return [];
    }
}

/**
 * Render a single template card
 */
function renderTemplateCard(template) {
    const fields = extractFieldNames(template);
    const fieldsHtml = fields.length > 0
        ? fields.map(field => `<span class="field-badge">${field}</span>`).join('')
        : '<span class="field-badge">Geen velden</span>';

    return `
        <div class="template-card" data-id="${template.id}">
            <div class="template-header">
                <div class="template-icon"><i data-lucide="file-text"></i></div>
            </div>

            <div class="template-title">${template.name}</div>
            <div class="template-meta">
                Gemaakt ${formatDate(template.created_at)}
            </div>

            <div class="template-fields">
                <div class="template-fields-title">Velden:</div>
                <div class="fields-list">
                    ${fieldsHtml}
                </div>
            </div>

            <div class="template-actions">
                <button class="action-btn edit-btn" onclick="editTemplate('${template.id}')">
                    <i data-lucide="edit"></i> Bewerken
                </button>
                <button class="action-btn delete-btn" onclick="deleteTemplate('${template.id}', '${template.name}')">
                    <i data-lucide="trash-2"></i> Verwijderen
                </button>
            </div>
        </div>
    `;
}

/**
 * Render all templates
 */
function renderTemplates() {
    const grid = document.getElementById('templates-grid');
    const emptyState = document.getElementById('empty-state');
    const loading = document.getElementById('loading');
    const stats = document.getElementById('stats');

    // Hide loading
    loading.style.display = 'none';

    if (templates.length === 0) {
        // Show empty state
        emptyState.style.display = 'block';
        grid.style.display = 'none';
        stats.style.display = 'none';
    } else {
        // Show templates
        emptyState.style.display = 'none';
        grid.style.display = 'grid';
        stats.style.display = 'flex';

        // Update stats
        document.getElementById('template-count').textContent = templates.length;

        // Render cards
        grid.innerHTML = templates.map(renderTemplateCard).join('');

        // Initialize Lucide icons after rendering
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
}

/**
 * Load all templates from backend
 */
async function loadTemplates() {
    try {
        templates = await api.getTemplates();
        console.log(`Loaded ${templates.length} templates`);
        renderTemplates();
    } catch (error) {
        console.error('Failed to load templates:', error);
        showNotification('Fout bij laden van templates: ' + error.message, 'error');

        // Show empty state on error
        document.getElementById('loading').style.display = 'none';
        document.getElementById('empty-state').style.display = 'block';
    }
}

/**
 * Edit template - navigate to designer
 */
function editTemplate(templateId) {
    window.location.href = `/designer?template_id=${templateId}`;
}

/**
 * Delete template with confirmation
 */
async function deleteTemplate(templateId, templateName) {
    const confirmed = confirm(
        `Weet je zeker dat je "${templateName}" wilt verwijderen?\n\nDit kan niet ongedaan worden gemaakt.`
    );

    if (!confirmed) return;

    try {
        await api.deleteTemplate(templateId);
        showNotification('Template verwijderd', 'success');

        // Remove from local array
        templates = templates.filter(t => t.id !== templateId);

        // Re-render
        renderTemplates();
    } catch (error) {
        console.error('Failed to delete template:', error);
        showNotification('Fout bij verwijderen: ' + error.message, 'error');
    }
}

/**
 * Initialize page
 */
async function init() {
    await loadTemplates();
}

// Make functions globally available for onclick handlers
window.editTemplate = editTemplate;
window.deleteTemplate = deleteTemplate;

// Start when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
