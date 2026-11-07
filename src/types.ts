export type Style = 'swing' | 'ballad' | 'musicbox' | 'bellchoir' | 'ambient';
export type MusicMood = 'calm' | 'exciting';
export type Instrument = 'piano' | 'celesta' | 'bell' | 'bass' | 'strings' | 'sleigh';
export type MelodyBar = readonly (readonly [beat:number, midi:number, duration:number])[];
export type Tune = { id:string; title:string; key:number; meter:3|4; melody:readonly MelodyBar[]; source:string; sourceNote:string };
