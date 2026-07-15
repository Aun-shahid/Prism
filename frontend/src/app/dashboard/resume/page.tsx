'use client';

import * as React from 'react';
import {
  Box, Typography, Button, IconButton, Stack, Alert, CircularProgress,
  Tooltip, Chip, Divider, TextField, FormControl, InputLabel,
  Select, MenuItem, Switch, Slider, Accordion, AccordionSummary,
  AccordionDetails, Dialog, DialogTitle, DialogContent, DialogActions,
  Drawer, Popover, AppBar, Toolbar, Snackbar, Paper,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArticleIcon from '@mui/icons-material/Article';
import SettingsIcon from '@mui/icons-material/Settings';
import LayersIcon from '@mui/icons-material/Layers';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import SyncIcon from '@mui/icons-material/Sync';

import { useAuth } from '../../../hooks/useAuth';
import { profileService, UserProfile } from '../../../services/profile';
import { applicationsService, JobApplication } from '../../../services/applications';
import { resumeService, TailorResult } from '../../../services/resume';
import {
  resumeVersionApi,
  initVersionFromProfile,
  genId,
  applyResumeOperations,
  mergeProfileIntoSections,
  annotateResumeDiff,
  ResumeVersion,
  ResumeCustomization,
  ResumeLayout,
  ResumeSection,
  ResumeWorkSection,
  ResumeEducationSection,
  ResumeSkillsSection,
  ResumeProjectsSection,
  ResumeCertificationsSection,
  ResumeLanguagesSection,
  ResumeSummarySection,
  ResumeCustomSection,
  ResumeSimpleItem,
  ResumeHighlight,
  DEFAULT_CUSTOMIZATION,
  HEADING_FONT_OPTIONS,
  BODY_FONT_OPTIONS,
  GOOGLE_FONTS_URL,
} from '../../../services/resumeBuilder';
import ResumeTemplate from './ResumeTemplate';
import ResumeDiffPreview from './ResumeDiffPreview';

// ─── Thin scrollbar sx helper ─────────────────────────────────────────────────
const thinScroll = {
  '&::-webkit-scrollbar': { width: '4px' },
  '&::-webkit-scrollbar-track': { background: 'transparent' },
  '&::-webkit-scrollbar-thumb': { background: 'rgba(0,0,0,0.18)', borderRadius: '4px' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function snakeToTitle(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

// ─── Word export ──────────────────────────────────────────────────────────────
async function downloadWordDoc(version: ResumeVersion) {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, TabStopType, convertInchesToTwip } = await import('docx');
  const { saveAs } = await import('file-saver');
  const c = version.customization;
  const col = (hex: string) => hex.replace('#', '');
  const sz = (pt: number) => Math.round(pt * 2);
  const base = c.layout.baseFontSize;
  const rts = [{ type: TabStopType.RIGHT, position: convertInchesToTwip(6.5) }];

  const ps: InstanceType<typeof Paragraph>[] = [];
  const contact = version.contact;
  const fullName = [contact.firstName, contact.middleName, contact.lastName].filter(Boolean).join(' ');
  const contactParts = [contact.email, contact.phone, contact.address, contact.linkedin, contact.github, contact.portfolio].filter(Boolean) as string[];

  ps.push(new Paragraph({ children: [new TextRun({ text: fullName, bold: true, size: sz(base * 2.6), color: col(c.primaryColor) })], alignment: AlignmentType.CENTER }));
  if (contactParts.length) {
    ps.push(new Paragraph({ children: [new TextRun({ text: contactParts.join('  |  '), size: sz(base * 0.88) })], alignment: AlignmentType.CENTER, spacing: { after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: col(c.primaryColor), space: 1 } } }));
  }

  const addSH = (label: string) => ps.push(new Paragraph({ children: [new TextRun({ text: label.toUpperCase(), bold: true, size: sz(base * 1.05), allCaps: true, color: col(c.primaryColor) })], spacing: { before: 240, after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: col(c.primaryColor), space: 1 } } }));

  const sorted = [...version.sections].sort((a, b) => a.order - b.order).filter(s => s.visible);
  for (const section of sorted) {
    if (section.type === 'summary') {
      const s = section as ResumeSummarySection;
      if (!s.content) continue;
      addSH(s.label);
      ps.push(new Paragraph({ children: [new TextRun({ text: s.content, size: sz(base) })], spacing: { after: 120 } }));
    } else if (section.type === 'work_experience') {
      const s = section as ResumeWorkSection;
      const vis = s.items.filter(i => i.visible);
      if (!vis.length) continue;
      addSH(s.label);
      for (const exp of vis) {
        ps.push(new Paragraph({ children: [new TextRun({ text: exp.company, bold: true, size: sz(base) }), new TextRun({ text: '\t' }), new TextRun({ text: exp.location || '', size: sz(base * 0.9) })], tabStops: rts, spacing: { before: 80, after: 0 } }));
        ps.push(new Paragraph({ children: [new TextRun({ text: exp.title, italics: true, size: sz(base * 0.95), color: col(c.accentColor) }), new TextRun({ text: '\t' }), new TextRun({ text: `${exp.startDate || ''} – ${exp.endDate || 'Present'}`, size: sz(base * 0.88) })], tabStops: rts, spacing: { after: 40 } }));
        for (const h of exp.highlights.filter(h => h.visible)) { ps.push(new Paragraph({ children: [new TextRun({ text: h.text, size: sz(base) })], bullet: { level: 0 }, spacing: { after: 20 } })); }
        if (!exp.highlights.length && exp.description) { ps.push(new Paragraph({ children: [new TextRun({ text: exp.description, size: sz(base) })], spacing: { after: 40 } })); }
      }
    } else if (section.type === 'education') {
      const s = section as ResumeEducationSection;
      const vis = s.items.filter(i => i.visible);
      if (!vis.length) continue;
      addSH(s.label);
      for (const edu of vis) {
        ps.push(new Paragraph({ children: [new TextRun({ text: edu.institution, bold: true, size: sz(base) })], spacing: { before: 80, after: 0 } }));
        ps.push(new Paragraph({ children: [new TextRun({ text: [edu.degree, edu.fieldOfStudy].filter(Boolean).join(', '), italics: true, size: sz(base * 0.95), color: col(c.accentColor) })], spacing: { after: 40 } }));
        if (edu.gpa) { ps.push(new Paragraph({ children: [new TextRun({ text: `GPA: ${edu.gpa}`, size: sz(base * 0.88) })], spacing: { after: 40 } })); }
      }
    } else if (section.type === 'skills' || section.type === 'languages') {
      const s = section as ResumeSkillsSection | ResumeLanguagesSection;
      const vis = s.items.filter(i => i.visible);
      if (!vis.length) continue;
      addSH(s.label);
      ps.push(new Paragraph({ children: [new TextRun({ text: vis.map(i => i.text).join(' • '), size: sz(base) })], spacing: { after: 120 } }));
    } else if (section.type === 'projects') {
      const s = section as ResumeProjectsSection;
      const vis = s.items.filter(i => i.visible);
      if (!vis.length) continue;
      addSH(s.label);
      for (const proj of vis) {
        ps.push(new Paragraph({ children: [new TextRun({ text: proj.name, bold: true, size: sz(base) })], spacing: { before: 80, after: 0 } }));
        if (proj.technologies) { ps.push(new Paragraph({ children: [new TextRun({ text: proj.technologies, italics: true, size: sz(base * 0.9), color: col(c.accentColor) })], spacing: { after: 20 } })); }
        for (const h of proj.highlights.filter(h => h.visible)) { ps.push(new Paragraph({ children: [new TextRun({ text: h.text, size: sz(base) })], bullet: { level: 0 }, spacing: { after: 20 } })); }
        if (!proj.highlights.length && proj.description) { ps.push(new Paragraph({ children: [new TextRun({ text: proj.description, size: sz(base) })], spacing: { after: 40 } })); }
      }
    } else if (section.type === 'certifications') {
      const s = section as ResumeCertificationsSection;
      const vis = s.items.filter(i => i.visible);
      if (!vis.length) continue;
      addSH(s.label);
      for (const cert of vis) {
        ps.push(new Paragraph({ children: [new TextRun({ text: `${cert.name}${cert.issuer ? ' — ' + cert.issuer : ''}${cert.date ? ' (' + cert.date + ')' : ''}`, size: sz(base) })], bullet: { level: 0 }, spacing: { after: 20 } }));
      }
    } else if (section.type === 'custom') {
      const s = section as ResumeCustomSection;
      const vis = s.items.filter(i => i.visible);
      if (!vis.length) continue;
      addSH(s.label);
      for (const item of vis) {
        if (item.title) { ps.push(new Paragraph({ children: [new TextRun({ text: item.title, bold: true, size: sz(base) })], spacing: { before: 80, after: 20 } })); }
        for (const field of item.fields.filter(f => f.visible)) {
          ps.push(new Paragraph({ children: [new TextRun({ text: field.key ? `${field.key}: ` : '', bold: true, size: sz(base) }), new TextRun({ text: field.value, size: sz(base) })], spacing: { after: 20 } }));
        }
      }
    }
  }

  const doc = new Document({ sections: [{ properties: {}, children: ps }] });
  const blob = await Packer.toBlob(doc);
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Resume';
  saveAs(blob, `${name} CV.docx`);
}

// ─── PDF export ───────────────────────────────────────────────────────────────
async function downloadPDF(ref: React.RefObject<HTMLDivElement | null>, version: ResumeVersion) {
  if (!ref.current) return;
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');
  const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
  const imgData = canvas.toDataURL('image/png');
  const isLetter = version.customization.layout.pageSize === 'letter';
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: isLetter ? 'letter' : 'a4' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  pdf.addImage(imgData, 'PNG', 0, 0, pw, ph);
  const contact = version.contact;
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Resume';
  pdf.save(`${name} CV.pdf`);
}

// ─── Color field ──────────────────────────────────────────────────────────────
const ColorRow = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1 }}>
    <Box component="input" type="color" value={value} onChange={e => onChange(e.target.value)}
      sx={{ width: 28, height: 28, border: 'none', borderRadius: '6px', cursor: 'pointer', p: 0, background: 'none' }} />
    <Typography variant="body2" sx={{ flex: 1 }}>{label}</Typography>
    <Typography variant="caption" sx={{ fontFamily: 'monospace', opacity: 0.6 }}>{value}</Typography>
  </Stack>
);

