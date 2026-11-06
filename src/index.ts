export {GenerativeMusic,defaultConfig,composeTrack,validateConfig,tunes} from './generative-music';
export {RotationScheduler,systemClock} from './scheduler';
export {virtualTrackIds,seeded,styles} from './composer';
export type {Config,TrackPlan,Clock,NoteEvent} from './composer';
export type {Style,Instrument,Tune,MelodyBar} from './types';

export {integratedLufs,truePeakDbfs,normalizationGainDb,applyGainDb,analyzeAndNormalize} from './mastering';
