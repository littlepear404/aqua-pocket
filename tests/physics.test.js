import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from 'three';
import {WaterPhysics,DT} from '../src/physics.js';

test('8 volumetric rings, independent pumps, and 200 ms cooldown',async()=>{
 const s=await WaterPhysics.create();
 assert.equal(s.rings.length,8); assert.equal(s.rings[0].body.numColliders(),24);
 assert.equal(s.pulse(0),true);assert.equal(s.pulse(0),false);assert.equal(s.pulse(1),true);
 for(let i=0;i<23;i++)s.step();assert.equal(s.pulse(0),false);
 s.step();assert.equal(s.pulse(0),true);s.dispose();
});
test('orientation rotates gravity through all three dimensions',async()=>{
 const s=await WaterPhysics.create();
 s.setOrientation(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI));
 assert.ok(s.world.gravity.y>2.19);
 s.setOrientation(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2));
 assert.ok(Math.abs(s.world.gravity.z)>2.19);s.dispose();
});
test('ring hole admits a peg and falling rings settle around it without artificial attachment',async()=>{
 const s=await WaterPhysics.create();const b=s.rings[0].body;
 b.setTranslation({x:-1.18,y:.3,z:0},true);
 b.setRotation(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2),true);
 for(let i=1;i<8;i++)s.rings[i].body.setTranslation({x:2.3,y:-1.8+(i-1)*.5,z:0},true);
 for(let i=0;i<600;i++)s.step();
 assert.equal(s.detectPeg(b),0);assert.ok(b.translation().y<-.4);
 s.setOrientation(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI));
 for(let i=0;i<700;i++)s.step();assert.equal(s.detectPeg(b),-1);s.dispose();
});
test('nearby jet lifts rings, stronger pressure has greater effect',async()=>{
 async function run(power){const s=await WaterPhysics.create();const b=s.rings[0].body;b.setTranslation({x:-2.35,y:-1.5,z:0},true);s.pulse(0,power);for(let i=0;i<60;i++)s.step();const y=b.translation().y;s.dispose();return y;}
 const weak=await run(.6),strong=await run(1.6);assert.ok(strong>weak+.15,`${weak} vs ${strong}`);assert.ok(strong>-.23,'strong pulse should raise a nearby ring above the peg tip within 0.5 s');
});
test('all eight threaded rings win after stable hold; reset clears success',async()=>{
 const s=await WaterPhysics.create();
 s.rings.forEach(({body},i)=>{body.setTranslation({x:i<4?-1.18:1.18,y:-1.9+(i%4)*.22,z:0},true);body.setRotation(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2),true);});
 for(let i=0;i<180;i++)s.step();assert.equal(s.count,8);assert.equal(s.won,true);
 s.reset();assert.equal(s.won,false);assert.equal(s.count,0);s.dispose();
});
test('stress: repeated jets, shakes and full rotations stay finite and contained',async()=>{
 const s=await WaterPhysics.create();
 for(let i=0;i<3600;i++){
  if(i%30===0){s.pulse(0,2.5);s.pulse(1,2.5);}
  if(i%120===0){s.setOrientation(new Quaternion().setFromAxisAngle(new Vector3(1,1,1).normalize(),i*.02));s.shake(new Vector3(3,-2,1),2);}
  s.step();
  for(const {body} of s.rings){const p=body.translation();assert.ok(Number.isFinite(p.x+p.y+p.z));assert.ok(Math.abs(p.x)<3.3 && Math.abs(p.y)<2.35 && Math.abs(p.z)<.9,JSON.stringify(p));}
 }
 assert.ok(s.time>=3600*DT-.001);s.dispose();
});
