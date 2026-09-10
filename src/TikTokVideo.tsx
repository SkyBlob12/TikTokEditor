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
import {SafeZoneGuide} from './components/SafeZoneGuide';

export type TikTokVideoProps = {
  /** Nom du dossier dans projects/ */
  project: string;
  /** Injecte par calculateMetadata. */
  plan?: Plan | null;
  words?: Word[];
  /**
   * Une transcription par prise, quand la voix vient de plusieurs rushes.
   * Injecte par calculateMetadata a partir de `plan.captions.sources`.
   */
  wordSets?: {syncTo: string; words: Word[]}[];
  /**
   * Cadence de rendu forcee, pour les brouillons.
   *
   * Tout le plan etant exprime en secondes, baisser la cadence divise le nombre
   * de frames a extraire sans deplacer quoi que ce soit sur la timeline. C'est
   * le seul levier qui accelere vraiment : le cout du rendu est domine par
   * l'extraction des frames du rush, pas par l'encodage.
   */
  fpsOverride?: number | null;
  /**
   * Affiche les reperes de la zone sure TikTok. Pour le Studio uniquement :
   * ne jamais laisser a `true` dans un rendu livre.
   */
  safeZoneGuide?: boolean;
};

export const TikTokVideo: React.FC<TikTokVideoProps> = ({
  project,
  plan,
  words = [],
  wordSets = [],
  safeZoneGuide = false,
}) => {
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

  // Les timings d'une transcription sont ceux de son fichier source. Si ce
  // fichier est remonte, on les replace sur la timeline finale, sinon on les
  // garde tels quels. Avec plusieurs prises, chaque transcription est recalee
  // sur les extraits de SON rush, puis tout est refondu en une seule liste.
  const timedWords = wordSets.length
    ? wordSets
        .flatMap((set) => remapWords(set.words, plan.clips, set.syncTo) ?? [])
        .sort((a, b) => a.startMs - b.startMs)
    : (remapWords(words, plan.clips, plan.captions?.syncTo) ?? words);

  return (
    <AbsoluteFill style={{backgroundColor: plan.background}}>
      <EffectLayer effects={plan.effects}>
        <ClipTrack clips={plan.clips} project={project} />
      </EffectLayer>
      <EffectOverlay effects={plan.effects} />
      {plan.captions ? (
        <Captions words={timedWords} config={plan.captions} safeZone={plan.safeZone} />
      ) : null}
      <Overlays overlays={plan.overlays} project={project} safeZone={plan.safeZone} />
      {plan.progressBar?.enabled ? (
        <ProgressBar
          color={plan.progressBar.color}
          height={plan.progressBar.height}
          safeZone={plan.safeZone}
        />
      ) : null}
      {plan.audio ? <AudioTrack audio={plan.audio} project={project} words={timedWords} /> : null}
      <SfxTrack sfx={plan.sfx} project={project} />
      {safeZoneGuide ? <SafeZoneGuide safeZone={plan.safeZone} /> : null}
    </AbsoluteFill>
  );
};
