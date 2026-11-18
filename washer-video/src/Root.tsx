import {Composition} from 'remotion';
import {Washer} from './Washer';
import {FPS, TOTAL} from './timeline';
export const Root: React.FC = () => (
  <Composition id="Washer" component={Washer} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
);
