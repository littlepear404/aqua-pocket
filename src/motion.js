import { Quaternion, Vector3 } from 'three';

const radians = Math.PI / 180;
const down = new Vector3(0, -1, 0);
export function screenVector(v, angle = 0) {
  return v.clone().applyAxisAngle(new Vector3(0, 0, 1), -angle * radians);
}
export function deviceGravity(beta, gamma, angle = 0) {
  const b = beta * radians, g = gamma * radians;
  return screenVector(new Vector3(Math.sin(g) * Math.cos(b), -Math.sin(b), -Math.cos(g) * Math.cos(b)), angle);
}

export class MotionControls {
  constructor({ onGravity, onShake, onStatus, isPaused = () => false, env = window }) {
    Object.assign(this, { onGravity, onShake, onStatus, isPaused, env });
    this.enabled = false; this.pending = false; this.generation = 0;
    this.calibration = new Quaternion(); this.smoothed = down.clone();
    this.orientationListener = e => this.orientation(e);
    this.motionListener = e => this.motion(e);
    this.screenListener = () => { this.raw = null; this.lastMotion = null; this.lastOrientation = null; this.onStatus('屏幕方向已改变，请保持自然握姿，自动重新校准。'); };
  }
  angle() { return this.env.screen?.orientation?.angle ?? this.env.orientation ?? 0; }
  async enable() {
    if (this.pending || this.enabled) return;
    if (!this.env.isSecureContext) { this.onStatus('体感需要 HTTPS；当前仍可使用触控和键盘。'); return; }
    if (!this.env.DeviceOrientationEvent) { this.onStatus('此浏览器不支持姿态感应，请使用触控和键盘。'); return; }
    this.pending = true; const generation = ++this.generation;
    this.onStatus('正在请求体感权限…');
    // Both iOS requests must start inside the original user gesture, before awaiting.
    const request = Type => {
      try { return typeof Type?.requestPermission === 'function' ? Promise.resolve(Type.requestPermission()) : Promise.resolve(Type ? 'granted' : 'unavailable'); }
      catch (error) { return Promise.reject(error); }
    };
    const permissions = await Promise.allSettled([request(this.env.DeviceOrientationEvent), request(this.env.DeviceMotionEvent)]);
    if (generation !== this.generation) return;
    this.pending = false;
    if (permissions[0].status !== 'fulfilled' || permissions[0].value !== 'granted') {
      this.onStatus('未获得姿态权限；可在浏览器设置中允许后重试，或继续触控操作。'); return;
    }
    this.motionAllowed = permissions[1].status === 'fulfilled' && permissions[1].value === 'granted';
    this.enabled = true; this.raw = null; this.lastMotion = null; this.lastOrientation = null; this.motionSeen = false;
    this.env.addEventListener('deviceorientation', this.orientationListener);
    if (this.motionAllowed) this.env.addEventListener('devicemotion', this.motionListener);
    this.env.addEventListener('orientationchange', this.screenListener);
    this.env.screen?.orientation?.addEventListener?.('change', this.screenListener);
    this.onStatus('等待传感器，请自然握住手机…');
    this.timer = this.env.setTimeout(() => {
      if (!this.raw) this.disable('未收到姿态数据，已恢复触控；请检查设备、权限，或用系统浏览器打开。');
    }, 5000);
  }
  disable(message = '体感已关闭，可使用触控和键盘。') {
    this.generation++; this.pending = false; this.enabled = false;
    this.env.clearTimeout(this.timer);
    this.env.removeEventListener('deviceorientation', this.orientationListener);
    this.env.removeEventListener('devicemotion', this.motionListener);
    this.env.removeEventListener('orientationchange', this.screenListener);
    this.env.screen?.orientation?.removeEventListener?.('change', this.screenListener);
    this.onStatus(message);
  }
  calibrate() {
    if (!this.raw) return;
    this.calibration.setFromUnitVectors(this.raw.clone().normalize(), down);
    this.smoothed.copy(down); this.lastMotion = null;
    this.onGravity(down.clone()); this.report();
  }
  report() {
    this.onStatus(this.motionSeen ? '体感已连接：倾斜调整重力，晃动施加惯性。' : '倾斜已连接；晃动尚不可用，可使用轻晃 / 用力晃按钮。');
  }
  orientation(event) {
    if (!this.enabled || this.isPaused()) return;
    if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    const first = !this.raw;
    this.raw = deviceGravity(event.beta, event.gamma, this.angle());
    if (first) { this.env.clearTimeout(this.timer); this.calibrate(); }
    const now = event.timeStamp;
    const dt = this.lastOrientation == null ? 1 / 60 : Math.min(.1, Math.max(0, (now - this.lastOrientation) / 1000));
    this.lastOrientation = now;
    const target = this.raw.clone().applyQuaternion(this.calibration);
    this.smoothed.lerp(target, 1 - Math.exp(-dt * 18));
    if (this.smoothed.lengthSq() < .001) this.smoothed.copy(target);
    this.onGravity(this.smoothed.clone().normalize());
  }
  motion(event) {
    if (!this.enabled || this.isPaused() || !this.raw) { this.lastMotion = null; return; }
    // Use gravity-free acceleration only: tilting alone must never create a shake.
    const a = event.acceleration;
    if (!a || ![a.x, a.y, a.z].every(Number.isFinite)) return;
    if (!this.motionSeen) { this.motionSeen = true; this.report(); }
    const now = event.timeStamp;
    const dt = this.lastMotion == null ? 0 : Math.min(.05, Math.max(0, (now - this.lastMotion) / 1000));
    this.lastMotion = now;
    const vector = screenVector(new Vector3(a.x, a.y, a.z), this.angle()).applyQuaternion(this.calibration);
    if (vector.length() < .8 || !dt) return;
    this.onShake(vector.clampLength(0, 35).multiplyScalar(-dt * .65));
  }
}
