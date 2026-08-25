import React from 'react';
import {Audio, interpolate, useVideoConfig} from 'remotion';
import type {AudioConfig, Word} from '../schema';
import {asset} from '../lib/project';

/** Facteur applique a la musique quand la voix parle. */
const DUCK_FACTOR = 0.32;
/** Marge autour de chaque mot, en ms, pour eviter le pompage. */
const DUCK_PAD_MS = 240;

/** Intervalles de parole fusionnes, en ms. */
const speechRanges = (words: Word[]): [number, number][] => {
  const ranges: [number, number][] = [];
  for (const word of words) {
    const start = word.startMs - DUCK_PAD_MS;
    const end = word.endMs + DUCK_PAD_MS;
    const last = ranges[ranges.length - 1];
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      ranges.push([start, end]);
    }
  }
  return ranges;
};

export const AudioTrack: React.FC<{
  audio: AudioConfig;
  project: string;
  words: Word[];
}> = ({audio, project, words}) => {
  const {fps, durationInFrames} = useVideoConfig();

  const ranges = audio.duck ? speechRanges(words) : [];
  const fadeOutFrames = Math.round(audio.musicFadeOut * fps);

  const musicVolume = (frame: number) => {
    const ms = (frame / fps) * 1000;
    const ducking = ranges.some(([start, end]) => ms >= start && ms <= end);
    const level = audio.musicVolume * (ducking ? DUCK_FACTOR : 1);

    if (fadeOutFrames > 0 && frame > durationInFrames - fadeOutFrames) {
      return (
        level *
        interpolate(frame, [durationInFrames - fadeOutFrames, durationInFrames], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      );
    }
    return level;
  };

  return (
    <>
      {audio.voice ? (
        <Audio src={asset(project, audio.voice)} volume={audio.voiceVolume} name="Voix" />
      ) : null}
      {audio.music ? (
        <Audio
          src={asset(project, audio.music)}
          volume={musicVolume}
          trimBefore={Math.round(audio.musicTrim * fps)}
          name="Musique"
        />
      ) : null}
    </>
  );
};
