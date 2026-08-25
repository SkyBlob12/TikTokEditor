import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';

export const ProgressBar: React.FC<{color: string; height: number}> = ({color, height}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const progress = Math.min(1, frame / Math.max(1, durationInFrames - 1));

  return (
    <AbsoluteFill style={{justifyContent: 'flex-end'}}>
      <div style={{height, width: '100%', backgroundColor: 'rgba(255,255,255,0.18)'}}>
        <div style={{height: '100%', width: `${progress * 100}%`, backgroundColor: color}} />
      </div>
    </AbsoluteFill>
  );
};
