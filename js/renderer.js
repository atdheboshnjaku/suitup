/* ============================================================
   renderer.js — Reads profile data, produces rendered HTML
   into the chosen template. Also renders cover letters.
   ============================================================ */
import { sanitizeHtml, formatDate, formatDateRange, hexToRgba, getFontFamily, SPACING_PRESETS } from './utils.js';

export function renderResume(profileData, containerElement) {
	const templateId = profileData.templateId || 'classic';
	const dateFormat = profileData.dateFormat || 'mon-yyyy';
	const colorScheme = profileData.colorScheme || { primary: '#d4603e', accent: '#eda08a' };
	const typography = profileData.typography || { headingFont: 'playfair-display', bodyFont: 'dm-sans', fontSize: 10, spacing: 'default' };

	applyColorProperties(containerElement, colorScheme);
	applyTypographyProperties(containerElement, typography);

	let htmlOutput = '';

	switch (templateId) {
		case 'modern':
			htmlOutput = buildModernTemplate(profileData, dateFormat);
			break;
		case 'minimal':
			htmlOutput = buildMinimalTemplate(profileData, dateFormat);
			break;
		default:
			htmlOutput = buildClassicTemplate(profileData, dateFormat);
	}

	containerElement.className = `resume-canvas template-${templateId}`;
	containerElement.innerHTML = htmlOutput;

	autoScaleToFitPages(containerElement, typography.fontSize);
	addPageOverflowIndicator(containerElement);
}

export function renderCoverLetter(profileData, containerElement) {
	const coverLetterData = profileData.coverLetter || {};
	const personalInfo = getPersonalInfo(profileData);
	const colorScheme = profileData.colorScheme || { primary: '#d4603e', accent: '#eda08a' };

	applyColorProperties(containerElement, colorScheme);

	let coverLetterHtml = '<div class="cover-letter-canvas">';
	coverLetterHtml += buildCoverLetterRecipient(coverLetterData);
	coverLetterHtml += buildCoverLetterDate(coverLetterData);
	coverLetterHtml += buildCoverLetterSubject(coverLetterData);
	coverLetterHtml += buildCoverLetterSalutation(coverLetterData);
	coverLetterHtml += buildCoverLetterBody(coverLetterData);
	coverLetterHtml += buildCoverLetterSignoff(coverLetterData, personalInfo);
	coverLetterHtml += '</div>';

	containerElement.className = 'resume-canvas';
	containerElement.innerHTML = coverLetterHtml;
}

function applyColorProperties(containerElement, colorScheme) {
	containerElement.style.setProperty('--cv-primary', colorScheme.primary);
	containerElement.style.setProperty('--cv-accent', colorScheme.accent);
	containerElement.style.setProperty('--cv-bg-secondary', hexToRgba(colorScheme.primary, 0.04));
}

function applyTypographyProperties(containerElement, typography) {
	const headingFamily = getFontFamily(typography.headingFont || 'playfair-display');
	const bodyFamily = getFontFamily(typography.bodyFont || 'dm-sans');
	const baseFontSize = typography.fontSize || 10;
	const spacingPreset = SPACING_PRESETS[typography.spacing] || SPACING_PRESETS['default'];

	containerElement.style.setProperty('--cv-font-heading', headingFamily);
	containerElement.style.setProperty('--cv-font-body', bodyFamily);
	containerElement.style.setProperty('--cv-font-size-base', `${baseFontSize}pt`);
	containerElement.style.setProperty('--cv-line-height', spacingPreset.lineHeight);
	containerElement.style.setProperty('--cv-section-margin-top', spacingPreset.sectionMarginTop);
	containerElement.style.setProperty('--cv-section-margin-bottom', spacingPreset.sectionMarginBottom);
	containerElement.style.setProperty('--cv-item-margin-bottom', spacingPreset.itemMarginBottom);
	containerElement.style.setProperty('--cv-header-padding-bottom', spacingPreset.headerPaddingBottom);
	containerElement.style.setProperty('--cv-header-margin-bottom', spacingPreset.headerMarginBottom);
}

