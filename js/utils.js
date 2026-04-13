export function generateUniqueId() {
	return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function sanitizeHtml(text) {
	if (!text) return '';
	const temporaryElement = document.createElement('div');
	temporaryElement.textContent = text;
	return temporaryElement.innerHTML;
}

export function debounce(callbackFunction, delayMs) {
	let timerId;
	return function (...argumentsList) {
		clearTimeout(timerId);
		timerId = setTimeout(() => callbackFunction.apply(this, argumentsList), delayMs);
	};
}

/* ---- Date Formatting ---- */
export const DATE_FORMATS = [
	{ id: 'mm-yyyy', label: 'MM/YYYY', example: '03/2024' },
	{ id: 'month-yyyy', label: 'Month YYYY', example: 'March 2024' },
	{ id: 'mon-yyyy', label: 'Mon YYYY', example: 'Mar 2024' },
	{ id: 'yyyy-mm', label: 'YYYY-MM', example: '2024-03' },
	{ id: 'mm-dot-yyyy', label: 'MM.YYYY', example: '03.2024' },
];

const MONTH_NAMES_FULL = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_NAMES_SHORT = [
	'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
	'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatDate(dateString, formatId) {
	if (!dateString) return '';
	const [yearPart, monthPart] = dateString.split('-');
	if (!yearPart || !monthPart) return dateString;
	const monthIndex = parseInt(monthPart, 10) - 1;

	switch (formatId) {
		case 'mm-yyyy':
			return `${monthPart}/${yearPart}`;
		case 'month-yyyy':
			return `${MONTH_NAMES_FULL[monthIndex]} ${yearPart}`;
		case 'mon-yyyy':
			return `${MONTH_NAMES_SHORT[monthIndex]} ${yearPart}`;
		case 'yyyy-mm':
			return `${yearPart}-${monthPart}`;
		case 'mm-dot-yyyy':
			return `${monthPart}.${yearPart}`;
		default:
			return `${MONTH_NAMES_SHORT[monthIndex]} ${yearPart}`;
	}
}

export function formatDateRange(startDate, endDate, isCurrent, formatId) {
	const formattedStart = formatDate(startDate, formatId);
	if (isCurrent) return `${formattedStart} — Present`;
	const formattedEnd = formatDate(endDate, formatId);
	if (!formattedStart && !formattedEnd) return '';
	if (!formattedEnd) return formattedStart;
	return `${formattedStart} — ${formattedEnd}`;
}

export function hexToRgba(hexColor, alphaValue) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor);
	if (!result) return `rgba(212, 96, 62, ${alphaValue})`;
	return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alphaValue})`;
}

/* ---- Font Options ---- */
export const FONT_OPTIONS = [
	{ id: 'playfair-display', label: 'Playfair Display', family: "'Playfair Display', serif", category: 'serif' },
	{ id: 'cormorant-garamond', label: 'Cormorant Garamond', family: "'Cormorant Garamond', serif", category: 'serif' },
	{ id: 'eb-garamond', label: 'EB Garamond', family: "'EB Garamond', serif", category: 'serif' },
	{ id: 'libre-baskerville', label: 'Libre Baskerville', family: "'Libre Baskerville', serif", category: 'serif' },
	{ id: 'lora', label: 'Lora', family: "'Lora', serif", category: 'serif' },
	{ id: 'merriweather', label: 'Merriweather', family: "'Merriweather', serif", category: 'serif' },
	{ id: 'crimson-pro', label: 'Crimson Pro', family: "'Crimson Pro', serif", category: 'serif' },
	{ id: 'source-serif-4', label: 'Source Serif', family: "'Source Serif 4', serif", category: 'serif' },
	{ id: 'ibm-plex-serif', label: 'IBM Plex Serif', family: "'IBM Plex Serif', serif", category: 'serif' },
	{ id: 'dm-sans', label: 'DM Sans', family: "'DM Sans', sans-serif", category: 'sans' },
	{ id: 'open-sans', label: 'Open Sans', family: "'Open Sans', sans-serif", category: 'sans' },
	{ id: 'lato', label: 'Lato', family: "'Lato', sans-serif", category: 'sans' },
	{ id: 'montserrat', label: 'Montserrat', family: "'Montserrat', sans-serif", category: 'sans' },
	{ id: 'poppins', label: 'Poppins', family: "'Poppins', sans-serif", category: 'sans' },
	{ id: 'raleway', label: 'Raleway', family: "'Raleway', sans-serif", category: 'sans' },
	{ id: 'nunito-sans', label: 'Nunito Sans', family: "'Nunito Sans', sans-serif", category: 'sans' },
	{ id: 'fira-sans', label: 'Fira Sans', family: "'Fira Sans', sans-serif", category: 'sans' },
	{ id: 'karla', label: 'Karla', family: "'Karla', sans-serif", category: 'sans' },
	{ id: 'source-sans-3', label: 'Source Sans', family: "'Source Sans 3', sans-serif", category: 'sans' },
	{ id: 'ibm-plex-sans', label: 'IBM Plex Sans', family: "'IBM Plex Sans', sans-serif", category: 'sans' },
];

export function getFontFamily(fontId) {
	const fontOption = FONT_OPTIONS.find(font => font.id === fontId);
	return fontOption ? fontOption.family : "'DM Sans', sans-serif";
}

/* ---- Spacing Presets ---- */
export const SPACING_PRESETS = {
	compact: {
		sectionMarginTop: '0.7rem',
		sectionMarginBottom: '0.3rem',
		itemMarginBottom: '0.4rem',
		lineHeight: '1.35',
		headerPaddingBottom: '0.8rem',
		headerMarginBottom: '0.8rem',
	},
	default: {
		sectionMarginTop: '1rem',
		sectionMarginBottom: '0.5rem',
		itemMarginBottom: '0.6rem',
		lineHeight: '1.45',
		headerPaddingBottom: '1.2rem',
		headerMarginBottom: '1.2rem',
	},
	comfortable: {
		sectionMarginTop: '1.5rem',
		sectionMarginBottom: '0.75rem',
		itemMarginBottom: '0.85rem',
		lineHeight: '1.6',
		headerPaddingBottom: '1.8rem',
		headerMarginBottom: '1.8rem',
	},
};

/**
 * Loads an external script from a CDN URL, returning a promise.
 * Skips if the script is already loaded.
 */
export function loadExternalScript(scriptUrl) {
	return new Promise((resolve, reject) => {
		const existingScript = document.querySelector(`script[src="${scriptUrl}"]`);
		if (existingScript) {
			resolve();
			return;
		}
		const scriptElement = document.createElement('script');
		scriptElement.src = scriptUrl;
		scriptElement.onload = resolve;
		scriptElement.onerror = reject;
		document.head.appendChild(scriptElement);
	});
}

/**
 * Triggers a file download from in-memory content.
 */
export function downloadFile(content, filename, mimeType) {
	const blobObject = new Blob([content], { type: mimeType });
	const downloadUrl = URL.createObjectURL(blobObject);
	const downloadLink = document.createElement('a');
	downloadLink.href = downloadUrl;
	downloadLink.download = filename;
	document.body.appendChild(downloadLink);
	downloadLink.click();
	document.body.removeChild(downloadLink);
	URL.revokeObjectURL(downloadUrl);
}