// ─── AI bullet coach field ────────────────────────────────────────────────────
// A text field with an inline "improve with AI" button. On click it calls the
// backend bullet coach and shows the best rewrite + alternatives + tips in a
// popover; the user picks one to apply.
function AiBulletField({
  value,
  onChange,
  context,
  multiline = false,
  rows,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  context?: string;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [result, setResult] = React.useState<import('../../../services/resume').BulletImproveResult | null>(null);

  const run = async (e: React.MouseEvent<HTMLElement>) => {
    const target = e.currentTarget;
    if (!value.trim()) return;
    setAnchor(target);
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await resumeService.improveBullet({ text: value, context });
      setResult(res);
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { detail?: string } } };
      setError(ex.response?.data?.detail || 'Could not improve this line.');
    } finally {
      setLoading(false);
    }
  };

  const apply = (text: string) => {
    onChange(text);
    setAnchor(null);
  };

  return (
    <>
      <Box sx={{ position: 'relative', flex: 1 }}>
        <TextField
          size="small"
          fullWidth
          multiline={multiline}
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          slotProps={{ htmlInput: { style: { paddingRight: 30 } } }}
        />
        <Tooltip title="Improve with AI">
          <span>
            <IconButton
              size="small"
              onClick={run}
              disabled={!value.trim()}
              sx={{ position: 'absolute', top: 3, right: 3, color: 'secondary.main' }}
            >
              <AutoFixHighIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { width: 380, maxWidth: '90vw', p: 2 } } }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1.5 }}>
          <AutoAwesomeIcon fontSize="small" color="secondary" />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>AI suggestions</Typography>
        </Stack>

        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Rewriting for impact…</Typography>
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

        {result && (
          <Stack spacing={1.25}>
            <Box
              sx={{
                p: 1.25,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'secondary.main',
                bgcolor: 'rgba(16,185,129,0.06)',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(16,185,129,0.12)' },
              }}
              onClick={() => apply(result.improved)}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'secondary.main', display: 'block', mb: 0.25 }}>
                Recommended
              </Typography>
              <Typography variant="body2">{result.improved}</Typography>
            </Box>

            {result.alternatives?.map((alt, i) => (
              <Box
                key={i}
                sx={{
                  p: 1.25,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
                onClick={() => apply(alt)}
              >
                <Typography variant="body2">{alt}</Typography>
              </Box>
            ))}

            {result.tips?.length > 0 && (
              <Box sx={{ pt: 0.5 }}>
                {result.tips.map((tip, i) => (
                  <Stack key={i} direction="row" spacing={0.75} sx={{ alignItems: 'flex-start', mb: 0.5 }}>
                    <TipsAndUpdatesIcon sx={{ fontSize: 14, color: 'warning.main', mt: '2px' }} />
                    <Typography variant="caption" color="text.secondary">{tip}</Typography>
                  </Stack>
                ))}
              </Box>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
              Click a suggestion to apply it
            </Typography>
          </Stack>
        )}
      </Popover>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ResumeBuilderPage() {
  const { user } = useAuth();
  const resumeRef = React.useRef<HTMLDivElement>(null);

  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [applications, setApplications] = React.useState<JobApplication[]>([]);
  const [versions, setVersions] = React.useState<ResumeVersion[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  // UI state
  const [versionsOpen, setVersionsOpen] = React.useState(false);
  const [customizeOpen, setCustomizeOpen] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);
  const [downloadAnchor, setDownloadAnchor] = React.useState<HTMLElement | null>(null);

  // AI state
  const [aiInstruction, setAiInstruction] = React.useState('');
  const [aiJobDesc, setAiJobDesc] = React.useState('');
  const [aiAppId, setAiAppId] = React.useState('');
  const [aiGenType, setAiGenType] = React.useState<'both' | 'resume' | 'cover_letter'>('resume');
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiError, setAiError] = React.useState('');
  const [aiPreview, setAiPreview] = React.useState<TailorResult | null>(null);
  // Toast for applied AI edits / profile syncs; carries an optional undo snapshot.
  const [toast, setToast] = React.useState<{ message: string; undo?: { sections: ResumeSection[]; aiCoverLetter?: string } } | null>(null);

  const active = versions.find(v => v.id === activeId) ?? null;

  // ─── Load data ─────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [prof, apps, vers] = await Promise.all([
          profileService.getProfile(),
          applicationsService.listApplications(),
          resumeVersionApi.getAll(),
        ]);
        setProfile(prof);
        setApplications(apps);
        if (vers.length > 0) {
          setVersions(vers);
          setActiveId(vers[0].id);
        } else if (prof) {
          // Create initial version from profile
          const init = initVersionFromProfile(prof, user.name || '', user.email || '');
          const created = await resumeVersionApi.create({ ...init, title: 'My Resume' });
          setVersions([created]);
          setActiveId(created.id);
        }
      } catch {
        setError('Failed to load resume data');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // ─── Patch active version (debounced) ─────────────────────────────────────
  const patchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateActive = React.useCallback((patch: Partial<ResumeVersion>) => {
    if (!activeId) return;
    setVersions(prev => prev.map(v => v.id === activeId ? { ...v, ...patch } : v));
    if (patchTimeout.current) clearTimeout(patchTimeout.current);
    patchTimeout.current = setTimeout(async () => {
      try {
        setSaving(true);
        const updated = await resumeVersionApi.update(activeId, {
          title: patch.title,
          isFavorite: patch.isFavorite,
          isAiTailored: patch.isAiTailored,
          contact: patch.contact,
          sections: patch.sections,
          customization: patch.customization,
          aiCoverLetter: patch.aiCoverLetter,
        });
        setVersions(prev => prev.map(v => v.id === activeId ? updated : v));
      } catch { /* silent */ } finally {
        setSaving(false);
      }
    }, 800);
  }, [activeId]);

  // ─── New version ───────────────────────────────────────────────────────────
  const handleNewVersion = async () => {
    if (!profile || !user) return;
    const init = initVersionFromProfile(profile, user.name || '', user.email || '');
    const created = await resumeVersionApi.create({ ...init, title: `Resume ${versions.length + 1}` });
    setVersions(prev => [created, ...prev]);
    setActiveId(created.id);
    setVersionsOpen(false);
  };

  // ─── Duplicate ─────────────────────────────────────────────────────────────
  const handleDuplicate = async (id: string) => {
    const dup = await resumeVersionApi.duplicate(id);
    setVersions(prev => [dup, ...prev]);
    setActiveId(dup.id);
  };

  // ─── Delete version ────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    await resumeVersionApi.delete(id);
    const remaining = versions.filter(v => v.id !== id);
    setVersions(remaining);
    if (activeId === id) setActiveId(remaining[0]?.id ?? null);
  };

  // ─── Rename ────────────────────────────────────────────────────────────────
  const handleRename = async (id: string, title: string) => {
    setVersions(prev => prev.map(v => v.id === id ? { ...v, title } : v));
    await resumeVersionApi.update(id, { title });
  };

  // ─── Favorite ──────────────────────────────────────────────────────────────
  const handleFavorite = async (id: string) => {
    const v = versions.find(v => v.id === id);
    if (!v) return;
    const updated = await resumeVersionApi.update(id, { isFavorite: !v.isFavorite });
    setVersions(prev => prev.map(v => v.id === id ? updated : v));
  };

  // ─── AI tailor ─────────────────────────────────────────────────────────────
  // Step 1: ask the AI for edit operations (a preview) — nothing is applied yet.
  const handleAiTailor = async () => {
    if (!active) return;
    setAiLoading(true);
    setAiError('');
    try {
      const result = await resumeService.tailor({
        instruction: aiInstruction.trim() || undefined,
        job_description: aiJobDesc.trim() || undefined,
        sections: active.sections,
        want_resume: aiGenType !== 'cover_letter',
        want_cover_letter: aiGenType !== 'resume',
      });
      // If the AI proposed nothing, keep the dialog open with a message.
      if (!(result.operations?.length) && !result.cover_letter) {
        setAiError('The AI didn’t suggest any changes. Try rephrasing your instruction.');
        return;
      }
      // Otherwise close the input dialog and review the diff on the canvas.
      setAiPreview(result);
      setAiOpen(false);
    } catch (e: unknown) {
      setAiError((e as Error)?.message || 'Generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  // Step 2: apply the previewed operations to the current resume, with Undo.
  const applyAiPreview = () => {
    if (!active || !aiPreview) return;
    const snapshot = active.sections;
    const prevCover = active.aiCoverLetter;
    const { sections, warnings } = applyResumeOperations(active.sections, aiPreview.operations);

    updateActive({
      sections,
      isAiTailored: true,
      ...(aiPreview.cover_letter ? { aiCoverLetter: aiPreview.cover_letter } : {}),
    });

    const changed = aiPreview.operations.length;
    const parts: string[] = [];
    if (changed) parts.push(`Applied ${changed} change${changed === 1 ? '' : 's'}`);
    if (aiPreview.cover_letter) parts.push('cover letter attached');
    if (warnings.length) parts.push(`${warnings.length} skipped`);
    setToast({ message: parts.join(' · ') || 'No changes to apply', undo: { sections: snapshot, aiCoverLetter: prevCover } });

    setAiPreview(null);
  };

  // Pull items added to the profile (e.g. new projects) into the active version.
  const syncFromProfile = () => {
    if (!active || !profile) return;
    const snapshot = active.sections;
    const { sections, added } = mergeProfileIntoSections(active.sections, profile);
    if (added === 0) {
      setToast({ message: 'Resume is already up to date with your profile' });
      return;
    }
    updateActive({ sections });
    setToast({
      message: `Added ${added} item${added === 1 ? '' : 's'} from your profile`,
      undo: { sections: snapshot, aiCoverLetter: active.aiCoverLetter },
    });
  };

  const handleToastUndo = () => {
    if (toast?.undo) updateActive({ sections: toast.undo.sections, aiCoverLetter: toast.undo.aiCoverLetter });
    setToast(null);
  };

  const closeAiDialog = () => {
    setAiOpen(false);
    setAiError('');
  };

  // Annotated sections for the on-canvas AI diff review.
  const aiDiffSections = React.useMemo(
    () => (aiPreview && active ? annotateResumeDiff(active.sections, aiPreview.operations) : null),
    [aiPreview, active],
  );

  // ─── Section helpers ───────────────────────────────────────────────────────
  const patchSection = (sectionId: string, patch: Partial<ResumeSection>) => {
    if (!active) return;
    const sections = active.sections.map(s => s.id === sectionId ? ({ ...s, ...patch } as ResumeSection) : s);
    updateActive({ sections });
  };

  const addCustomSection = () => {
    if (!active) return;
    const newSection: ResumeCustomSection = {
      id: genId(), type: 'custom', label: 'Custom Section',
      visible: true, order: active.sections.length, items: [],
    };
    updateActive({ sections: [...active.sections, newSection] });
  };

  // ─── Drag-to-reorder sections ──────────────────────────────────────────────
  const dragSectionId = React.useRef<string | null>(null);
  const reorderSections = (draggedId: string, targetId: string) => {
    if (!active || draggedId === targetId) return;
    const ordered = [...active.sections].sort((a, b) => a.order - b.order);
    const from = ordered.findIndex(s => s.id === draggedId);
    const to = ordered.findIndex(s => s.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    updateActive({ sections: ordered.map((s, i) => ({ ...s, order: i })) });
  };
  const onSectionDragStart = (id: string) => { dragSectionId.current = id; };
  const onSectionDrop = (id: string) => {
    if (dragSectionId.current) reorderSections(dragSectionId.current, id);
    dragSectionId.current = null;
  };

  // ─── Customize helpers ─────────────────────────────────────────────────────
  const patchCustomization = (patch: Partial<ResumeCustomization>) => {
    if (!active) return;
    updateActive({ customization: { ...active.customization, ...patch } });
  };

  const patchLayout = (patch: Partial<ResumeLayout>) => {
    if (!active) return;
    updateActive({ customization: { ...active.customization, layout: { ...active.customization.layout, ...patch } } });
  };

  // ─── Contact helpers ───────────────────────────────────────────────────────
  const patchContact = (key: string, value: string) => {
    if (!active) return;
    updateActive({ contact: { ...active.contact, [key]: value } });
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
  }

  if (!active) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>No resume versions yet</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleNewVersion}>Create Resume</Button>
      </Box>
    );
  }

  return (
    <>
      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href={GOOGLE_FONTS_URL} />

      <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden', bgcolor: '#f1f5f9', mx: -3, mt: -3, mb: -3 }}>
        {/* ─── TOOLBAR ────────────────────────────────────────────────────── */}
        <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', zIndex: 10 }}>
          <Toolbar variant="dense" sx={{ gap: 1, minHeight: 48 }}>
            {/* Versions button */}
            <Button size="small" startIcon={<LayersIcon />} onClick={() => setVersionsOpen(true)}
              sx={{ textTransform: 'none', fontWeight: 600 }}>
              Versions
            </Button>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Active title (editable) */}
            <TextField
              value={active.title}
              onChange={e => handleRename(active.id, e.target.value)}
              variant="standard"
              slotProps={{ htmlInput: { style: { fontWeight: 600, fontSize: 14 } } }}
              sx={{ width: 200, '& .MuiInput-underline:before': { borderBottomColor: 'transparent' } }}
            />

            {active.isAiTailored && (
              <Chip label="AI" size="small" color="secondary" icon={<AutoAwesomeIcon />} sx={{ ml: 0.5 }} />
            )}

            <Box sx={{ flex: 1 }} />

            {saving && <CircularProgress size={14} sx={{ mr: 1 }} />}

            {/* Sync from profile */}
            <Tooltip title="Pull items from My Profile that aren't in this resume yet (e.g. newly added projects)">
              <Button size="small" startIcon={<SyncIcon />} onClick={syncFromProfile}
                sx={{ textTransform: 'none' }}>
                Sync
              </Button>
            </Tooltip>

            {/* AI Tailor */}
            <Button size="small" startIcon={<AutoAwesomeIcon />} onClick={() => setAiOpen(true)}
              sx={{ textTransform: 'none' }}>
              AI Tailor
            </Button>

            {/* Customize */}
            <Button size="small" startIcon={<SettingsIcon />} onClick={() => setCustomizeOpen(true)}
              sx={{ textTransform: 'none' }}>
              Customize
            </Button>

            {/* Download */}
            <Button size="small" variant="contained" startIcon={<PictureAsPdfIcon />}
              onClick={e => setDownloadAnchor(e.currentTarget)}
              sx={{ textTransform: 'none' }}>
              Download
            </Button>
          </Toolbar>
        </AppBar>

        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mx: 2, mt: 1 }}>{error}</Alert>}

        {/* ─── RESUME PREVIEW ─────────────────────────────────────────────── */}
        <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2, px: 2, ...thinScroll }}>
          {/* AI change review bar (shown on the canvas instead of a modal) */}
          {aiPreview && (
            <Paper elevation={4} sx={{ position: 'sticky', top: 0, zIndex: 5, width: '100%', maxWidth: 900, mb: 2, p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <AutoAwesomeIcon color="secondary" fontSize="small" />
              <Box sx={{ flex: 1, minWidth: 220 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>Review AI changes</Typography>
                <Typography variant="caption" color="text.secondary">
                  {aiPreview.summary || `${aiPreview.operations.length} change(s) proposed`}
                  {aiPreview.cover_letter && ' · cover letter ready'}
                </Typography>
              </Box>
              <Stack direction="row" sx={{ gap: 1.25, alignItems: 'center' }}>
                {([['#10b981', 'Added'], ['#ef4444', 'Removed'], ['#f59e0b', 'Edited']] as [string, string][]).map(([col, lbl]) => (
                  <Stack key={lbl} direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: col }} />
                    <Typography variant="caption" color="text.secondary">{lbl}</Typography>
                  </Stack>
                ))}
              </Stack>
              <Button size="small" onClick={() => setAiPreview(null)}>Discard</Button>
              <Button size="small" variant="contained" startIcon={<CheckIcon />} onClick={applyAiPreview}>
                Apply changes
              </Button>
            </Paper>
          )}

          {/* Normal preview (kept mounted for PDF export ref, hidden while reviewing) */}
          <Box sx={{ boxShadow: '0 4px 32px rgba(0,0,0,0.13)', borderRadius: 1, flexShrink: 0, mb: 4, display: aiPreview ? 'none' : 'block' }}>
            <ResumeTemplate ref={resumeRef} version={active} />
          </Box>
          {/* On-canvas diff while reviewing AI changes */}
          {aiPreview && aiDiffSections && (
            <Box sx={{ boxShadow: '0 4px 32px rgba(0,0,0,0.13)', borderRadius: 1, flexShrink: 0, mb: 4 }}>
              <ResumeDiffPreview version={active} sections={aiDiffSections} />
            </Box>
          )}
        </Box>
      </Box>

      {/* ═══════════════════════════════════════════════════════════════════════
          VERSIONS DIALOG
      ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={versionsOpen} onClose={() => setVersionsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Resume Versions</Typography>
          <IconButton onClick={() => setVersionsOpen(false)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <Box sx={{ maxHeight: 500, overflow: 'auto', ...thinScroll }}>
            {versions.map(v => (
              <Box key={v.id} onClick={() => { setActiveId(v.id); setVersionsOpen(false); }}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5, cursor: 'pointer', borderBottom: '1px solid', borderColor: 'divider', bgcolor: v.id === activeId ? 'action.selected' : 'transparent', '&:hover': { bgcolor: 'action.hover' } }}>
                {v.id === activeId && <CheckIcon fontSize="small" color="primary" />}
                {v.id !== activeId && <Box sx={{ width: 20 }} />}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{v.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[formatDate(v.createdAt), v.isAiTailored ? 'AI tailored' : '', v.applicationLabel || '']
                      .filter(Boolean).join(' · ') || 'Draft'}
                  </Typography>
                </Box>
                <Tooltip title={v.isFavorite ? 'Unfavorite' : 'Favorite'}>
                  <IconButton size="small" onClick={e => { e.stopPropagation(); handleFavorite(v.id); }}>
                    {v.isFavorite ? <StarIcon fontSize="small" color="warning" /> : <StarBorderIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Duplicate">
                  <IconButton size="small" onClick={e => { e.stopPropagation(); handleDuplicate(v.id); }}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" onClick={e => { e.stopPropagation(); handleDelete(v.id); }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button startIcon={<AddIcon />} onClick={handleNewVersion}>New Version from Profile</Button>
        </DialogActions>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          CUSTOMIZE DRAWER
      ═══════════════════════════════════════════════════════════════════════ */}
      <Drawer anchor="right" open={customizeOpen} onClose={() => setCustomizeOpen(false)}
        slotProps={{ paper: { sx: { width: 380, display: 'flex', flexDirection: 'column' } } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6">Customize</Typography>
          <IconButton onClick={() => setCustomizeOpen(false)} size="small"><CloseIcon /></IconButton>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', ...thinScroll }}>
          {/* ── Appearance ── */}
          <Accordion defaultExpanded disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Appearance</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Heading Font</InputLabel>
                <Select label="Heading Font" value={active.customization.headingFont} onChange={e => patchCustomization({ headingFont: e.target.value })}>
                  {HEADING_FONT_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Body Font</InputLabel>
                <Select label="Body Font" value={active.customization.bodyFont} onChange={e => patchCustomization({ bodyFont: e.target.value })}>
                  {BODY_FONT_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                </Select>
              </FormControl>
              <ColorRow label="Primary (name / headers)" value={active.customization.primaryColor} onChange={v => patchCustomization({ primaryColor: v })} />
              <ColorRow label="Accent (titles / links)" value={active.customization.accentColor} onChange={v => patchCustomization({ accentColor: v })} />
              <ColorRow label="Body text" value={active.customization.textColor} onChange={v => patchCustomization({ textColor: v })} />
              <ColorRow label="Divider line" value={active.customization.lineColor} onChange={v => patchCustomization({ lineColor: v })} />
            </AccordionDetails>
          </Accordion>

          {/* ── Layout ── */}
          <Accordion disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Layout</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Page Size</InputLabel>
                <Select label="Page Size" value={active.customization.layout.pageSize} onChange={e => patchLayout({ pageSize: e.target.value as 'a4' | 'letter' })}>
                  <MenuItem value="a4">A4</MenuItem>
                  <MenuItem value="letter">Letter</MenuItem>
                </Select>
              </FormControl>

              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Text alignment</Typography>
              <Stack direction="row" sx={{ gap: 1, mb: 2 }}>
                <Button variant={active.customization.layout.textAlign === 'left' ? 'contained' : 'outlined'} size="small" startIcon={<FormatAlignLeftIcon />} onClick={() => patchLayout({ textAlign: 'left' })}>Left</Button>
                <Button variant={active.customization.layout.textAlign === 'justify' ? 'contained' : 'outlined'} size="small" startIcon={<FormatAlignJustifyIcon />} onClick={() => patchLayout({ textAlign: 'justify' })}>Justify</Button>
              </Stack>

              <Typography variant="caption" color="text.secondary">Base font size: {active.customization.layout.baseFontSize}pt</Typography>
              <Slider min={8} max={13} step={0.5} value={active.customization.layout.baseFontSize} onChange={(_, v) => patchLayout({ baseFontSize: v as number })} size="small" sx={{ mb: 1.5 }} />

              <Typography variant="caption" color="text.secondary">Line height: {active.customization.layout.lineHeight}</Typography>
              <Slider min={1.2} max={1.8} step={0.05} value={active.customization.layout.lineHeight} onChange={(_, v) => patchLayout({ lineHeight: v as number })} size="small" sx={{ mb: 1.5 }} />

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Margins (mm)</Typography>
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                {(['marginTop', 'marginBottom', 'marginLeft', 'marginRight'] as const).map(key => (
                  <Box key={key} sx={{ flex: '1 1 40%' }}>
                    <Typography variant="caption">{snakeToTitle(key.replace('margin', ''))}</Typography>
                    <Slider min={5} max={40} step={1} value={active.customization.layout[key]} onChange={(_, v) => patchLayout({ [key]: v as number })} size="small" />
                    <Typography variant="caption" color="text.secondary">{active.customization.layout[key]}mm</Typography>
                  </Box>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* ── Contact ── */}
          <Accordion disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Contact Info</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {([
                ['firstName', 'First Name'],
                ['middleName', 'Middle Name (optional)'],
                ['lastName', 'Last Name'],
                ['email', 'Email'],
                ['phone', 'Phone'],
                ['address', 'Address / City'],
                ['linkedin', 'LinkedIn URL'],
                ['github', 'GitHub URL'],
                ['portfolio', 'Portfolio URL'],
                ['website', 'Website URL'],
              ] as [string, string][]).map(([key, label]) => (
                <TextField key={key} fullWidth size="small" label={label} sx={{ mb: 1.5 }}
                  value={(active.contact[key] as string) || ''}
                  onChange={e => patchContact(key, e.target.value)} />
              ))}
            </AccordionDetails>
          </Accordion>

          {/* ── Sections ── */}
          <Accordion disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Sections</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              {[...active.sections].sort((a, b) => a.order - b.order).map(section => (
                <SectionEditor key={section.id} section={section} patchSection={patchSection}
                  onSectionDragStart={onSectionDragStart} onSectionDrop={onSectionDrop} />
              ))}
              <Box sx={{ p: 2 }}>
                <Button fullWidth size="small" startIcon={<AddIcon />} variant="outlined" onClick={addCustomSection}>
                  Add Custom Section
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>
      </Drawer>

      {/* ═══════════════════════════════════════════════════════════════════════
          AI TAILOR DIALOG
      ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={aiOpen} onClose={closeAiDialog} maxWidth="sm" fullWidth>
        <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
            <AutoAwesomeIcon color="secondary" fontSize="small" />
            <Typography variant="h6">AI Tailor Resume</Typography>
          </Stack>
          <IconButton onClick={closeAiDialog} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          {aiError && <Alert severity="error" sx={{ mb: 2 }}>{aiError}</Alert>}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Describe the edits you want, paste a job description, or both. You&apos;ll review every change highlighted on the resume before anything is applied.
          </Typography>
          <TextField
            fullWidth multiline rows={3} label="Instruction (optional)"
            placeholder="e.g. remove my 2 weakest projects and add Prism and Nimbus; make the summary punchier"
            value={aiInstruction} onChange={e => setAiInstruction(e.target.value)} sx={{ mb: 2 }}
          />
          <TextField
            fullWidth multiline rows={6} label="Job Description (optional)"
            placeholder="Paste a job description to tailor against..."
            value={aiJobDesc} onChange={e => setAiJobDesc(e.target.value)} sx={{ mb: 2 }}
          />
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Generate</InputLabel>
            <Select label="Generate" value={aiGenType} onChange={e => setAiGenType(e.target.value as typeof aiGenType)}>
              <MenuItem value="resume">Resume changes only</MenuItem>
              <MenuItem value="both">Resume + Cover Letter</MenuItem>
              <MenuItem value="cover_letter">Cover Letter only</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Link to Application (optional)</InputLabel>
            <Select label="Link to Application (optional)" value={aiAppId}
              onChange={e => {
                const id = e.target.value;
                setAiAppId(id);
                const app = applications.find(a => a.id === id);
                if (app?.job_description) setAiJobDesc(app.job_description);
              }}>
              <MenuItem value="">None</MenuItem>
              {applications.map(a => (
                <MenuItem key={a.id} value={a.id}>{a.position} @ {a.company}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAiDialog}>Cancel</Button>
          <Button variant="contained" startIcon={aiLoading ? <CircularProgress size={14} /> : <AutoAwesomeIcon />}
            onClick={handleAiTailor} disabled={aiLoading || (!aiInstruction.trim() && !aiJobDesc.trim())}>
            {aiLoading ? 'Thinking...' : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast for applied AI edits / profile syncs (with optional Undo) */}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={8000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={toast?.message}
        action={toast?.undo ? <Button color="secondary" size="small" onClick={handleToastUndo}>UNDO</Button> : undefined}
      />

      {/* ═══════════════════════════════════════════════════════════════════════
          DOWNLOAD POPOVER
      ═══════════════════════════════════════════════════════════════════════ */}
      <Popover open={Boolean(downloadAnchor)} anchorEl={downloadAnchor} onClose={() => setDownloadAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 200 }}>
          <Button fullWidth startIcon={<PictureAsPdfIcon />} onClick={() => { downloadPDF(resumeRef, active); setDownloadAnchor(null); }}
            sx={{ justifyContent: 'flex-start', textTransform: 'none' }}>
            Download PDF
          </Button>
          <Button fullWidth startIcon={<DescriptionIcon />} onClick={() => { downloadWordDoc(active); setDownloadAnchor(null); }}
            sx={{ justifyContent: 'flex-start', textTransform: 'none' }}>
            Download Word (.docx)
          </Button>
          {active.aiCoverLetter && (
            <Button fullWidth startIcon={<ArticleIcon />}
              onClick={() => {
                const blob = new Blob([active.aiCoverLetter!], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'Cover Letter.txt'; a.click();
                URL.revokeObjectURL(url);
                setDownloadAnchor(null);
              }}
              sx={{ justifyContent: 'flex-start', textTransform: 'none' }}>
              Download Cover Letter
            </Button>
          )}
        </Box>
      </Popover>
    </>
  );
}

// ─── Section Editor (inside Customize drawer) ────────────────────────────────
function SectionEditor({ section, patchSection, onSectionDragStart, onSectionDrop }: {
  section: ResumeSection;
  patchSection: (id: string, p: Partial<ResumeSection>) => void;
  onSectionDragStart: (id: string) => void;
  onSectionDrop: (id: string) => void;
}) {
  const updateItem = (itemId: string, patch: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anySection = section as any;
    if (!anySection.items) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = anySection.items.map((it: any) =>
      it.id === itemId ? { ...it, ...patch } : it
    );
    patchSection(section.id, { items } as Partial<ResumeSection>);
  };

  // Remove an item card entirely (projects / experience / education / certifications).
  const removeItem = (itemId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anySection = section as any;
    if (!anySection.items) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    patchSection(section.id, { items: anySection.items.filter((it: any) => it.id !== itemId) } as Partial<ResumeSection>);
  };

  // Native drag-to-reorder for items within this section.
  const dragItemId = React.useRef<string | null>(null);
  const reorderItems = (draggedId: string, targetId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (section as any).items as any[] | undefined;
    if (!items || draggedId === targetId) return;
    const from = items.findIndex(it => it.id === draggedId);
    const to = items.findIndex(it => it.id === targetId);
    if (from < 0 || to < 0) return;
    const copy = [...items];
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    patchSection(section.id, { items: copy } as Partial<ResumeSection>);
  };
  const itemHandle = (itemId: string) => (
    <Box component="span" draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', itemId); dragItemId.current = itemId; }}
      sx={{ cursor: 'grab', display: 'inline-flex', color: 'text.disabled' }}>
      <DragIndicatorIcon fontSize="small" />
    </Box>
  );
  const itemDrop = (itemId: string) => ({
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: () => { if (dragItemId.current) reorderItems(dragItemId.current, itemId); dragItemId.current = null; },
  });

  return (
    <Box onDragOver={e => e.preventDefault()} onDrop={() => onSectionDrop(section.id)}>
    <Accordion disableGutters sx={{ boxShadow: 'none', borderBottom: '1px solid', borderColor: 'divider', '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 44, px: 2 }}>
        <Stack direction="row" sx={{ alignItems: 'center', flex: 1, gap: 1, mr: 1 }}>
          <Box component="span" draggable
            onClick={e => e.stopPropagation()}
            onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', section.id); onSectionDragStart(section.id); }}
            sx={{ cursor: 'grab', display: 'inline-flex', color: 'text.disabled' }}>
            <DragIndicatorIcon fontSize="small" />
          </Box>
          <Switch size="small" checked={section.visible}
            onChange={e => { e.stopPropagation(); patchSection(section.id, { visible: e.target.checked }); }}
            onClick={e => e.stopPropagation()} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{section.label}</Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
        {/* Editable section label */}
        <TextField fullWidth size="small" label="Section label" value={section.label} sx={{ mb: 1.5 }}
          onChange={e => patchSection(section.id, { label: e.target.value })} />

        {/* Summary: single textarea with AI coach */}
        {section.type === 'summary' && (
          <AiBulletField
            multiline
            rows={4}
            placeholder="Professional summary"
            context="Professional summary / headline for the top of the resume"
            value={(section as ResumeSummarySection).content}
            onChange={v => patchSection(section.id, { content: v } as Partial<ResumeSummarySection>)}
          />
        )}

        {/* Skills / Languages: list of simple items */}
        {(section.type === 'skills' || section.type === 'languages') && (
          <Box>
            {(section as ResumeSkillsSection | ResumeLanguagesSection).items.map((item, idx) => (
              <Stack key={item.id} direction="row" sx={{ alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <Switch size="small" checked={item.visible} onChange={e => updateItem(item.id, { visible: e.target.checked })} />
                <TextField size="small" fullWidth value={item.text}
                  onChange={e => updateItem(item.id, { text: e.target.value })} />
                <IconButton size="small" onClick={() => {
                  const items = (section as ResumeSkillsSection).items.filter((_, i) => i !== idx);
                  patchSection(section.id, { items } as Partial<ResumeSection>);
                }}><DeleteIcon fontSize="small" /></IconButton>
              </Stack>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={() => {
              const newItem: ResumeSimpleItem = { id: genId(), text: '', visible: true };
              patchSection(section.id, { items: [...(section as ResumeSkillsSection).items, newItem] } as Partial<ResumeSection>);
            }}>Add item</Button>
          </Box>
        )}

        {/* Work experience items */}
        {section.type === 'work_experience' && (
          <Box>
            {(section as ResumeWorkSection).items.map(exp => (
              <Box key={exp.id} {...itemDrop(exp.id)} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, mb: 1 }}>
                <Stack direction="row" sx={{ alignItems: 'center', mb: 1 }}>
                  {itemHandle(exp.id)}
                  <Switch size="small" checked={exp.visible} onChange={e => updateItem(exp.id, { visible: e.target.checked })} />
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>{exp.company || 'Work item'}</Typography>
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title="Remove"><IconButton size="small" onClick={() => removeItem(exp.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                </Stack>
                {([['company', 'Company'], ['title', 'Title'], ['location', 'Location'], ['startDate', 'Start Date'], ['endDate', 'End Date']] as [string, string][]).map(([k, lbl]) => (
                  <TextField key={k} size="small" fullWidth label={lbl} sx={{ mb: 0.5 }}
                    value={(exp as unknown as Record<string, string>)[k] || ''} onChange={e => updateItem(exp.id, { [k]: e.target.value })} />
                ))}
                <TextField size="small" fullWidth multiline rows={2} label="Description" sx={{ mb: 1 }}
                  value={exp.description || ''} onChange={e => updateItem(exp.id, { description: e.target.value })} />
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }} color="text.secondary">Highlights / Bullets</Typography>
                {exp.highlights.map((h, hi) => (
                  <Stack key={h.id} direction="row" sx={{ alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Switch size="small" checked={h.visible} onChange={e => updateItem(exp.id, {
                      highlights: exp.highlights.map((hh, hhi) => hhi === hi ? { ...hh, visible: e.target.checked } : hh)
                    })} />
                    <AiBulletField
                      value={h.text}
                      context={`${exp.title || ''} at ${exp.company || ''}`.trim()}
                      onChange={v => updateItem(exp.id, {
                        highlights: exp.highlights.map((hh, hhi) => hhi === hi ? { ...hh, text: v } : hh)
                      })}
                    />
                    <IconButton size="small" onClick={() => updateItem(exp.id, { highlights: exp.highlights.filter((_, hhi) => hhi !== hi) })}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
                <Button size="small" startIcon={<AddIcon />} onClick={() => updateItem(exp.id, {
                  highlights: [...exp.highlights, { id: genId(), text: '', visible: true } as ResumeHighlight]
                })}>Add bullet</Button>
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={() => {
              const newItem = { id: genId(), visible: true, company: '', title: '', highlights: [] };
              patchSection(section.id, { items: [...(section as ResumeWorkSection).items, newItem] } as Partial<ResumeSection>);
            }}>Add job</Button>
          </Box>
        )}

        {/* Education items */}
        {section.type === 'education' && (
          <Box>
            {(section as ResumeEducationSection).items.map(edu => (
              <Box key={edu.id} {...itemDrop(edu.id)} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, mb: 1 }}>
                <Stack direction="row" sx={{ alignItems: 'center', mb: 1 }}>
                  {itemHandle(edu.id)}
                  <Switch size="small" checked={edu.visible} onChange={e => updateItem(edu.id, { visible: e.target.checked })} />
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>{edu.institution || 'Education item'}</Typography>
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title="Remove"><IconButton size="small" onClick={() => removeItem(edu.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                </Stack>
                {([['institution', 'Institution'], ['degree', 'Degree'], ['fieldOfStudy', 'Field of Study'], ['startDate', 'Start Date'], ['endDate', 'End Date'], ['gpa', 'GPA']] as [string, string][]).map(([k, lbl]) => (
                  <TextField key={k} size="small" fullWidth label={lbl} sx={{ mb: 0.5 }}
                    value={(edu as unknown as Record<string, string>)[k] || ''} onChange={e => updateItem(edu.id, { [k]: e.target.value })} />
                ))}
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={() => {
              const newItem = { id: genId(), visible: true, institution: '' };
              patchSection(section.id, { items: [...(section as ResumeEducationSection).items, newItem] } as Partial<ResumeSection>);
            }}>Add education</Button>
          </Box>
        )}

        {/* Projects items */}
        {section.type === 'projects' && (
          <Box>
            {(section as ResumeProjectsSection).items.map(proj => (
              <Box key={proj.id} {...itemDrop(proj.id)} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, mb: 1 }}>
                <Stack direction="row" sx={{ alignItems: 'center', mb: 1 }}>
                  {itemHandle(proj.id)}
                  <Switch size="small" checked={proj.visible} onChange={e => updateItem(proj.id, { visible: e.target.checked })} />
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>{proj.name || 'Project'}</Typography>
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title="Remove"><IconButton size="small" onClick={() => removeItem(proj.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                </Stack>
                {([['name', 'Project Name'], ['technologies', 'Technologies'], ['url', 'URL'], ['startDate', 'Start Date'], ['endDate', 'End Date']] as [string, string][]).map(([k, lbl]) => (
                  <TextField key={k} size="small" fullWidth label={lbl} sx={{ mb: 0.5 }}
                    value={(proj as unknown as Record<string, string>)[k] || ''} onChange={e => updateItem(proj.id, { [k]: e.target.value })} />
                ))}
                <TextField size="small" fullWidth multiline rows={2} label="Description" sx={{ mb: 1 }}
                  value={proj.description || ''} onChange={e => updateItem(proj.id, { description: e.target.value })} />
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }} color="text.secondary">Highlights / Bullets</Typography>
                {proj.highlights.map((h, hi) => (
                  <Stack key={h.id} direction="row" sx={{ alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Switch size="small" checked={h.visible} onChange={e => updateItem(proj.id, {
                      highlights: proj.highlights.map((hh, hhi) => hhi === hi ? { ...hh, visible: e.target.checked } : hh)
                    })} />
                    <AiBulletField
                      value={h.text}
                      context={`Project: ${proj.name || ''}`.trim()}
                      onChange={v => updateItem(proj.id, {
                        highlights: proj.highlights.map((hh, hhi) => hhi === hi ? { ...hh, text: v } : hh)
                      })}
                    />
                    <IconButton size="small" onClick={() => updateItem(proj.id, { highlights: proj.highlights.filter((_, hhi) => hhi !== hi) })}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
                <Button size="small" startIcon={<AddIcon />} onClick={() => updateItem(proj.id, {
                  highlights: [...proj.highlights, { id: genId(), text: '', visible: true } as ResumeHighlight]
                })}>Add bullet</Button>
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={() => {
              const newItem = { id: genId(), visible: true, name: '', highlights: [] };
              patchSection(section.id, { items: [...(section as ResumeProjectsSection).items, newItem] } as Partial<ResumeSection>);
            }}>Add project</Button>
          </Box>
        )}

        {/* Certifications */}
        {section.type === 'certifications' && (
          <Box>
            {(section as ResumeCertificationsSection).items.map(cert => (
              <Box key={cert.id} {...itemDrop(cert.id)} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, mb: 1 }}>
                <Stack direction="row" sx={{ alignItems: 'center', mb: 1 }}>
                  {itemHandle(cert.id)}
                  <Switch size="small" checked={cert.visible} onChange={e => updateItem(cert.id, { visible: e.target.checked })} />
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>{cert.name || 'Certification'}</Typography>
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title="Remove"><IconButton size="small" onClick={() => removeItem(cert.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                </Stack>
                {([['name', 'Name'], ['issuer', 'Issuer'], ['date', 'Date'], ['url', 'URL']] as [string, string][]).map(([k, lbl]) => (
                  <TextField key={k} size="small" fullWidth label={lbl} sx={{ mb: 0.5 }}
                    value={(cert as unknown as Record<string, string>)[k] || ''} onChange={e => updateItem(cert.id, { [k]: e.target.value })} />
                ))}
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={() => {
              const newItem = { id: genId(), visible: true, name: '', issuer: '' };
              patchSection(section.id, { items: [...(section as ResumeCertificationsSection).items, newItem] } as Partial<ResumeSection>);
            }}>Add certification</Button>
          </Box>
        )}

        {/* Custom sections */}
        {section.type === 'custom' && (
          <Box>
            {(section as ResumeCustomSection).items.map(item => (
              <Box key={item.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, mb: 1 }}>
                <Stack direction="row" sx={{ alignItems: 'center', mb: 1 }}>
                  <Switch size="small" checked={item.visible} onChange={e => updateItem(item.id, { visible: e.target.checked })} />
                  <TextField size="small" label="Title (optional)" value={item.title || ''} onChange={e => updateItem(item.id, { title: e.target.value })} />
                </Stack>
                {item.fields.map((field, fi) => (
                  <Stack key={field.id} direction="row" sx={{ alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Switch size="small" checked={field.visible} onChange={e => updateItem(item.id, {
                      fields: item.fields.map((f, ffi) => ffi === fi ? { ...f, visible: e.target.checked } : f)
                    })} />
                    <TextField size="small" label="Key" sx={{ flex: 1 }} value={field.key} onChange={e => updateItem(item.id, {
                      fields: item.fields.map((f, ffi) => ffi === fi ? { ...f, key: e.target.value } : f)
                    })} />
                    <TextField size="small" label="Value" sx={{ flex: 2 }} value={field.value} onChange={e => updateItem(item.id, {
                      fields: item.fields.map((f, ffi) => ffi === fi ? { ...f, value: e.target.value } : f)
                    })} />
                    <IconButton size="small" onClick={() => updateItem(item.id, { fields: item.fields.filter((_, ffi) => ffi !== fi) })}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
                <Button size="small" startIcon={<AddIcon />} onClick={() => updateItem(item.id, {
                  fields: [...item.fields, { id: genId(), key: '', value: '', visible: true }]
                })}>Add field</Button>
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={() => {
              const newItem = { id: genId(), visible: true, fields: [] };
              patchSection(section.id, { items: [...(section as ResumeCustomSection).items, newItem] } as Partial<ResumeSection>);
            }}>Add item</Button>
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
    </Box>
  );
}
