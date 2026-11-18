import {Composition} from 'remotion';
import {Main} from './Main';
import {FPS, TOTAL} from './timeline';
export const Root: React.FC = () => <Composition id="MICRO" component={Main} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />;
