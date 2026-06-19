import api from '../api';
import { UserProfile } from './profile';

// ─── Google Fonts ─────────────────────────────────────────────────────────────
export const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Merriweather:wght@300;400;700&family=EB+Garamond:wght@400;700&family=Open+Sans:wght@300;400;600;700&family=Lato:wght@300;400;700&display=swap';

export const HEADING_FONT_OPTIONS = [
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'Playfair Display', value: "'Playfair Display', serif" },
  { label: 'Merriweather', value: "'Merriweather', serif" },
  { label: 'EB Garamond', value: "'EB Garamond', Garamond, serif" },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
];

export const BODY_FONT_OPTIONS = [
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'Open Sans', value: "'Open Sans', sans-serif" },
  { label: 'Lato', value: "'Lato', sans-serif" },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
];

// ─── Contact ──────────────────────────────────────────────────────────────────
export interface ResumeContact {
  firstName: string;
  lastName: string;
  middleName?: string;
  email?: string;
  phone?: string;
  address?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  website?: string;
  [key: string]: string | undefined; // extra custom contact fields
}

// ─── Section items ────────────────────────────────────────────────────────────

export interface ResumeHighlight {
  id: string;
  text: string;
  visible: boolean;
}

export interface ResumeWorkItem {
  id: string;
  visible: boolean;
  company: string;
  title: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  highlights: ResumeHighlight[];
}

export interface ResumeEducationItem {
  id: string;
  visible: boolean;
  institution: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
}

export interface ResumeProjectItem {
  id: string;
  visible: boolean;
  name: string;
  technologies?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  highlights: ResumeHighlight[];
}

export interface ResumeCertificationItem {
  id: string;
  visible: boolean;
  name: string;
  issuer?: string;
  date?: string;
  url?: string;
}

export interface ResumeSimpleItem {
  id: string;
  text: string;
  visible: boolean;
}

export interface ResumeCustomField {
  id: string;
  key: string;
  value: string;
  visible: boolean;
}

export interface ResumeCustomItem {
  id: string;
  visible: boolean;
  title?: string;
  fields: ResumeCustomField[];
}

// ─── Section types ────────────────────────────────────────────────────────────

export type ResumeSectionType =
  | 'summary'
  | 'work_experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'languages'
  | 'custom';

export interface ResumeSectionBase {
  id: string;
  type: ResumeSectionType;
  label: string;
  visible: boolean;
  order: number;
}

export interface ResumeSummarySection extends ResumeSectionBase {
  type: 'summary';
  content: string;
}

export interface ResumeWorkSection extends ResumeSectionBase {
  type: 'work_experience';
  items: ResumeWorkItem[];
}

export interface ResumeEducationSection extends ResumeSectionBase {
  type: 'education';
  items: ResumeEducationItem[];
}

export interface ResumeSkillsSection extends ResumeSectionBase {
  type: 'skills';
  items: ResumeSimpleItem[];
}

export interface ResumeProjectsSection extends ResumeSectionBase {
  type: 'projects';
  items: ResumeProjectItem[];
}

export interface ResumeCertificationsSection extends ResumeSectionBase {
  type: 'certifications';
  items: ResumeCertificationItem[];
}

export interface ResumeLanguagesSection extends ResumeSectionBase {
  type: 'languages';
  items: ResumeSimpleItem[];
}

export interface ResumeCustomSection extends ResumeSectionBase {
  type: 'custom';
  items: ResumeCustomItem[];
}

export type ResumeSection =
  | ResumeSummarySection
  | ResumeWorkSection
  | ResumeEducationSection
  | ResumeSkillsSection
  | ResumeProjectsSection
  | ResumeCertificationsSection
  | ResumeLanguagesSection
  | ResumeCustomSection;

// ─── Layout + Customization ───────────────────────────────────────────────────

export interface ResumeLayout {
  marginTop: number;     // mm
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  baseFontSize: number;  // pt (8–13)
  lineHeight: number;    // 1.2–1.8
  textAlign: 'left' | 'justify';
  pageSize: 'a4' | 'letter';
}

export interface ResumeCustomization {
  headingFont: string;
  bodyFont: string;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  lineColor: string;
  layout: ResumeLayout;
}

export const DEFAULT_LAYOUT: ResumeLayout = {
  marginTop: 18,
  marginBottom: 18,
  marginLeft: 20,
  marginRight: 20,
  baseFontSize: 10,
  lineHeight: 1.5,
  textAlign: 'left',
  pageSize: 'a4',
};

export const DEFAULT_CUSTOMIZATION: ResumeCustomization = {
  headingFont: 'Inter, sans-serif',
  bodyFont: 'Inter, sans-serif',
  primaryColor: '#0f172a',
  accentColor: '#1d4ed8',
  textColor: '#1e293b',
  lineColor: '#cbd5e1',
  layout: DEFAULT_LAYOUT,
};

// ─── Version ──────────────────────────────────────────────────────────────────

