import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WaterPhysics, DT, PEGS, RADIUS, TUBE } from './physics.js';
import { MotionControls } from './motion.js';
import './style.css';

document.querySelector('#app').innerHTML=`
<header><div class="logo">aqua<span>POCKET PLAY</span></div><div class="head-right"><span><i class="live"></i>一点水压，一点童年。</span><button class="plain" id="help">玩法指南 ↗</button></div></header>
<main><div class="intro"><div><div class="eyebrow">THE LITTLE THINGS / 001</div><h1>把快乐，握在手心。</h1><p>按下水流，让八枚彩环轻轻落在柱上。</p></div><div class="edition">WATER RING TOSS<br>交互式 3D 水压套圈机</div></div>
<div class="layout"><div><div class="stage"><span class="stage-label">AQUA — ORIGINAL EDITION</span><div class="view-controls"><button id="view">侧面观察</button><button id="reset">重新开始 ↻</button></div><canvas id="scene" aria-label="3D 水压套圈游戏机，拖动旋转，Shift 拖动晃动"></canvas><div id="loading">正在注入一小片快乐…</div><div class="hint">拖动机身旋转 · Shift + 拖动晃动 · 滚轮缩放</div><div id="message" class="hidden"><div class="eyebrow">A LITTLE VICTORY</div><h2>八枚快乐，全部接住。</h2><p id="win-detail"></p><button id="again">再玩一次 ↗</button></div></div>
<div class="under"><div class="pumps"><button class="pump" id="left" aria-label="左侧水压"><span>◉ 左侧水压</span><kbd>A</kbd></button><button class="pump" id="right" aria-label="右侧水压"><span>右侧水压 ◉</span><kbd>D</kbd></button></div><p>按住连续泵水 · 最快每 0.2 秒一次<br>Shift 加强 / Shift + 空格 最强 · 支持笔压</p></div>
<section class="motion-panel" aria-label="手机体感控制"><div class="motion-actions"><button id="motion-toggle" aria-pressed="false">启用手机体感</button><button id="motion-calibrate" disabled>刷新姿态</button></div><p id="motion-status" role="status">像握住真实套圈机一样：竖握向下沉，侧倾向低侧滑，倒置向顶部落。</p><p id="gravity-readout" class="motion-help">真实重力模式 · 平放时圆环沉向屏幕背面</p><p class="motion-help">需要 HTTPS 与设备支持。双指可同时按左右水压；普通触屏用三档力度控制。</p></section>
<section class="key-guide" aria-labelledby="key-guide-title">
  <div class="key-guide-heading"><h2 id="key-guide-title">操作键位</h2><span>按住喷水 · 组合键同时按</span></div>
  <dl class="key-guide-grid">
    <div><dt><kbd>A</kbd> / <kbd>D</kbd></dt><dd>左 / 右喷水，可同时按</dd></div>
    <div><dt><kbd>Shift</kbd> + <kbd>A / D</kbd></dt><dd>加强水压</dd></div>
    <div><dt><kbd>Shift</kbd> + <kbd>空格</kbd> + <kbd>A / D</kbd></dt><dd>最强水压</dd></div>
    <div><dt><kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd></dt><dd>微调机身倾斜</dd></div>
    <div><dt><kbd>Q</kbd> / <kbd>E</kbd></dt><dd>轻晃 / 用力晃</dd></div>
    <div><dt><kbd>Shift</kbd> + <span>拖动</span></dt><dd>晃动，越快力度越大</dd></div>
    <div><dt>鼠标 / 手指拖动</dt><dd>360° 旋转机身</dd></div>
    <div><dt>鼠标滚轮</dt><dd>放大 / 缩小视角</dd></div>
  </dl>
  <p>触屏可直接按水压按钮、拖动机身，并使用右侧或下方的力度、倾斜与晃动控件。</p>
</section></div>
<aside class="controls"><div class="control-block"><div class="section-label">01 / YOUR PROGRESS</div><div class="score-row"><div class="score"><span id="score">0</span><small> / 8</small></div><span class="state" id="state">慢慢来，别着急</span></div><div class="dots">${Array.from({length:8},()=>'<i class="dot"></i>').join('')}</div><div class="row"><span>游戏时间</span><strong id="time">00:00</strong></div><div class="row"><span>水压次数</span><strong id="pulses">000</strong></div></div><div class="divider"></div>
<div class="control-block"><div class="section-label">02 / WATER PRESSURE</div><div class="row"><span>基础水压力度</span><strong id="power-label">标准 · 100%</strong></div><div class="pressure-levels"><button data-power="0.6">轻柔</button><button data-power="1" class="selected">标准</button><button data-power="1.6">强劲</button></div><div class="note">左右水流相互独立，可同时按压。<br>把圆环托高，再用倾斜调整落点。</div></div><div class="divider"></div>
<div class="control-block"><div class="section-label">03 / TILT & SHAKE</div><div class="row"><label for="roll">左右翻转</label><strong id="roll-value">0°</strong></div><input class="range" id="roll" type="range" min="-180" max="180" value="0"><div class="row"><label for="pitch">前后倾斜</label><strong id="pitch-value">0°</strong></div><input class="range" id="pitch" type="range" min="-180" max="180" value="0"><div class="shake-row"><button id="gentle">轻晃 <kbd>Q</kbd></button><button id="strong">用力晃 <kbd>E</kbd></button><button id="upright" aria-label="恢复直立">归正</button></div><div class="note">360° 自由调整重力方向<br>方向键微调 · Q / E 施加不同惯性</div></div></aside></div>
<footer class="bottom"><span>没有电池的童年，有一点物理的魔法。</span><span>8 RINGS · 2 PEGS · ENDLESS LITTLE JOYS</span></footer></main>
<dialog id="guide"><h2>掌心里的小小海洋</h2><p>目标：让 8 个圆环同时套在两根柱子上，保持片刻即可获胜。两根柱子上的数量不限。</p><p><b>水压</b>：点击或按住左右按钮，也可按 A / D。Shift 加强，Shift + 空格最强。触控笔支持压力变化。每侧泵水至少间隔 0.2 秒。</p><p><b>倾斜</b>：拖动机身或调整两个角度滑块，可翻转整台机器。方向键精细调整。倾斜会改变重力，已套上的环也可能脱落。</p><p><b>晃动</b>：按住 Shift 快速拖动机身，或按 Q 轻晃、E 猛晃。速度越快，惯性越强。</p><p><b>物理说明</b>：实体刚体碰撞、浮力后的有效重力、流体阻力和局部衰减水流；采用适合实时游戏的水动力近似，非完整 CFD 求解。</p><button class="plain" id="close-help">开始玩吧</button></dialog>`;

