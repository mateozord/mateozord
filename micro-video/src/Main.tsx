import {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame} from 'remotion';
import {MicroScene, RW, RH} from './scene';
import {drawUI, UW, UH} from './ui';

export const Main: React.FC = () => {
  const frame = useCurrentFrame();
  const gl = useRef<HTMLCanvasElement>(null);
  const ui = useRef<HTMLCanvasElement>(null);
  const scene = useRef<MicroScene | null>(null);
  useLayoutEffect(() => {
    if (!scene.current) scene.current = new MicroScene(gl.current!);
    scene.current.render(frame);
    const c = ui.current!.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    drawUI(c, frame, scene.current);
  }, [frame]);
  const st = {position: 'absolute' as const, inset: 0, width: 1080, height: 1920, imageRendering: 'pixelated' as const};
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <canvas ref={gl} width={RW} height={RH} style={st} />
      <canvas ref={ui} width={UW} height={UH} style={st} />
      <Audio src={staticFile('soundtrack.wav')} />
    </AbsoluteFill>
  );
};
