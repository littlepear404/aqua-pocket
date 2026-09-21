import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3, Quaternion, Euler } from 'three';

export const DT = 1 / 120;
export const RADIUS = .37, TUBE = .075, PEG_RADIUS = .095;
export const PEGS = [-1.18, 1.18];
export class WaterPhysics {
  static async create() { await RAPIER.init(); return new WaterPhysics(); }
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -2.2, z: 0 });
    this.world.timestep = DT;
    this.world.numSolverIterations = 8;
    this.time = 0; this.lastPulse = [-Infinity, -Infinity]; this.pulses = [];
    this.orientation = new Quaternion(); this.count = 0; this.winTime = 0; this.won = false;
    const wall = (x,y,z,hx,hy,hz) => this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx,hy,hz).setTranslation(x,y,z).setFriction(.3).setRestitution(.12));
    wall(-3.25,0,0,.15,2.45,.92); wall(3.25,0,0,.15,2.45,.92);
    wall(0,-2.3,0,3.3,.15,.92); wall(0,2.3,0,3.3,.15,.92);
    wall(0,0,-.87,3.3,2.45,.12); wall(0,0,.87,3.3,2.45,.12);
    for (const x of PEGS) {
      this.world.createCollider(RAPIER.ColliderDesc.cylinder(.96, PEG_RADIUS).setTranslation(x,-1.19,0).setFriction(.25));
      this.world.createCollider(RAPIER.ColliderDesc.ball(PEG_RADIUS).setTranslation(x,-.23,0));
    }
    this.rings = Array.from({length:8},(_,i)=>{
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true).setCanSleep(false).setLinearDamping(.5).setAngularDamping(1.7));
      // 24 overlapping capsule segments preserve a genuine empty ring centre.
      for(let j=0;j<24;j++) {
        const a=j*Math.PI*2/24, b=(j+1)*Math.PI*2/24;
        const p=new Vector3(Math.cos(a)*RADIUS,Math.sin(a)*RADIUS,0), q=new Vector3(Math.cos(b)*RADIUS,Math.sin(b)*RADIUS,0);
        const midpoint=p.clone().add(q).multiplyScalar(.5);
        const rotation=new Quaternion().setFromUnitVectors(new Vector3(0,1,0),q.clone().sub(p).normalize());
        this.world.createCollider(RAPIER.ColliderDesc.capsule(p.distanceTo(q)/2,TUBE).setTranslation(...midpoint.toArray()).setRotation(rotation).setDensity(1.1).setFriction(.24).setRestitution(.08),body);
      }
      return {body,index:i,scored:false,peg:-1};
    });
    this.reset();
  }
  reset() {
    this.time=0; this.pulses=[]; this.lastPulse=[-Infinity,-Infinity]; this.count=0; this.winTime=0; this.won=false;
    this.rings.forEach(({body},i)=>{
      body.setTranslation({x:-2.45+(i%4)*1.63,y:-.65+Math.floor(i/4)*1.4,z:(i%2 ? .18 : -.18)},true);
      body.setRotation(new Quaternion().setFromEuler(new Euler(.4+(i%3)*.35,.18*i,.3*i)),true);
      body.setLinvel({x:0,y:0,z:0},true); body.setAngvel({x:0,y:0,z:0},true);
    });
  }
  setOrientation(q) {
    this.orientation.copy(q);
    const g=new Vector3(0,-2.2,0).applyQuaternion(q.clone().invert());
    this.world.gravity={x:g.x,y:g.y,z:g.z};
  }
  pulse(side, strength=1) {
    if(this.time-this.lastPulse[side]<.2-1e-8) return false;
    this.lastPulse[side]=this.time;
    this.pulses.push({side,strength:Math.max(.2,Math.min(2.5,strength)),age:0}); return true;
  }
  shake(vector, strength=1) {
    for(const {body} of this.rings) {
      const m=body.mass();
      body.applyImpulse({x:vector.x*m*strength,y:vector.y*m*strength,z:vector.z*m*strength},true);
      body.applyTorqueImpulse({x:vector.y*m*.18*strength,y:vector.z*m*.12*strength,z:vector.x*m*.16*strength},true);
    }
  }
  step() {
    this.time+=DT;
    for(const p of this.pulses) p.age+=DT;
    this.pulses=this.pulses.filter(p=>p.age<.65);
    for(const ring of this.rings) {
      const b=ring.body, p=b.translation(), velocity=new Vector3(), current=new Vector3();
      for(const jet of this.pulses) {
        const sign=jet.side===0?1:-1;
        const source=new Vector3(-sign*2.96,-1.96,0);
        const dir=new Vector3(sign*.47,1,0).normalize();
        const delta=new Vector3(p.x,p.y,p.z).sub(source), along=delta.dot(dir);
        const radial=delta.clone().addScaledVector(dir,-along).length();
        const width=.7+Math.max(0,along)*.30;
        if(along>-.5) {
          const power=jet.strength*17*Math.exp(-jet.age*4)*Math.exp(-radial*radial/(width*width))*Math.exp(-Math.max(0,along)*.22);
          current.addScaledVector(dir,power);
          current.z+=Math.sin(p.x*2+this.time*7)*power*.07;
        }
      }
      velocity.copy(b.linvel());
      const relative=current.sub(velocity), speed=relative.length();
      const m=b.mass();
      // Buoyancy is included in net gravity (2.2); water drag follows relative flow.
      const impulse=relative.multiplyScalar(Math.min(1,(1.1+.16*speed)*DT)*m);
      const normal=new Vector3(0,0,1).applyQuaternion(b.rotation());
      const point=new Vector3(p.x,p.y,p.z).addScaledVector(normal,.10);
      b.applyImpulseAtPoint(impulse,point,true);
    }
    this.world.step();
    this.count=0;
    for(const ring of this.rings) {
      ring.peg=this.detectPeg(ring.body); ring.scored=ring.peg!==-1;
      if(ring.scored) this.count++;
    }
    this.winTime=this.count===8?this.winTime+DT:0;
    if(this.winTime>.75) this.won=true;
  }
  detectPeg(body) {
    const c=body.translation(), n=new Vector3(0,0,1).applyQuaternion(body.rotation());
    if(Math.abs(n.y)<.25) return -1;
    for(let i=0;i<PEGS.length;i++) {
      const x=PEGS[i];
      const y=c.y-(n.x*(x-c.x)-n.z*c.z)/n.y;
      if(y< -2.08 || y>-.26) continue;
      const d=Math.hypot(x-c.x,y-c.y,c.z);
      if(d+PEG_RADIUS/Math.abs(n.y)<RADIUS-TUBE+.015) return i;
    }
    return -1;
  }
  dispose() {this.world.free();}
}
