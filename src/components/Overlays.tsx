import React from 'react';
import {AbsoluteFill, Easing, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Overlay} from '../schema';
import {FONTS, type FontName} from '../lib/fonts';
import {asset} from '../lib/project';
import {animateIn, animateOut, combine} from '../lib/animations';

type Preset = {
  fontSize: number;
  color: string;
  background?: string;
  font: FontName;
  padding: string;
  borderRadius: number;
  stroke: number;
  maxWidth: string;
};

const PRESETS: Record<Overlay['preset'], Preset> = {
  hook: {
    fontSize: 96,
    color: '#FFFFFF',
    font: 'montserrat',
    padding: '0',
    borderRadius: 0,
    stroke: 12,
    maxWidth: '86%',
  },
  cta: {
    fontSize: 62,
    color: '#000000',
    background: '#FFFFFF',
    font: 'montserrat',
    padding: '22px 44px',
    borderRadius: 999,
    stroke: 0,
    maxWidth: '82%',
  },
  sticker: {
    fontSize: 46,
    color: '#000000',
    background: '#FFE100',
    font: 'montserrat',
    padding: '14px 28px',
    borderRadius: 16,
    stroke: 0,
    maxWidth: '70%',
  },
  label: {
    fontSize: 40,
    color: '#FFFFFF',
    background: 'rgba(0,0,0,0.55)',
    font: 'montserrat',
    padding: '12px 24px',
    borderRadius: 12,
    stroke: 0,
    maxWidth: '70%',
  },
  plain: {
    fontSize: 58,
    color: '#FFFFFF',
    font: 'montserrat',
    padding: '0',
    borderRadius: 0,
    stroke: 0,
    maxWidth: '84%',
  },
};

const OverlayItem: React.FC<{
  overlay: Overlay;
  project: string;
  durationInFrames: number;
}> = ({overlay, project, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const preset = PRESETS[overlay.preset];

  const anim = combine(
    animateIn(overlay.animationIn, frame, fps, 0.35),
    animateOut(overlay.animationOut, durationInFrames - 1 - frame, fps, 0.3),
  );

  const font = FONTS[overlay.font ?? preset.font];
  const fontSize = overlay.fontSize ?? preset.fontSize;
  const stroke = preset.stroke;

  /**
   * Un compteur monte vite puis freine : c'est ce qui donne l'impression que le
   * chiffre « arrive » quelque part, plutot que de defiler mecaniquement.
   * Une fois `countDuration` ecoulee, il reste affiche a sa valeur finale.
   */
  const contenu =
    overlay.type === 'counter'
      ? `${overlay.prefix}${Math.round(
          interpolate(
            frame,
            [0, Math.max(1, Math.round(overlay.countDuration * fps))],
            [overlay.from, overlay.to ?? overlay.from],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            },
          ),
        ).toLocaleString('fr-FR')}${overlay.suffix}`
      : overlay.text;

  const wrapper: React.CSSProperties = {
    position: 'absolute',
    left: `${overlay.position.x * 100}%`,
    top: `${overlay.position.y * 100}%`,
    transform: [
      'translate(-50%, -50%)',
      overlay.rotate ? `rotate(${overlay.rotate}deg)` : '',
      anim.transform !== 'none' ? anim.transform : '',
    ]
      .filter(Boolean)
      .join(' '),
    opacity: anim.opacity,
    filter: anim.filter,
    maxWidth: preset.maxWidth,
  };

  if (overlay.type === 'image' && overlay.src) {
    // Un logo monochrome disparait sur un fond de la meme valeur. `background`
    // le pose sur une pastille, comme le preset `cta`, et le rend lisible
    // quelle que soit l'image derriere.
    const card = overlay.background
      ? {
          backgroundColor: overlay.background,
          padding: '5% 7%',
          borderRadius: 28,
          boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
        }
      : {};

    return (
      <AbsoluteFill>
        <div
          style={{
            ...wrapper,
            width: `${overlay.width * 100}%`,
            maxWidth: 'none',
            ...card,
          }}
        >
          <Img
            src={asset(project, overlay.src)}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              filter: overlay.background
                ? undefined
                : 'drop-shadow(0 20px 50px rgba(0,0,0,0.45))',
            }}
          />
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      <div
        style={{
          ...wrapper,
          ...font,
          fontSize,
          lineHeight: 1.12,
          textAlign: 'center',
          textTransform: overlay.preset === 'hook' ? 'uppercase' : 'none',
          color: overlay.color ?? preset.color,
          backgroundColor: overlay.background ?? preset.background,
          padding: preset.padding,
          borderRadius: preset.borderRadius,
          whiteSpace: 'pre-wrap',
          ...(stroke
            ? {
                WebkitTextStroke: `${stroke}px #000000`,
                paintOrder: 'stroke fill',
                filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.5))',
              }
            : {boxShadow: preset.background ? '0 12px 32px rgba(0,0,0,0.35)' : undefined}),
        }}
      >
        {contenu}
      </div>
    </AbsoluteFill>
  );
};

export const Overlays: React.FC<{overlays: Overlay[]; project: string}> = ({
  overlays,
  project,
}) => {
  const {fps} = useVideoConfig();

  return (
    <>
      {overlays.map((overlay, i) => {
        const durationInFrames = Math.max(1, Math.round(overlay.duration * fps));
        return (
          <Sequence
            key={i}
            from={Math.round(overlay.start * fps)}
            durationInFrames={durationInFrames}
            name={`Overlay ${i + 1} — ${overlay.text ?? overlay.src ?? ''}`.slice(0, 40)}
            layout="none"
          >
            <OverlayItem overlay={overlay} project={project} durationInFrames={durationInFrames} />
          </Sequence>
        );
      })}
    </>
  );
};
