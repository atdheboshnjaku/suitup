import { generateUniqueId, sanitizeHtml, debounce, DATE_FORMATS, FONT_OPTIONS, getFontFamily, SPACING_PRESETS } from './utils.js';
import * as Store from './store.js';
import { getAddableSections, createDefaultSectionData, getSectionDefinition } from './sections.js';
import { renderResume, renderCoverLetter } from './renderer.js';
import { executeExport } from './exporter.js';
import { openCoverLetterEditor, closeCurrentCoverLetterEditor } from './coverLetter.js';

/* ---- Expose Store for coverLetter.js lazy access ---- */
window._suitUpStore = Store;

const subscribersByEvent = {};

export function subscribe(eventName, handlerFunction) {
	if (!subscribersByEvent[eventName]) subscribersByEvent[eventName] = [];
	subscribersByEvent[eventName].push(handlerFunction);
	return () => {
		subscribersByEvent[eventName] = subscribersByEvent[eventName].filter(
			subscriber => subscriber !== handlerFunction
		);
	};
}

export function publish(eventName, eventData) {
	if (!subscribersByEvent[eventName]) return;
	subscribersByEvent[eventName].forEach(handler => handler(eventData));
}

export function showNotification(message, durationMs = 3000) {
	const container = document.getElementById('notificationContainer');
	const toastElement = document.createElement('div');
	toastElement.className = 'notification-toast';
	toastElement.textContent = message;
	container.appendChild(toastElement);
	setTimeout(() => {
		if (toastElement.parentNode) toastElement.remove();
	}, durationMs);
}

let confirmResolveCallback = null;

function showConfirmDialog(title, message) {
	return new Promise((resolve) => {
		confirmResolveCallback = resolve;
		document.getElementById('confirmTitle').textContent = title;
		document.getElementById('confirmMessage').textContent = message;
		document.getElementById('confirmOverlay').classList.add('visible');
	});
}

document.getElementById('confirmOkButton').addEventListener('click', () => {
	document.getElementById('confirmOverlay').classList.remove('visible');
	if (confirmResolveCallback) confirmResolveCallback(true);
});

document.getElementById('confirmCancelButton').addEventListener('click', () => {
	document.getElementById('confirmOverlay').classList.remove('visible');
	if (confirmResolveCallback) confirmResolveCallback(false);
});

let currentlyEditingSectionElement = null;

function closeCurrentInlineEditor() {
	if (!currentlyEditingSectionElement) return;

	currentlyEditingSectionElement.classList.remove('editing');
	const editGroup = currentlyEditingSectionElement.querySelector('.inline-edit-group');
	if (editGroup) editGroup.remove();
	const controlsBar = currentlyEditingSectionElement.querySelector('.section-edit-controls');
	if (controlsBar) controlsBar.remove();
	const displayContent = currentlyEditingSectionElement.querySelector('.display-content');
	if (displayContent) displayContent.style.display = '';
	currentlyEditingSectionElement = null;
}

function openInlineEditor(sectionElement, profileData) {
	closeCurrentInlineEditor();
	closeCurrentCoverLetterEditor();

	const sectionType = sectionElement.dataset.sectionType;
	const sectionId = sectionElement.dataset.sectionId;

	const sectionData = sectionType === 'personalInfo'
		? profileData.sections.find(section => section.type === 'personalInfo')
		: profileData.sections.find(section => section.id === sectionId);

	if (!sectionData) return;

	currentlyEditingSectionElement = sectionElement;
	sectionElement.classList.add('editing');

	const displayContent = sectionElement.querySelector('.display-content');
	if (displayContent) displayContent.style.display = 'none';

	// Controls bar
	sectionElement.insertAdjacentHTML('afterbegin', buildControlsBar(sectionData));

	// Edit form
	const editGroupElement = document.createElement('div');
	editGroupElement.className = 'inline-edit-group';
	editGroupElement.style.display = 'block';
	editGroupElement.innerHTML = buildEditForm(sectionData);
	sectionElement.appendChild(editGroupElement);

	wireControlBarEvents(sectionElement, sectionData, profileData);
	wireFormInputEvents(editGroupElement, sectionData, profileData);
}

function buildControlsBar(sectionData) {
	const isPersonalInfo = sectionData.type === 'personalInfo';
	let controlsHtml = '<div class="section-edit-controls">';

	if (!isPersonalInfo) {
		controlsHtml += '<button class="section-edit-control-button" data-control-action="moveUp" title="Move Up">↑</button>';
		controlsHtml += '<button class="section-edit-control-button" data-control-action="moveDown" title="Move Down">↓</button>';
		controlsHtml += '<button class="section-edit-control-button" data-control-action="toggleVisibility" title="Hide Section">👁</button>';
		controlsHtml += '<button class="section-edit-control-button danger" data-control-action="deleteSection" title="Delete Section">✕ Remove</button>';
	}

	controlsHtml += '<button class="section-done-button" data-control-action="done">Done</button>';
	controlsHtml += '</div>';
	return controlsHtml;
}

function wireControlBarEvents(sectionElement, sectionData, profileData) {
	sectionElement.querySelectorAll('[data-control-action]').forEach(buttonElement => {
		buttonElement.addEventListener('click', (clickEvent) => {
			clickEvent.stopPropagation();
			const actionName = buttonElement.dataset.controlAction;

			switch (actionName) {
				case 'done':
					closeCurrentInlineEditor();
					refreshActiveView();
					break;

				case 'moveUp':
					moveSectionInProfile(profileData, sectionData.id, -1);
					saveCurrentProfile(profileData);
					closeCurrentInlineEditor();
					refreshActiveView();
					break;

				case 'moveDown':
					moveSectionInProfile(profileData, sectionData.id, 1);
					saveCurrentProfile(profileData);
					closeCurrentInlineEditor();
					refreshActiveView();
					break;

				case 'toggleVisibility':
					sectionData.visible = false;
					saveCurrentProfile(profileData);
					closeCurrentInlineEditor();
					refreshActiveView();
					showNotification('Section hidden. Add it back from the Add Section menu.');
					break;

				case 'deleteSection':
					profileData.sections = profileData.sections.filter(section => section.id !== sectionData.id);
					saveCurrentProfile(profileData);
					closeCurrentInlineEditor();
					refreshActiveView();
					showNotification('Section removed.');
					break;
			}
		});
	});
}

