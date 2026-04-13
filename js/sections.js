const registeredSections = {};

export function registerSection(sectionType, sectionDefinition) {
	registeredSections[sectionType] = sectionDefinition;
}

export function getSectionDefinition(sectionType) {
	return registeredSections[sectionType] || null;
}

export function getAllSectionTypes() {
	return Object.keys(registeredSections);
}

export function getAddableSections(existingSectionTypes) {
	return Object.entries(registeredSections)
		.filter(([sectionType, definition]) => {
			if (sectionType === 'personalInfo') return false;
			if (definition.singleton && existingSectionTypes.includes(sectionType)) return false;
			return true;
		})
		.map(([sectionType, definition]) => ({
			type: sectionType,
			label: definition.defaultLabel,
		}));
}

export function createDefaultSectionData(sectionType) {
	const definition = registeredSections[sectionType];
	if (!definition) return {};
	return JSON.parse(JSON.stringify(definition.defaultData));
}

registerSection('personalInfo', {
	defaultLabel: 'Personal Info',
	singleton: true,
	defaultData: {
		data: {
			fullName: '', title: '', email: '', phone: '',
			location: '', photoUrl: '', summary: '',
		},
	},
});

registerSection('links', {
	defaultLabel: 'Links',
	singleton: true,
	defaultData: {
		items: [{ id: '', label: 'LinkedIn', url: '' }],
	},
});

registerSection('experience', {
	defaultLabel: 'Experience',
	singleton: false,
	defaultData: {
		items: [{
			id: '', jobTitle: '', company: '', location: '',
			startDate: '', endDate: '', isCurrent: false, bullets: [''],
		}],
	},
});

registerSection('education', {
	defaultLabel: 'Education',
	singleton: false,
	defaultData: {
		items: [{
			id: '', degree: '', institution: '', location: '',
			startDate: '', endDate: '', gpa: '', notes: '',
		}],
	},
});

registerSection('skills', {
	defaultLabel: 'Skills',
	singleton: true,
	defaultData: {
		groups: [{ id: '', label: 'Technical', skills: [''] }],
	},
});

registerSection('projects', {
	defaultLabel: 'Projects',
	singleton: false,
	defaultData: {
		items: [{
			id: '', name: '', description: '', url: '',
			techStack: '', bullets: [''],
		}],
	},
});

registerSection('certifications', {
	defaultLabel: 'Certifications',
	singleton: false,
	defaultData: {
		items: [{ id: '', name: '', issuer: '', date: '', url: '' }],
	},
});

registerSection('languages', {
	defaultLabel: 'Languages',
	singleton: true,
	defaultData: {
		items: [{ id: '', language: '', proficiency: 'Fluent' }],
	},
});

registerSection('awards', {
	defaultLabel: 'Awards & Honors',
	singleton: false,
	defaultData: {
		items: [{ id: '', title: '', issuer: '', date: '', description: '' }],
	},
});

registerSection('publications', {
	defaultLabel: 'Publications',
	singleton: false,
	defaultData: {
		items: [{
			id: '', title: '', publisher: '', date: '', url: '', description: '',
		}],
	},
});

registerSection('volunteer', {
	defaultLabel: 'Volunteer Experience',
	singleton: false,
	defaultData: {
		items: [{
			id: '', role: '', organization: '',
			startDate: '', endDate: '', bullets: [''],
		}],
	},
});

registerSection('references', {
	defaultLabel: 'References',
	singleton: true,
	defaultData: {
		items: [{ id: '', name: '', title: '', company: '', contact: '' }],
	},
});

registerSection('custom', {
	defaultLabel: 'Custom Section',
	singleton: false,
	defaultData: {
		items: [{ id: '', content: '' }],
	},
});