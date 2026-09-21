import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Quaternion } from 'three';
import { WaterPhysics } from '../src/physics.js';
import { MotionControls, deviceGravity, screenVector } from '../src/motion.js';

function fixture(overrides={}) {
  const events=new Map();let timer;const gravity=[],shakes=[],messages=[];
  const env={isSecureContext:true,DeviceOrientationEvent:{},DeviceMotionEvent:{},screen:{orientation:{angle:0}},
    addEventListener:(name,handler)=>events.set(name,handler),removeEventListener:name=>events.delete(name),
    setTimeout:fn=>{timer=fn;return 1;},clearTimeout:()=>{timer=null;},...overrides};
  const motion=new MotionControls({env,onGravity:g=>gravity.push(g),onShake:v=>shakes.push(v),onStatus:m=>messages.push(m)});
  return {motion,env,events,gravity,shakes,messages,timeout:()=>timer?.()};
}
test('gravity covers flat/upright/inverted devices and landscape axes',()=>{
  assert.ok(deviceGravity(90,0).distanceTo(new Vector3(0,-1,0))<1e-6);
  assert.ok(deviceGravity(-90,0).distanceTo(new Vector3(0,1,0))<1e-6);
  assert.ok(deviceGravity(0,0).distanceTo(new Vector3(0,0,-1))<1e-6);
  assert.ok(screenVector(new Vector3(-1,0,0),90).distanceTo(new Vector3(0,-1,0))<1e-6);
  assert.ok(deviceGravity(0,-90,90).distanceTo(new Vector3(0,-1,0))<1e-6);
  assert.ok(deviceGravity(0,90,270).distanceTo(new Vector3(0,-1,0))<1e-6);
});
test('insecure and unsupported browsers preserve manual fallback',async()=>{
  for(const overrides of [{isSecureContext:false},{DeviceOrientationEvent:undefined}]){
    const f=fixture(overrides);await f.motion.enable();assert.equal(f.motion.enabled,false);assert.equal(f.events.size,0);assert.ok(f.messages.length);
  }
});
test('both permission requests start synchronously before either resolves',async()=>{
  const calls=[];let grant;
  const f=fixture({DeviceOrientationEvent:{requestPermission:()=>{calls.push('orientation');return new Promise(r=>grant=r);}},DeviceMotionEvent:{requestPermission:()=>{calls.push('motion');return Promise.resolve('granted');}}});
  const pending=f.motion.enable();assert.deepEqual(calls,['orientation','motion']);grant('granted');await pending;assert.equal(f.motion.enabled,true);f.motion.disable();assert.equal(f.events.size,0);
});
test('denial, timeout and cancellation cleanly leave manual controls available',async()=>{
  const denied=fixture({DeviceOrientationEvent:{requestPermission:()=>Promise.resolve('denied')}});await denied.motion.enable();assert.equal(denied.motion.enabled,false);
  const empty=fixture();await empty.motion.enable();empty.motion.orientation({beta:null,gamma:null});empty.timeout();assert.equal(empty.motion.enabled,false);assert.equal(empty.events.size,0);
  let resolve;const cancel=fixture({DeviceOrientationEvent:{requestPermission:()=>new Promise(r=>resolve=r)}});const pending=cancel.motion.enable();cancel.motion.disable();resolve('granted');await pending;assert.equal(cancel.events.size,0);
});
test('initial tilted grip and refresh preserve real gravity instead of zeroing tilt',async()=>{
  const f=fixture();await f.motion.enable();f.motion.orientation({beta:45,gamma:10,timeStamp:0});assert.ok(f.gravity.at(-1).distanceTo(deviceGravity(45,10))<1e-6);
  for(let i=1;i<=30;i++)f.motion.orientation({beta:-45,gamma:35,timeStamp:i*16});
  assert.ok(f.gravity.at(-1).distanceTo(new Vector3(0,-1,0))>.5);
  f.motion.calibrate();assert.ok(f.gravity.at(-1).distanceTo(deviceGravity(-45,35))<1e-6);
  f.env.screen.orientation.angle=90;f.events.get('orientationchange')();assert.ok(f.gravity.at(-1).distanceTo(deviceGravity(-45,35,90))<1e-6);
});
test('a single inversion sample immediately reverses gravity',async()=>{
  const f=fixture();await f.motion.enable();f.motion.orientation({beta:90,gamma:0,timeStamp:0});
  f.motion.orientation({beta:-90,gamma:0,timeStamp:16});assert.ok(f.gravity.at(-1).y>.99);
});
test('sensor-to-physics: sideways tilt moves settled rings and inversion lifts them',async()=>{
  const s=await WaterPhysics.create();const f=fixture();
  f.motion.onGravity=g=>s.setOrientation(new Quaternion().setFromUnitVectors(g,new Vector3(0,-1,0)));
  await f.motion.enable();f.motion.orientation({beta:90,gamma:0,timeStamp:0});
  for(let i=0;i<600;i++)s.step();
  const before=s.rings.reduce((a,r)=>a+r.body.translation().x,0)/8;
  // Hold a 60-degree sideways tilt, with no water pulses or shake.
  for(let i=0;i<360;i++){f.motion.orientation({beta:30,gamma:90,timeStamp:16+i*1000/120});s.step();}
  const after=s.rings.reduce((a,r)=>a+r.body.translation().x,0)/8;
  // Pegs physically obstruct some rings; require clear movement of the whole group's mean.
  assert.ok(after-before>.5,`mean lateral displacement ${after-before}`);
  const low=s.rings.reduce((a,r)=>a+r.body.translation().y,0)/8;
  f.motion.orientation({beta:-90,gamma:0,timeStamp:4000});
  for(let i=0;i<600;i++)s.step();
  const high=s.rings.reduce((a,r)=>a+r.body.translation().y,0)/8;
  assert.ok(high-low>2,`mean rise ${high-low}`);s.dispose();
});
test('motion permission may fail while orientation continues',async()=>{
  const f=fixture({DeviceMotionEvent:{requestPermission:()=>Promise.reject(Error('blocked'))}});await f.motion.enable();assert.equal(f.motion.enabled,true);assert.equal(f.events.has('devicemotion'),false);
});
test('shake uses gravity-free acceleration, dead zone and bounded time-scaled impulses',async()=>{
  const f=fixture();await f.motion.enable();f.motion.orientation({beta:90,gamma:0,timeStamp:0});
  f.motion.motion({acceleration:null,accelerationIncludingGravity:{x:0,y:-9.8,z:0},timeStamp:10});assert.equal(f.shakes.length,0);
  f.motion.motion({acceleration:{x:0,y:0,z:0},timeStamp:20});
  f.motion.motion({acceleration:{x:.1,y:.1,z:0},timeStamp:40});assert.equal(f.shakes.length,0);
  f.motion.motion({acceleration:{x:10,y:0,z:0},timeStamp:60});assert.ok(f.shakes[0].x<0);assert.ok(Math.abs(f.shakes[0].x+.13)<1e-6);
  f.motion.motion({acceleration:{x:1000,y:0,z:0},timeStamp:2000});assert.ok(f.shakes.at(-1).length()<=35*.05*.65+.00001);
  f.motion.isPaused=()=>true;f.motion.motion({acceleration:{x:10,y:0,z:0},timeStamp:2100});assert.equal(f.shakes.length,2);
});