function moveSectionInProfile(profileData, sectionId, directionOffset) {
	const currentIndex = profileData.sections.findIndex(section => section.id === sectionId);
	if (currentIndex === -1) return;
	const newIndex = currentIndex + directionOffset;
	if (newIndex < 0 || newIndex >= profileData.sections.length) return;
	const [movedSection] = profileData.sections.splice(currentIndex, 1);
	profileData.sections.splice(newIndex, 0, movedSection);
}

function buildEditForm(sectionData) {
	switch (sectionData.type) {
		case 'personalInfo': return buildPersonalInfoForm(sectionData.data || {});
		case 'experience': return buildItemizedForm(sectionData, buildExperienceItemFields, 'Add Experience');
		case 'education': return buildItemizedForm(sectionData, buildEducationItemFields, 'Add Education');
		case 'skills': return buildSkillsForm(sectionData);
		case 'links': return buildLinksForm(sectionData);
		case 'projects': return buildItemizedForm(sectionData, buildProjectItemFields, 'Add Project');
		case 'certifications': return buildGenericItemForm(sectionData, certificationFields, 'Add Certification');
		case 'languages': return buildLanguagesForm(sectionData);
		case 'awards': return buildGenericItemForm(sectionData, awardFields, 'Add Award');
		case 'publications': return buildGenericItemForm(sectionData, publicationFields, 'Add Publication');
		case 'volunteer': return buildItemizedForm(sectionData, buildVolunteerItemFields, 'Add Volunteer Experience');
		case 'references': return buildGenericItemForm(sectionData, referenceFields, 'Add Reference');
		case 'custom': return buildCustomForm(sectionData);
		default: return '<p>Unknown section type</p>';
	}
}

function buildSectionLabelEditor(sectionData) {
	if (sectionData.type === 'personalInfo') return '';
	return `<div class="inline-field-row single" style="margin-bottom:1rem;">
    <div class="inline-field">
      <label>Section Title</label>
      <input type="text" data-field="sectionLabel" value="${sanitizeHtml(sectionData.label || '')}" placeholder="Section name" style="font-weight:600;">
    </div>
  </div>`;
}

function buildPersonalInfoForm(data) {
	return `
    <div class="inline-field-row">
      <div class="inline-field"><label>Full Name</label><input type="text" data-field="fullName" value="${sanitizeHtml(data.fullName || '')}" placeholder="John Doe"></div>
      <div class="inline-field"><label>Professional Title</label><input type="text" data-field="title" value="${sanitizeHtml(data.title || '')}" placeholder="Software Engineer"></div>
    </div>
    <div class="inline-field-row triple">
      <div class="inline-field"><label>Email</label><input type="email" data-field="email" value="${sanitizeHtml(data.email || '')}" placeholder="john@example.com"></div>
      <div class="inline-field"><label>Phone</label><input type="tel" data-field="phone" value="${sanitizeHtml(data.phone || '')}" placeholder="+1 (555) 123-4567"></div>
      <div class="inline-field"><label>Location</label><input type="text" data-field="location" value="${sanitizeHtml(data.location || '')}" placeholder="New York, NY"></div>
    </div>
    <div class="inline-field-row single">
      <div class="inline-field"><label>Photo URL</label><input type="url" data-field="photoUrl" value="${sanitizeHtml(data.photoUrl || '')}" placeholder="https://example.com/photo.jpg"></div>
    </div>
    <div class="inline-field-row single">
      <div class="inline-field"><label>Summary / Objective</label><textarea data-field="summary" rows="3" placeholder="Brief professional summary...">${sanitizeHtml(data.summary || '')}</textarea></div>
    </div>`;
}

/* ---- Itemized forms xperience, education, projects, volunteer ---- */
function buildItemizedForm(sectionData, itemFieldsBuilder, addLabel) {
	const items = sectionData.items || [];
	let formHtml = buildSectionLabelEditor(sectionData);

	for (const [itemIndex, itemData] of items.entries()) {
		const itemTitle = getItemDisplayTitle(sectionData.type, itemData, itemIndex);
		formHtml += `<div class="dynamic-item" data-item-index="${itemIndex}">`;
		formHtml += `<div class="dynamic-item-header"><div class="dynamic-item-title">${itemTitle}</div>`;
		formHtml += `<div class="dynamic-item-actions"><button class="dynamic-item-action delete" data-form-action="removeItem" data-item-index="${itemIndex}" title="Remove">✕</button></div></div>`;
		formHtml += itemFieldsBuilder(itemData, itemIndex);
		formHtml += '</div>';
	}

	formHtml += `<button class="add-item-button" data-form-action="addItem">+ ${addLabel}</button>`;
	return formHtml;
}

function getItemDisplayTitle(sectionType, itemData, itemIndex) {
	switch (sectionType) {
		case 'experience': return sanitizeHtml(itemData.jobTitle || itemData.company || `Entry ${itemIndex + 1}`);
		case 'education': return sanitizeHtml(itemData.degree || itemData.institution || `Entry ${itemIndex + 1}`);
		case 'projects': return sanitizeHtml(itemData.name || `Project ${itemIndex + 1}`);
		case 'volunteer': return sanitizeHtml(itemData.role || itemData.organization || `Entry ${itemIndex + 1}`);
		default: return `Entry ${itemIndex + 1}`;
	}
}

function buildExperienceItemFields(experienceItem, itemIndex) {
	let html = `
    <div class="inline-field-row">
      <div class="inline-field"><label>Job Title</label><input type="text" data-field="jobTitle" data-item-index="${itemIndex}" value="${sanitizeHtml(experienceItem.jobTitle || '')}" placeholder="Software Engineer"></div>
      <div class="inline-field"><label>Company</label><input type="text" data-field="company" data-item-index="${itemIndex}" value="${sanitizeHtml(experienceItem.company || '')}" placeholder="Acme Inc."></div>
    </div>
    <div class="inline-field-row triple">
      <div class="inline-field"><label>Location</label><input type="text" data-field="location" data-item-index="${itemIndex}" value="${sanitizeHtml(experienceItem.location || '')}" placeholder="Remote"></div>
      <div class="inline-field"><label>Start Date</label><input type="month" data-field="startDate" data-item-index="${itemIndex}" value="${experienceItem.startDate || ''}"></div>
      <div class="inline-field"><label>End Date</label><input type="month" data-field="endDate" data-item-index="${itemIndex}" value="${experienceItem.endDate || ''}" ${experienceItem.isCurrent ? 'disabled' : ''}></div>
    </div>
    <div class="inline-field-row single">
      <div class="inline-field" style="flex-direction:row;align-items:center;gap:0.5rem;">
        <input type="checkbox" data-field="isCurrent" data-item-index="${itemIndex}" ${experienceItem.isCurrent ? 'checked' : ''} style="width:auto;">
        <label style="text-transform:none;font-size:0.8rem;">I currently work here</label>
      </div>
    </div>`;

	html += buildBulletListEditor(experienceItem.bullets, itemIndex, 'Key Achievements / Responsibilities');
	return html;
}

