import React from 'react';
import {AbsoluteFill, Easing, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Overlay, SafeZone} from '../schema';
import {FONTS, type FontName} from '../lib/fonts';
import {asset} from '../lib/project';
import {animateIn, animateOut, combine} from '../lib/animations';
import {clampCenterY, estimateLines, insetsOf, maxWidthAt} from '../lib/safeZone';

const LINE_HEIGHT = 1.12;

type Preset = {
  fontSize: number;
  color: string;
  background?: string;
  font: FontName;
  /** Marges internes, en px : [vertical, horizontal]. */
  padding: [number, number];
  borderRadius: number;
  stroke: number;
  /** Largeur maximale voulue, en fraction de l'ecran. Bornee par la zone sure. */
  maxWidth: number;
};

const PRESETS: Record<Overlay['preset'], Preset> = {
  hook: {
    fontSize: 96,
    color: '#FFFFFF',
    font: 'montserrat',
    padding: [0, 0],
    borderRadius: 0,
    stroke: 12,
    maxWidth: 0.86,
  },
  cta: {
    fontSize: 62,
    color: '#000000',
    background: '#FFFFFF',
    font: 'montserrat',
    padding: [22, 44],
    borderRadius: 999,
    stroke: 0,
    maxWidth: 0.82,
  },
  sticker: {
    fontSize: 46,
    color: '#000000',
    background: '#FFE100',
    font: 'montserrat',
    padding: [14, 28],
    borderRadius: 16,
    stroke: 0,
    maxWidth: 0.7,
  },
  label: {
    fontSize: 40,
    color: '#FFFFFF',
    background: 'rgba(0,0,0,0.55)',
    font: 'montserrat',
    padding: [12, 24],
    borderRadius: 12,
    stroke: 0,
    maxWidth: 0.7,
  },
  plain: {
    fontSize: 58,
    color: '#FFFFFF',
    font: 'montserrat',
    padding: [0, 0],
    borderRadius: 0,
    stroke: 0,
    maxWidth: 0.84,
  },
};

const OverlayItem: React.FC<{
  overlay: Overlay;
  project: string;
  durationInFrames: number;
  safeZone: SafeZone;
}> = ({overlay, project, durationInFrames, safeZone}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
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

  /**
   * La zone sure borne l'overlay avant tout le reste.
   *
   * `maxWidth` se calcule depuis le centre du bloc : un texte pose a `x: 0.5`
   * ne peut pas depasser 840 px sans passer sous la colonne de boutons. Le
   * centre vertical, lui, est ramene dans la zone : un bloc pose trop bas
   * remonte, au lieu de disparaitre sous la legende.
   */
  const insets = insetsOf(safeZone, width, height);
  const [paddingY, paddingX] = preset.padding;
  const centerX = overlay.position.x * width;
  const maxWidth = Math.min(preset.maxWidth * width, maxWidthAt(centerX, insets, width));

  const halfHeight =
    overlay.type === 'image'
      ? 0
      : (estimateLines(
          String(contenu),
          fontSize,
          Math.max(1, maxWidth - paddingX * 2),
          overlay.preset === 'hook',
        ) *
          fontSize *
          LINE_HEIGHT) /
          2 +
        paddingY +
        stroke;

  const centerY = clampCenterY(overlay.position.y * height, halfHeight, insets, height);

  const wrapper: React.CSSProperties = {
    position: 'absolute',
    left: centerX,
    top: centerY,
    transform: [
      'translate(-50%, -50%)',
      overlay.rotate ? `rotate(${overlay.rotate}deg)` : '',
      anim.transform !== 'none' ? anim.transform : '',
    ]
      .filter(Boolean)
      .join(' '),
    opacity: anim.opacity,
    filter: anim.filter,
    // Pose en absolu a `left: centerX`, un bloc sans largeur explicite ne
    // dispose que de l'espace a sa droite (540 px au centre) et passe a la
    // ligne bien avant `maxWidth`. `max-content` le laisse prendre sa largeur
    // naturelle, que `maxWidth` borne.
    width: 'max-content',
    maxWidth,
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

    // La hauteur d'une image n'est connue qu'au chargement : plutot que de la
    // deviner, on la borne. Une image trop haute pour la zone sure retrecit,
    // `contain` gardant ses proportions.
    const maxHeight = Math.max(
      0,
      2 * Math.min(centerY - insets.top, height - insets.bottom - centerY),
    );

    return (
      <AbsoluteFill>
        <div
          style={{
            ...wrapper,
            width: Math.min(overlay.width * width, maxWidth),
            ...card,
          }}
        >
          <Img
            src={asset(project, overlay.src)}
            style={{
              width: '100%',
              height: 'auto',
              maxHeight,
              objectFit: 'contain',
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
          padding: `${paddingY}px ${paddingX}px`,
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

export const Overlays: React.FC<{
  overlays: Overlay[];
  project: string;
  safeZone: SafeZone;
}> = ({overlays, project, safeZone}) => {
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
            <OverlayItem
              overlay={overlay}
              project={project}
              durationInFrames={durationInFrames}
              safeZone={safeZone}
            />
          </Sequence>
        );
      })}
    </>
  );
};
