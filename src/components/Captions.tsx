import React from 'react';
import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {CaptionsConfig, SafeZone} from '../schema';
import {FONTS} from '../lib/fonts';
import {applyReplacements, paginate, type Page, type TimedWord} from '../lib/captions';
import {clampBottom, insetsOf, sideInset} from '../lib/safeZone';

const LINE_HEIGHT = 1.15;

const CaptionPage: React.FC<{page: Page; config: CaptionsConfig; safeZone: SafeZone}> = ({
  page,
  config,
  safeZone,
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const font = FONTS[config.font];

  const timeMs = page.startMs + (frame / fps) * 1000;
  const entry = spring({frame, fps, config: {damping: 200}, durationInFrames: 5});

  const outlined = config.style === 'karaoke' || config.style === 'punch';
  const strokeWidth = Math.round(config.fontSize * 0.13);

  const base: React.CSSProperties = {
    ...font,
    fontSize: config.fontSize,
    lineHeight: LINE_HEIGHT,
    textAlign: 'center',
    textTransform: config.uppercase ? 'uppercase' : 'none',
    letterSpacing: config.style === 'clean' ? '0.01em' : '-0.01em',
    ...(outlined
      ? {
          WebkitTextStroke: `${strokeWidth}px #000000`,
          paintOrder: 'stroke fill',
          filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.45))',
        }
      : {textShadow: '0 4px 18px rgba(0,0,0,0.55)'}),
  };

  /**
   * Le bloc est ancre par son bord BAS, pas par son centre : une page qui passe
   * sur deux lignes monte au lieu de descendre sous la legende TikTok. Le bord
   * bas lui-meme est ramene dans la zone sure, ce qui est la seule facon de
   * garantir qu'un sous-titre reste entierement lisible dans l'application.
   */
  const insets = insetsOf(safeZone, width, height);
  const side = sideInset(insets);
  const lineHeight = config.fontSize * LINE_HEIGHT;
  const boxed = config.style === 'boxed';
  const bottomPx = clampBottom(
    config.y * height + lineHeight / 2 + (boxed ? 18 : 0),
    lineHeight + (boxed ? 36 : 0),
    insets,
    height,
  );

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: side,
          right: side,
          bottom: height - bottomPx,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            transform: `scale(${0.94 + entry * 0.06})`,
            transformOrigin: 'center bottom',
            maxWidth: '100%',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: `${Math.round(config.fontSize * 0.14)}px ${Math.round(config.fontSize * 0.22)}px`,
            ...(boxed
              ? {
                  backgroundColor: 'rgba(0,0,0,0.72)',
                  borderRadius: 22,
                  padding: '18px 26px',
                }
              : {}),
          }}
        >
          {page.tokens.map((token, i) => {
            const active = timeMs >= token.fromMs && timeMs < token.toMs;
            const highlighted = active && config.style !== 'clean';

            return (
              <span
                key={`${token.text}-${i}`}
                style={{
                  ...base,
                  display: 'inline-block',
                  color: highlighted ? config.highlight : config.color,
                  transform: highlighted && config.style === 'punch' ? 'scale(1.14)' : 'none',
                  ...(config.style === 'boxed' && active
                    ? {
                        backgroundColor: config.highlight,
                        color: '#000000',
                        borderRadius: 10,
                        padding: '0 12px',
                        textShadow: 'none',
                      }
                    : {}),
                }}
              >
                {token.text}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Captions: React.FC<{
  words: TimedWord[];
  config: CaptionsConfig;
  safeZone: SafeZone;
}> = ({words, config, safeZone}) => {
  const {fps} = useVideoConfig();

  if (!config.enabled || words.length === 0) return null;

  // Corrections de lexique avant tout decoupage en pages.
  const corrected = applyReplacements(words, config.replace);

  const pages = paginate(corrected, {
    wordsPerPage: config.wordsPerPage,
    offsetMs: Math.round(config.offset * 1000),
  });

  return (
    <>
      {pages.map((page, i) => {
        const from = Math.round((page.startMs / 1000) * fps);
        const durationInFrames = Math.max(
          1,
          Math.round(((page.endMs - page.startMs) / 1000) * fps),
        );
        return (
          <Sequence
            key={i}
            from={Math.max(0, from)}
            durationInFrames={durationInFrames}
            name={`Sub ${i + 1} — ${page.tokens.map((t) => t.text).join(' ').slice(0, 24)}`}
            layout="none"
          >
            <CaptionPage page={page} config={config} safeZone={safeZone} />
          </Sequence>
        );
      })}
    </>
  );
};
