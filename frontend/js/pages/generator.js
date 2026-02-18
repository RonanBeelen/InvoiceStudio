/**
 * Generator page module
 * Extracted from generator.html, adapted for dashboard
 */

let templates = [];
let currentTemplate = null;

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
 * Extract field names from template
 */
function extractFields(template) {
    try {
        const schemas = template.template_json?.schemas;
        if (!schemas || !schemas[0]) return [];

        const pageSchema = schemas[0];

        // pdfme v4: schemas[0] is an object with field names as keys
        if (!Array.isArray(pageSchema)) {
            return Object.entries(pageSchema).map(([name, schema]) => ({
                name,
                ...schema
            }));
        }

        // Legacy format: schemas[0] is an array with name property
        return pageSchema.filter(field => field.name && field.name !== '');
    } catch (error) {
        console.error('Error extracting fields:', error);
        return [];
    }
}

/**
 * Generate form fields HTML
 */
function generateFormFields(template) {
    const fields = extractFields(template);

    if (fields.length === 0) {
        return '<p style="color: var(--color-text-secondary);">Deze template heeft geen invulbare velden.</p>';
    }

    return fields.map(field => `
        <div class="form-group">
            <label class="form-label" for="field-${field.name}">${field.name}</label>
            <input
                type="text"
                class="form-input"
                id="field-${field.name}"
                name="${field.name}"
                placeholder="Vul ${field.name} in..."
                required
            />
        </div>
    `).join('');
}

/**
 * Initialize generator page
 */
