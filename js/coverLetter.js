/* ============================================================
   coverLetter.js — Cover letter inline editor
   ============================================================ */
import { sanitizeHtml, debounce } from './utils.js';
import { refreshActiveView, saveCurrentProfile } from './app.js';

let currentlyEditingElement = null;

export function closeCurrentCoverLetterEditor() {
	if (!currentlyEditingElement) return;

	currentlyEditingElement.classList.remove('editing');
	const editGroup = currentlyEditingElement.querySelector('.inline-edit-group');
	if (editGroup) editGroup.remove();
	const displayContent = currentlyEditingElement.querySelector('.display-content');
	if (displayContent) displayContent.style.display = '';
	currentlyEditingElement = null;
}

export function openCoverLetterEditor(sectionElement, profileData) {
	closeCurrentCoverLetterEditor();

	const fieldName = sectionElement.dataset.clField;
	const coverLetterData = profileData.coverLetter || {};

	currentlyEditingElement = sectionElement;
	sectionElement.classList.add('editing');

	const displayContent = sectionElement.querySelector('.display-content');
	if (displayContent) displayContent.style.display = 'none';

	const editGroupElement = document.createElement('div');
	editGroupElement.className = 'inline-edit-group';
	editGroupElement.style.display = 'block';
	editGroupElement.innerHTML = buildCoverLetterFieldForm(fieldName, coverLetterData);
	sectionElement.appendChild(editGroupElement);

	// Done button
	const doneButton = document.createElement('button');
	doneButton.className = 'section-done-button';
	doneButton.textContent = 'Done';
	doneButton.style.marginTop = '0.5rem';
	doneButton.addEventListener('click', (clickEvent) => {
		clickEvent.stopPropagation();
		closeCurrentCoverLetterEditor();
		refreshActiveView();
	});
	editGroupElement.appendChild(doneButton);

	// Wire input events
	const debouncedSave = debounce(() => saveCurrentProfile(profileData), 300);
	editGroupElement.querySelectorAll('input, textarea').forEach(inputElement => {
		inputElement.addEventListener('input', () => {
			updateCoverLetterDataFromInput(inputElement, coverLetterData);
			debouncedSave();
		});
	});

	// Paragraph add/remove actions
	editGroupElement.querySelectorAll('[data-action]').forEach(buttonElement => {
		buttonElement.addEventListener('click', (clickEvent) => {
			clickEvent.stopPropagation();
			const actionName = buttonElement.dataset.action;

			if (actionName === 'addParagraph') {
				coverLetterData.paragraphs.push('');
			} else if (actionName === 'removeParagraph') {
				const paragraphIndex = parseInt(buttonElement.dataset.paragraphIndex, 10);
				if (coverLetterData.paragraphs.length > 1) {
					coverLetterData.paragraphs.splice(paragraphIndex, 1);
				}
			}

			saveCurrentProfile(profileData);
			closeCurrentCoverLetterEditor();
			refreshActiveView();

			// Re-open editor on the same field
			setTimeout(() => {
				const freshProfile = getProfileForReopen(profileData.id);
				const newSectionElement = document.querySelector(`[data-cl-field="${fieldName}"]`);
				if (newSectionElement && freshProfile) {
					openCoverLetterEditor(newSectionElement, freshProfile);
				}
			}, 50);
		});
	});
}

/**
 * Helper to get a fresh profile reference — imported lazily to avoid circular deps.
 */
function getProfileForReopen(profileId) {
	const { getProfile } = window._suitUpStore || {};
	return getProfile ? getProfile(profileId) : null;
}

function buildCoverLetterFieldForm(fieldName, coverLetterData) {
	switch (fieldName) {
		case 'recipient':
			return `
        <div class="inline-field-row">
          <div class="inline-field"><label>Recipient Name</label><input type="text" data-cl-field="recipientName" value="${sanitizeHtml(coverLetterData.recipientName || '')}" placeholder="Jane Smith"></div>
          <div class="inline-field"><label>Title</label><input type="text" data-cl-field="recipientTitle" value="${sanitizeHtml(coverLetterData.recipientTitle || '')}" placeholder="Head of HR"></div>
        </div>
        <div class="inline-field-row">
          <div class="inline-field"><label>Company</label><input type="text" data-cl-field="recipientCompany" value="${sanitizeHtml(coverLetterData.recipientCompany || '')}" placeholder="Acme Inc."></div>
          <div class="inline-field"><label>Address</label><input type="text" data-cl-field="recipientAddress" value="${sanitizeHtml(coverLetterData.recipientAddress || '')}" placeholder="123 Main St, City"></div>
        </div>`;

		case 'date':
			return `<div class="inline-field-row single"><div class="inline-field"><label>Date</label><input type="date" data-cl-field="date" value="${coverLetterData.date || ''}"></div></div>`;

		case 'subject':
			return `<div class="inline-field-row single"><div class="inline-field"><label>Subject / Position</label><input type="text" data-cl-field="subject" value="${sanitizeHtml(coverLetterData.subject || '')}" placeholder="Senior Software Engineer Position"></div></div>`;

		case 'salutation':
			return `<div class="inline-field-row single"><div class="inline-field"><label>Salutation</label><input type="text" data-cl-field="salutation" value="${sanitizeHtml(coverLetterData.salutation || '')}" placeholder="Dear Hiring Manager,"></div></div>`;

		case 'body': {
			const paragraphs = coverLetterData.paragraphs || ['', '', ''];
			let bodyFormHtml = '';
			for (const [paragraphIndex, paragraphText] of paragraphs.entries()) {
				bodyFormHtml += `<div class="inline-field" style="margin-bottom:0.75rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <label>Paragraph ${paragraphIndex + 1}</label>
            <button class="remove-bullet" data-action="removeParagraph" data-paragraph-index="${paragraphIndex}" style="width:20px;height:20px;font-size:0.6rem;">✕</button>
          </div>
          <textarea data-cl-field="paragraph" data-paragraph-index="${paragraphIndex}" rows="3" placeholder="Write your paragraph...">${sanitizeHtml(paragraphText)}</textarea>
        </div>`;
			}
			bodyFormHtml += `<button class="add-item-button" data-action="addParagraph">+ Add Paragraph</button>`;
			return bodyFormHtml;
		}

		case 'signoff':
			return `
        <div class="inline-field-row">
          <div class="inline-field"><label>Sign Off</label><input type="text" data-cl-field="signOff" value="${sanitizeHtml(coverLetterData.signOff || '')}" placeholder="Sincerely,"></div>
          <div class="inline-field"><label>Your Name</label><input type="text" data-cl-field="senderName" value="${sanitizeHtml(coverLetterData.senderName || '')}" placeholder="John Doe"></div>
        </div>`;

		default:
			return '';
	}
}

function updateCoverLetterDataFromInput(inputElement, coverLetterData) {
	const clField = inputElement.dataset.clField;
	if (clField === 'paragraph') {
		const paragraphIndex = parseInt(inputElement.dataset.paragraphIndex, 10);
		coverLetterData.paragraphs[paragraphIndex] = inputElement.value;
	} else if (clField) {
		coverLetterData[clField] = inputElement.value;
	}
}