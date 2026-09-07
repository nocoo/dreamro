import { Vector2 } from 'three';
import type { World } from './World';

export function clearLine(world: World, start: Vector2, end: Vector2) {
  const n = Math.ceil(start.distanceTo(end) / .4);
  for (let i = 1; i <= n; i++) if (!world.isWalkable(start.x + (end.x - start.x) * i / n, start.y + (end.y - start.y) * i / n)) return false;
  return true;
}

export function findPath(world: World, from: Vector2, requested: Vector2): Vector2[] {
  const to = world.nearestWalkable(requested.x, requested.y);
  if (clearLine(world, from, to)) return [to];
  const size = 51; const step = 1.25; const half = 31.25;
  const point = (id: number) => new Vector2((id % size) * step - half, Math.floor(id / size) * step - half);
  const valid = new Uint8Array(size * size);
  for (let i = 0; i < valid.length; i++) { const p = point(i); valid[i] = Number(world.isWalkable(p.x, p.y)); }
  const nearest = (p: Vector2) => {
    let best = -1; let distance = Infinity;
    for (let i = 0; i < valid.length; i++) {
      if (!valid[i]) continue; const candidate = point(i); const d = p.distanceToSquared(candidate);
      if (d < distance && (d > 10 || clearLine(world, p, candidate))) { best = i; distance = d; }
    }
    return best;
  };
  const start = nearest(from); const goal = nearest(to);
  if (start < 0 || goal < 0) return [];
  const g = new Float32Array(valid.length).fill(Infinity); const f = new Float32Array(valid.length).fill(Infinity);
  const parent = new Int32Array(valid.length).fill(-1); const closed = new Uint8Array(valid.length);
  const open = new Set<number>([start]); g[start] = 0; f[start] = point(start).distanceTo(point(goal));
  let found = false;
  while (open.size) {
    let current = -1; let min = Infinity;
    for (const id of open) if (f[id] < min) { min = f[id]; current = id; }
    if (current < 0) break;
    if (current === goal) { found = true; break; }
    open.delete(current); closed[current] = 1;
    const cx = current % size; const cy = Math.floor(current / size);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const n = y * size + x;
      if (!valid[n] || closed[n]) continue;
      if (dx && dy && (!valid[cy * size + x] || !valid[y * size + cx])) continue;
      const score = g[current] + (dx && dy ? Math.SQRT2 : 1);
      if (score < g[n]) { g[n] = score; parent[n] = current; f[n] = score + point(n).distanceTo(point(goal)) / step; open.add(n); }
    }
  }
  if (!found) return [];
  const path: Vector2[] = [to]; let at = goal;
  while (at !== start && at >= 0) { path.unshift(point(at)); at = parent[at]; }
  path.unshift(point(start));
  const smooth: Vector2[] = []; let cursor = from; let i = 0;
  while (i < path.length) {
    let far = i;
    for (let j = i + 1; j < path.length && clearLine(world, cursor, path[j]); j++) far = j;
    smooth.push(path[far]); cursor = path[far]; i = far + 1;
  }
  return smooth;
}