const $=s=>document.querySelector(s);
$('#help').onclick=()=>$('#guide').showModal(); $('#close-help').onclick=()=>$('#guide').close();
let sim;
try { sim=await WaterPhysics.create(); } catch(error) { $('#loading').textContent='物理引擎加载失败，请刷新页面。'; throw error; }
const canvas=$('#scene');
let renderer;
try {renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});} catch(error) {$('#loading').textContent='需要支持 WebGL 2 的浏览器，请启用硬件加速后重试。';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer: coarse)').matches?1.5:2));renderer.setClearColor(0x000000,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(34,1,.1,100);camera.position.set(0,1,16.5);camera.lookAt(0,0,0);
scene.add(new THREE.HemisphereLight(0xf4fff4,0x5c8068,3));
const light=new THREE.DirectionalLight(0xfff4d9,4);light.position.set(-4,7,8);scene.add(light);
const rim=new THREE.DirectionalLight(0xc4ecff,2);rim.position.set(6,1,-3);scene.add(rim);
const machine=new THREE.Group();scene.add(machine);
const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.35,metalness:.05,...extra});
const green=mat(0x9caf81),edge=mat(0x657b54),dark=mat(0x42573b),cream=mat(0xe8e7c5);
function box(w,h,d,r,material,x=0,y=0,z=0){const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,5,r),material);m.position.set(x,y,z);machine.add(m);return m;}
box(7.6,7.25,.32,.15,green,0,-.25,-1.02);
box(.68,5.35,1.8,.25,green,-3.46,.55,-.15);
box(.68,5.35,1.8,.25,green,3.46,.55,-.15);
box(7.35,.68,1.8,.26,green,0,3.04,-.15);
box(7.35,1.84,1.8,.32,green,0,-2.95,-.15);
function bezel(w,h,innerW,innerH,material,z){const s=new THREE.Shape();s.moveTo(-w/2,-h/2);s.lineTo(w/2,-h/2);s.lineTo(w/2,h/2);s.lineTo(-w/2,h/2);s.closePath();const hole=new THREE.Path();hole.moveTo(-innerW/2,-innerH/2);hole.lineTo(-innerW/2,innerH/2);hole.lineTo(innerW/2,innerH/2);hole.lineTo(innerW/2,-innerH/2);hole.closePath();s.holes.push(hole);const m=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:.1,bevelEnabled:true,bevelThickness:.04,bevelSize:.06,bevelSegments:3}),material);m.position.set(0,.55,z);machine.add(m);}
bezel(7.05,5.2,6.48,4.58,edge,.80);
bezel(6.60,4.71,6.25,4.33,dark,.92);
// The physics tank is centred at zero; this offset aligns it with the display window.
const tank=new THREE.Group();tank.position.y=.55;machine.add(tank);
const back=new THREE.Mesh(new THREE.BoxGeometry(6.23,4.31,.06),mat(0x75c7c1,{roughness:.62}));back.position.z=-.78;tank.add(back);
const floor=new THREE.Mesh(new THREE.BoxGeometry(6.23,.10,1.5),mat(0x6db4a2));floor.position.y=-2.12;tank.add(floor);
const water=new THREE.Mesh(new THREE.BoxGeometry(6.23,4.32,1.5),new THREE.MeshPhysicalMaterial({color:0x95eddf,transparent:true,opacity:.075,roughness:.15,depthWrite:false,side:THREE.DoubleSide}));tank.add(water);
// Gentle graphic caustics on the back wall.
for(let i=0;i<11;i++) {const points=[];for(let j=0;j<=50;j++){const x=-3.1+j*6.2/50;points.push(new THREE.Vector3(x,-2.05+i*.42+Math.sin(x*2+i)*.07,-.739));}const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xb4eee0,transparent:true,opacity:.16}));tank.add(line);}
for(const x of PEGS){const peg=new THREE.Mesh(new THREE.CylinderGeometry(.095,.095,1.92,24),mat(0xf5e9a7,{metalness:.28,roughness:.2}));peg.position.set(x,-1.19,0);tank.add(peg);const cap=new THREE.Mesh(new THREE.SphereGeometry(.095,16,12),peg.material);cap.position.set(x,-.23,0);tank.add(cap);const base=new THREE.Mesh(new THREE.CylinderGeometry(.29,.33,.10,32),edge);base.position.set(x,-2.07,0);tank.add(base);}
for(const side of [-1,1]){const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(.14,.21,.3,24),cream);nozzle.rotation.z=-side*.65;nozzle.position.set(side*2.95,-1.95,0);tank.add(nozzle);const hole=new THREE.Mesh(new THREE.SphereGeometry(.10,16,12),dark);hole.position.set(side*2.88,-1.82,0);tank.add(hole);}
const colors=[0xf0ae66,0xf48e8b,0xf2dc75,0xb9a0d2,0xe3b36c,0x76b4de,0xefa49c,0xb7d276];
const ringMeshes=sim.rings.map((r,i)=>{const m=new THREE.Mesh(new THREE.TorusGeometry(RADIUS,TUBE,12,64),mat(colors[i],{roughness:.23,metalness:.12}));tank.add(m);return m;});
// Thin glass outline, with narrow highlights that do not obscure the rings.
box(.045,4.5,.03,.02,mat(0xe3fff5,{transparent:true,opacity:.6}),-3.19,.55,1.055);
box(6.3,.035,.03,.015,mat(0xe3fff5,{transparent:true,opacity:.65}),0,2.83,1.055);
function label(text,size,color,x,y,z,width){const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.font=`500 ${size}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,64);const texture=new THREE.CanvasTexture(c);const m=new THREE.Mesh(new THREE.PlaneGeometry(width,width/8),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));m.position.set(x,y,z);machine.add(m);}
label('aqua',100,'#f1efd5',0,3.03,.79,1.3);label('W A T E R   R I N G   T O S S',43,'#526846',0,-2.18,.81,2.45);label('P O C K E T   N o . 0 1',36,'#5e704c',0,-3.35,.80,1.8);
const buttons=[];
for(const x of [-2.55,2.55]) {const base=new THREE.Mesh(new THREE.CylinderGeometry(.63,.65,.10,48),edge);base.rotation.x=Math.PI/2;base.position.set(x,-2.83,.79);machine.add(base);const m=new THREE.Mesh(new THREE.CylinderGeometry(.51,.55,.22,48),mat(0xd8ddb2));m.rotation.x=Math.PI/2;m.position.set(x,-2.83,.91);machine.add(m);buttons.push(m);const inset=new THREE.Mesh(new THREE.TorusGeometry(.37,.016,8,48),mat(0xa8b58c));inset.position.set(x,-2.83,1.027);machine.add(inset);}
for(let i=0;i<5;i++)box(.035,.20+(2-Math.abs(2-i))*.06,.025,.015,edge,(i-2)*.12,-2.85,.78);
const particles=[];const bubbleGeometry=new THREE.SphereGeometry(.035,8,6);const bubbleMaterial=new THREE.MeshBasicMaterial({color:0xdbfff3,transparent:true,opacity:.52});
function bubbles(side,strength){for(let i=0;i<18;i++){const m=new THREE.Mesh(bubbleGeometry,bubbleMaterial);m.position.set(side===0?-2.9:2.9,-1.85,(Math.random()-.5)*.4);tank.add(m);particles.push({mesh:m,v:new THREE.Vector3((side===0?1:-1)*(.7+Math.random()),2+Math.random()*2*strength,(Math.random()-.5)*.4),life:1.2+Math.random()});}}
let power=1,pulseCount=0,roll=0,pitch=0,viewSide=false,wonShown=false,shakeSign=1;
const keys=new Set(),held=[false,false],pressures=[0,0];
function strength(side){return Math.min(2.5,pressures[side]>0? .4+pressures[side]*2.1:power*(keys.has('Shift')?(keys.has(' ')?2.5:1.6):1));}
function pump(side){if(sim.pulse(side,strength(side))){pulseCount++;$('#pulses').textContent=String(pulseCount).padStart(3,'0');bubbles(side,strength(side));}}
const motion = new MotionControls({
  isPaused:()=>document.hidden||$('#guide').open,
  onGravity:g=>{
    // Keep the virtual case readable: the player is already rotating the real screen.
    machine.quaternion.identity();
    sim.setOrientation(new THREE.Quaternion().setFromUnitVectors(g,new THREE.Vector3(0,-1,0)));
    const tilt=Math.round(Math.acos(THREE.MathUtils.clamp(-g.y,-1,1))*180/Math.PI);
    const lateral=Math.hypot(g.x,g.y);
    const direction=lateral<.25?(g.z<0?'屏幕背面':'屏幕正面'):
      (Math.abs(g.x)>Math.abs(g.y)?(g.x>0?'右侧':'左侧'):(g.y>0?'顶部':'底部'));
    $('#gravity-readout').textContent=`真实重力 → ${direction} · 偏离竖直 ${tilt}°`;
  },
  onShake:impulse=>sim.shake(impulse),
  onStatus:message=>{
    $('#motion-status').textContent=message;
    $('#motion-toggle').textContent=motion.pending?'正在授权…':motion.enabled?'关闭手机体感':'启用手机体感';
    $('#motion-toggle').disabled=motion.pending;
    $('#motion-toggle').setAttribute('aria-pressed',String(motion.enabled));
    $('#motion-calibrate').disabled=!motion.enabled||!motion.raw;
    if(!motion.enabled&&!motion.pending)applyManualOrientation();
    if(!motion.enabled&&!motion.pending)$('#gravity-readout').textContent='手动模式 · 启用体感可查看实时重力方向';
  }
});
$('#motion-toggle').onclick=()=>{if(motion.enabled)motion.disable();else void motion.enable();};
$('#motion-calibrate').onclick=()=>motion.calibrate();
function applyManualOrientation(){const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch*Math.PI/180,0,roll*Math.PI/180,'XYZ'));machine.quaternion.copy(q);sim.setOrientation(q);$('#roll').value=roll;$('#pitch').value=pitch;$('#roll-value').textContent=`${Math.round(roll)}°`;$('#pitch-value').textContent=`${Math.round(pitch)}°`;}
function orient(){if(motion.enabled||motion.pending)motion.disable('已切换为手动倾斜；可随时重新启用体感。');applyManualOrientation();}
function reset(){sim.reset();held.fill(false);pressures.fill(0);keys.clear();pulseCount=0;wonShown=false;roll=0;pitch=0;orient();$('#message').classList.add('hidden');$('#pulses').textContent='000';for(const p of particles)tank.remove(p.mesh);particles.length=0;}
$('#reset').onclick=reset;$('#again').onclick=reset;$('#upright').onclick=()=>{if(motion.enabled){motion.calibrate();return;}roll=0;pitch=0;orient();};
$('#roll').oninput=e=>{roll=Number(e.target.value);orient();};$('#pitch').oninput=e=>{pitch=Number(e.target.value);orient();};
for(const button of document.querySelectorAll('[data-power]'))button.onclick=()=>{power=Number(button.dataset.power);document.querySelectorAll('[data-power]').forEach(b=>b.classList.toggle('selected',b===button));$('#power-label').textContent=`${button.textContent} · ${Math.round(power*100)}%`;};
function shake(amount){shakeSign*=-1;sim.shake(new THREE.Vector3(shakeSign*.9,1,.3*shakeSign),amount);}
$('#gentle').onclick=()=>shake(1.6);$('#strong').onclick=()=>shake(5);
for(const [side,id] of ['left','right'].entries()){const el=$('#'+id);el.onpointerdown=e=>{e.preventDefault();el.setPointerCapture(e.pointerId);held[side]=true;pressures[side]=e.pointerType==='pen'?e.pressure:0;pump(side);};el.onpointermove=e=>{if(held[side]&&e.pointerType==='pen')pressures[side]=e.pressure;};const release=()=>{held[side]=false;pressures[side]=0;};el.onpointerup=release;el.onpointercancel=release;el.onlostpointercapture=release;}
window.addEventListener('keydown',e=>{if($('#guide').open||document.activeElement.tagName==='INPUT')return;const k=e.key.length===1?e.key.toLowerCase():e.key;keys.add(k);if(['a','d',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(k))e.preventDefault();if(!e.repeat){if(k==='a')pump(0);if(k==='d')pump(1);if(k==='q')shake(1.6);if(k==='e')shake(5);}});
window.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));
window.addEventListener('blur',()=>{keys.clear();held.fill(false);pressures.fill(0);});
document.addEventListener('visibilitychange',()=>{keys.clear();held.fill(false);pressures.fill(0);motion.lastMotion=null;});
const wrap=a=>((a+180)%360+360)%360-180;
let drag=null;const canvasPumps=new Map(),raycaster=new THREE.Raycaster();
canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);document.activeElement.blur();const rect=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hit=raycaster.intersectObjects(buttons)[0];if(hit){const side=buttons.indexOf(hit.object);canvasPumps.set(e.pointerId,side);held[side]=true;pressures[side]=e.pointerType==='pen'?e.pressure:0;pump(side);return;}drag={x:e.clientX,y:e.clientY,time:performance.now()};};
canvas.onpointermove=e=>{if(!drag)return;const now=performance.now(),dx=e.clientX-drag.x,dy=e.clientY-drag.y,seconds=Math.max(.012,(now-drag.time)/1000);if(e.shiftKey){sim.shake(new THREE.Vector3(-dx/seconds/200,dy/seconds/200,0).clampLength(0,5),.55);}else{roll=wrap(roll-dx*.4);pitch=wrap(pitch+dy*.4);orient();if(Math.hypot(dx,dy)/seconds>500)sim.shake(new THREE.Vector3(-dx*.025,dy*.025,0).clampLength(0,1.5),1);}drag={x:e.clientX,y:e.clientY,time:now};};
const releaseCanvas=e=>{if(canvasPumps.has(e.pointerId)){const side=canvasPumps.get(e.pointerId);held[side]=false;pressures[side]=0;canvasPumps.delete(e.pointerId);}drag=null;};canvas.onpointerup=releaseCanvas;canvas.onpointercancel=releaseCanvas;canvas.onlostpointercapture=releaseCanvas;
canvas.addEventListener('wheel',e=>{e.preventDefault();camera.position.multiplyScalar(e.deltaY>0?1.04:.96);camera.position.clampLength(12,24);},{passive:false});
$('#view').onclick=()=>{viewSide=!viewSide;camera.position.set(viewSide?8:0,viewSide?3:1,viewSide?15:16.5);camera.lookAt(0,0,0);$('#view').textContent=viewSide?'正面观察':'侧面观察';resize();};
function resize(){const rect=canvas.getBoundingClientRect();renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.fov=camera.aspect<1?46:34;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(canvas);resize();orient();$('#loading').remove();
let previous=performance.now(),accumulator=0;
function frame(now){requestAnimationFrame(frame);const elapsed=Math.min(.05,(now-previous)/1000);previous=now;if(document.hidden||$('#guide').open){accumulator=0;return;}accumulator+=elapsed;
  while(accumulator>=DT){
    if(keys.has('ArrowLeft'))roll=wrap(roll+50*DT);if(keys.has('ArrowRight'))roll=wrap(roll-50*DT);if(keys.has('ArrowUp'))pitch=wrap(pitch+50*DT);if(keys.has('ArrowDown'))pitch=wrap(pitch-50*DT);if([...keys].some(k=>k.startsWith('Arrow')))orient();
    for(let s=0;s<2;s++)if(held[s]||keys.has(s===0?'a':'d'))pump(s);
    sim.step();accumulator-=DT;
  }
  sim.rings.forEach((r,i)=>{ringMeshes[i].position.copy(r.body.translation());ringMeshes[i].quaternion.copy(r.body.rotation());});
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=elapsed;p.mesh.position.addScaledVector(p.v,elapsed);p.v.multiplyScalar(1-elapsed*.7);if(p.life<=0||p.mesh.position.y>2.05||Math.abs(p.mesh.position.x)>3.05){tank.remove(p.mesh);particles.splice(i,1);}}
  buttons.forEach((b,s)=>{const down=held[s]||keys.has(s===0?'a':'d');b.position.z=down?.84:.91;$('#'+(s===0?'left':'right')).classList.toggle('active',down);});
  $('#score').textContent=sim.count;document.querySelectorAll('.dot').forEach((d,i)=>d.classList.toggle('on',sim.rings[i].scored));
  $('#state').textContent=sim.count===8?'全部套中！':sim.count>0?'很好，继续保持':'慢慢来，别着急';
  const secs=Math.floor(sim.time);$('#time').textContent=`${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`;
  if(sim.won&&!wonShown){wonShown=true;$('#win-detail').textContent=`用时 ${$('#time').textContent} · ${pulseCount} 次水压`;$('#message').classList.remove('hidden');}
  renderer.render(scene,camera);
}requestAnimationFrame(frame);
