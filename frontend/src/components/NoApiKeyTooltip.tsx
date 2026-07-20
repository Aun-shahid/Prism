'use client';

import * as React from 'react';
import { Tooltip } from '@mui/material';

const DEFAULT_MESSAGE = 'Add an API key in Settings to use AI features.';

interface Props {
  /** True when there's no active API key — shows the tooltip and expects the child to be disabled. */
  blocked: boolean;
  message?: string;
  children: React.ReactElement;
}

/**
 * Wraps an (already-disabled-when-blocked) button/icon-button so hovering it
 * while blocked explains why, instead of a silent or ugly failure on click.
 * MUI suppresses pointer events on disabled elements, so the Tooltip needs a
 * non-disabled wrapper (`span`) to still receive hover/focus events.
 */
export default function NoApiKeyTooltip({ blocked, message, children }: Props) {
  if (!blocked) return children;
  return (
    <Tooltip title={message || DEFAULT_MESSAGE}>
      <span style={{ display: 'inline-block' }}>{children}</span>
    </Tooltip>
  );
}
