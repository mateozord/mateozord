import {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {drawFrame, W, H} from './draw';

export const Washer: React.FC = () => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    drawFrame(ctx, frame);
  }, [frame]);
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <canvas ref={ref} width={W} height={H} style={{width: 1080, height: 1920, imageRendering: 'pixelated'}} />
      <Audio src={staticFile('soundtrack.wav')} />
    </AbsoluteFill>
  );
};