/**
 * Auto scales font size down if content slightly overflows a page boundary.
 * If overflow is less than ~18% of a page, scale down incrementally.
 * Floor is 8pt to keep readability. Restores user's chosen size if content fits.
 */
function autoScaleToFitPages(containerElement, userFontSize) {
	const PAGE_HEIGHT = 1122; // A4 at 96dpi
	const OVERFLOW_THRESHOLD = 0.18; // max % of a page overflow we'll try to squeeze
	const MIN_FONT_SIZE = 8;
	const STEP = 0.25;

	requestAnimationFrame(() => {
		const contentHeight = containerElement.scrollHeight;
		const currentPageCount = Math.ceil(contentHeight / PAGE_HEIGHT);
		const overflowIntoNextPage = contentHeight - ((currentPageCount - 1) * PAGE_HEIGHT);
		const overflowRatio = overflowIntoNextPage / PAGE_HEIGHT;

		// Only auto shrink if we barely spill onto the next page
		if (contentHeight > PAGE_HEIGHT && overflowRatio <= OVERFLOW_THRESHOLD && overflowRatio > 0) {
			let trialFontSize = userFontSize;

			while (trialFontSize >= MIN_FONT_SIZE) {
				containerElement.style.setProperty('--cv-font-size-base', `${trialFontSize}pt`);

				// Force reflow
				const newHeight = containerElement.scrollHeight;
				const newPageCount = Math.ceil(newHeight / PAGE_HEIGHT);

				if (newPageCount < currentPageCount) {
					// It fits — done
					return;
				}

				trialFontSize -= STEP;
			}

			// Couldn't fit — restore user's size
			containerElement.style.setProperty('--cv-font-size-base', `${userFontSize}pt`);
		}
	});
}

function getPersonalInfo(profileData) {
	const personalSection = profileData.sections.find(
		section => section.type === 'personalInfo'
	);
	return personalSection ? personalSection.data || {} : {};
}

function getVisibleSections(profileData, excludeTypes = []) {
	return profileData.sections.filter(
		section => section.visible && !excludeTypes.includes(section.type)
	);
}

function addPageOverflowIndicator(containerElement) {
	requestAnimationFrame(() => {
		const existingIndicator = containerElement.querySelector('.page-overflow-indicator');
		if (existingIndicator) existingIndicator.remove();

		if (containerElement.scrollHeight > 1122) {
			const indicatorElement = document.createElement('div');
			indicatorElement.className = 'page-overflow-indicator';
			containerElement.appendChild(indicatorElement);
		}
	});
}

function wrapSection(sectionId, sectionType, innerHtml) {
	return `<div class="cv-section" data-section-id="${sectionId}" data-section-type="${sectionType}">
    <span class="section-hover-hint">Click to edit</span>
    <div class="display-content">${innerHtml}</div>
  </div>`;
}

function buildContactLine(personalInfo, separator) {
	const contactParts = [personalInfo.email, personalInfo.phone, personalInfo.location].filter(Boolean);
	if (contactParts.length === 0) return '';
	return `<div class="contact-line">${contactParts.map(part => sanitizeHtml(part)).join(separator)}</div>`;
}

function buildPhotoHtml(photoUrl) {
	if (!photoUrl) return '';
	return `<div class="photo-container"><img src="${sanitizeHtml(photoUrl)}" alt="Photo" onerror="this.parentElement.style.display='none'"></div>`;
}


/* ============================================================
   CLASSIC TEMPLATE
   ============================================================ */

