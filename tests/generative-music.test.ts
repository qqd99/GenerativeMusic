import {describe,it,expect} from 'vitest';
import {composeTrack,tunes,virtualTrackIds,defaultConfig} from '../src/index';
describe('Generative Music composer',()=>{
 it('provides forty stable tune/style/key combinations',()=>{expect(new Set(virtualTrackIds()).size).toBe(40)});
 it('is deterministic for a fixed seed',()=>{const a=composeTrack(tunes[0],'swing',0,123,defaultConfig);const b=composeTrack(tunes[0],'swing',0,123,defaultConfig);expect(a.events).toEqual(b.events)});
 it('keeps generated notes inside the planned track',()=>{const p=composeTrack(tunes[1],'musicbox',10,7,defaultConfig);expect(p.events.length).toBeGreaterThan(100);expect(Math.max(...p.events.map(e=>e.at))).toBeLessThan(p.duration)});
});