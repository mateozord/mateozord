import {Composition} from 'remotion';
import {Fan} from './Fan';
import {FPS, TOTAL} from './timeline';
export const Root: React.FC = () => <Composition id="Fan" component={Fan} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />;