function buildClassicTemplate(profileData, dateFormat) {
	const personalInfo = getPersonalInfo(profileData);
	const visibleSections = getVisibleSections(profileData, ['personalInfo']);

	let headerHtml = `<div class="cv-section cv-header" data-section-type="personalInfo">`;
	headerHtml += `<span class="section-hover-hint">Click to edit</span>`;
	headerHtml += buildPhotoHtml(personalInfo.photoUrl);
	headerHtml += `<div class="display-content">`;
	headerHtml += `<div class="person-name">${sanitizeHtml(personalInfo.fullName) || 'Your Name'}</div>`;
	headerHtml += `<div class="person-title">${sanitizeHtml(personalInfo.title) || 'Professional Title'}</div>`;
	headerHtml += buildContactLine(personalInfo, ' <span class="contact-separator">•</span> ');
	headerHtml += `</div></div>`;

	if (personalInfo.summary) {
		headerHtml += `<div class="section-title" style="margin-top:1.25rem;">Summary</div>`;
		headerHtml += `<div class="summary-text">${sanitizeHtml(personalInfo.summary)}</div>`;
	}

	let sectionsHtml = '';
	for (const section of visibleSections) {
		const innerContent = `<div class="section-title">${sanitizeHtml(section.label)}</div>` +
			renderSectionContent(section, dateFormat);
		sectionsHtml += wrapSection(section.id, section.type, innerContent);
	}

	return headerHtml + sectionsHtml;
}


/* ============================================================
   MODERN TEMPLATE
   ============================================================ */

function buildModernTemplate(profileData, dateFormat) {
	const personalInfo = getPersonalInfo(profileData);
	const allSections = getVisibleSections(profileData, ['personalInfo']);

	const sidebarSectionTypes = ['links', 'skills', 'languages', 'certifications'];
	const sidebarSections = allSections.filter(section => sidebarSectionTypes.includes(section.type));
	const mainSections = allSections.filter(section => !sidebarSectionTypes.includes(section.type));

	let sidebarHtml = '<div class="cv-sidebar">';

	// Personal info in sidebar
	sidebarHtml += `<div class="cv-section" data-section-type="personalInfo">`;
	sidebarHtml += `<span class="section-hover-hint">Click to edit</span>`;
	sidebarHtml += `<div class="display-content">`;
	sidebarHtml += buildPhotoHtml(personalInfo.photoUrl);
	sidebarHtml += `<div class="person-name">${sanitizeHtml(personalInfo.fullName) || 'Your Name'}</div>`;
	sidebarHtml += `<div class="person-title">${sanitizeHtml(personalInfo.title) || 'Professional Title'}</div>`;
	sidebarHtml += `</div></div>`;

	// Contact details
	sidebarHtml += '<div class="sidebar-section">';
	sidebarHtml += '<div class="sidebar-section-title">Contact</div>';
	if (personalInfo.email) sidebarHtml += `<div class="contact-item">${sanitizeHtml(personalInfo.email)}</div>`;
	if (personalInfo.phone) sidebarHtml += `<div class="contact-item">${sanitizeHtml(personalInfo.phone)}</div>`;
	if (personalInfo.location) sidebarHtml += `<div class="contact-item">${sanitizeHtml(personalInfo.location)}</div>`;
	sidebarHtml += '</div>';

	// Sidebar sections
	for (const section of sidebarSections) {
		sidebarHtml += `<div class="cv-section sidebar-section" data-section-id="${section.id}" data-section-type="${section.type}">`;
		sidebarHtml += `<span class="section-hover-hint">Click to edit</span>`;
		sidebarHtml += `<div class="display-content">`;
		sidebarHtml += `<div class="sidebar-section-title">${sanitizeHtml(section.label)}</div>`;
		sidebarHtml += renderSidebarSectionContent(section, dateFormat);
		sidebarHtml += `</div></div>`;
	}

	sidebarHtml += '</div>';

	let mainHtml = '<div class="cv-main">';

	if (personalInfo.summary) {
		mainHtml += `<div class="section-title">Summary</div>`;
		mainHtml += `<div class="summary-text">${sanitizeHtml(personalInfo.summary)}</div>`;
	}

	for (const section of mainSections) {
		const innerContent = `<div class="section-title">${sanitizeHtml(section.label)}</div>` +
			renderSectionContent(section, dateFormat);
		mainHtml += wrapSection(section.id, section.type, innerContent);
	}

	mainHtml += '</div>';

	return sidebarHtml + mainHtml;
}