function buildEducationItemFields(educationItem, itemIndex) {
	return `
    <div class="inline-field-row">
      <div class="inline-field"><label>Degree / Program</label><input type="text" data-field="degree" data-item-index="${itemIndex}" value="${sanitizeHtml(educationItem.degree || '')}" placeholder="B.S. Computer Science"></div>
      <div class="inline-field"><label>Institution</label><input type="text" data-field="institution" data-item-index="${itemIndex}" value="${sanitizeHtml(educationItem.institution || '')}" placeholder="MIT"></div>
    </div>
    <div class="inline-field-row triple">
      <div class="inline-field"><label>Location</label><input type="text" data-field="location" data-item-index="${itemIndex}" value="${sanitizeHtml(educationItem.location || '')}" placeholder="Cambridge, MA"></div>
      <div class="inline-field"><label>Start Date</label><input type="month" data-field="startDate" data-item-index="${itemIndex}" value="${educationItem.startDate || ''}"></div>
      <div class="inline-field"><label>End Date</label><input type="month" data-field="endDate" data-item-index="${itemIndex}" value="${educationItem.endDate || ''}"></div>
    </div>
    <div class="inline-field-row">
      <div class="inline-field"><label>GPA (optional)</label><input type="text" data-field="gpa" data-item-index="${itemIndex}" value="${sanitizeHtml(educationItem.gpa || '')}" placeholder="3.8/4.0"></div>
      <div class="inline-field"><label>Notes</label><input type="text" data-field="notes" data-item-index="${itemIndex}" value="${sanitizeHtml(educationItem.notes || '')}" placeholder="Magna Cum Laude"></div>
    </div>`;
}

function buildProjectItemFields(projectItem, itemIndex) {
	let html = `
    <div class="inline-field-row">
      <div class="inline-field"><label>Project Name</label><input type="text" data-field="name" data-item-index="${itemIndex}" value="${sanitizeHtml(projectItem.name || '')}" placeholder="Project name"></div>
      <div class="inline-field"><label>Tech Stack</label><input type="text" data-field="techStack" data-item-index="${itemIndex}" value="${sanitizeHtml(projectItem.techStack || '')}" placeholder="React, Node.js"></div>
    </div>
    <div class="inline-field-row single">
      <div class="inline-field"><label>URL</label><input type="url" data-field="url" data-item-index="${itemIndex}" value="${sanitizeHtml(projectItem.url || '')}" placeholder="https://..."></div>
    </div>
    <div class="inline-field-row single">
      <div class="inline-field"><label>Description</label><textarea data-field="description" data-item-index="${itemIndex}" rows="2" placeholder="Brief description...">${sanitizeHtml(projectItem.description || '')}</textarea></div>
    </div>`;

	html += buildBulletListEditor(projectItem.bullets, itemIndex, 'Highlights');
	return html;
}

function buildVolunteerItemFields(volunteerItem, itemIndex) {
	let html = `
    <div class="inline-field-row">
      <div class="inline-field"><label>Role</label><input type="text" data-field="role" data-item-index="${itemIndex}" value="${sanitizeHtml(volunteerItem.role || '')}" placeholder="Volunteer role"></div>
      <div class="inline-field"><label>Organization</label><input type="text" data-field="organization" data-item-index="${itemIndex}" value="${sanitizeHtml(volunteerItem.organization || '')}" placeholder="Organization name"></div>
    </div>
    <div class="inline-field-row">
      <div class="inline-field"><label>Start Date</label><input type="month" data-field="startDate" data-item-index="${itemIndex}" value="${volunteerItem.startDate || ''}"></div>
      <div class="inline-field"><label>End Date</label><input type="month" data-field="endDate" data-item-index="${itemIndex}" value="${volunteerItem.endDate || ''}"></div>
    </div>`;

	html += buildBulletListEditor(volunteerItem.bullets, itemIndex, 'Details');
	return html;
}

function buildBulletListEditor(bullets, itemIndex, labelText) {
	let html = `<div class="inline-field" style="margin-top:0.5rem;"><label>${labelText}</label>`;
	html += `<div class="bullet-list-editor" data-item-index="${itemIndex}">`;
	for (const [bulletIndex, bulletText] of (bullets || ['']).entries()) {
		html += `<div class="bullet-entry">
      <input type="text" data-field="bullet" data-item-index="${itemIndex}" data-bullet-index="${bulletIndex}" value="${sanitizeHtml(bulletText)}" placeholder="Describe an achievement...">
      <button class="remove-bullet" data-form-action="removeBullet" data-item-index="${itemIndex}" data-bullet-index="${bulletIndex}">✕</button>
    </div>`;
	}
	html += '</div>';
	html += `<button class="add-bullet-button" data-form-action="addBullet" data-item-index="${itemIndex}">+ Add bullet</button>`;
	html += '</div>';
	return html;
}


/* ---- Generic item form (certifications, awards, publications, references) ---- */

const certificationFields = [
	{ key: 'name', label: 'Certification Name', placeholder: 'AWS Solutions Architect' },
	{ key: 'issuer', label: 'Issuer', placeholder: 'Amazon Web Services' },
	{ key: 'date', label: 'Date', type: 'month' },
	{ key: 'url', label: 'URL', type: 'url', placeholder: 'https://...' },
];

const awardFields = [
	{ key: 'title', label: 'Award Title', placeholder: 'Best Paper Award' },
	{ key: 'issuer', label: 'Issuer', placeholder: 'ACM' },
	{ key: 'date', label: 'Date', type: 'month' },
	{ key: 'description', label: 'Description', placeholder: 'Brief description' },
];

const publicationFields = [
	{ key: 'title', label: 'Title', placeholder: 'Publication title' },
	{ key: 'publisher', label: 'Publisher', placeholder: 'IEEE' },
	{ key: 'date', label: 'Date', type: 'month' },
	{ key: 'url', label: 'URL', type: 'url', placeholder: 'https://...' },
	{ key: 'description', label: 'Description', placeholder: 'Brief description' },
];

