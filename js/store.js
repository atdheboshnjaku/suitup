/* ============================================================
   store.js — localStorage abstraction with profile CRUD
   ============================================================ */
import { generateUniqueId } from './utils.js';

const STORAGE_KEY = 'resumeForgeData';
const MAX_STORAGE_BYTES = 5 * 1024 * 1024; // 5 MB

let onSaveCallback = null;
let onErrorCallback = null;

/**
 * Register callbacks for save and error events.
 * This avoids circular dependency with app.js event bus.
 */
export function setStoreCallbacks({ onSave, onError }) {
	if (onSave) onSaveCallback = onSave;
	if (onError) onErrorCallback = onError;
}

/* ---- Low-level read/write ---- */
function loadAllData() {
	try {
		const rawData = localStorage.getItem(STORAGE_KEY);
		if (!rawData) return createEmptyStore();
		return JSON.parse(rawData);
	} catch (parseError) {
		console.error('Failed to parse stored data:', parseError);
		return createEmptyStore();
	}
}

function saveAllData(storeData) {
	try {
		const serializedData = JSON.stringify(storeData);
		localStorage.setItem(STORAGE_KEY, serializedData);
		if (onSaveCallback) onSaveCallback(storeData);
	} catch (saveError) {
		console.error('Failed to save data:', saveError);
		if (onErrorCallback) onErrorCallback('Storage is full. Consider exporting and deleting old profiles.');
	}
}

function createEmptyStore() {
	return { activeProfileId: null, profiles: {} };
}


/* ---- Storage metrics global, not per-profile ---- */
export function getStorageUsageBytes() {
	const rawData = localStorage.getItem(STORAGE_KEY) || '';
	return new Blob([rawData]).size;
}

export function getStoragePercentage() {
	return (getStorageUsageBytes() / MAX_STORAGE_BYTES) * 100;
}

export function getStorageUsageFormatted() {
	const usageBytes = getStorageUsageBytes();
	if (usageBytes < 1024) return `${usageBytes} B`;
	if (usageBytes < 1024 * 1024) return `${(usageBytes / 1024).toFixed(1)} KB`;
	return `${(usageBytes / (1024 * 1024)).toFixed(2)} MB`;
}


/* ---- Profile CRUD ---- */
export function getAllProfiles() {
	return loadAllData().profiles;
}

export function getProfile(profileId) {
	return loadAllData().profiles[profileId] || null;
}

export function createProfile(profileName, templateId = 'classic') {
	const storeData = loadAllData();
	const newProfileId = generateUniqueId();
	storeData.profiles[newProfileId] = buildDefaultProfile(newProfileId, profileName, templateId);
	storeData.activeProfileId = newProfileId;
	saveAllData(storeData);
	return newProfileId;
}

export function updateProfile(profileId, updatedFields) {
	const storeData = loadAllData();
	if (!storeData.profiles[profileId]) return;
	Object.assign(storeData.profiles[profileId], updatedFields, {
		updatedAt: new Date().toISOString(),
	});
	saveAllData(storeData);
}

export function deleteProfile(profileId) {
	const storeData = loadAllData();
	delete storeData.profiles[profileId];
	if (storeData.activeProfileId === profileId) {
		const remainingIds = Object.keys(storeData.profiles);
		storeData.activeProfileId = remainingIds.length > 0 ? remainingIds[0] : null;
	}
	saveAllData(storeData);
}

export function duplicateProfile(profileId) {
	const storeData = loadAllData();
	const sourceProfile = storeData.profiles[profileId];
	if (!sourceProfile) return null;

	const newProfileId = generateUniqueId();
	const duplicatedProfile = JSON.parse(JSON.stringify(sourceProfile));
	duplicatedProfile.id = newProfileId;
	duplicatedProfile.name = sourceProfile.name + ' (Copy)';
	duplicatedProfile.createdAt = new Date().toISOString();
	duplicatedProfile.updatedAt = new Date().toISOString();
	storeData.profiles[newProfileId] = duplicatedProfile;
	saveAllData(storeData);
	return newProfileId;
}

export function setActiveProfile(profileId) {
	const storeData = loadAllData();
	storeData.activeProfileId = profileId;
	saveAllData(storeData);
}

export function getActiveProfileId() {
	return loadAllData().activeProfileId;
}

export function importProfileFromJson(jsonData) {
	const storeData = loadAllData();
	const importedProfile = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
	const newProfileId = generateUniqueId();
	importedProfile.id = newProfileId;
	importedProfile.createdAt = new Date().toISOString();
	importedProfile.updatedAt = new Date().toISOString();
	storeData.profiles[newProfileId] = importedProfile;
	saveAllData(storeData);
	return newProfileId;
}


/* ---- Default profile ---- */
function buildDefaultProfile(profileId, profileName, templateId) {
	return {
		id: profileId,
		name: profileName || 'Untitled Resume',
		templateId: templateId,
		dateFormat: 'mon-yyyy',
		colorScheme: {
			primary: '#d4603e',
			accent: '#eda08a',
		},
		typography: {
			headingFont: 'playfair-display',
			bodyFont: 'dm-sans',
			fontSize: 10,
			spacing: 'default',
		},
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		sections: [
			{
				id: generateUniqueId(),
				type: 'personalInfo',
				label: 'Personal Info',
				visible: true,
				data: {
					fullName: '',
					title: '',
					email: '',
					phone: '',
					location: '',
					photoUrl: '',
					summary: '',
				},
			},
			{
				id: generateUniqueId(),
				type: 'links',
				label: 'Links',
				visible: true,
				items: [{ id: generateUniqueId(), label: 'LinkedIn', url: '' }],
			},
			{
				id: generateUniqueId(),
				type: 'experience',
				label: 'Experience',
				visible: true,
				items: [
					{
						id: generateUniqueId(),
						jobTitle: '',
						company: '',
						location: '',
						startDate: '',
						endDate: '',
						isCurrent: false,
						bullets: [''],
					},
				],
			},
			{
				id: generateUniqueId(),
				type: 'education',
				label: 'Education',
				visible: true,
				items: [
					{
						id: generateUniqueId(),
						degree: '',
						institution: '',
						location: '',
						startDate: '',
						endDate: '',
						gpa: '',
						notes: '',
					},
				],
			},
			{
				id: generateUniqueId(),
				type: 'skills',
				label: 'Skills',
				visible: true,
				groups: [{ id: generateUniqueId(), label: 'Technical', skills: [''] }],
			},
		],
		coverLetter: {
			recipientName: '',
			recipientTitle: '',
			recipientCompany: '',
			recipientAddress: '',
			date: new Date().toISOString().slice(0, 10),
			subject: '',
			salutation: 'Dear Hiring Manager,',
			paragraphs: ['', '', ''],
			signOff: 'Sincerely,',
			senderName: '',
		},
	};
}