export async function initGenerator() {
    const html = `
        <div style="padding: var(--space-lg); max-width: 1200px; margin: 0 auto;">
            <div style="background: var(--color-white); border-radius: var(--radius-xl); padding: var(--space-xl); margin-bottom: var(--space-xl); box-shadow: var(--shadow-md); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-md);">
                <h1 style="font-size: 32px; color: var(--color-text-primary); margin: 0; display: flex; align-items: center; gap: var(--space-md);">
                    <i data-lucide="zap"></i>
                    PDF Genereren
                </h1>
                <div style="display: flex; gap: var(--space-md); align-items: center;">
                    <select id="template-select" class="template-select">
                        <option value="">Selecteer een template...</option>
                    </select>
                    <button id="generate-btn" class="btn btn-primary" disabled>
                        <i data-lucide="rocket"></i> Genereer PDF
                    </button>
                </div>
            </div>

            <div id="loading-generator" class="loading" style="display: flex; background: var(--color-white); border-radius: var(--radius-xl); box-shadow: var(--shadow-md);">
                <div class="loader-pulse">
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__ring"></div>
                    <div class="loader-pulse__dot"></div>
                </div>
                <p>Templates laden...</p>
            </div>

            <div id="empty-state" style="display: none; text-align: center; padding: var(--space-2xl); background: var(--color-white); border-radius: var(--radius-xl); box-shadow: var(--shadow-md);">
                <div style="margin-bottom: var(--space-lg);">
                    <i data-lucide="clipboard" style="width: 64px; height: 64px; color: var(--color-text-secondary); opacity: 0.5;"></i>
                </div>
                <h2 style="color: var(--color-text-primary); margin-bottom: var(--space-sm);">Selecteer een template</h2>
                <p style="color: var(--color-text-secondary);">Kies een template uit de dropdown om te beginnen met het invullen van gegevens.</p>
            </div>

            <div id="form-container" style="display: none; background: var(--color-white); border-radius: var(--radius-xl); padding: var(--space-xl); box-shadow: var(--shadow-md);">
                <h2 id="form-title" style="margin-bottom: var(--space-lg); color: var(--color-text-primary);">Vul de gegevens in</h2>
                <form id="pdf-form">
                    <!-- Form fields will be generated here -->
                </form>
            </div>

            <div id="result-container" style="display: none; text-align: center; padding: var(--space-2xl); background: var(--color-white); border-radius: var(--radius-xl); box-shadow: var(--shadow-md);">
                <div style="margin-bottom: var(--space-lg);">
                    <i data-lucide="check-circle" style="width: 64px; height: 64px; color: var(--color-success);"></i>
                </div>
                <h2 style="color: var(--color-text-primary); margin-bottom: var(--space-sm);">PDF Succesvol Gegenereerd!</h2>
                <p style="color: var(--color-text-secondary); margin-bottom: var(--space-lg);">Je PDF is klaar en kan worden gedownload.</p>
                <div style="display: flex; gap: var(--space-md); justify-content: center;">
                    <a id="download-link" href="#" class="btn btn-success" target="_blank">
                        <i data-lucide="download"></i> Download PDF
                    </a>
                    <button id="new-pdf-btn" class="btn btn-primary">
                        <i data-lucide="plus-circle"></i> Nieuwe PDF
                    </button>
                </div>
            </div>
        </div>
    `;

    router.render(html);

    // Get DOM elements
    const elements = {
        loading: document.getElementById('loading-generator'),
        emptyState: document.getElementById('empty-state'),
        formContainer: document.getElementById('form-container'),
        resultContainer: document.getElementById('result-container'),
        templateSelect: document.getElementById('template-select'),
        generateBtn: document.getElementById('generate-btn'),
        pdfForm: document.getElementById('pdf-form'),
        formTitle: document.getElementById('form-title'),
        downloadLink: document.getElementById('download-link'),
        newPdfBtn: document.getElementById('new-pdf-btn')
    };

    // Load templates
    try {
        templates = await api.getTemplates();

        // Populate template dropdown
        elements.templateSelect.innerHTML = '<option value="">Selecteer een template...</option>';
        templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            elements.templateSelect.appendChild(option);
        });

        elements.loading.style.display = 'none';
        elements.emptyState.style.display = 'block';

        if (templates.length === 0) {
            showNotification('Geen templates gevonden. Maak eerst een template aan.', 'info');
        }

    } catch (error) {
        console.error('Failed to load templates:', error);
        showNotification('Fout bij laden van templates: ' + error.message, 'error');
        elements.loading.style.display = 'none';
        elements.emptyState.style.display = 'block';
    }

    // Template selection handler
    elements.templateSelect.addEventListener('change', (e) => {
        const templateId = e.target.value;

        if (!templateId) {
            elements.emptyState.style.display = 'block';
            elements.formContainer.style.display = 'none';
            elements.resultContainer.style.display = 'none';
            elements.generateBtn.disabled = true;
            currentTemplate = null;
            return;
        }

        currentTemplate = templates.find(t => t.id === templateId);

        if (currentTemplate) {
            elements.emptyState.style.display = 'none';
            elements.formContainer.style.display = 'block';
            elements.resultContainer.style.display = 'none';
            elements.formTitle.textContent = `Vul de gegevens in voor: ${currentTemplate.name}`;
            elements.generateBtn.disabled = false;

            // Generate form
            elements.pdfForm.innerHTML = generateFormFields(currentTemplate);
        }
    });

    // Generate PDF handler
    elements.generateBtn.addEventListener('click', async () => {
        if (!currentTemplate) return;

        try {
            elements.generateBtn.disabled = true;
            elements.generateBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> Genereren...';
            lucide.createIcons();

            // Collect form data
            const formData = new FormData(elements.pdfForm);
            const inputData = {};
            formData.forEach((value, key) => {
                inputData[key] = value;
            });

            console.log('Generating PDF with data:', inputData);

            // Call API
            const result = await api.generatePdf(currentTemplate.id, inputData);

            console.log('PDF generated:', result);

            // Show result
            elements.formContainer.style.display = 'none';
            elements.resultContainer.style.display = 'block';
            elements.downloadLink.href = result.pdf_url;

            lucide.createIcons();

            showNotification('PDF succesvol gegenereerd!', 'success');

        } catch (error) {
            console.error('Failed to generate PDF:', error);
            showNotification('Fout bij genereren PDF: ' + error.message, 'error');
        } finally {
            elements.generateBtn.disabled = false;
            elements.generateBtn.innerHTML = '<i data-lucide="rocket"></i> Genereer PDF';
            lucide.createIcons();
        }
    });

    // New PDF handler
    elements.newPdfBtn.addEventListener('click', () => {
        elements.resultContainer.style.display = 'none';
        elements.formContainer.style.display = 'block';
        elements.pdfForm.reset();
    });
}