const referenceFields = [
	{ key: 'name', label: 'Name', placeholder: 'Jane Smith' },
	{ key: 'title', label: 'Title', placeholder: 'VP of Engineering' },
	{ key: 'company', label: 'Company', placeholder: 'Acme Inc.' },
	{ key: 'contact', label: 'Contact', placeholder: 'jane@acme.com or Available upon request' },
];

function buildGenericItemForm(sectionData, fields, addLabel) {
	const items = sectionData.items || [];
	let formHtml = buildSectionLabelEditor(sectionData);

	for (const [itemIndex, itemData] of items.entries()) {
		formHtml += `<div class="dynamic-item" data-item-index="${itemIndex}">`;
		formHtml += `<div class="dynamic-item-header"><div class="dynamic-item-title">${sanitizeHtml(itemData[fields[0].key] || `Entry ${itemIndex + 1}`)}</div>`;
		formHtml += `<div class="dynamic-item-actions"><button class="dynamic-item-action delete" data-form-action="removeItem" data-item-index="${itemIndex}">✕</button></div></div>`;

		// Pair fields into rows of 2
		for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 2) {
			const fieldPair = fields.slice(fieldIndex, fieldIndex + 2);
			const gridClass = fieldPair.length === 1 ? 'single' : '';
			formHtml += `<div class="inline-field-row ${gridClass}">`;
			for (const field of fieldPair) {
				const inputType = field.type || 'text';
				formHtml += `<div class="inline-field"><label>${field.label}</label><input type="${inputType}" data-field="${field.key}" data-item-index="${itemIndex}" value="${sanitizeHtml(itemData[field.key] || '')}" placeholder="${field.placeholder || ''}"></div>`;
			}
			formHtml += '</div>';
		}

		formHtml += '</div>';
	}

	formHtml += `<button class="add-item-button" data-form-action="addItem">+ ${addLabel}</button>`;
	return formHtml;
}

/* ---- Skills form ---- */
function buildSkillsForm(sectionData) {
	const groups = sectionData.groups || [];
	let formHtml = buildSectionLabelEditor(sectionData);

	for (const [groupIndex, skillGroup] of groups.entries()) {
		formHtml += `<div class="skill-group dynamic-item" data-group-index="${groupIndex}">`;
		formHtml += '<div class="skill-group-header">';
		formHtml += `<input type="text" data-field="groupLabel" data-group-index="${groupIndex}" value="${sanitizeHtml(skillGroup.label || '')}" placeholder="Group name (e.g., Languages)">`;
		formHtml += `<button class="dynamic-item-action delete" data-form-action="removeGroup" data-group-index="${groupIndex}" title="Remove group">✕</button>`;
		formHtml += '</div>';

		formHtml += `<div class="skill-tags-editor" data-group-index="${groupIndex}">`;
		for (const [skillIndex, skillText] of (skillGroup.skills || ['']).entries()) {
			formHtml += `<div style="display:flex;align-items:center;gap:2px;">
        <input class="skill-tag-input" type="text" data-field="skill" data-group-index="${groupIndex}" data-skill-index="${skillIndex}" value="${sanitizeHtml(skillText)}" placeholder="Skill">
        <button class="remove-skill-tag" data-form-action="removeSkill" data-group-index="${groupIndex}" data-skill-index="${skillIndex}">✕</button>
      </div>`;
		}
		formHtml += '</div>';
		formHtml += `<button class="add-bullet-button" data-form-action="addSkill" data-group-index="${groupIndex}">+ Add skill</button>`;
		formHtml += '</div>';
	}

	formHtml += '<button class="add-item-button" data-form-action="addGroup">+ Add Skill Group</button>';
	return formHtml;
}

/* ---- Links form ---- */
function buildLinksForm(sectionData) {
	const items = sectionData.items || [];
	let formHtml = buildSectionLabelEditor(sectionData);

	for (const [itemIndex, linkItem] of items.entries()) {
		formHtml += `<div class="link-entry">
      <input type="text" data-field="label" data-item-index="${itemIndex}" value="${sanitizeHtml(linkItem.label || '')}" placeholder="Label (GitHub, LinkedIn...)">
      <input type="url" data-field="url" data-item-index="${itemIndex}" value="${sanitizeHtml(linkItem.url || '')}" placeholder="https://...">
      <button class="dynamic-item-action delete" data-form-action="removeItem" data-item-index="${itemIndex}">✕</button>
    </div>`;
	}

	formHtml += '<button class="add-item-button" data-form-action="addItem">+ Add Link</button>';
	return formHtml;
}


/* ---- Custom section form ---- */
function buildCustomForm(sectionData) {
	const items = sectionData.items || [];
	let formHtml = buildSectionLabelEditor(sectionData);

	for (const [itemIndex, customItem] of items.entries()) {
		formHtml += `<div class="dynamic-item" data-item-index="${itemIndex}">
      <div class="dynamic-item-header"><div class="dynamic-item-title">Entry ${itemIndex + 1}</div>
      <div class="dynamic-item-actions"><button class="dynamic-item-action delete" data-form-action="removeItem" data-item-index="${itemIndex}">✕</button></div></div>
      <div class="inline-field-row single"><div class="inline-field"><label>Content</label><textarea data-field="content" data-item-index="${itemIndex}" rows="2" placeholder="Custom content...">${sanitizeHtml(customItem.content || '')}</textarea></div></div>
    </div>`;
	}

	formHtml += '<button class="add-item-button" data-form-action="addItem">+ Add Entry</button>';
	return formHtml;
}


/* ---- Languages form ---- */
function buildLanguagesForm(sectionData) {
	const items = sectionData.items || [];
	let formHtml = buildSectionLabelEditor(sectionData);

	for (const [itemIndex, languageItem] of items.entries()) {
		formHtml += `<div class="dynamic-item" data-item-index="${itemIndex}" style="padding:0.75rem;">
      <div class="inline-field-row">
        <div class="inline-field"><label>Language</label><input type="text" data-field="language" data-item-index="${itemIndex}" value="${sanitizeHtml(languageItem.language || '')}" placeholder="English"></div>
        <div class="inline-field"><label>Proficiency</label><select data-field="proficiency" data-item-index="${itemIndex}">
          ${['Native', 'Fluent', 'Advanced', 'Intermediate', 'Basic'].map(level =>
			`<option value="${level}" ${languageItem.proficiency === level ? 'selected' : ''}>${level}</option>`
		).join('')}
        </select></div>
        <div style="display:flex;align-items:end;"><button class="dynamic-item-action delete" data-form-action="removeItem" data-item-index="${itemIndex}">✕</button></div>
      </div>
    </div>`;
	}

	formHtml += '<button class="add-item-button" data-form-action="addItem">+ Add Language</button>';
	return formHtml;
}

