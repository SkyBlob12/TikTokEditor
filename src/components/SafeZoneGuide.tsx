import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import type {SafeZone} from '../schema';
import {insetsOf, sideInset} from '../lib/safeZone';

/**
 * Le calque de controle de la zone sure. Jamais rendu dans un export : il
 * s'active dans le Studio, pour voir ou l'interface TikTok va mordre.
 *
 *   npm run studio -- --props='{"project":"mon-projet","safeZoneGuide":true}'
 *
 * Le trait plein est la zone sure. Le trait pointille est la marge laterale
 * reellement appliquee aux sous-titres, symetrique pour qu'ils restent centres.
 */
export const SafeZoneGuide: React.FC<{safeZone: SafeZone}> = ({safeZone}) => {
  const {width, height} = useVideoConfig();
  const i = insetsOf(safeZone, width, height);
  const side = sideInset(i);

  const legende: React.CSSProperties = {
    position: 'absolute',
    fontFamily: 'monospace',
    fontSize: 26,
    color: '#00E5FF',
    padding: '4px 8px',
    backgroundColor: 'rgba(0,0,0,0.6)',
  };

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          top: i.top,
          bottom: i.bottom,
          left: i.left,
          right: i.right,
          border: '3px solid #00E5FF',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: side,
          right: side,
          borderLeft: '2px dashed rgba(0,229,255,0.55)',
          borderRight: '2px dashed rgba(0,229,255,0.55)',
        }}
      />
      <div style={{...legende, top: i.top + 8, left: i.left + 8}}>{`haut ${Math.round(
        safeZone.top,
      )} / bas ${Math.round(safeZone.bottom)} / cotes ${Math.round(safeZone.left)}-${Math.round(
        safeZone.right,
      )}`}</div>
    </AbsoluteFill>
  );
};
