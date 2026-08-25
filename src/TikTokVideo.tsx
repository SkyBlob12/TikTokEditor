import React from 'react';
import {AbsoluteFill} from 'remotion';
import type {Plan, Word} from './schema';
import {remapWords} from './lib/captions';
import {ClipTrack} from './components/ClipTrack';
import {Overlays} from './components/Overlays';
import {Captions} from './components/Captions';
import {AudioTrack} from './components/AudioTrack';
import {ProgressBar} from './components/ProgressBar';
import {EffectLayer, EffectOverlay} from './components/Effects';
import {SfxTrack} from './components/SfxTrack';

export type TikTokVideoProps = {
  /** Nom du dossier dans projects/ */
  project: string;
  /** Injecte par calculateMetadata. */
  plan?: Plan | null;
  words?: Word[];
  /**
   * Cadence de rendu forcee, pour les brouillons.
   *
   * Tout le plan etant exprime en secondes, baisser la cadence divise le nombre
   * de frames a extraire sans deplacer quoi que ce soit sur la timeline. C'est
   * le seul levier qui accelere vraiment : le cout du rendu est domine par
   * l'extraction des frames du rush, pas par l'encodage.
   */
  fpsOverride?: number | null;
};

export const TikTokVideo: React.FC<TikTokVideoProps> = ({project, plan, words = []}) => {
  if (!plan) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#111',
          color: '#fff',
          fontFamily: 'monospace',
          fontSize: 34,
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          padding: 80,
        }}
      >
        Aucun plan charge pour « {project} ».{'\n'}
        Verifie projects/{project}/plan.json
      </AbsoluteFill>
    );
  }

  // Les timings de captions.json sont ceux du fichier source. Si ce fichier est
  // remonte, on les replace sur la timeline finale — sinon on les garde tels quels.
  const timedWords = remapWords(words, plan.clips, plan.captions?.syncTo) ?? words;

  return (
    <AbsoluteFill style={{backgroundColor: plan.background}}>
      <EffectLayer effects={plan.effects}>
        <ClipTrack clips={plan.clips} project={project} />
      </EffectLayer>
      <EffectOverlay effects={plan.effects} />
      {plan.captions ? <Captions words={timedWords} config={plan.captions} /> : null}
      <Overlays overlays={plan.overlays} project={project} />
      {plan.progressBar?.enabled ? (
        <ProgressBar color={plan.progressBar.color} height={plan.progressBar.height} />
      ) : null}
      {plan.audio ? <AudioTrack audio={plan.audio} project={project} words={timedWords} /> : null}
      <SfxTrack sfx={plan.sfx} project={project} />
    </AbsoluteFill>
  );
};
