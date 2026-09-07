import * as THREE from 'three';

export function seeded(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let toonGradient: THREE.DataTexture;
export function toon(color: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}) {
  if (!toonGradient) {
    toonGradient = new THREE.DataTexture(new Uint8Array([95, 155, 199, 232, 255]), 5, 1, THREE.RedFormat);
    toonGradient.minFilter = toonGradient.magFilter = THREE.NearestFilter;
    toonGradient.needsUpdate = true;
  }
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient, ...extra });
}

let shadowTex: THREE.CanvasTexture;
export function contactShadow(size: number, opacity = .22): THREE.Mesh {
  shadowTex ??= canvasTexture(128, 128, ctx => {
    const gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 62);
    gradient.addColorStop(0, 'rgba(40,43,28,.9)'); gradient.addColorStop(.5, 'rgba(40,43,28,.42)'); gradient.addColorStop(1, 'rgba(40,43,28,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = .025;
  return mesh;
}

export function magicTexture(color = '#d9b666') {
  return canvasTexture(512, 512, ctx => {
    ctx.translate(256, 256); ctx.strokeStyle = color; ctx.fillStyle = color;
    for (const [r, width] of [[239, 3], [229, 1], [193, 2], [182, 1], [116, 2], [110, 1]]) {
      ctx.lineWidth = width; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      ctx.save(); ctx.rotate(i * Math.PI / 6);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -227); ctx.lineTo(7, -211); ctx.lineTo(0, -196); ctx.lineTo(-7, -211); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-9, -176); ctx.lineTo(0, -168); ctx.lineTo(9, -176); ctx.stroke();
      ctx.fillRect(-1, -167, 2, 9); ctx.restore();
    }
    for (const shift of [0, Math.PI]) {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3 - Math.PI / 2 + shift;
        const x = Math.cos(a) * 170; const y = Math.sin(a) * 170;
        if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, -95); ctx.lineTo(22, -22); ctx.lineTo(95, 0); ctx.lineTo(22, 22); ctx.lineTo(0, 95); ctx.lineTo(-22, 22); ctx.lineTo(-95, 0); ctx.lineTo(-22, -22); ctx.closePath(); ctx.stroke();
  });
}

export function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse(obj => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
      geometries.add(obj.geometry);
      (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => materials.add(m));
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  root.clear();
}

export function makeLabel(text: string, color = '#fff9ec', size = .8): THREE.Sprite {
  const texture = canvasTexture(512, 128, ctx => {
    ctx.font = '600 44px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(40,57,48,.65)'; ctx.strokeText(text, 256, 64);
    ctx.fillStyle = color; ctx.fillText(text, 256, 64);
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
  sprite.scale.set(size * 4, size, 1); return sprite;
}

export function dampAngle(current: number, target: number, factor: number) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * factor;
}