function renderSidebarSectionContent(section, dateFormat) {
	let contentHtml = '';

	if (section.type === 'skills' && section.groups) {
		for (const group of section.groups) {
			const validSkills = group.skills.filter(skill => skill.trim());
			if (validSkills.length > 0 || group.label) {
				contentHtml += '<div style="margin-bottom:0.5rem;">';
				if (group.label) {
					contentHtml += `<div style="font-size:0.75rem;opacity:0.7;margin-bottom:0.25rem;">${sanitizeHtml(group.label)}</div>`;
				}
				contentHtml += validSkills.map(skill => `<span class="skill-tag">${sanitizeHtml(skill)}</span>`).join(' ');
				contentHtml += '</div>';
			}
		}
	} else if (section.type === 'links' && section.items) {
		for (const linkItem of section.items) {
			if (linkItem.url || linkItem.label) {
				contentHtml += '<div class="link-item">';
				if (linkItem.url) {
					contentHtml += `<a href="${sanitizeHtml(linkItem.url)}" target="_blank">${sanitizeHtml(linkItem.label || linkItem.url)}</a>`;
				} else {
					contentHtml += sanitizeHtml(linkItem.label);
				}
				contentHtml += '</div>';
			}
		}
	} else if (section.type === 'languages' && section.items) {
		for (const languageItem of section.items) {
			if (languageItem.language) {
				contentHtml += `<div class="language-item">${sanitizeHtml(languageItem.language)}`;
				if (languageItem.proficiency) contentHtml += ` — ${sanitizeHtml(languageItem.proficiency)}`;
				contentHtml += '</div>';
			}
		}
	} else if (section.type === 'certifications' && section.items) {
		for (const certItem of section.items) {
			if (certItem.name) {
				contentHtml += `<div class="cert-item-sidebar">${sanitizeHtml(certItem.name)}`;
				if (certItem.date) contentHtml += ` (${formatDate(certItem.date, dateFormat)})`;
				contentHtml += '</div>';
			}
		}
	}

	return contentHtml;
}


/* ============================================================
   MINIMAL TEMPLATE
   ============================================================ */

function buildMinimalTemplate(profileData, dateFormat) {
	const personalInfo = getPersonalInfo(profileData);
	const visibleSections = getVisibleSections(profileData, ['personalInfo']);

	let headerHtml = `<div class="cv-section cv-header" data-section-type="personalInfo">`;
	headerHtml += `<span class="section-hover-hint">Click to edit</span>`;
	headerHtml += `<div class="display-content">`;
	headerHtml += buildPhotoHtml(personalInfo.photoUrl);
	headerHtml += `<div class="person-name">${sanitizeHtml(personalInfo.fullName) || 'Your Name'}</div>`;
	headerHtml += `<div class="person-title">${sanitizeHtml(personalInfo.title) || 'Professional Title'}</div>`;
	headerHtml += buildContactLine(personalInfo, ' <span>|</span> ');
	headerHtml += `</div></div>`;

	if (personalInfo.summary) {
		headerHtml += `<div class="section-title">Summary</div>`;
		headerHtml += `<div class="summary-text">${sanitizeHtml(personalInfo.summary)}</div>`;
	}

	let sectionsHtml = '';
	for (const section of visibleSections) {
		const innerContent = `<div class="section-title">${sanitizeHtml(section.label)}</div>` +
			renderSectionContent(section, dateFormat);
		sectionsHtml += wrapSection(section.id, section.type, innerContent);
	}

	return headerHtml + sectionsHtml;
}

/* ============================================================
   SHARED SECTION CONTENT RENDERER
   Used by classic and minimal (modern sidebar has its own)
   ============================================================ */
function renderSectionContent(section, dateFormat) {
	let contentHtml = '';

	switch (section.type) {
		case 'experience':
			contentHtml = renderExperienceItems(section.items, dateFormat);
			break;
		case 'education':
			contentHtml = renderEducationItems(section.items, dateFormat);
			break;
		case 'skills':
			contentHtml = renderSkillGroups(section.groups);
			break;
		case 'links':
			contentHtml = renderLinks(section.items);
			break;
		case 'projects':
			contentHtml = renderProjectItems(section.items, dateFormat);
			break;
		case 'certifications':
			contentHtml = renderCertificationItems(section.items, dateFormat);
			break;
		case 'languages':
			contentHtml = renderLanguageItems(section.items);
			break;
		case 'awards':
			contentHtml = renderAwardItems(section.items, dateFormat);
			break;
		case 'publications':
			contentHtml = renderPublicationItems(section.items, dateFormat);
			break;
		case 'volunteer':
			contentHtml = renderVolunteerItems(section.items, dateFormat);
			break;
		case 'references':
			contentHtml = renderReferenceItems(section.items);
			break;
		case 'custom':
			contentHtml = renderCustomItems(section.items);
			break;
	}

	return contentHtml;
}