export interface ResumeVersion {
  id: string;
  title: string;
  isFavorite: boolean;
  createdAt: string;
  isAiTailored: boolean;
  aiCoverLetter?: string;
  applicationId?: string;
  applicationLabel?: string;
  contact: ResumeContact;
  sections: ResumeSection[];
  customization: ResumeCustomization;
}

// ─── ID generator ─────────────────────────────────────────────────────────────

export function genId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Initialize version from profile ─────────────────────────────────────────

export function initVersionFromProfile(
  profile: UserProfile,
  userName: string,
  userEmail: string
): Omit<ResumeVersion, 'id' | 'createdAt'> {
  const nameParts = (userName || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
  const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : undefined;

  const contact: ResumeContact = {
    firstName,
    lastName,
    ...(middleName ? { middleName } : {}),
    email: userEmail || undefined,
    phone: profile.phone || undefined,
    address: profile.location || undefined,
    linkedin: profile.linkedin_url || undefined,
    github: profile.github_url || undefined,
    portfolio: profile.portfolio_url || undefined,
  };

  let order = 0;
  const sections: ResumeSection[] = [];

  if (profile.summary) {
    sections.push({
      id: genId(), type: 'summary', label: 'Professional Summary',
      visible: true, order: order++, content: profile.summary,
    });
  }

  sections.push({
    id: genId(), type: 'work_experience', label: 'Work Experience',
    visible: true, order: order++,
    items: profile.work_experience.map(exp => ({
      id: genId(), visible: true,
      company: exp.company, title: exp.title,
      location: exp.location, startDate: exp.start_date, endDate: exp.end_date,
      description: exp.description,
      highlights: exp.highlights.map(h => ({ id: genId(), text: h, visible: true })),
    })),
  });

  sections.push({
    id: genId(), type: 'education', label: 'Education',
    visible: true, order: order++,
    items: profile.education.map(edu => ({
      id: genId(), visible: true,
      institution: edu.institution, degree: edu.degree,
      fieldOfStudy: edu.field_of_study, startDate: edu.start_date, endDate: edu.end_date,
      gpa: edu.gpa,
    })),
  });

  if (profile.skills.length > 0) {
    sections.push({
      id: genId(), type: 'skills', label: 'Skills',
      visible: true, order: order++,
      items: profile.skills.map(s => ({ id: genId(), text: s, visible: true })),
    });
  }

  if (profile.projects.length > 0) {
    sections.push({
      id: genId(), type: 'projects', label: 'Projects',
      visible: true, order: order++,
      items: profile.projects.map(p => ({
        id: genId(), visible: true,
        name: p.name, technologies: p.technologies.join(', '),
        url: p.url, startDate: p.start_date, endDate: p.end_date,
        description: p.description,
        highlights: [],
      })),
    });
  }

  if (profile.certifications.length > 0) {
    sections.push({
      id: genId(), type: 'certifications', label: 'Certifications',
      visible: true, order: order++,
      items: profile.certifications.map(c => ({
        id: genId(), visible: true,
        name: c.name, issuer: c.issuer, date: c.date, url: c.url,
      })),
    });
  }

  if (profile.languages.length > 0) {
    sections.push({
      id: genId(), type: 'languages', label: 'Languages',
      visible: true, order: order++,
      items: profile.languages.map(l => ({ id: genId(), text: l, visible: true })),
    });
  }

  return {
    title: 'My Resume',
    isFavorite: false,
    isAiTailored: false,
    contact,
    sections,
    customization: DEFAULT_CUSTOMIZATION,
  };
}

// ─── API client ───────────────────────────────────────────────────────────────

export interface ResumeVersionCreatePayload {
  title: string;
  isFavorite: boolean;
  isAiTailored: boolean;
  aiCoverLetter?: string;
  applicationId?: string;
  applicationLabel?: string;
  contact: ResumeContact;
  sections: ResumeSection[];
  customization: ResumeCustomization;
}

export interface ResumeVersionUpdatePayload {
  title?: string;
  isFavorite?: boolean;
  isAiTailored?: boolean;
  aiCoverLetter?: string;
  contact?: ResumeContact;
  sections?: ResumeSection[];
  customization?: ResumeCustomization;
}

export const resumeVersionApi = {
  async getAll(): Promise<ResumeVersion[]> {
    const res = await api.get<ResumeVersion[]>('/resume/versions');
    return res.data;
  },

  async create(payload: ResumeVersionCreatePayload): Promise<ResumeVersion> {
    const res = await api.post<ResumeVersion>('/resume/versions', payload);
    return res.data;
  },

  async update(id: string, payload: ResumeVersionUpdatePayload): Promise<ResumeVersion> {
    const res = await api.patch<ResumeVersion>(`/resume/versions/${id}`, payload);
    return res.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/resume/versions/${id}`);
  },

  async duplicate(id: string): Promise<ResumeVersion> {
    const res = await api.post<ResumeVersion>(`/resume/versions/${id}/duplicate`);
    return res.data;
  },
};
