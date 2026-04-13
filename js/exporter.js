import { sanitizeHtml, loadExternalScript, downloadFile } from './utils.js';
import { showNotification } from './app.js';

const registeredExporters = {};

export function registerExporter(exporterId, exporterDefinition) {
	registeredExporters[exporterId] = exporterDefinition;
}

export function getExporter(exporterId) {
	return registeredExporters[exporterId] || null;
}

export function executeExport(exporterId, profileData) {
	const exporter = registeredExporters[exporterId];
	if (!exporter) {
		console.error(`No exporter registered with id: ${exporterId}`);
		return;
	}
	exporter.handler(profileData);
}

/* ---- PDF html2pdf.js loaded lazily from CDN ---- */
registerExporter('pdf', {
	label: 'PDF Document',
	handler: async (profileData) => {
		showNotification('Preparing PDF...');

		if (!window.html2pdf) {
			try {
				await loadExternalScript(
				'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
				);
			} catch (loadError) {
				showNotification('Could not load PDF library. Try the Print option instead.');
				return;
			}
		}

		const canvasElement = document.getElementById('resumeCanvas');

		const pdfOptions = {
			margin: 0,
			filename: `${profileData.name || 'resume'}.pdf`,
			image: { type: 'jpeg', quality: 0.98 },
			html2canvas: { scale: 2, useCORS: true, letterRendering: true },
			jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
		};

		try {
			window.scrollTo(0, 0);
			await window.html2pdf().from(canvasElement).set(pdfOptions).save();
			showNotification('PDF downloaded!');
		} catch (exportError) {
			console.error('PDF export failed:', exportError);
			showNotification('PDF export failed. Try the Print option.');
		}
	},
});

/* ---- HTML (self-contained file) ---- */
registerExporter('html', {
	label: 'HTML File',
	handler: (profileData) => {
		const canvasElement = document.getElementById('resumeCanvas');
		const clonedCanvas = canvasElement.cloneNode(true);
		stripEditingArtifacts(clonedCanvas);

		// Gather all CSS rules
		let cssRules = '';
		for (const stylesheet of document.styleSheets) {
			try {
				for (const rule of stylesheet.cssRules) {
					cssRules += rule.cssText + '\n';
				}
			} catch (accessError) {
				// Skip cross-origin stylesheets example Google Fonts
			}
		}

		const inlineStyles = canvasElement.getAttribute('style') || '';

		const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${sanitizeHtml(profileData.name || 'Resume')}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
<style>${cssRules}</style>
</head>
<body style="margin:0;padding:2rem;background:#f5f4f2;display:flex;justify-content:center;">
<div class="${canvasElement.className}" style="${inlineStyles};max-width:850px;width:100%;">
${clonedCanvas.innerHTML}
</div>
</body>
</html>`;

		downloadFile(htmlContent, `${profileData.name || 'resume'}.html`, 'text/html');
		showNotification('HTML file downloaded!');
	},
});


/* ---- JSON Backup ---- */
registerExporter('json', {
	label: 'JSON Backup',
	handler: (profileData) => {
		const jsonContent = JSON.stringify(profileData, null, 2);
		downloadFile(jsonContent, `${profileData.name || 'resume'}-backup.json`, 'application/json');
		showNotification('JSON backup downloaded!');
	},
});

function stripEditingArtifacts(clonedElement) {
	const selectorsToRemove = [
		'.section-hover-hint',
		'.section-edit-controls',
		'.inline-edit-group',
		'.page-overflow-indicator',
	];

	for (const selector of selectorsToRemove) {
		clonedElement.querySelectorAll(selector).forEach(element => element.remove());
	}

	clonedElement.querySelectorAll('.cv-section').forEach(sectionElement => {
		sectionElement.style.border = 'none';
		sectionElement.style.cursor = 'default';
	});
}