function renderBulletList(bullets) {
	const validBullets = (bullets || []).filter(bullet => bullet.trim());
	if (validBullets.length === 0) return '';
	return `<ul class="item-bullets">${validBullets.map(bullet => `<li>${sanitizeHtml(bullet)}</li>`).join('')}</ul>`;
}

function renderExperienceItems(items, dateFormat) {
	if (!items) return '';
	let html = '';
	for (const experienceItem of items) {
		if (!experienceItem.jobTitle && !experienceItem.company) continue;
		html += '<div class="experience-item">';
		html += '<div class="item-header"><div>';
		html += `<span class="item-primary">${sanitizeHtml(experienceItem.jobTitle)}</span>`;
		if (experienceItem.company) html += ` <span class="item-secondary">at ${sanitizeHtml(experienceItem.company)}</span>`;
		if (experienceItem.location) html += ` <span class="item-secondary">· ${sanitizeHtml(experienceItem.location)}</span>`;
		html += '</div>';
		html += `<div class="item-date">${formatDateRange(experienceItem.startDate, experienceItem.endDate, experienceItem.isCurrent, dateFormat)}</div>`;
		html += '</div>';
		html += renderBulletList(experienceItem.bullets);
		html += '</div>';
	}
	return html;
}

function renderEducationItems(items, dateFormat) {
	if (!items) return '';
	let html = '';
	for (const educationItem of items) {
		if (!educationItem.degree && !educationItem.institution) continue;
		html += '<div class="education-item">';
		html += '<div class="item-header"><div>';
		html += `<span class="item-primary">${sanitizeHtml(educationItem.degree)}</span>`;
		if (educationItem.institution) html += ` <span class="item-secondary">at ${sanitizeHtml(educationItem.institution)}</span>`;
		if (educationItem.location) html += ` <span class="item-secondary">· ${sanitizeHtml(educationItem.location)}</span>`;
		html += '</div>';
		html += `<div class="item-date">${formatDateRange(educationItem.startDate, educationItem.endDate, false, dateFormat)}</div>`;
		html += '</div>';
		if (educationItem.gpa) html += `<div class="item-secondary" style="font-size:0.8rem;">GPA: ${sanitizeHtml(educationItem.gpa)}</div>`;
		if (educationItem.notes) html += `<div style="font-size:0.8rem;margin-top:0.15rem;">${sanitizeHtml(educationItem.notes)}</div>`;
		html += '</div>';
	}
	return html;
}

function renderSkillGroups(groups) {
	if (!groups) return '';
	let html = '';
	for (const skillGroup of groups) {
		const validSkills = skillGroup.skills.filter(skill => skill.trim());
		if (validSkills.length > 0) {
			html += `<div class="skills-group"><span class="skills-group-label">${sanitizeHtml(skillGroup.label)}:</span> ${validSkills.map(skill => sanitizeHtml(skill)).join(', ')}</div>`;
		}
	}
	return html;
}

function renderLinks(items) {
	if (!items) return '';
	const validLinks = items.filter(linkItem => linkItem.label || linkItem.url);
	if (validLinks.length === 0) return '';
	return `<div class="links-list">${validLinks.map(linkItem =>
		`<div><span class="link-item-label">${sanitizeHtml(linkItem.label)}:</span> ${sanitizeHtml(linkItem.url)}</div>`
	).join('')}</div>`;
}

