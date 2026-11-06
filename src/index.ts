export {GenerativeMusic,defaultConfig,composeTrack,validateConfig,tunes} from './generative-music.js';
export {RotationScheduler,systemClock} from './scheduler.js';
export {virtualTrackIds,seeded,styles} from './composer.js';
export type {Config,TrackPlan,Clock,NoteEvent} from './composer.js';
export type {Style,Instrument,Tune,MelodyBar} from './types.js';

export {integratedLufs,truePeakDbfs,normalizationGainDb,applyGainDb,analyzeAndNormalize,estimateTrackGainDb} from './mastering.js';

export {renderTrackOffline} from './offline.js';
export type {OfflineRenderOptions,OfflineRenderResult} from './offline.js';
export type {LoudnessReport} from './mastering.js';