function wireFormInputEvents(editGroupElement, sectionData, profileData) {
	const debouncedSave = debounce(() => saveCurrentProfile(profileData), 300);

	// Text inputs, textareas, selects
	editGroupElement.querySelectorAll('input, textarea, select').forEach(inputElement => {
		const handler = () => {
			updateSectionDataFromInput(inputElement, sectionData);
			debouncedSave();
		};
		inputElement.addEventListener('input', handler);
		inputElement.addEventListener('change', handler);
	});

	// Action buttons add/remove items, bullets, groups, skills
	editGroupElement.querySelectorAll('[data-form-action]').forEach(buttonElement => {
		buttonElement.addEventListener('click', (clickEvent) => {
			clickEvent.stopPropagation();
			handleFormAction(buttonElement, sectionData, profileData);
		});
	});
}

function updateSectionDataFromInput(inputElement, sectionData) {
	const fieldName = inputElement.dataset.field;
	const itemIndex = inputElement.dataset.itemIndex !== undefined ? parseInt(inputElement.dataset.itemIndex, 10) : null;
	const bulletIndex = inputElement.dataset.bulletIndex !== undefined ? parseInt(inputElement.dataset.bulletIndex, 10) : null;
	const groupIndex = inputElement.dataset.groupIndex !== undefined ? parseInt(inputElement.dataset.groupIndex, 10) : null;
	const skillIndex = inputElement.dataset.skillIndex !== undefined ? parseInt(inputElement.dataset.skillIndex, 10) : null;

	if (fieldName === 'sectionLabel') {
		sectionData.label = inputElement.value;
		return;
	}

	if (sectionData.type === 'personalInfo') {
		if (!sectionData.data) sectionData.data = {};
		sectionData.data[fieldName] = inputElement.value;
		return;
	}

	if (fieldName === 'groupLabel' && groupIndex !== null) {
		sectionData.groups[groupIndex].label = inputElement.value;
		return;
	}

	if (fieldName === 'skill' && groupIndex !== null && skillIndex !== null) {
		sectionData.groups[groupIndex].skills[skillIndex] = inputElement.value;
		return;
	}

	if (fieldName === 'bullet' && itemIndex !== null && bulletIndex !== null) {
		sectionData.items[itemIndex].bullets[bulletIndex] = inputElement.value;
		return;
	}

	if (itemIndex !== null && sectionData.items && sectionData.items[itemIndex]) {
		if (fieldName === 'isCurrent') {
			sectionData.items[itemIndex].isCurrent = inputElement.checked;
			const endDateInput = inputElement.closest('.dynamic-item')?.querySelector('[data-field="endDate"]');
			if (endDateInput) endDateInput.disabled = inputElement.checked;
		} else {
			sectionData.items[itemIndex][fieldName] = inputElement.value;
		}
	}
}

function handleFormAction(buttonElement, sectionData, profileData) {
	const actionName = buttonElement.dataset.formAction;
	const itemIndex = buttonElement.dataset.itemIndex !== undefined ? parseInt(buttonElement.dataset.itemIndex, 10) : null;

	switch (actionName) {
		case 'addItem':
			addItemToSection(sectionData);
			break;
		case 'removeItem':
			if (sectionData.items && sectionData.items.length > 1) {
				sectionData.items.splice(itemIndex, 1);
			}
			break;
		case 'addBullet':
			if (sectionData.items && sectionData.items[itemIndex]) {
				if (!sectionData.items[itemIndex].bullets) sectionData.items[itemIndex].bullets = [];
				sectionData.items[itemIndex].bullets.push('');
			}
			break;
		case 'removeBullet': {
			const bulletIndex = parseInt(buttonElement.dataset.bulletIndex, 10);
			if (sectionData.items?.[itemIndex]?.bullets?.length > 1) {
				sectionData.items[itemIndex].bullets.splice(bulletIndex, 1);
			}
			break;
		}
		case 'addGroup':
			if (!sectionData.groups) sectionData.groups = [];
			sectionData.groups.push({ id: generateUniqueId(), label: '', skills: [''] });
			break;
		case 'removeGroup': {
			const groupIndex = parseInt(buttonElement.dataset.groupIndex, 10);
			if (sectionData.groups?.length > 1) {
				sectionData.groups.splice(groupIndex, 1);
			}
			break;
		}
		case 'addSkill': {
			const groupIdx = parseInt(buttonElement.dataset.groupIndex, 10);
			if (sectionData.groups?.[groupIdx]) {
				sectionData.groups[groupIdx].skills.push('');
			}
			break;
		}
		case 'removeSkill': {
			const grpIdx = parseInt(buttonElement.dataset.groupIndex, 10);
			const sklIdx = parseInt(buttonElement.dataset.skillIndex, 10);
			if (sectionData.groups?.[grpIdx]?.skills?.length > 1) {
				sectionData.groups[grpIdx].skills.splice(sklIdx, 1);
			}
			break;
		}
	}

	saveCurrentProfile(profileData);
	reopenEditorOnSection(sectionData, profileData.id);
}

function addItemToSection(sectionData) {
	if (!sectionData.items) sectionData.items = [];
	const definition = getSectionDefinition(sectionData.type);
	if (definition?.defaultData?.items) {
		const newItem = JSON.parse(JSON.stringify(definition.defaultData.items[0]));
		newItem.id = generateUniqueId();
		sectionData.items.push(newItem);
	} else {
		sectionData.items.push({ id: generateUniqueId() });
	}
}

function reopenEditorOnSection(sectionData, profileId) {
	closeCurrentInlineEditor();
	refreshActiveView();

	setTimeout(() => {
		const sectionSelector = sectionData.type === 'personalInfo'
			? '[data-section-type="personalInfo"]'
			: `[data-section-id="${sectionData.id}"]`;
		const newSectionElement = document.querySelector(sectionSelector);
		if (newSectionElement) {
			const freshProfile = Store.getProfile(profileId);
			openInlineEditor(newSectionElement, freshProfile);
		}
	}, 50);
}

let currentProfileId = null;