function renderProjectItems(items, dateFormat) {
	if (!items) return '';
	let html = '';
	for (const projectItem of items) {
		if (!projectItem.name) continue;
		html += '<div class="project-item">';
		html += `<div class="item-header"><span class="item-primary">${sanitizeHtml(projectItem.name)}</span>`;
		if (projectItem.techStack) html += ` <span class="item-secondary">· ${sanitizeHtml(projectItem.techStack)}</span>`;
		html += '</div>';
		if (projectItem.description) html += `<div style="font-size:0.85rem;margin-top:0.2rem;">${sanitizeHtml(projectItem.description)}</div>`;
		if (projectItem.url) html += `<div style="font-size:0.8rem;color:var(--cv-primary);margin-top:0.1rem;">${sanitizeHtml(projectItem.url)}</div>`;
		html += renderBulletList(projectItem.bullets);
		html += '</div>';
	}
	return html;
}

function renderCertificationItems(items, dateFormat) {
	if (!items) return '';
	let html = '';
	for (const certItem of items) {
		if (!certItem.name) continue;
		html += `<div class="cert-item"><span class="item-primary">${sanitizeHtml(certItem.name)}</span>`;
		if (certItem.issuer) html += ` — ${sanitizeHtml(certItem.issuer)}`;
		if (certItem.date) html += ` (${formatDate(certItem.date, dateFormat)})`;
		html += '</div>';
	}
	return html;
}

function renderLanguageItems(items) {
	if (!items) return '';
	let html = '';
	for (const languageItem of items) {
		if (!languageItem.language) continue;
		html += `<div class="language-item"><span class="item-primary">${sanitizeHtml(languageItem.language)}</span>`;
		if (languageItem.proficiency) html += ` — ${sanitizeHtml(languageItem.proficiency)}`;
		html += '</div>';
	}
	return html;
}

function renderAwardItems(items, dateFormat) {
	if (!items) return '';
	let html = '';
	for (const awardItem of items) {
		if (!awardItem.title) continue;
		html += `<div class="award-item"><span class="item-primary">${sanitizeHtml(awardItem.title)}</span>`;
		if (awardItem.issuer) html += ` — ${sanitizeHtml(awardItem.issuer)}`;
		if (awardItem.date) html += ` (${formatDate(awardItem.date, dateFormat)})`;
		if (awardItem.description) html += `<div style="font-size:0.8rem;margin-top:0.1rem;">${sanitizeHtml(awardItem.description)}</div>`;
		html += '</div>';
	}
	return html;
}

function renderPublicationItems(items, dateFormat) {
	if (!items) return '';
	let html = '';
	for (const publicationItem of items) {
		if (!publicationItem.title) continue;
		html += `<div class="publication-item"><span class="item-primary">${sanitizeHtml(publicationItem.title)}</span>`;
		if (publicationItem.publisher) html += ` — ${sanitizeHtml(publicationItem.publisher)}`;
		if (publicationItem.date) html += ` (${formatDate(publicationItem.date, dateFormat)})`;
		if (publicationItem.url) html += `<div style="font-size:0.8rem;color:var(--cv-primary);">${sanitizeHtml(publicationItem.url)}</div>`;
		html += '</div>';
	}
	return html;
}

function renderVolunteerItems(items, dateFormat) {
	if (!items) return '';
	let html = '';
	for (const volunteerItem of items) {
		if (!volunteerItem.role && !volunteerItem.organization) continue;
		html += '<div class="volunteer-item">';
		html += '<div class="item-header"><div>';
		html += `<span class="item-primary">${sanitizeHtml(volunteerItem.role)}</span>`;
		if (volunteerItem.organization) html += ` <span class="item-secondary">at ${sanitizeHtml(volunteerItem.organization)}</span>`;
		html += '</div>';
		html += `<div class="item-date">${formatDateRange(volunteerItem.startDate, volunteerItem.endDate, false, dateFormat)}</div>`;
		html += '</div>';
		html += renderBulletList(volunteerItem.bullets);
		html += '</div>';
	}
	return html;
}

function renderReferenceItems(items) {
	if (!items) return '';
	let html = '';
	for (const referenceItem of items) {
		if (!referenceItem.name) continue;
		html += `<div class="reference-item"><span class="item-primary">${sanitizeHtml(referenceItem.name)}</span>`;
		if (referenceItem.title) html += `, ${sanitizeHtml(referenceItem.title)}`;
		if (referenceItem.company) html += ` at ${sanitizeHtml(referenceItem.company)}`;
		if (referenceItem.contact) html += ` — ${sanitizeHtml(referenceItem.contact)}`;
		html += '</div>';
	}
	return html;
}

