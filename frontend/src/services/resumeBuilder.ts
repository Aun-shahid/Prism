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

// ─── AI tailor operations ─────────────────────────────────────────────────────

/**
 * A single affected-fields-only edit returned by the AI tailor. The backend
 * validates these; `applyResumeOperations` below applies them to sections.
 */
export type ResumeOperation =
  | { op: 'set_visibility'; target_id: string; visible: boolean }
  | { op: 'update_fields'; target_id: string; fields: Record<string, unknown> }
  | { op: 'remove'; target_id: string }
  | { op: 'add_item'; section_id: string; item: Record<string, unknown>; position?: 'start' | 'end' }
  | { op: 'add_highlight'; item_id: string; text: string; position?: 'start' | 'end' }
  | { op: 'reorder_items'; section_id: string; item_ids: string[] }
  | { op: 'reorder_sections'; section_ids: string[] };

export interface ApplyOperationsResult {
  sections: ResumeSection[];
  warnings: string[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */

const STRUCTURAL_KEYS = new Set(['id', 'type', 'order', 'items']);

function normalizeHighlights(value: unknown): ResumeHighlight[] {
  if (!Array.isArray(value)) return [];
  return value.map(h => {
    if (typeof h === 'string') return { id: genId(), text: h, visible: true };
    const obj = (h ?? {}) as any;
    return { id: obj.id || genId(), text: String(obj.text ?? ''), visible: obj.visible !== false };
  });
}

function normalizeNewItem(sectionType: string, raw: any): any {
  const item: any = { ...(raw || {}) };
  item.id = item.id || genId();
  if (item.visible === undefined) item.visible = true;
  if (Array.isArray(item.technologies)) item.technologies = item.technologies.join(', ');
  if (sectionType === 'work_experience' || sectionType === 'projects') {
    item.highlights = normalizeHighlights(item.highlights);
  } else {
    delete item.highlights;
  }
  return item;
}

function applyFields(node: any, fields: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(fields || {})) {
    if (STRUCTURAL_KEYS.has(key)) continue;                         // never let the AI rewrite ids/type/order/items
    if (key === 'highlights') { node.highlights = normalizeHighlights(value); continue; }
    if (key === 'technologies' && Array.isArray(value)) { node.technologies = value.join(', '); continue; }
    node[key] = value;
  }
}

function reorderById<T extends { id: string }>(arr: T[], ids: string[]): T[] {
  const byId = new Map(arr.map(x => [x.id, x]));
  const out: T[] = [];
  for (const id of ids) {
    const found = byId.get(id);
    if (found) { out.push(found); byId.delete(id); }
  }
  for (const x of arr) if (byId.has(x.id)) out.push(x);             // keep anything the AI omitted
  return out;
}

/**
 * Apply AI tailor operations to a resume's sections, returning a NEW sections
 * array (input is not mutated) plus warnings for unresolved targets. Defensive:
 * unknown targets are skipped, new nodes get fresh ids, omitted items survive
 * reorders.
 */
export function applyResumeOperations(
  sections: ResumeSection[],
  operations: ResumeOperation[],
): ApplyOperationsResult {
  const next: ResumeSection[] = JSON.parse(JSON.stringify(sections ?? []));
  const warnings: string[] = [];

  const findSection = (id: string): any => next.find(s => s.id === id);
  const findItem = (id: string): { items: any[]; item: any; index: number } | null => {
    for (const s of next as any[]) {
      const items = s.items as any[] | undefined;
      if (!items) continue;
      const index = items.findIndex((it: any) => it.id === id);
      if (index >= 0) return { items, item: items[index], index };
    }
    return null;
  };
  const findHighlight = (id: string): { highlights: any[]; index: number } | null => {
    for (const s of next as any[]) {
      const items = s.items as any[] | undefined;
      if (!items) continue;
      for (const it of items) {
        const highlights = it.highlights as any[] | undefined;
        if (!highlights) continue;
        const index = highlights.findIndex((h: any) => h.id === id);
        if (index >= 0) return { highlights, index };
      }
    }
    return null;
  };

  for (const op of operations ?? []) {
    switch (op.op) {
      case 'set_visibility': {
        const s = findSection(op.target_id);
        if (s) { s.visible = op.visible; break; }
        const it = findItem(op.target_id);
        if (it) { it.item.visible = op.visible; break; }
        const hl = findHighlight(op.target_id);
        if (hl) { hl.highlights[hl.index].visible = op.visible; break; }
        warnings.push(`Couldn't find something to ${op.visible ? 'show' : 'hide'} (${op.target_id})`);
        break;
      }
      case 'update_fields': {
        const s = findSection(op.target_id);
        if (s) { applyFields(s, op.fields); break; }
        const it = findItem(op.target_id);
        if (it) { applyFields(it.item, op.fields); break; }
        warnings.push(`Couldn't find something to update (${op.target_id})`);
        break;
      }
      case 'remove': {
        const si = next.findIndex(s => s.id === op.target_id);
        if (si >= 0) { next.splice(si, 1); break; }
        const it = findItem(op.target_id);
        if (it) { it.items.splice(it.index, 1); break; }
        const hl = findHighlight(op.target_id);
        if (hl) { hl.highlights.splice(hl.index, 1); break; }
        warnings.push(`Couldn't find something to remove (${op.target_id})`);
        break;
      }
      case 'add_item': {
        const s = findSection(op.section_id);
        if (!s || !Array.isArray(s.items)) { warnings.push(`Couldn't find a section to add to (${op.section_id})`); break; }
        const item = normalizeNewItem(s.type, op.item);
        if (op.position === 'start') s.items.unshift(item);
        else s.items.push(item);
        break;
      }
      case 'add_highlight': {
        const it = findItem(op.item_id);
        if (!it) { warnings.push(`Couldn't find an item to add a bullet to (${op.item_id})`); break; }
        if (!Array.isArray(it.item.highlights)) it.item.highlights = [];
        const hl: ResumeHighlight = { id: genId(), text: op.text, visible: true };
        if (op.position === 'start') it.item.highlights.unshift(hl);
        else it.item.highlights.push(hl);
        break;
      }
      case 'reorder_items': {
        const s = findSection(op.section_id);
        if (!s || !Array.isArray(s.items)) { warnings.push(`Couldn't find a section to reorder (${op.section_id})`); break; }
        s.items = reorderById(s.items, op.item_ids);
        break;
      }
      case 'reorder_sections': {
        const reordered = reorderById(next as any[], op.section_ids);
        reordered.forEach((s: any, i: number) => { s.order = i; });
        next.splice(0, next.length, ...(reordered as ResumeSection[]));
        break;
      }
    }
  }

  return { sections: next, warnings };
}

function truncate(text: string, n = 44): string {
  const t = (text || '').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

function sectionTypeLabel(type: ResumeSectionType): string {
  const map: Record<ResumeSectionType, string> = {
    summary: 'Summary', work_experience: 'Work Experience', education: 'Education',
    skills: 'Skills', projects: 'Projects', certifications: 'Certifications',
    languages: 'Languages', custom: 'Section',
  };
  return map[type] || 'Section';
}

function nodeLabel(node: any): string {
  return node.name || node.title || node.institution || node.text || node.company || 'item';
}

/**
 * Human-readable one-liners describing what a set of operations will do, for a
 * confirm-before-apply preview. Names are resolved from the CURRENT sections.
 */
export function describeOperations(operations: ResumeOperation[], sections: ResumeSection[]): string[] {
  const labelOf = new Map<string, string>();
  for (const s of sections) {
    labelOf.set(s.id, s.label || sectionTypeLabel(s.type));
    const items = (s as any).items as any[] | undefined;
    if (items) for (const it of items) {
      labelOf.set(it.id, nodeLabel(it));
      const hs = it.highlights as any[] | undefined;
      if (hs) for (const h of hs) labelOf.set(h.id, `"${truncate(h.text)}"`);
    }
  }
  const nameOf = (id: string) => labelOf.get(id) || 'item';

  const lines: string[] = [];
  for (const op of operations ?? []) {
    switch (op.op) {
      case 'set_visibility':
        lines.push(`${op.visible ? 'Show' : 'Hide'} ${nameOf(op.target_id)}`); break;
      case 'update_fields':
        lines.push(`Update ${Object.keys(op.fields || {}).join(', ') || 'fields'} of ${nameOf(op.target_id)}`); break;
      case 'remove':
        lines.push(`Remove ${nameOf(op.target_id)}`); break;
      case 'add_item': {
        const it = (op.item || {}) as any;
        lines.push(`Add ${it.name || it.title || it.text || 'new item'}`); break;
      }
      case 'add_highlight':
        lines.push(`Add a bullet to ${nameOf(op.item_id)}`); break;
      case 'reorder_items':
        lines.push(`Reorder items in ${nameOf(op.section_id)}`); break;
      case 'reorder_sections':
        lines.push('Reorder sections'); break;
    }
  }
  return lines;
}

// ─── Sync a version's sections from the (possibly updated) profile ─────────────

function normKey(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function itemMergeKey(type: string, item: any): string {
  switch (type) {
    case 'work_experience': return normKey(`${item.company} | ${item.title}`);
    case 'education': return normKey(`${item.institution} | ${item.degree || ''}`);
    case 'projects': return normKey(item.name);
    case 'certifications': return normKey(item.name);
    case 'skills':
    case 'languages': return normKey(item.text);
    default: return normKey(JSON.stringify(item));
  }
}

/**
 * Non-destructively pull items that exist in the profile but are missing from a
 * version's sections (e.g. projects added after the version was created). Existing
 * items are untouched; missing sections are created. Returns new sections + count.
 */
export function mergeProfileIntoSections(
  sections: ResumeSection[],
  profile: UserProfile,
): { sections: ResumeSection[]; added: number } {
  const fresh = initVersionFromProfile(profile, '', '').sections;
  const next: any[] = JSON.parse(JSON.stringify(sections ?? []));
  let added = 0;
  let maxOrder = next.reduce((m, s) => Math.max(m, s.order || 0), 0);

  for (const fs of fresh as any[]) {
    if (fs.type === 'summary') continue;                 // never overwrite the summary
    const cur = next.find(s => s.type === fs.type);
    if (!cur) {
      next.push({ ...fs, order: ++maxOrder });           // whole section was missing
      added += Array.isArray(fs.items) ? fs.items.length : 0;
      continue;
    }
    if (!Array.isArray(fs.items) || !Array.isArray(cur.items)) continue;
    const seen = new Set(cur.items.map((it: any) => itemMergeKey(cur.type, it)));
    for (const it of fs.items) {
      const key = itemMergeKey(fs.type, it);
      if (!seen.has(key)) {
        cur.items.push({ ...it, id: genId() });
        seen.add(key);
        added++;
      }
    }
  }
  return { sections: next as ResumeSection[], added };
}

// ─── Diff annotation for the on-canvas AI review ──────────────────────────────

export type DiffStatus = 'added' | 'removed' | 'modified' | 'hidden' | 'shown';

/**
 * Like applyResumeOperations, but instead of mutating, it TAGS each affected
 * node with `__diff` and keeps removed nodes in place — so the canvas can render
 * a git/Copilot-style preview of what an operation set would change.
 */
export function annotateResumeDiff(
  sections: ResumeSection[],
  operations: ResumeOperation[],
): ResumeSection[] {
  const next: any[] = JSON.parse(JSON.stringify(sections ?? []));

  const findSection = (id: string): any => next.find(s => s.id === id);
  const findItem = (id: string): { items: any[]; item: any } | null => {
    for (const s of next) {
      if (!Array.isArray(s.items)) continue;
      const item = s.items.find((it: any) => it.id === id);
      if (item) return { items: s.items, item };
    }
    return null;
  };
  const findHighlight = (id: string): any | null => {
    for (const s of next) {
      if (!Array.isArray(s.items)) continue;
      for (const it of s.items) {
        const h = (it.highlights || []).find((x: any) => x.id === id);
        if (h) return h;
      }
    }
    return null;
  };

  for (const op of operations ?? []) {
    switch (op.op) {
      case 'set_visibility': {
        const status: DiffStatus = op.visible ? 'shown' : 'hidden';
        const s = findSection(op.target_id); if (s) { s.__diff = status; s.visible = op.visible; break; }
        const it = findItem(op.target_id); if (it) { it.item.__diff = status; it.item.visible = op.visible; break; }
        const hl = findHighlight(op.target_id); if (hl) { hl.__diff = status; hl.visible = op.visible; }
        break;
      }
      case 'update_fields': {
        const s = findSection(op.target_id); if (s) { applyFields(s, op.fields); s.__diff = 'modified'; break; }
        const it = findItem(op.target_id); if (it) { applyFields(it.item, op.fields); it.item.__diff = 'modified'; }
        break;
      }
      case 'remove': {
        const s = findSection(op.target_id); if (s) { s.__diff = 'removed'; break; }
        const it = findItem(op.target_id); if (it) { it.item.__diff = 'removed'; break; }
        const hl = findHighlight(op.target_id); if (hl) { hl.__diff = 'removed'; }
        break;
      }
      case 'add_item': {
        const s = findSection(op.section_id);
        if (s && Array.isArray(s.items)) {
          const item = normalizeNewItem(s.type, op.item);
          item.__diff = 'added';
          if (op.position === 'start') s.items.unshift(item); else s.items.push(item);
        }
        break;
      }
      case 'add_highlight': {
        const it = findItem(op.item_id);
        if (it) {
          if (!Array.isArray(it.item.highlights)) it.item.highlights = [];
          const hl: any = { id: genId(), text: op.text, visible: true, __diff: 'added' };
          if (op.position === 'start') it.item.highlights.unshift(hl); else it.item.highlights.push(hl);
        }
        break;
      }
      case 'reorder_items': {
        const s = findSection(op.section_id);
        if (s && Array.isArray(s.items)) s.items = reorderById(s.items, op.item_ids);
        break;
      }
      case 'reorder_sections': {
        const reordered = reorderById(next, op.section_ids);
        reordered.forEach((s: any, i: number) => { s.order = i; });
        next.splice(0, next.length, ...reordered);
        break;
      }
    }
  }
  return next as ResumeSection[];
}

/* eslint-enable @typescript-eslint/no-explicit-any */

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
