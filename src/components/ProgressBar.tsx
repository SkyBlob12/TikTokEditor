import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {SafeZone} from '../schema';
import {insetsOf} from '../lib/safeZone';

/**
 * La barre de progression se pose sur le bord bas de la zone sure, pas sur le
 * bord de l'image : tout en bas, la barre de navigation TikTok et la barre de
 * lecture de l'application la recouvrent entierement.
 */
export const ProgressBar: React.FC<{color: string; height: number; safeZone: SafeZone}> = ({
  color,
  height,
  safeZone,
}) => {
  const frame = useCurrentFrame();
  const {durationInFrames, width, height: compHeight} = useVideoConfig();
  const progress = Math.min(1, frame / Math.max(1, durationInFrames - 1));
  const insets = insetsOf(safeZone, width, compHeight);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          bottom: insets.bottom,
          left: insets.left,
          right: insets.right,
          height,
          backgroundColor: 'rgba(255,255,255,0.18)',
        }}
      >
        <div style={{height: '100%', width: `${progress * 100}%`, backgroundColor: color}} />
      </div>
    </AbsoluteFill>
  );
};
