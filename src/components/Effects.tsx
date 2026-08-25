import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Effect} from '../schema';

/**
 * Les effets sont volontairement discrets.
 *
 * Sur un plan fixe en selfie, un effet visible se lit comme un bug (on l'a
 * appris a nos depens avec le Ken Burns). Les amplitudes ci-dessous sont
 * calibrees pour se sentir plutot que se voir : a `intensity: 1`, la secousse
 * fait 14 px sur 1080 de large, et le coup de zoom 4 %.
 */
const SHAKE_MAX_PX = 14;
const PULSE_MAX = 0.04;
const FLASH_MAX_OPACITY = 0.45;

/** Amortissement : l'effet part fort et s'eteint. */
const decay = (progress: number) => Math.max(0, 1 - progress);

type Active = {effect: Effect; progress: number};

const useActiveEffects = (effects: Effect[]): Active[] => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const seconds = frame / fps;

  return effects
    .map((effect) => ({
      effect,
      progress: (seconds - effect.start) / effect.duration,
    }))
    .filter(({progress}) => progress >= 0 && progress <= 1);
};

/**
 * Enveloppe l'image et lui applique les effets geometriques (shake, pulse).
 * Le flash, lui, se pose par-dessus : voir `<EffectOverlay>`.
 */
export const EffectLayer: React.FC<{effects: Effect[]; children: React.ReactNode}> = ({
  effects,
  children,
}) => {
  const active = useActiveEffects(effects);

  let translateX = 0;
  let translateY = 0;
  let scale = 1;

  for (const {effect, progress} of active) {
    const amount = effect.intensity * decay(progress);

    if (effect.type === 'shake') {
      // Deux frequences differentes en x et y : une seule donnerait un
      // balancement regulier, qui ressemble a un defaut de lecture.
      translateX += Math.sin(progress * Math.PI * 9) * SHAKE_MAX_PX * amount;
      translateY += Math.cos(progress * Math.PI * 7) * SHAKE_MAX_PX * 0.7 * amount;
    }

    if (effect.type === 'pulse') {
      scale += PULSE_MAX * amount;
    }
  }

  const idle = translateX === 0 && translateY === 0 && scale === 1;

  return (
    <AbsoluteFill
      style={{
        transform: idle
          ? undefined
          : `translate(${translateX}px, ${translateY}px) scale(${scale})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Les flashs, poses au-dessus de l'image mais sous les textes. */
export const EffectOverlay: React.FC<{effects: Effect[]}> = ({effects}) => {
  const active = useActiveEffects(effects).filter(({effect}) => effect.type === 'flash');

  if (!active.length) return null;

  return (
    <>
      {active.map(({effect, progress}, i) => (
        <AbsoluteFill
          key={i}
          style={{
            backgroundColor: effect.color,
            opacity: interpolate(
              decay(progress) * effect.intensity,
              [0, 1],
              [0, FLASH_MAX_OPACITY],
            ),
            pointerEvents: 'none',
          }}
        />
      ))}
    </>
  );
};
