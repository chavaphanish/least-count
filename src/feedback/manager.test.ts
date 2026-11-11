import { afterEach,describe,it,expect,vi } from 'vitest'
import { FeedbackManager,loadPreferences,defaults } from './manager'
import type { AudioPlayer } from './audio'
afterEach(()=>vi.unstubAllGlobals())
function setup(mobile=true){
 const audio={play:vi.fn(),stop:vi.fn(),stopAll:vi.fn()},vibrate=vi.fn(),storage={getItem:vi.fn(()=>null),setItem:vi.fn()}
 vi.stubGlobal('document',{hidden:false});vi.stubGlobal('navigator',{vibrate})
 const manager=new FeedbackManager(audio as unknown as AudioPlayer,()=>mobile,storage as unknown as Storage)
 return{manager,audio,vibrate,storage}
}
describe('independent feedback preferences',()=>{
 it.each([[true,true,true,1,1],[true,false,true,1,0],[false,true,true,0,1],[false,false,true,0,0],[true,true,false,0,0],[false,false,false,0,0]])('sound %s vibration %s turn %s', (sound,vibration,notifications,bells,haptics)=>{
  const {manager,audio,vibrate}=setup();manager.set('sound',sound);manager.set('vibration',vibration);manager.set('turnNotifications',notifications);vibrate.mockClear();manager.turn('turn')
  expect(audio.play).toHaveBeenCalledTimes(bells);expect(vibrate).toHaveBeenCalledTimes(haptics)
 })
 it('uses safe defaults and preserves explicit false preferences',()=>{
  expect(loadPreferences(null)).toEqual(defaults);expect(loadPreferences({getItem:()=>'{broken'})).toEqual(defaults)
  expect(loadPreferences({getItem:()=>'{"sound":false,"vibration":"yes"}'})).toEqual({...defaults,sound:false})
 })
 it('stops sound immediately, persists settings and does not disable haptics',()=>{
  const {manager,audio,vibrate,storage}=setup();manager.tick('turn');manager.set('sound',false);expect(audio.stopAll).toHaveBeenCalled();manager.turn('turn');expect(vibrate).toHaveBeenLastCalledWith(150);expect(storage.setItem).toHaveBeenCalled()
 })
 it('tick loops do not restart each second; disabling sound stops them and re-enabling can resume',()=>{
  const {manager,audio}=setup();manager.tick('a');manager.tick('a');expect(audio.play).toHaveBeenCalledTimes(1);manager.set('sound',false);manager.set('sound',true);expect(audio.play).toHaveBeenCalledTimes(2);manager.tick(null);expect(audio.stop).toHaveBeenLastCalledWith('tick')
 })
 it('cancels vibration immediately and keeps sound working',()=>{
  const {manager,audio,vibrate}=setup();manager.set('vibration',false);expect(vibrate).toHaveBeenLastCalledWith(0);manager.turn('a');expect(audio.play).toHaveBeenCalledWith('turn_bell','turn',3)
 })
 it('uses two/three celebration pulses and stops lower-priority feedback',()=>{
  const {manager,audio,vibrate}=setup();manager.celebrate(false,'round');expect(vibrate).toHaveBeenLastCalledWith([150,120,150]);manager.celebrate(true,'game');expect(vibrate).toHaveBeenLastCalledWith([150,120,150,120,150]);expect(audio.play).toHaveBeenLastCalledWith('game_applause','game',5);expect(audio.stopAll).toHaveBeenCalledTimes(2)
 })
 it('never vibrates desktops, unsupported hardware or hidden applications',()=>{
  const {manager,vibrate,audio}=setup(false);manager.turn('a');expect(vibrate).not.toHaveBeenCalled();vi.stubGlobal('document',{hidden:true});manager.turn('b');expect(audio.play).toHaveBeenCalledTimes(1)
  vi.stubGlobal('navigator',{});expect(manager.supported()).toBe(false)
 })
})

it('cross-tab preferences apply atomically without writing back or losing independent values',()=>{
 const {manager,audio,storage}=setup();storage.getItem.mockReturnValueOnce('{"sound":false,"vibration":false,"turnNotifications":true}' as never);const subscriber=vi.fn();manager.subscribe(subscriber);manager.reload();expect(manager.preferences).toEqual({sound:false,vibration:false,turnNotifications:true});expect(subscriber).toHaveBeenCalledTimes(1);expect(storage.setItem).not.toHaveBeenCalled();expect(audio.stopAll).toHaveBeenCalled()
})
