import React from 'react';
import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {CaptionsConfig} from '../schema';
import {FONTS} from '../lib/fonts';
import {paginate, type Page, type TimedWord} from '../lib/captions';

const CaptionPage: React.FC<{page: Page; config: CaptionsConfig}> = ({page, config}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const font = FONTS[config.font];

  const timeMs = page.startMs + (frame / fps) * 1000;
  const entry = spring({frame, fps, config: {damping: 200}, durationInFrames: 5});

  const outlined = config.style === 'karaoke' || config.style === 'punch';
  const strokeWidth = Math.round(config.fontSize * 0.13);

  const base: React.CSSProperties = {
    ...font,
    fontSize: config.fontSize,
    lineHeight: 1.15,
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

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingLeft: 90,
        paddingRight: 90,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: `${config.y * 100}%`,
          transform: `translateY(-50%) scale(${0.94 + entry * 0.06})`,
          width: '100%',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: `${Math.round(config.fontSize * 0.14)}px ${Math.round(config.fontSize * 0.22)}px`,
          ...(config.style === 'boxed'
            ? {
                backgroundColor: 'rgba(0,0,0,0.72)',
                borderRadius: 22,
                padding: '18px 26px',
                width: 'auto',
                maxWidth: '100%',
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
    </AbsoluteFill>
  );
};

export const Captions: React.FC<{words: TimedWord[]; config: CaptionsConfig}> = ({words, config}) => {
  const {fps} = useVideoConfig();

  if (!config.enabled || words.length === 0) return null;

  // Corrections de lexique avant tout decoupage en pages.
  const corrected = config.replace
    ? words.map((word) => {
        const key = word.text.trim().replace(/[.,!?;:…]+$/u, '');
        const match = Object.keys(config.replace ?? {}).find(
          (k) => k.toLowerCase() === key.toLowerCase(),
        );
        return match
          ? {...word, text: word.text.replace(key, config.replace![match])}
          : word;
      })
    : words;

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
            <CaptionPage page={page} config={config} />
          </Sequence>
        );
      })}
    </>
  );
};
