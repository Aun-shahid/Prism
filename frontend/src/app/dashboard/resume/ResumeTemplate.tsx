'use client';

import React from 'react';
import {
  ResumeVersion,
  ResumeSection,
  ResumeSummarySection,
  ResumeWorkSection,
  ResumeEducationSection,
  ResumeSkillsSection,
  ResumeProjectsSection,
  ResumeCertificationsSection,
  ResumeLanguagesSection,
  ResumeCustomSection,
} from '../../../services/resumeBuilder';

interface Props {
  version: ResumeVersion;
}

// mm → px (96 dpi, 1mm ≈ 3.7795px)
const mmToPx = (mm: number) => `${Math.round(mm * 3.7795)}px`;
const ptToPx = (pt: number) => `${Math.round(pt * 1.333)}px`;

const ResumeTemplate = React.forwardRef<HTMLDivElement, Props>(({ version }, ref) => {
    const { contact, sections, customization: c } = version;
    const { layout } = c;
    const base = layout.baseFontSize;

    const sorted = [...sections].sort((a, b) => a.order - b.order);

    const paper: React.CSSProperties = {
      background: '#ffffff',
      color: c.textColor,
      fontFamily: c.bodyFont,
      fontSize: ptToPx(base),
      lineHeight: layout.lineHeight,
      paddingTop: mmToPx(layout.marginTop),
      paddingBottom: mmToPx(layout.marginBottom),
      paddingLeft: mmToPx(layout.marginLeft),
      paddingRight: mmToPx(layout.marginRight),
      width: layout.pageSize === 'letter' ? '816px' : '794px',
      minHeight: layout.pageSize === 'letter' ? '1056px' : '1123px',
      boxSizing: 'border-box',
      textAlign: layout.textAlign,
    };

    const contactItems: string[] = [];
    if (contact.email) contactItems.push(contact.email);
    if (contact.phone) contactItems.push(contact.phone);
    if (contact.address) contactItems.push(contact.address);
    if (contact.linkedin) contactItems.push(contact.linkedin.replace(/^https?:\/\/(www\.)?/, ''));
    if (contact.github) contactItems.push(contact.github.replace(/^https?:\/\/(www\.)?/, ''));
    if (contact.portfolio) contactItems.push(contact.portfolio.replace(/^https?:\/\/(www\.)?/, ''));
    if (contact.website) contactItems.push(contact.website.replace(/^https?:\/\/(www\.)?/, ''));

    const fullName = [contact.firstName, contact.middleName, contact.lastName].filter(Boolean).join(' ');

    const dateRange = (start?: string, end?: string) => {
      if (!start && !end) return '';
      return `${start || ''}${start ? ' – ' : ''}${end || 'Present'}`;
    };

    const SectionHeader = ({ label }: { label: string }) => (
      <div style={{ marginTop: '14px' }}>
        <div style={{
          fontFamily: c.bodyFont,
          fontSize: ptToPx(base * 1.05),
          fontWeight: 700,
          color: c.primaryColor,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '2px',
        }}>
          {label}
        </div>
        <div style={{ height: '2px', background: c.primaryColor, marginBottom: '7px' }} />
      </div>
    );

    const renderSection = (section: ResumeSection) => {
      if (!section.visible) return null;

      switch (section.type) {
        case 'summary': {
          const s = section as ResumeSummarySection;
          if (!s.content) return null;
          return (
            <div key={s.id}>
              <SectionHeader label={s.label} />
              <p style={{ margin: '0 0 6px', fontSize: ptToPx(base), lineHeight: layout.lineHeight }}>
                {s.content}
              </p>
            </div>
          );
        }
        case 'work_experience': {
          const s = section as ResumeWorkSection;
          const vis = s.items.filter(i => i.visible);
          if (!vis.length) return null;
          return (
            <div key={s.id}>
              <SectionHeader label={s.label} />
              {vis.map(exp => (
                <div key={exp.id} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700, color: c.primaryColor }}>{exp.company}</span>
                    {exp.location && <span style={{ fontSize: ptToPx(base * 0.88), opacity: 0.7 }}>{exp.location}</span>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '1px' }}>
                    <span style={{ fontStyle: 'italic', color: c.accentColor, fontSize: ptToPx(base * 0.95) }}>{exp.title}</span>
                    <span style={{ fontSize: ptToPx(base * 0.88), opacity: 0.7 }}>{dateRange(exp.startDate, exp.endDate)}</span>
                  </div>
                  {exp.highlights.filter(h => h.visible).length > 0 ? (
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      {exp.highlights.filter(h => h.visible).map(h => (
                        <li key={h.id} style={{ marginBottom: '2px', lineHeight: layout.lineHeight }}>{h.text}</li>
                      ))}
                    </ul>
                  ) : exp.description ? (
                    <p style={{ margin: '3px 0 0', lineHeight: layout.lineHeight }}>{exp.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          );
        }
        case 'education': {
          const s = section as ResumeEducationSection;
          const vis = s.items.filter(i => i.visible);
          if (!vis.length) return null;
          return (
            <div key={s.id}>
              <SectionHeader label={s.label} />
              {vis.map(edu => (
                <div key={edu.id} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700, color: c.primaryColor }}>{edu.institution}</span>
                    <span style={{ fontSize: ptToPx(base * 0.88), opacity: 0.7 }}>{dateRange(edu.startDate, edu.endDate)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '1px' }}>
                    <span style={{ fontStyle: 'italic', color: c.accentColor, fontSize: ptToPx(base * 0.95) }}>
                      {[edu.degree, edu.fieldOfStudy].filter(Boolean).join(', ')}
                    </span>
                    {edu.gpa && <span style={{ fontSize: ptToPx(base * 0.88), opacity: 0.65 }}>GPA: {edu.gpa}</span>}
                  </div>
                </div>
              ))}
            </div>
          );
        }
        case 'skills': {
          const s = section as ResumeSkillsSection;
          const vis = s.items.filter(i => i.visible);
          if (!vis.length) return null;
          return (
            <div key={s.id}>
              <SectionHeader label={s.label} />
              <p style={{ margin: '0 0 8px', lineHeight: layout.lineHeight }}>{vis.map(i => i.text).join(' • ')}</p>
            </div>
          );
        }
        case 'projects': {
          const s = section as ResumeProjectsSection;
          const vis = s.items.filter(i => i.visible);
          if (!vis.length) return null;
          return (
            <div key={s.id}>
              <SectionHeader label={s.label} />
              {vis.map(proj => (
                <div key={proj.id} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700, color: c.primaryColor }}>
                      {proj.name}
                      {proj.url && (
                        <span style={{ fontWeight: 400, fontSize: ptToPx(base * 0.82), color: c.accentColor, marginLeft: 8 }}>
                          {proj.url.replace(/^https?:\/\//, '')}
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: ptToPx(base * 0.88), opacity: 0.7 }}>{dateRange(proj.startDate, proj.endDate)}</span>
                  </div>
                  {proj.technologies && (
                    <div style={{ fontSize: ptToPx(base * 0.9), fontStyle: 'italic', color: c.accentColor, marginTop: '2px' }}>
                      {proj.technologies}
                    </div>
                  )}
                  {proj.highlights.filter(h => h.visible).length > 0 ? (
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      {proj.highlights.filter(h => h.visible).map(h => (
                        <li key={h.id} style={{ marginBottom: '2px', lineHeight: layout.lineHeight }}>{h.text}</li>
                      ))}
                    </ul>
                  ) : proj.description ? (
                    <p style={{ margin: '3px 0 0', lineHeight: layout.lineHeight }}>{proj.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          );
        }
        case 'certifications': {
          const s = section as ResumeCertificationsSection;
          const vis = s.items.filter(i => i.visible);
          if (!vis.length) return null;
          return (
            <div key={s.id}>
              <SectionHeader label={s.label} />
              <ul style={{ margin: '0 0 8px 16px', padding: 0 }}>
                {vis.map(cert => (
                  <li key={cert.id} style={{ marginBottom: '3px', lineHeight: layout.lineHeight }}>
                    <strong style={{ color: c.primaryColor }}>{cert.name}</strong>
                    {cert.issuer && <span> — {cert.issuer}</span>}
                    {cert.date && <span style={{ opacity: 0.65 }}> ({cert.date})</span>}
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        case 'languages': {
          const s = section as ResumeLanguagesSection;
          const vis = s.items.filter(i => i.visible);
          if (!vis.length) return null;
          return (
            <div key={s.id}>
              <SectionHeader label={s.label} />
              <p style={{ margin: '0 0 8px', lineHeight: layout.lineHeight }}>{vis.map(i => i.text).join(' • ')}</p>
            </div>
          );
        }
        case 'custom': {
          const s = section as ResumeCustomSection;
          const vis = s.items.filter(i => i.visible);
          if (!vis.length) return null;
          return (
            <div key={s.id}>
              <SectionHeader label={s.label} />
              {vis.map(item => (
                <div key={item.id} style={{ marginBottom: '8px' }}>
                  {item.title && <div style={{ fontWeight: 700, color: c.primaryColor }}>{item.title}</div>}
                  {item.fields.filter(f => f.visible).map(field => (
                    <div key={field.id} style={{ lineHeight: layout.lineHeight }}>
                      {field.key && <strong style={{ color: c.primaryColor }}>{field.key}: </strong>}
                      {field.value}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        }
        default:
          return null;
      }
    };

    return (
      <div ref={ref} style={paper}>
        {/* ─── HEADER ─── */}
        <div style={{ textAlign: 'center', marginBottom: '4px' }}>
          <div style={{
            fontFamily: c.headingFont,
            fontSize: ptToPx(base * 2.8),
            fontWeight: 800,
            color: c.primaryColor,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}>
            {fullName || 'Your Name'}
          </div>
        </div>

        {/* ─── CONTACT BAR ─── */}
        {contactItems.length > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            fontSize: ptToPx(base * 0.88),
            color: c.textColor,
            marginBottom: '4px',
          }}>
            {contactItems.map((item, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ margin: '0 7px', opacity: 0.4 }}>|</span>}
                <span>{item}</span>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Top rule */}
        <div style={{ height: '2px', background: c.primaryColor, margin: '6px 0 10px' }} />

        {/* ─── SECTIONS ─── */}
        {sorted.map(renderSection)}

</div>
    );
});

ResumeTemplate.displayName = 'ResumeTemplate';
export default ResumeTemplate;