const COLOR_PRESETS = [
	{ primary: '#d4603e', accent: '#eda08a', label: 'Rust' },
	{ primary: '#2563eb', accent: '#93c5fd', label: 'Blue' },
	{ primary: '#059669', accent: '#6ee7b7', label: 'Emerald' },
	{ primary: '#7c3aed', accent: '#c4b5fd', label: 'Violet' },
	{ primary: '#dc2626', accent: '#fca5a5', label: 'Red' },
	{ primary: '#0891b2', accent: '#67e8f9', label: 'Cyan' },
	{ primary: '#292524', accent: '#a8a29e', label: 'Charcoal' },
	{ primary: '#92400e', accent: '#fbbf24', label: 'Amber' },
];

export function saveCurrentProfile(profileData) {
	Store.updateProfile(profileData.id, profileData);
}

export function refreshActiveView() {
	const profileId = Store.getActiveProfileId();
	if (!profileId) return;

	const profileData = Store.getProfile(profileId);
	if (!profileData) return;

	const resumeWrapper = document.getElementById('resumeCanvasWrapper');
	const coverLetterWrapper = document.getElementById('coverLetterCanvasWrapper');

	if (resumeWrapper.style.display !== 'none') {
		renderResume(profileData, document.getElementById('resumeCanvas'));
		attachSectionClickHandlers(profileData);
	}

	if (coverLetterWrapper.style.display !== 'none') {
		renderCoverLetter(profileData, document.getElementById('coverLetterCanvas'));
		attachCoverLetterClickHandlers(profileData);
	}
}

function attachSectionClickHandlers(profileData) {
	const sectionElements = document.getElementById('resumeCanvas').querySelectorAll('.cv-section');
	for (const sectionElement of sectionElements) {
		sectionElement.addEventListener('click', (clickEvent) => {
			if (sectionElement.classList.contains('editing')) return;
			clickEvent.stopPropagation();
			openInlineEditor(sectionElement, profileData);
		});
	}
}

function attachCoverLetterClickHandlers(profileData) {
	const coverLetterSections = document.getElementById('coverLetterCanvas').querySelectorAll('.cover-letter-section');
	for (const sectionElement of coverLetterSections) {
		sectionElement.addEventListener('click', (clickEvent) => {
			if (sectionElement.classList.contains('editing')) return;
			clickEvent.stopPropagation();
			openCoverLetterEditor(sectionElement, profileData);
		});
	}
}


/* ---- Dashboard ---- */
function renderDashboard() {
	const profilesGrid = document.getElementById('profilesGrid');
	const allProfiles = Store.getAllProfiles();

	// Remove old profile cards
	profilesGrid.querySelectorAll('.profile-card').forEach(card => card.remove());

	const createCard = document.getElementById('createProfileCard');

	for (const [profileId, profileData] of Object.entries(allProfiles)) {
		const cardElement = document.createElement('div');
		cardElement.className = 'profile-card';
		cardElement.dataset.profileId = profileId;

		const lastEdited = new Date(profileData.updatedAt).toLocaleDateString(undefined, {
			month: 'short', day: 'numeric', year: 'numeric',
		});

		cardElement.innerHTML = `
      <div class="profile-card-actions">
        <button class="profile-card-action-button" data-card-action="duplicate" title="Duplicate">⎘</button>
        <button class="profile-card-action-button delete" data-card-action="delete" title="Delete">✕</button>
      </div>
      <div class="profile-card-name">${sanitizeHtml(profileData.name)}</div>
      <div class="profile-card-meta">Last edited: ${lastEdited}</div>
      <span class="profile-card-template">${profileData.templateId || 'classic'}</span>`;

		cardElement.addEventListener('click', (clickEvent) => {
			if (clickEvent.target.closest('[data-card-action]')) return;
			openProfile(profileId);
		});

		cardElement.querySelector('[data-card-action="duplicate"]').addEventListener('click', (clickEvent) => {
			clickEvent.stopPropagation();
			Store.duplicateProfile(profileId);
			renderDashboard();
			updateStorageIndicator();
			showNotification('Profile duplicated!');
		});

		cardElement.querySelector('[data-card-action="delete"]').addEventListener('click', async (clickEvent) => {
			clickEvent.stopPropagation();
			const confirmed = await showConfirmDialog('Delete Profile', `Are you sure you want to delete "${profileData.name}"? This cannot be undone.`);
			if (confirmed) {
				Store.deleteProfile(profileId);
				renderDashboard();
				updateStorageIndicator();
				showNotification('Profile deleted.');
			}
		});

		profilesGrid.insertBefore(cardElement, createCard);
	}

	updateStorageIndicator();
}

function openProfile(profileId) {
	currentProfileId = profileId;
	Store.setActiveProfile(profileId);

	const profileData = Store.getProfile(profileId);
	if (!profileData) return;

	document.getElementById('dashboardView').classList.add('hidden');
	document.getElementById('editorView').classList.add('active');
	document.getElementById('editorProfileName').value = profileData.name;

	switchToResumeTab();
}

function switchToResumeTab() {
	document.getElementById('tabResume').classList.add('active');
	document.getElementById('tabCoverLetter').classList.remove('active');
	document.getElementById('resumeCanvasWrapper').style.display = '';
	document.getElementById('coverLetterCanvasWrapper').style.display = 'none';
	refreshActiveView();
}

function switchToCoverLetterTab() {
	document.getElementById('tabCoverLetter').classList.add('active');
	document.getElementById('tabResume').classList.remove('active');
	document.getElementById('coverLetterCanvasWrapper').style.display = '';
	document.getElementById('resumeCanvasWrapper').style.display = 'none';
	refreshActiveView();
}

function backToDashboard() {
	closeCurrentInlineEditor();
	closeCurrentCoverLetterEditor();
	currentProfileId = null;
	document.getElementById('editorView').classList.remove('active');
	document.getElementById('dashboardView').classList.remove('hidden');
	renderDashboard();
}

function updateStorageIndicator() {
	document.getElementById('storageLabel').textContent = `Storage: ${Store.getStorageUsageFormatted()} / 5 MB`;
	const usagePercentage = Store.getStoragePercentage();
	const fillElement = document.getElementById('storageBarFill');
	fillElement.style.width = `${Math.min(usagePercentage, 100)}%`;
	fillElement.classList.remove('warning', 'danger');
	if (usagePercentage > 80) fillElement.classList.add('danger');
	else if (usagePercentage > 60) fillElement.classList.add('warning');
}


