'use client';

import React from 'react';
import { ResumeVersion, DiffStatus } from '../../../services/resumeBuilder';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
  version: ResumeVersion;
  /** annotated sections from annotateResumeDiff (nodes may carry __diff) */
  sections: any[];
}

const mmToPx = (mm: number) => `${Math.round(mm * 3.7795)}px`;
const ptToPx = (pt: number) => `${Math.round(pt * 1.333)}px`;

const DIFF_BG: Record<DiffStatus, string> = {
  added: 'rgba(16,185,129,0.16)',
  removed: 'rgba(239,68,68,0.13)',
  modified: 'rgba(245,158,11,0.18)',
  hidden: 'rgba(148,163,184,0.14)',
  shown: 'rgba(16,185,129,0.12)',
};
const DIFF_BORDER: Record<DiffStatus, string> = {
  added: '#10b981', removed: '#ef4444', modified: '#f59e0b', hidden: '#94a3b8', shown: '#10b981',
};
const DIFF_TAG: Record<DiffStatus, string> = {
  added: 'Added', removed: 'Removed', modified: 'Edited', hidden: 'Hidden', shown: 'Shown',
};

/** A tiny colored pill marking what happened to a node. */
function DiffTag({ status }: { status: DiffStatus }) {
  return (
    <span style={{
      fontSize: '9px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
      color: '#fff', background: DIFF_BORDER[status], borderRadius: 4, padding: '1px 5px',
      marginLeft: 6, verticalAlign: 'middle',
    }}>
      {DIFF_TAG[status]}
    </span>
  );
}

const ResumeDiffPreview: React.FC<Props> = ({ version, sections }) => {
  const c = version.customization;
  const { layout } = c;
  const base = layout.baseFontSize;

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

  const dateRange = (start?: string, end?: string) => {
    if (!start && !end) return '';
    return `${start || ''}${start ? ' – ' : ''}${end || 'Present'}`;
  };

  // Wrap any node in a diff-styled container (background, border, strike, dim, tag).
  const wrap = (node: any, children: React.ReactNode, key?: React.Key) => {
    const status: DiffStatus | undefined = node.__diff;
    const isHiddenNoDiff = node.visible === false && !status;
    const style: React.CSSProperties = { borderRadius: 4, transition: 'none' };
    if (status) {
      style.background = DIFF_BG[status];
      style.borderLeft = `3px solid ${DIFF_BORDER[status]}`;
      style.padding = '2px 6px';
      style.margin = '2px -6px';
      if (status === 'removed') { style.textDecoration = 'line-through'; style.opacity = 0.8; }
      if (status === 'hidden') style.opacity = 0.6;
    } else if (isHiddenNoDiff) {
      style.opacity = 0.4;                        // normally-hidden item, shown for context
    }
    return (
      <div key={key} style={style}>
        {children}
        {status && <DiffTag status={status} />}
      </div>
    );
  };

  const SectionHeader = ({ label }: { label: string }) => (
    <div style={{ marginTop: '14px' }}>
      <div style={{
        fontFamily: c.bodyFont, fontSize: ptToPx(base * 1.05), fontWeight: 700,
        color: c.primaryColor, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px',
      }}>
        {label}
      </div>
      <div style={{ height: '2px', background: c.primaryColor, marginBottom: '7px' }} />
    </div>
  );

  const renderBullets = (highlights: any[]) => {
    if (!Array.isArray(highlights) || !highlights.length) return null;
    return (
      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
        {highlights.map((h: any) => {
          const status: DiffStatus | undefined = h.__diff;
          const style: React.CSSProperties = { marginBottom: '2px', lineHeight: layout.lineHeight };
          if (status) {
            style.background = DIFF_BG[status];
            style.borderLeft = `3px solid ${DIFF_BORDER[status]}`;
            style.paddingLeft = '6px';
            style.marginLeft = '-6px';
            style.listStyle = 'none';
            if (status === 'removed') { style.textDecoration = 'line-through'; style.opacity = 0.8; }
          } else if (h.visible === false) {
            style.opacity = 0.4;
          }
          return (
            <li key={h.id} style={style}>
              {h.text}{status && <DiffTag status={status} />}
            </li>
          );
        })}
      </ul>
    );
  };

  const itemPrimary = (it: any) => it.name || it.company || it.institution || it.title || it.text || 'Item';
  const itemMeta = (it: any): string => {
    const parts: string[] = [];
    if (it.company && it.title) parts.push(it.title);           // work: role under company
    const deg = [it.degree, it.fieldOfStudy].filter(Boolean).join(', ');
    if (deg) parts.push(deg);
    if (it.technologies) parts.push(it.technologies);
    if (it.issuer) parts.push(it.issuer);
    const dr = dateRange(it.startDate, it.endDate) || it.date;
    if (dr) parts.push(dr);
    return parts.filter(Boolean).join('  ·  ');
  };

  const renderItemBlock = (it: any) => wrap(it, (
    <div style={{ marginBottom: '6px' }}>
      <span style={{ fontWeight: 700, color: c.primaryColor }}>{itemPrimary(it)}</span>
      {itemMeta(it) && (
        <div style={{ fontSize: ptToPx(base * 0.9), fontStyle: 'italic', color: c.accentColor }}>{itemMeta(it)}</div>
      )}
      {it.description && !((it.highlights || []).length) && (
        <div style={{ marginTop: '2px' }}>{it.description}</div>
      )}
      {renderBullets(it.highlights)}
    </div>
  ), it.id);

  const renderSection = (section: any) => {
    const label = <SectionHeader label={section.label} />;
    let body: React.ReactNode = null;

    if (section.type === 'summary') {
      body = <p style={{ margin: '0 0 6px', lineHeight: layout.lineHeight }}>{section.content}</p>;
    } else if (section.type === 'skills' || section.type === 'languages') {
      body = (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 10px' }}>
          {(section.items || []).map((it: any) => wrap(it, (
            <span>{it.text}</span>
          ), it.id))}
        </div>
      );
    } else if (Array.isArray(section.items)) {
      body = section.items.map((it: any) => renderItemBlock(it));
    }

    return wrap(section, (
      <div>
        {label}
        {body}
      </div>
    ), section.id);
  };

  const contactItems: string[] = [];
  const ct = version.contact;
  if (ct.email) contactItems.push(ct.email);
  if (ct.phone) contactItems.push(ct.phone);
  if (ct.address) contactItems.push(ct.address);
  const fullName = [ct.firstName, ct.middleName, ct.lastName].filter(Boolean).join(' ');

  const sorted = [...(sections || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div style={paper}>
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        <div style={{
          fontFamily: c.headingFont, fontSize: ptToPx(base * 2.8), fontWeight: 800,
          color: c.primaryColor, letterSpacing: '-0.02em', lineHeight: 1.1,
        }}>
          {fullName || 'Your Name'}
        </div>
      </div>
      {contactItems.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', fontSize: ptToPx(base * 0.88), marginBottom: '4px' }}>
          {contactItems.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ margin: '0 7px', opacity: 0.4 }}>|</span>}
              <span>{item}</span>
            </React.Fragment>
          ))}
        </div>
      )}
      <div style={{ height: '2px', background: c.primaryColor, margin: '6px 0 10px' }} />
      {sorted.map(renderSection)}
    </div>
  );
};

export default ResumeDiffPreview;
