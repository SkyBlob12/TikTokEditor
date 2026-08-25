import React from 'react';
import {Composition, type CalculateMetadataFunction} from 'remotion';
import {TikTokVideo, type TikTokVideoProps} from './TikTokVideo';
import {loadPlan, loadWords, planDurationInFrames} from './lib/project';

/**
 * Le projet a afficher par defaut dans le Studio.
 * Surchargeable : `npm run studio -- --props='{"project":"mon-projet"}'`
 */
const DEFAULT_PROJECT = process.env.REMOTION_PROJECT ?? 'demo';

const calculateMetadata: CalculateMetadataFunction<TikTokVideoProps> = async ({props}) => {
  const plan = await loadPlan(props.project);
  const words = plan.captions?.enabled
    ? await loadWords(props.project, plan.captions.file)
    : [];

  const fps = props.fpsOverride ?? plan.fps;

  return {
    durationInFrames: planDurationInFrames(plan, fps),
    fps,
    width: plan.width,
    height: plan.height,
    props: {...props, plan, words},
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="TikTok"
      component={TikTokVideo}
      calculateMetadata={calculateMetadata}
      defaultProps={{project: DEFAULT_PROJECT, plan: null, words: [], fpsOverride: null}}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
