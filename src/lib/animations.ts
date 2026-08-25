import {interpolate, spring} from 'remotion';
import type {AnimationName} from '../schema';

export type Transform = {
  opacity: number;
  transform: string;
  filter?: string;
};

const IDENTITY: Transform = {opacity: 1, transform: 'none'};

/**
 * Calcule opacite + transform pour une animation d'entree.
 *
 * @param frame     frame courante DANS la sequence (0 = debut de l'element)
 * @param fps       frames par seconde
 * @param duration  duree de l'animation en secondes
 */
export const animateIn = (
  name: AnimationName,
  frame: number,
  fps: number,
  duration: number,
): Transform => {
  if (name === 'none' || duration <= 0) return IDENTITY;

  const frames = Math.max(1, Math.round(duration * fps));
  const p = interpolate(frame, [0, frames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  switch (name) {
    case 'fade':
      return {opacity: p, transform: 'none'};

    case 'pop': {
      const s = spring({frame, fps, config: {damping: 12, mass: 0.5}, durationInFrames: frames});
      return {opacity: Math.min(1, p * 2), transform: `scale(${0.6 + s * 0.4})`};
    }

    case 'slide-up':
      return {opacity: Math.min(1, p * 2), transform: `translateY(${(1 - p) * 120}px)`};

    case 'slide-down':
      return {opacity: Math.min(1, p * 2), transform: `translateY(${(p - 1) * 120}px)`};

    case 'slide-left':
      return {opacity: 1, transform: `translateX(${(1 - p) * 1080}px)`};

    case 'slide-right':
      return {opacity: 1, transform: `translateX(${(p - 1) * 1080}px)`};

    case 'zoom-punch': {
      const s = spring({frame, fps, config: {damping: 14, mass: 0.4}, durationInFrames: frames});
      return {opacity: 1, transform: `scale(${1.25 - s * 0.25})`};
    }

    case 'whip':
      return {
        opacity: Math.min(1, p * 3),
        transform: `translateX(${(1 - p) * 420}px)`,
        filter: `blur(${(1 - p) * 22}px)`,
      };

    default:
      return IDENTITY;
  }
};

/**
 * Animation de sortie : `frame` est compte a rebours depuis la fin
 * (0 = derniere frame de l'element).
 */
export const animateOut = (
  name: AnimationName,
  framesLeft: number,
  fps: number,
  duration: number,
): Transform => {
  if (name === 'none' || duration <= 0) return IDENTITY;
  return animateIn(name, framesLeft, fps, duration);
};

/** Combine deux transforms (entree + sortie). */
export const combine = (a: Transform, b: Transform): Transform => ({
  opacity: a.opacity * b.opacity,
  transform: [a.transform, b.transform].filter((t) => t && t !== 'none').join(' ') || 'none',
  filter: [a.filter, b.filter].filter(Boolean).join(' ') || undefined,
});
