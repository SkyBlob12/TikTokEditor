import React from 'react';
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {Clip} from '../schema';
import {asset} from '../lib/project';
import {animateIn} from '../lib/animations';

const ClipContent: React.FC<{clip: Clip; project: string; durationInFrames: number}> = ({
  clip,
  project,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Ken Burns : zoom continu sur toute la duree du clip.
  const zoom = clip.zoom
    ? interpolate(frame, [0, durationInFrames], [clip.zoom.from, clip.zoom.to], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  const inAnim = clip.transitionIn
    ? animateIn(clip.transitionIn.type, frame, fps, clip.transitionIn.duration)
    : {opacity: 1, transform: 'none' as string, filter: undefined as string | undefined};

  const offsetX = (clip.offset?.x ?? 0) * 100;
  const offsetY = (clip.offset?.y ?? 0) * 100;

  const mediaStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: clip.fit,
    transform: [
      `translate(${offsetX}%, ${offsetY}%)`,
      `scale(${zoom})`,
      clip.rotate ? `rotate(${clip.rotate}deg)` : '',
      clip.flip ? 'scaleX(-1)' : '',
    ]
      .filter(Boolean)
      .join(' '),
    filter: clip.filter,
  };

  const src = clip.kind === 'color' ? null : asset(project, clip.src);

  // Combien de frames du fichier source ce clip consomme, vitesse comprise.
  const trimBefore = Math.round(clip.trim * fps);
  const trimAfter = trimBefore + Math.ceil(durationInFrames * clip.speed) + 1;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: clip.color,
        opacity: inAnim.opacity,
        transform: inAnim.transform,
        filter: inAnim.filter,
        overflow: 'hidden',
      }}
    >
      {clip.kind === 'video' && src ? (
        <OffthreadVideo
          src={src}
          style={mediaStyle}
          trimBefore={trimBefore}
          trimAfter={trimAfter}
          playbackRate={clip.speed}
          volume={clip.volume}
          muted={clip.volume === 0}
        />
      ) : null}
      {clip.kind === 'image' && src ? <Img src={src} style={mediaStyle} /> : null}
    </AbsoluteFill>
  );
};

export const ClipTrack: React.FC<{clips: Clip[]; project: string}> = ({clips, project}) => {
  const {fps} = useVideoConfig();

  return (
    <>
      {clips.map((clip, i) => {
        const from = Math.round(clip.start * fps);

        // Un clip colle au suivant : sa fin est la frame ou le suivant commence,
        // pas sa duree arrondie de son cote. Arrondir `start` et `duration`
        // separement laisse un trou d'une frame quand les deux arrondis tombent
        // du mauvais cote, et ce trou se voit : un eclair noir sur la coupe.
        const suivant = clips[i + 1];
        const colle =
          suivant !== undefined &&
          Math.abs(suivant.start - (clip.start + clip.duration)) < 0.001;
        const fin = colle
          ? Math.round(suivant.start * fps)
          : from + Math.round(clip.duration * fps);
        const durationInFrames = Math.max(1, fin - from);
        return (
          <Sequence
            key={`${clip.src}-${i}`}
            from={from}
            durationInFrames={durationInFrames}
            name={`Clip ${i + 1} — ${clip.src.split('/').pop()}`}
            layout="none"
          >
            <ClipContent clip={clip} project={project} durationInFrames={durationInFrames} />
          </Sequence>
        );
      })}
    </>
  );
};
