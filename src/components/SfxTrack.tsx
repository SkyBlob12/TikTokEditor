import React from 'react';
import {Audio, Sequence, useVideoConfig} from 'remotion';
import type {Sfx} from '../schema';
import {asset} from '../lib/project';

/**
 * Bruitages ponctuels.
 *
 * Chaque son est declenche a une seconde precise de la timeline finale, pas du
 * fichier source : on pose un whoosh sur une coupe, un pop sur l'apparition
 * d'un sticker. Les fichiers vivent dans media/sfx/.
 */
export const SfxTrack: React.FC<{sfx: Sfx[]; project: string}> = ({sfx, project}) => {
  const {fps} = useVideoConfig();

  return (
    <>
      {sfx.map((sound, i) => (
        <Sequence
          key={`${sound.src}-${i}`}
          from={Math.round(sound.at * fps)}
          durationInFrames={
            sound.duration ? Math.max(1, Math.round(sound.duration * fps)) : undefined
          }
          name={`SFX ${i + 1} — ${sound.src.split('/').pop()}`}
          layout="none"
        >
          <Audio
            src={asset(project, sound.src)}
            volume={sound.volume}
            trimBefore={sound.trim ? Math.round(sound.trim * fps) : undefined}
          />
        </Sequence>
      ))}
    </>
  );
};
