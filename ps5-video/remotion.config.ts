import {Config} from '@remotion/cli/config';
Config.setVideoImageFormat('png');
Config.setCodec('h264');
Config.setCrf(16);
if (process.env.CHROME_PATH) Config.setBrowserExecutable(process.env.CHROME_PATH);
Config.setChromiumOpenGlRenderer('swangle');