/* ---- Template Picker ---- */
function openTemplatePicker() {
	const profileData = Store.getProfile(currentProfileId);
	if (!profileData) return;

	document.querySelectorAll('.template-option').forEach(option => {
		option.classList.toggle('selected', option.dataset.template === profileData.templateId);
	});

	// Color presets
	const presetsContainer = document.getElementById('colorPresets');
	presetsContainer.innerHTML = '';
	for (const preset of COLOR_PRESETS) {
		const presetElement = document.createElement('div');
		presetElement.className = 'color-preset';
		presetElement.style.background = preset.primary;
		presetElement.title = preset.label;
		if (profileData.colorScheme.primary === preset.primary) presetElement.classList.add('selected');

		presetElement.addEventListener('click', () => {
			presetsContainer.querySelectorAll('.color-preset').forEach(presetEl => presetEl.classList.remove('selected'));
			presetElement.classList.add('selected');
			document.getElementById('customPrimaryColor').value = preset.primary;
			document.getElementById('customAccentColor').value = preset.accent;
		});
		presetsContainer.appendChild(presetElement);
	}

	document.getElementById('customPrimaryColor').value = profileData.colorScheme.primary;
	document.getElementById('customAccentColor').value = profileData.colorScheme.accent;

	// Date format options
	const dateFormatContainer = document.getElementById('dateFormatOptions');
	dateFormatContainer.innerHTML = '';
	for (const format of DATE_FORMATS) {
		const formatElement = document.createElement('div');
		formatElement.className = 'date-format-option';
		if (profileData.dateFormat === format.id) formatElement.classList.add('selected');
		formatElement.textContent = `${format.label} (${format.example})`;
		formatElement.dataset.formatId = format.id;
		formatElement.addEventListener('click', () => {
			dateFormatContainer.querySelectorAll('.date-format-option').forEach(option => option.classList.remove('selected'));
			formatElement.classList.add('selected');
		});
		dateFormatContainer.appendChild(formatElement);
	}

	document.getElementById('templatePickerOverlay').classList.add('visible');

	// Typography controls
	const typography = profileData.typography || { headingFont: 'playfair-display', bodyFont: 'dm-sans', fontSize: 10, spacing: 'default' };

	const headingSelect = document.getElementById('fontHeadingSelect');
	const bodySelect = document.getElementById('fontBodySelect');

	// Populate font selects if empty (first open)
	if (headingSelect.options.length === 0) {
		for (const fontOption of FONT_OPTIONS) {
			const headingOption = document.createElement('option');
			headingOption.value = fontOption.id;
			headingOption.textContent = fontOption.label;
			headingOption.style.fontFamily = fontOption.family;
			headingSelect.appendChild(headingOption);

			const bodyOption = document.createElement('option');
			bodyOption.value = fontOption.id;
			bodyOption.textContent = fontOption.label;
			bodyOption.style.fontFamily = fontOption.family;
			bodySelect.appendChild(bodyOption);
		}
	}

	headingSelect.value = typography.headingFont;
	bodySelect.value = typography.bodyFont;

	// Font size slider
	const fontSizeSlider = document.getElementById('fontSizeSlider');
	const fontSizeLabel = document.getElementById('fontSizeLabel');
	fontSizeSlider.value = typography.fontSize;
	fontSizeLabel.textContent = `${typography.fontSize}pt`;

	// Spacing options
	document.querySelectorAll('.spacing-option').forEach(option => {
		option.classList.toggle('selected', option.dataset.spacing === typography.spacing);
	});
}

function closeTemplatePicker() {
	document.getElementById('templatePickerOverlay').classList.remove('visible');
}

function applyTemplateSettings() {
	const selectedTemplate = document.querySelector('.template-option.selected');
	const selectedDateFormat = document.querySelector('.date-format-option.selected');
	const selectedSpacing = document.querySelector('.spacing-option.selected');

	Store.updateProfile(currentProfileId, {
		templateId: selectedTemplate ? selectedTemplate.dataset.template : 'classic',
		colorScheme: {
			primary: document.getElementById('customPrimaryColor').value,
			accent: document.getElementById('customAccentColor').value,
		},
		dateFormat: selectedDateFormat ? selectedDateFormat.dataset.formatId : 'mon-yyyy',
		typography: {
			headingFont: document.getElementById('fontHeadingSelect').value,
			bodyFont: document.getElementById('fontBodySelect').value,
			fontSize: parseFloat(document.getElementById('fontSizeSlider').value),
			spacing: selectedSpacing ? selectedSpacing.dataset.spacing : 'default',
		},
	});

	closeTemplatePicker();
	refreshActiveView();
	showNotification('Template settings applied!');
}


/* ---- Add Section Panel ---- */
function toggleAddSectionPanel() {
	const panel = document.getElementById('addSectionPanel');
	if (panel.classList.contains('visible')) {
		panel.classList.remove('visible');
		return;
	}

	const profileData = Store.getProfile(currentProfileId);
	if (!profileData) return;

	const optionsContainer = document.getElementById('addSectionOptions');
	optionsContainer.innerHTML = '';

	// First show hidden sections that can be restored with their data intact
	const hiddenSections = profileData.sections.filter(section => !section.visible);
	for (const hiddenSection of hiddenSections) {
		const unhideButton = document.createElement('button');
		unhideButton.className = 'add-section-option';
		unhideButton.textContent = `👁 Show "${hiddenSection.label}"`;
		unhideButton.style.borderColor = 'var(--app-accent)';
		unhideButton.style.color = 'var(--app-accent)';
		unhideButton.addEventListener('click', () => {
			hiddenSection.visible = true;
			Store.updateProfile(currentProfileId, { sections: profileData.sections });
			refreshActiveView();
			panel.classList.remove('visible');
			showNotification(`${hiddenSection.label} restored.`);
		});
		optionsContainer.appendChild(unhideButton);
	}

	// Second: show new sections that can be added excluding types already present, visible or not
	const existingSectionTypes = profileData.sections.map(section => section.type);
	const addableSections = getAddableSections(existingSectionTypes);

	for (const sectionOption of addableSections) {
		const optionButton = document.createElement('button');
		optionButton.className = 'add-section-option';
		optionButton.textContent = sectionOption.label;
		optionButton.addEventListener('click', () => {
			addSectionToProfile(sectionOption.type, sectionOption.label);
			panel.classList.remove('visible');
		});
		optionsContainer.appendChild(optionButton);
	}

	panel.classList.add('visible');
}