function renderCustomItems(items) {
	if (!items) return '';
	let html = '';
	for (const customItem of items) {
		if (customItem.content) {
			html += `<div class="custom-item">${sanitizeHtml(customItem.content)}</div>`;
		}
	}
	return html;
}

function buildCoverLetterRecipient(coverLetterData) {
	let html = `<div class="cover-letter-section" data-cl-field="recipient">`;
	html += `<span class="section-hover-hint">Click to edit</span>`;
	html += `<div class="display-content cl-recipient">`;
	if (coverLetterData.recipientName) html += `<div>${sanitizeHtml(coverLetterData.recipientName)}</div>`;
	if (coverLetterData.recipientTitle) html += `<div>${sanitizeHtml(coverLetterData.recipientTitle)}</div>`;
	if (coverLetterData.recipientCompany) html += `<div>${sanitizeHtml(coverLetterData.recipientCompany)}</div>`;
	if (coverLetterData.recipientAddress) html += `<div>${sanitizeHtml(coverLetterData.recipientAddress)}</div>`;
	if (!coverLetterData.recipientName && !coverLetterData.recipientCompany) {
		html += `<div style="color:var(--cv-text-light);font-style:italic;">Click to add recipient details</div>`;
	}
	html += '</div></div>';
	return html;
}

function buildCoverLetterDate(coverLetterData) {
	let html = `<div class="cover-letter-section" data-cl-field="date">`;
	html += `<span class="section-hover-hint">Click to edit</span>`;
	html += `<div class="display-content cl-date">${coverLetterData.date || new Date().toLocaleDateString()}</div>`;
	html += '</div>';
	return html;
}

function buildCoverLetterSubject(coverLetterData) {
	let html = `<div class="cover-letter-section" data-cl-field="subject">`;
	html += `<span class="section-hover-hint">Click to edit</span>`;
	if (coverLetterData.subject) {
		html += `<div class="display-content cl-subject">Re: ${sanitizeHtml(coverLetterData.subject)}</div>`;
	} else {
		html += `<div class="display-content cl-subject" style="color:var(--cv-text-light);font-style:italic;">Click to add subject line</div>`;
	}
	html += '</div>';
	return html;
}

function buildCoverLetterSalutation(coverLetterData) {
	let html = `<div class="cover-letter-section" data-cl-field="salutation">`;
	html += `<span class="section-hover-hint">Click to edit</span>`;
	html += `<div class="display-content cl-salutation">${sanitizeHtml(coverLetterData.salutation || 'Dear Hiring Manager,')}</div>`;
	html += '</div>';
	return html;
}

function buildCoverLetterBody(coverLetterData) {
	const paragraphs = coverLetterData.paragraphs || ['', '', ''];
	let html = `<div class="cover-letter-section" data-cl-field="body">`;
	html += `<span class="section-hover-hint">Click to edit</span>`;
	html += '<div class="display-content">';
	if (paragraphs.some(paragraph => paragraph.trim())) {
		for (const paragraph of paragraphs) {
			if (paragraph.trim()) {
				html += `<div class="cl-paragraph">${sanitizeHtml(paragraph)}</div>`;
			}
		}
	} else {
		html += `<div class="cl-paragraph" style="color:var(--cv-text-light);font-style:italic;">Click to write your cover letter body...</div>`;
	}
	html += '</div></div>';
	return html;
}

function buildCoverLetterSignoff(coverLetterData, personalInfo) {
	let html = `<div class="cover-letter-section" data-cl-field="signoff">`;
	html += `<span class="section-hover-hint">Click to edit</span>`;
	html += '<div class="display-content">';
	html += `<div class="cl-signoff">${sanitizeHtml(coverLetterData.signOff || 'Sincerely,')}</div>`;
	html += `<div class="cl-sender-name">${sanitizeHtml(coverLetterData.senderName || personalInfo.fullName || 'Your Name')}</div>`;
	html += '</div></div>';
	return html;
}