export type Vec2 = {
  x: number
  y: number
}

export const vec = (x = 0, y = 0): Vec2 => ({ x, y })

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })

export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })

export const scale = (v: Vec2, scalar: number): Vec2 => ({
  x: v.x * scalar,
  y: v.y * scalar,
})

export const lengthSq = (v: Vec2): number => v.x * v.x + v.y * v.y

export const length = (v: Vec2): number => Math.sqrt(lengthSq(v))

export const normalize = (v: Vec2): Vec2 => {
  const magnitude = length(v)
  return magnitude > 0 ? scale(v, 1 / magnitude) : vec()
}

export const fromAngle = (angle: number): Vec2 => ({
  x: Math.cos(angle),
  y: Math.sin(angle),
})