function addSectionToProfile(sectionType, sectionLabel) {
	const profileData = Store.getProfile(currentProfileId);
	if (!profileData) return;

	const defaultData = createDefaultSectionData(sectionType);
	const newSection = {
		id: generateUniqueId(),
		type: sectionType,
		label: sectionLabel,
		visible: true,
		...defaultData,
	};

	// Assign IDs to sub-items
	if (newSection.items) {
		for (const item of newSection.items) {
			if (!item.id) item.id = generateUniqueId();
		}
	}
	if (newSection.groups) {
		for (const group of newSection.groups) {
			if (!group.id) group.id = generateUniqueId();
		}
	}

	profileData.sections.push(newSection);
	Store.updateProfile(currentProfileId, { sections: profileData.sections });
	refreshActiveView();
	showNotification(`${sectionLabel} section added!`);
}

function handleJsonImport(changeEvent) {
	const file = changeEvent.target.files[0];
	if (!file) return;

	const fileReader = new FileReader();
	fileReader.onload = (loadEvent) => {
		try {
			const importedData = JSON.parse(loadEvent.target.result);
			Store.importProfileFromJson(importedData);
			renderDashboard();
			updateStorageIndicator();
			showNotification('Profile imported successfully!');
		} catch (parseError) {
			showNotification('Invalid JSON file.');
		}
	};
	fileReader.readAsText(file);
	changeEvent.target.value = '';
}

function bindAllEvents() {
	// Create profile
	document.getElementById('createProfileCard').addEventListener('click', () => {
		const newProfileId = Store.createProfile('Untitled Resume', 'classic');
		openProfile(newProfileId);
		showNotification('New profile created!');
	});

	// Import profile from JSON
	document.getElementById('importProfileCard').addEventListener('click', () => {
		document.getElementById('jsonImportInput').click();
	});

	// Navigation
	document.getElementById('backToDashboard').addEventListener('click', backToDashboard);

	// Profile name editing
	const profileNameInput = document.getElementById('editorProfileName');
	profileNameInput.addEventListener('input', debounce(() => {
		if (!currentProfileId) return;
		Store.updateProfile(currentProfileId, { name: profileNameInput.value });
	}, 400));

	// Tab switching
	document.getElementById('tabResume').addEventListener('click', switchToResumeTab);
	document.getElementById('tabCoverLetter').addEventListener('click', switchToCoverLetterTab);

	// Ghost bar
	document.getElementById('ghostBarTemplate').addEventListener('click', openTemplatePicker);
	document.getElementById('ghostBarAddSection').addEventListener('click', toggleAddSectionPanel);
	document.getElementById('ghostBarExport').addEventListener('click', () => {
		document.getElementById('exportOverlay').classList.add('visible');
	});
	document.getElementById('ghostBarPrint').addEventListener('click', () => window.print());

	// Export buttons
	document.getElementById('exportPdf').addEventListener('click', () => {
		executeExport('pdf', Store.getProfile(currentProfileId));
		document.getElementById('exportOverlay').classList.remove('visible');
	});
	document.getElementById('exportHtml').addEventListener('click', () => {
		executeExport('html', Store.getProfile(currentProfileId));
		document.getElementById('exportOverlay').classList.remove('visible');
	});
	document.getElementById('exportJson').addEventListener('click', () => {
		executeExport('json', Store.getProfile(currentProfileId));
		document.getElementById('exportOverlay').classList.remove('visible');
	});
	document.getElementById('exportClose').addEventListener('click', () => {
		document.getElementById('exportOverlay').classList.remove('visible');
	});

	// Template picker
	document.getElementById('templatePickerCancel').addEventListener('click', closeTemplatePicker);
	document.getElementById('templatePickerApply').addEventListener('click', applyTemplateSettings);

	document.getElementById('templateOptions').addEventListener('click', (clickEvent) => {
		const optionElement = clickEvent.target.closest('.template-option');
		if (!optionElement) return;
		document.querySelectorAll('.template-option').forEach(option => option.classList.remove('selected'));
		optionElement.classList.add('selected');
	});

	// Custom color deselects presets
	document.getElementById('customPrimaryColor').addEventListener('input', () => {
		document.querySelectorAll('.color-preset').forEach(preset => preset.classList.remove('selected'));
	});

	// Font size slider live label
	document.getElementById('fontSizeSlider').addEventListener('input', () => {
		document.getElementById('fontSizeLabel').textContent = `${document.getElementById('fontSizeSlider').value}pt`;
	});

	// Spacing option selection
	document.getElementById('spacingOptions').addEventListener('click', (clickEvent) => {
		const optionElement = clickEvent.target.closest('.spacing-option');
		if (!optionElement) return;
		document.querySelectorAll('.spacing-option').forEach(option => option.classList.remove('selected'));
		optionElement.classList.add('selected');
	});

	// JSON import
	document.getElementById('jsonImportInput').addEventListener('change', handleJsonImport);

	// Close overlays on backdrop click
	document.getElementById('exportOverlay').addEventListener('click', (clickEvent) => {
		if (clickEvent.target.id === 'exportOverlay') {
			document.getElementById('exportOverlay').classList.remove('visible');
		}
	});
	document.getElementById('templatePickerOverlay').addEventListener('click', (clickEvent) => {
		if (clickEvent.target.id === 'templatePickerOverlay') closeTemplatePicker();
	});

	// Close inline editors when clicking outside
	document.addEventListener('click', (clickEvent) => {
		const isInsideSection = clickEvent.target.closest('.cv-section');
		const isInsideCoverLetterSection = clickEvent.target.closest('.cover-letter-section');
		const isInsideGhostBar = clickEvent.target.closest('.ghost-bar');

		if (!isInsideSection && !isInsideCoverLetterSection && !isInsideGhostBar) {
			closeCurrentInlineEditor();
			closeCurrentCoverLetterEditor();
			if (currentProfileId) refreshActiveView();
		}
	});
}

document.addEventListener('DOMContentLoaded', () => {
	// Wire store callbacks (avoids circular dependency)
	Store.setStoreCallbacks({
		onError: (errorMessage) => showNotification(errorMessage),
	});

	// Load template CSS files dynamically
	const templateStylesheets = [
		'css/templates/template-classic.css',
		'css/templates/template-modern.css',
		'css/templates/template-minimal.css',
	];

	for (const stylesheetPath of templateStylesheets) {
		const linkElement = document.createElement('link');
		linkElement.rel = 'stylesheet';
		linkElement.href = stylesheetPath;
		document.head.appendChild(linkElement);
	}

	bindAllEvents();
	renderDashboard();
	updateStorageIndicator();
});