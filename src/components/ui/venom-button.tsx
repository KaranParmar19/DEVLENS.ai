// @ts-nocheck
/* eslint-disable */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

export interface VenomPhysics {
  reach?: number;
  awareness?: number;
  maxStrands?: number;
  snapStretch?: number;
  maxLen?: number;
  creep?: number;
  slither?: number;
  whip?: number;
  magnet?: number;
  grip?: number;
  thickness?: number;
  pull?: number;
  gravity?: number;
  sheen?: number;
}

export interface VenomButtonProps {
  text?: string;
  font?: {
    fontFamily?: string;
    fontSize?: string | number;
    fontWeight?: string | number;
    fontStyle?: string;
  };
  link?: string;
  newTab?: boolean;
  buttonHeight?: number;
  sidePadding?: number;
  customCursor?: boolean;
  quality?: 'low' | 'balanced' | 'high';
  physics?: VenomPhysics;
  style?: React.CSSProperties;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

const useIsStaticRenderer = () => false;
const NP = 14;
const MAXB = 5;
const MAXR = 6;
const MAXBR = 9;
const SUB = 1 / 240;
const ITER = 3;
const PEAK_H = 15;
const HAND_BIG = 2.3;
const PULL_MAX = 10;
const TILT_MAX = 0.36;
const WRIST_ANG = Math.atan2(15.5, 5.7);
const LABEL_W = 2048;
const LABEL_H = 256;
const LABEL_PX = 120;
const LABEL_NUDGE = 1;
const LIFT_H = 14;
const BEVEL = 3;
const WP = 18;
const FINGERS = [
  { a: [8.45, 4.4], b: [9.6, 10.8], hw: 1.5, turns: 2.4, t0: 0.12, t1: 0.78 },
  {
    a: [12.45, 8.4],
    b: [12.6, 12.8],
    hw: 1.38,
    turns: 1.6,
    t0: 0.12,
    t1: 0.82,
  },
  { a: [13.7, 16.9], b: [13.7, 20.1], hw: 4.1, turns: 1.4, t0: 0.08, t1: 0.92 },
  { a: [16, 8.6], b: [16.1, 12.8], hw: 1.55, turns: 1.6, t0: 0.12, t1: 0.82 },
  { a: [4.6, 11.4], b: [7.4, 14.6], hw: 1.25, turns: 1.7, t0: 0.1, t1: 0.82 },
  { a: [19.3, 9.6], b: [19.6, 12.8], hw: 1.1, turns: 1.4, t0: 0.12, t1: 0.86 },
];
const DEFAULT_PHYSICS = {
  reach: 120,
  awareness: 220,
  maxStrands: 6,
  snapStretch: 1.6,
  maxLen: 160,
  creep: 0.25,
  slither: 1,
  whip: 1,
  magnet: 1.6,
  grip: 1,
  thickness: 1,
  pull: 1,
  gravity: 900,
  sheen: 0,
};
const HAND_D =
  "M6.99667 16.6967C6.66322 16.3018 6.25814 15.494 5.53722 14.5136C5.12861 13.9591 4.11533 12.9149 3.81358 12.3845C3.55174 11.9158 3.57992 11.7056 3.64214 11.3172C3.75252 10.6262 4.50866 10.0881 5.3153 10.1608C5.92469 10.2147 6.44131 10.5921 6.90626 10.9486C7.18688 11.1632 7.53209 11.5802 7.7399 11.8157C7.93129 12.0313 7.97826 12.1205 8.18256 12.3757C8.45261 12.7135 8.53715 12.8808 8.43383 12.5089C8.35046 11.9631 8.21426 11.0311 8.01701 10.207C7.86672 9.58199 7.83031 9.48406 7.68707 9.00431C7.5356 8.49376 7.45812 8.13614 7.31604 7.59479C7.21741 7.21187 7.04012 6.42954 6.99198 5.9894C6.92506 5.38752 6.88982 4.40603 7.30195 3.95489C7.62485 3.60168 8.36573 3.49495 8.82481 3.71282C9.42597 3.9978 9.76765 4.81645 9.92382 5.14325C10.2044 5.73083 10.3782 6.40973 10.5297 7.301C10.7222 8.43544 11.0768 10.01 11.0886 10.3412C11.16 10.824 11.0087 9.08023 11.0839 8.69071C11.152 8.3375 11.469 7.92708 11.8659 7.81595C12.2016 7.72242 12.595 7.68832 12.9414 7.75543C13.3088 7.82586 13.6963 8.07233 13.8408 8.3045C14.2658 8.99111 14.274 10.394 14.2916 10.3192C14.3926 9.90548 14.375 8.9669 14.6251 8.57628C14.7895 8.31881 15.2087 8.08663 15.4318 8.04923C15.7769 7.992 16.2008 7.9744 16.5636 8.04042C16.8559 8.09434 17.2517 8.42003 17.3585 8.57628C17.6144 8.9548 17.76 10.0254 17.8034 10.4006C17.8211 10.5558 17.8903 9.9693 18.1475 9.59079C18.6242 8.88768 20.3114 8.75123 20.376 10.2939C20.4054 11.0135 20.3995 10.9805 20.3995 11.4646C20.3995 12.0335 20.3855 12.3757 20.3526 12.7872C20.3161 13.2274 20.2152 14.222 20.0684 14.7041C20.0023 14.9208 19.8362 15.3146 19.6368 15.6862C19.4365 16.0595 19.1574 16.3814 18.8863 16.7071C18.5057 17.1643 17.9896 17.8381 17.9045 18.2218C17.7659 18.8401 17.8117 18.8446 17.7847 19.2836C17.7658 19.59 17.8429 19.9643 17.8909 20.1614C17.9084 20.2334 17.8602 20.3059 17.7865 20.3134C17.505 20.3417 16.8649 20.3946 16.4779 20.3366C16.0188 20.2673 15.4505 19.4112 15.3037 19.1494C15.1018 18.7884 14.6708 18.8578 14.503 19.124C14.2388 19.5455 13.6705 20.3014 13.269 20.3488C12.514 20.4377 10.9776 20.3869 9.72746 20.3723C9.65243 20.3714 9.59565 20.3027 9.60515 20.2283C9.64502 19.9157 9.69386 19.1741 9.31679 18.8765C8.95867 18.5915 8.34224 18.0138 7.97357 17.7101L6.99667 16.6967Z";
const HAND_SVG = `<svg width='256' height='256' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'><g><g><path d='${HAND_D}' fill-rule='evenodd' clip-rule='evenodd' fill='white'/><path d='${HAND_D}' stroke-width='0.96' stroke='black'/></g><path d='M16.68 17.04V13.32' stroke-width='0.84' stroke-linecap='round' stroke='black'/><path d='M14.52 17.04V13.32' stroke-width='0.84' stroke-linecap='round' stroke='black'/><path d='M11.88 13.32V17.04' stroke-width='0.84' stroke-linecap='round' stroke='black'/></g></svg>`;
const ARROW_SVG = `<svg width='256' height='256' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'><g transform='translate(3.96 -0.12)'><g><g><path d='M2.16 17.76V0.96L14.28 13.1485H7.18952L6.75977 13.2786L2.16 17.76Z' fill-rule='evenodd' clip-rule='evenodd' fill='white'/><path d='M10.7449 16.5635C11.1744 17.6016 10.6882 18.792 9.65484 19.2326C8.61036 19.678 7.40291 19.1896 6.96183 18.1434L2.88 8.46155L6.72302 6.84L10.7449 16.5635Z' fill-rule='evenodd' clip-rule='evenodd' fill='white'/></g><path d='M9.77305 16.6772C10.0078 17.2234 9.74953 17.8559 9.19969 18.0818C8.66208 18.3028 8.04661 18.0515 7.81731 17.5174L4.92 10.7703L6.88612 9.96L9.77305 16.6772Z' fill-rule='evenodd' clip-rule='evenodd' fill='black'/><path d='M3.12 3.48V15.12L6.21809 12.1382L6.6647 11.9936H11.64L3.12 3.48Z' fill-rule='evenodd' clip-rule='evenodd' fill='black'/></g></g></svg>`; // ───────────────────────────── shaders ─────────────────────────────
const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
function sceneFrag(MAXS, MAXC, floatBuf) {
  return `#version 300 es
precision highp float;
precision highp int;
#define MAXS ${MAXS}
#define NP ${NP}
#define MAXB ${MAXB}
#define MAXR ${MAXR}
#define MAXBR ${MAXBR}
#define MAXC ${MAXC}
#define WP ${WP}
${floatBuf ? "" : "#define ENC8 1"}

uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform int uNC;
uniform vec4 uCoil[MAXC * WP];
uniform vec4 uCBox[MAXC];
uniform sampler2D uHandSDF;
uniform sampler2D uArrowSDF;
uniform float uMorph;
uniform vec4 uHand;
uniform vec4 uHand2;
uniform vec3 uCoat;
uniform vec4 uBtn;
uniform vec4 uBtnZ;
uniform vec4 uBtnZ2;
uniform vec4 uPull;
uniform vec4 uPeak;
uniform int uNS;
uniform vec4 uPts[MAXS * NP];
uniform vec4 uBox[MAXS];
uniform vec4 uAnc[MAXS];
uniform vec4 uAncD[MAXS];
uniform int uNBr;
uniform vec4 uBr[MAXBR * 3];
uniform int uNB;
uniform vec4 uBlob[MAXB];
uniform float uBlobZ[MAXB];
uniform vec4 uRip[MAXR];
uniform sampler2D uLabel;
uniform vec4 uLabelBox;
uniform float uEmboss;
uniform float uZTop;
uniform vec3 uK;

out vec4 outG;

uint gMask[MAXS];
uint gCMask[MAXC];
bool gBlob[MAXB];
bool gBr[MAXBR];
bool gHand;
const vec2 HOT = vec2(8.0, 3.0);
const vec2 HOT_A = vec2(6.1, 0.9);

vec2 iconQ(vec2 p, vec2 hot) {
  vec2 d = p - uHand.xy;
  return vec2(uHand2.x * d.x + uHand2.y * d.y, -uHand2.y * d.x + uHand2.x * d.y) / uHand.z + hot;
}
float iconSdf(sampler2D t, vec2 q) {
  vec2 qc = clamp(q, vec2(0.0), vec2(24.0));
  return textureLod(t, qc / 24.0, 0.0).r + length(q - qc);
}
float hand2D(vec2 p) {
  float dh = uMorph > 0.001 ? iconSdf(uHandSDF, iconQ(p, HOT)) : 0.0;
  float da = uMorph < 0.999 ? iconSdf(uArrowSDF, iconQ(p, HOT_A)) : 0.0;
  return mix(da, dh, uMorph) * uHand.z;
}
float sdHand(float h2, float z, float th) {
  return length(vec2(max(h2 + th, 0.0), z - uHand2.z)) - th;
}

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash12(i), b = hash12(i + vec2(1, 0)), c = hash12(i + vec2(0, 1)), d = hash12(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }

vec2 button2D(vec2 p) {
  vec2 q = p - uBtn.xy;
  float d = length(vec2(max(abs(q.x) - (uBtn.z - uBtn.w), 0.0), q.y)) - uBtn.w;
  if (d > 110.0) return vec2(d, 0.0);
  float inner = clamp(-d / uBtn.w, 0.0, 1.0);
  float disp = uBtnZ.z * (1.0 - (1.0 - inner) * (1.0 - inner));
  float body = smoothstep(1.0, -14.0, d);
  float lift = 0.0;
  float t = uTime;
  vec2 nq = q * 0.008;
  vec2 w = vec2(vnoise(nq + vec2(t * 0.07, -t * 0.05)), vnoise(nq * 1.3 + vec2(-t * 0.06, t * 0.04) + 4.7));
  lift += (vnoise(nq * 1.2 + 1.2 * w) - 0.5) * uBtnZ.w;
  vec2 dp = p - uPull.xy;
  lift += uPull.z * exp(-dot(dp, dp) / (2.0 * uPull.w * uPull.w));
  dp = p - uPeak.xy;
  float rr = dot(dp, dp) / (uPeak.w * uPeak.w);
  lift += uPeak.z / ((1.0 + rr) * (1.0 + rr));
  for (int i = 0; i < MAXS; i++) {
    if (i >= uNS) break;
    vec4 an = uAnc[i];
    if (an.z <= 0.0) continue;
    vec4 ad = uAncD[i];
    dp = p - an.xy;
    float al = dot(dp, ad.xy), ac = dp.x * ad.y - dp.y * ad.x;
    float sl = an.w * (1.0 + ad.z), a0 = an.w * ad.z * 0.7;
    lift += an.z * exp(-ac * ac / (2.0 * an.w * an.w) - (al - a0) * (al - a0) / (2.0 * sl * sl));
  }
  for (int i = 0; i < MAXR; i++) {
    vec4 r = uRip[i];
    if (r.w <= 0.0) continue;
    float sg = 12.0 + r.z * 40.0, rd = length(p - r.xy);
    lift += r.w * 0.6 * exp(-rd * rd / (2.0 * sg * sg)) * exp(-r.z * 5.0);
  }
  disp += lift * body;
  if (uEmboss > 0.0) {
    vec2 lu = (p - uLabelBox.xy) / (2.0 * uLabelBox.zw) + 0.5;
    if (lu.x > 0.0 && lu.y > 0.0 && lu.x < 1.0 && lu.y < 1.0) disp += uEmboss * textureLod(uLabel, lu, 2.0).a;
  }
  return vec2(d, disp);
}

float sdButton(vec2 bd, float z) {
  float hh = 0.5 * (uBtnZ.x + uBtnZ.y), zc = 0.5 * (uBtnZ.x - uBtnZ.y) + uBtnZ2.x;
  float re = min(uBtnZ2.y, hh);
  vec2 w = vec2(bd.x + re, abs(z - zc) - hh + re);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - re - bd.y;
}
float sdSeg(vec3 p, vec4 a, vec4 b) {
  vec3 pa = p - a.xyz, ba = b.xyz - a.xyz;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
  return length(pa - ba * h) - mix(a.w, b.w, h);
}
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-5); }

float map(vec3 p, vec2 bd, float h2, out float dB, out float dS, out float dH) {
  dB = sdButton(bd, p.z);
  float ds = 1e5;
  for (int s = 0; s < MAXS; s++) {
    if (s >= uNS) break;
    uint m = gMask[s];
    if (m == 0u) continue;
    float dd = 1e5;
    for (int j = 0; j < NP - 1; j++) {
      if ((m & (1u << uint(j))) == 0u) continue;
      dd = min(dd, sdSeg(p, uPts[s * NP + j], uPts[s * NP + j + 1]));
    }
    ds = smin(ds, dd, uK.x);
  }
  for (int b = 0; b < MAXBR; b++) {
    if (b >= uNBr) break;
    if (!gBr[b]) continue;
    vec4 a = uBr[b * 3], m = uBr[b * 3 + 1], c = uBr[b * 3 + 2];
    ds = smin(ds, min(sdSeg(p, a, m), sdSeg(p, m, c)), uK.x * 0.6);
  }
  for (int b = 0; b < MAXB; b++) {
    if (b >= uNB) break;
    if (!gBlob[b]) continue;
    vec4 bl = uBlob[b];
    ds = smin(ds, sdEll(p - bl.xyz, vec3(bl.w, bl.w, bl.w * uBlobZ[b])), uK.z);
  }
  for (int c = 0; c < MAXC; c++) {
    if (c >= uNC) break;
    uint m = gCMask[c];
    if (m == 0u) continue;
    for (int j = 0; j < WP - 1; j++) {
      if ((m & (1u << uint(j))) == 0u) continue;
      ds = smin(ds, sdSeg(p, uCoil[c * WP + j], uCoil[c * WP + j + 1]), 0.8);
    }
  }
  dH = 1e5;
  if (gHand) {
    dH = sdHand(h2, p.z, uHand2.w);
    if (uCoat.x > -uCoat.y) {
      float n = 0.6 * vnoise(p.xy * 0.075 + vec2(uTime * 0.55, -uTime * 0.35)) + 0.4 * vnoise(p.xy * 0.16 - vec2(uTime * 0.8, uTime * 0.45));
      float coat = clamp((uCoat.x - bd.x) / uCoat.y, 0.0, 1.0) * smoothstep(uCoat.z, uCoat.z + 0.12, n);
      if (coat > 0.0) {
        float sh = 2.8 * coat - 0.9;
        ds = smin(ds, sdHand(h2 - sh, p.z, uHand2.w + sh), 2.5);
      }
    }
  }
  dS = ds;
  float dg = smin(dB, ds, uK.y);
  if (!gHand) return dg;
  return smin(dg, dH, 1.2);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;

  for (int s = 0; s < MAXS; s++) {
    gMask[s] = 0u;
    if (s >= uNS) continue;
    vec4 bb = uBox[s];
    if (p.x < bb.x || p.y < bb.y || p.x > bb.z || p.y > bb.w) continue;
    uint m = 0u;
    for (int j = 0; j < NP - 1; j++) {
      vec4 a = uPts[s * NP + j], b = uPts[s * NP + j + 1];
      vec2 pa = p - a.xy, ba = b.xy - a.xy;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
      if (length(pa - ba * h) - max(a.w, b.w) < uK.y + 2.0) m |= (1u << uint(j));
    }
    gMask[s] = m;
  }
  for (int b = 0; b < MAXB; b++) {
    gBlob[b] = false;
    if (b >= uNB) continue;
    gBlob[b] = length(p - uBlob[b].xy) - uBlob[b].w < uK.y + uK.z + 2.0;
  }
  for (int b = 0; b < MAXBR; b++) {
    gBr[b] = false;
    if (b >= uNBr) continue;
    vec2 lo = min(min(uBr[b * 3].xy, uBr[b * 3 + 1].xy), uBr[b * 3 + 2].xy) - uK.x - 3.0;
    vec2 hi = max(max(uBr[b * 3].xy, uBr[b * 3 + 1].xy), uBr[b * 3 + 2].xy) + uK.x + 3.0;
    gBr[b] = all(greaterThan(p, lo)) && all(lessThan(p, hi));
  }
  for (int c = 0; c < MAXC; c++) {
    gCMask[c] = 0u;
    if (c >= uNC) continue;
    vec4 bb = uCBox[c];
    if (p.x < bb.x || p.y < bb.y || p.x > bb.z || p.y > bb.w) continue;
    uint m = 0u;
    for (int j = 0; j < WP - 1; j++) {
      vec4 a = uCoil[c * WP + j], b = uCoil[c * WP + j + 1];
      vec2 pa = p - a.xy, ba = b.xy - a.xy;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
      if (length(pa - ba * h) - max(a.w, b.w) < uK.y + 2.0) m |= (1u << uint(j));
    }
    gCMask[c] = m;
  }
  vec2 hc = uHand.xy + mat2(uHand2.x, uHand2.y, -uHand2.y, uHand2.x) * (vec2(4.0, 9.0) * uHand.z);
  gHand = uHand.w > 0.5 && length(p - hc) < 17.5 * uHand.z + 4.0;

  vec2 bd = button2D(p);
  float h2 = gHand ? hand2D(p) : 1e5;
  float z = uZTop, minD = 1e5, dB, dS, dH;
  bool hit = false;
  for (int i = 0; i < 64; i++) {
    float d = map(vec3(p, z), bd, h2, dB, dS, dH);
    minD = min(minD, d);
    if (d < 0.02) { hit = true; break; }
    z -= max(d * 0.8, 0.01);
    if (z < 0.0) break;
  }
  if (!hit) {
#ifdef ENC8
    outG = vec4(clamp(minD / 4.0, 0.0, 1.0), 0.0, 0.0, 0.0);
#else
    outG = vec4(minD, 0.0, 0.0, 0.0);
#endif
    return;
  }

  vec3 pos = vec3(p, z);
  const vec2 k = vec2(1.0, -1.0);
  const float e = 0.3;
  float t0, t1, t2;
  vec3 n = k.xyy * map(pos + k.xyy * e, button2D(pos.xy + k.xy * e), gHand ? hand2D(pos.xy + k.xy * e) : 1e5, t0, t1, t2)
         + k.yyx * map(pos + k.yyx * e, button2D(pos.xy + k.yy * e), gHand ? hand2D(pos.xy + k.yy * e) : 1e5, t0, t1, t2)
         + k.yxy * map(pos + k.yxy * e, button2D(pos.xy + k.yx * e), gHand ? hand2D(pos.xy + k.yx * e) : 1e5, t0, t1, t2)
         + k.xxx * map(pos + k.xxx * e, button2D(pos.xy + k.xx * e), gHand ? hand2D(pos.xy + k.xx * e) : 1e5, t0, t1, t2);
  n = normalize(n);
  float mat = dH < min(dB, dS) - 0.05 ? 3.0 : 1.0 + smoothstep(-1.5, 1.5, dB - dS);
#ifdef ENC8
  outG = vec4(n.xy * 0.5 + 0.5, z / 128.0, mat * 0.25);
#else
  outG = vec4(n.xy, z, mat);
#endif
}`;
}
function shadeFrag(floatBuf) {
  return `#version 300 es
precision highp float;
${floatBuf ? "" : "#define ENC8 1"}
uniform sampler2D uG;
uniform sampler2D uLabel;
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform vec4 uLabelBox;
uniform float uLabelAmt;
uniform float uLabelLod;
uniform float uIri;
uniform float uZMax;
uniform float uLift;
uniform vec4 uBtnP;
uniform vec2 uWin;
uniform vec2 uBtnH;
uniform sampler2D uHandCol;
uniform sampler2D uArrowCol;
uniform float uMorph;
uniform vec4 uHand;
uniform vec4 uHand2;
out vec4 outC;

vec3 KEY;

vec4 dec(vec4 g) {
#ifdef ENC8
  if (g.a < 0.1) return vec4(g.r * 4.0, 0.0, 0.0, 0.0);
  return vec4(g.rg * 2.0 - 1.0, g.b * 128.0, g.a * 4.0);
#else
  return g;
#endif
}
float decH(vec4 g) {
#ifdef ENC8
  return g.b * 128.0;
#else
  return g.b;
#endif
}
vec2 uvOf(vec2 p) { return vec2(p.x * uDpr / uRes.x, 1.0 - p.y * uDpr / uRes.y); }
vec4 gAt(ivec2 c) { return dec(texelFetch(uG, clamp(c, ivec2(0), ivec2(uRes) - 1), 0)); }
float hAt(vec2 p, float lod) { return decH(textureLod(uG, uvOf(p), lod)); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

float softShadow(vec2 p, float h0) {
  vec2 L2 = normalize(KEY.xy);
  float tanE = KEY.z / length(KEY.xy);
  float res = 1.0, s = 1.0;
  for (int i = 0; i < 28; i++) {
    float zr = h0 + s * tanE;
    if (zr > uZMax) break;
    float hgt = hAt(p + L2 * s, log2(1.0 + s * 0.08 * uDpr));
    res = min(res, (1.5 - 0.7 * uLift) * (zr - hgt) / s);
    if (res < -0.2) break;
    s += 0.8 + s * 0.14;
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}
float occlusion(vec2 p, float h) {
  vec2 uv = uvOf(p);
  float o = 0.0;
  o += 0.50 * clamp((decH(textureLod(uG, uv, log2(6.0 * uDpr))) - h) / 9.0, 0.0, 1.0);
  o += 0.32 * clamp((decH(textureLod(uG, uv, log2(20.0 * uDpr))) - h) / 26.0, 0.0, 1.0);
  o += 0.26 * clamp((decH(textureLod(uG, uv, log2(60.0 * uDpr))) - h) / 60.0, 0.0, 1.0);
  return clamp(1.0 - o, 0.0, 1.0);
}
bool isNear(vec2 p) {
  float l = log2(96.0 * uDpr);
  float m = max(max(hAt(p + vec2(48.0, 48.0), l), hAt(p + vec2(-48.0, 48.0), l)),
                max(hAt(p + vec2(48.0, -48.0), l), hAt(p + vec2(-48.0, -48.0), l)));
  return max(m, hAt(p, l)) > 0.02;
}

float softbox(vec3 R, vec3 c, vec2 size, float edge) {
  float cd = dot(R, c);
  if (cd <= 0.0) return 0.0;
  vec3 t1 = normalize(cross(c, vec3(0.0, 0.0, 1.0)));
  vec3 t2 = cross(t1, c);
  vec2 q = abs(vec2(dot(R, t1), dot(R, t2)) / cd) / size;
  return (1.0 - smoothstep(edge, 1.0, q.x)) * (1.0 - smoothstep(edge, 1.0, q.y)) * (0.85 + 0.15 * (1.0 - q.y));
}
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec3 room(vec3 R) {
  vec3 c = normalize(vec3(-0.34, -0.42, 0.84));
  float cd = dot(R, c);
  if (cd <= 0.2) return vec3(0.0);
  vec3 t1 = normalize(cross(c, vec3(0.0, 0.0, 1.0)));
  vec3 t2 = cross(t1, c);
  vec2 w = vec2(dot(R, t1), dot(R, t2)) / cd / vec2(0.34, 0.28);
  float wallMask = 1.0 - smoothstep(1.3, 2.3, length(w * vec2(0.8, 1.0)));
  vec3 col = vec3(0.92, 0.78, 0.6) * 0.3 * wallMask;
  float shelf = smoothstep(-2.3, -2.2, w.y) * (1.0 - smoothstep(-1.35, -1.25, w.y));
  col = mix(col, vec3(0.3, 0.18, 0.1) * 0.5, shelf * wallMask);
  vec2 lp = w - vec2(1.75, -0.55);
  col += vec3(1.0, 0.7, 0.4) * 5.0 * exp(-dot(lp, lp) / 0.05);
  vec2 aw = abs(w);
  float glass = (1.0 - smoothstep(0.94, 1.0, aw.x)) * (1.0 - smoothstep(0.94, 1.0, aw.y));
  if (glass > 0.0) {
    float v = w.y * 0.5 + 0.5;
    vec3 sky = mix(vec3(1.0, 0.92, 0.8), vec3(0.6, 0.76, 1.0), smoothstep(0.2, 1.0, v)) * 16.0;
    float line = 0.3 + 0.16 * vn(vec2(w.x * 4.0, 3.1)) + 0.07 * vn(vec2(w.x * 11.0, 7.3));
    float tree = 1.0 - smoothstep(line - 0.03, line + 0.03, v);
    vec3 green = mix(vec3(0.16, 0.3, 0.12), vec3(0.32, 0.45, 0.2), vn(w * 9.0)) * 3.0;
    vec3 view = mix(sky, green, tree);
    float mull = max(1.0 - smoothstep(0.025, 0.05, aw.x), 1.0 - smoothstep(0.025, 0.05, abs(w.y - 0.1)));
    view = mix(view, vec3(0.85, 0.8, 0.72) * 0.6, mull);
    col = mix(col, view, glass);
  }
  return col;
}

vec3 env(vec3 R) {
  vec2 rd = normalize(R.xy + vec2(1e-5));
  float keySide = 0.5 + 0.5 * dot(rd, normalize(KEY.xy));
  if (R.z < 0.0) return mix(vec3(0.14) * keySide, vec3(0.0015), smoothstep(0.0, -0.22, R.z));
  vec3 c = vec3(0.0015);
  c += room(R);
  c += vec3(1.0) * 7.0 * softbox(R, normalize(vec3(-0.96, 0.08, 0.2)), vec2(0.75, 0.035), 0.7);
  c += vec3(1.0) * 5.0 * softbox(R, normalize(vec3(0.95, -0.12, 0.24)), vec2(0.75, 0.035), 0.7);
  c += vec3(1.0) * 5.0 * softbox(R, normalize(vec3(0.45, 0.55, 0.75)), vec2(0.07, 0.07), 0.5);
  c += vec3(0.1) * softbox(R, normalize(vec3(0.12, 0.25, 1.0)), vec2(0.8, 0.55), 0.2);
  float wall = 1.0 - smoothstep(0.0, 0.1, R.z);
  c += vec3(0.28) * wall * wall * keySide * keySide * keySide;
  return c;
}

vec3 shadeLabel(vec2 lu, float sh, float ao) {
  vec2 tx = vec2(2.5 / ${LABEL_W}.0, 2.5 / ${LABEL_H}.0);
  float mx = textureLod(uLabel, lu + vec2(tx.x, 0.0), uLabelLod).a - textureLod(uLabel, lu - vec2(tx.x, 0.0), uLabelLod).a;
  float my = textureLod(uLabel, lu + vec2(0.0, tx.y), uLabelLod).a - textureLod(uLabel, lu - vec2(0.0, tx.y), uLabelLod).a;
  vec3 N = normalize(vec3(-mx * 1.1, -my * 1.1, 1.0));
  vec3 R = reflect(vec3(0.0, 0.0, -1.0), N);
  vec3 silver = vec3(0.9, 0.91, 0.94);
  float t = clamp((lu.y - 0.32) / 0.36, 0.0, 1.0);
  float grad = t < 0.48 ? mix(1.12, 0.74, smoothstep(0.0, 0.48, t))
                        : mix(0.6, 0.95, smoothstep(0.5, 1.0, t));
  vec3 col = silver * grad * (0.82 + 0.18 * sh);
  col += env(R) * silver * 0.3;
  float edge = clamp(length(vec2(mx, my)) * 1.6, 0.0, 1.0);
  float facing = dot(normalize(vec2(mx, my) + 1e-5), normalize(KEY.xy));
  col *= 1.0 - 0.25 * edge * smoothstep(0.0, 0.8, -facing);
  col += vec3(1.0) * 0.55 * edge * smoothstep(0.1, 0.9, facing);
  vec3 Hh = normalize(KEY + vec3(0.0, 0.0, 1.0));
  float NdH = max(dot(N, Hh), 0.0), a2 = 0.01;
  col += vec3(1.0) * a2 / (3.14159 * pow(NdH * NdH * (a2 - 1.0) + 1.0, 2.0)) * 0.05 * sh;
  return col * mix(0.85, 1.0, ao);
}

vec3 faceWindow(vec2 b) {
  vec2 w = vec2((b.x - uWin.x + b.y * 0.08) / uWin.y, (b.y + 0.3) / 1.15);
  float fade = 1.0 - smoothstep(0.2, 1.05, length(w * vec2(0.85, 0.8)));
  if (fade <= 0.0) return vec3(0.0);
  float v = 0.5 - 0.5 * w.y;
  vec3 sky = mix(vec3(0.95, 0.88, 0.8), vec3(0.66, 0.78, 0.96), smoothstep(0.2, 1.0, v));
  float line = 0.36 + 0.1 * vn(vec2(w.x * 1.6, 2.0));
  float tree = 1.0 - smoothstep(line - 0.2, line + 0.2, v);
  vec3 view = mix(sky, vec3(0.24, 0.36, 0.18) * 0.65, tree * 0.85);
  float sash = 1.0 - smoothstep(0.04, 0.26, abs(w.y + 0.1));
  float stile = 1.0 - smoothstep(0.05, 0.3, abs(w.x));
  view *= 1.0 - 0.5 * max(sash, stile * 0.6);
  return view * 0.14 * fade;
}

vec3 shadeGoo(vec2 p, vec4 g) {
  vec3 N = vec3(g.xy, sqrt(max(1e-4, 1.0 - dot(g.xy, g.xy))));
  float strandness = clamp(g.w - 1.0, 0.0, 1.0);
  vec3 V = vec3(0.0, 0.0, 1.0);
  float NdV = clamp(N.z, 0.03, 1.0);
  vec3 R = reflect(-V, N);
  float F = 0.04 + 0.96 * pow(1.0 - NdV, 5.0);
  float sh = softShadow(p, g.z + 0.6);
  float ao = occlusion(p, g.z);

  vec3 dN = vec3(N.xy, 0.0) * 0.07 + vec3(0.012, 0.008, 0.0);
  vec3 spec = vec3(env(normalize(R + dN)).r, env(R).g, env(normalize(R - dN)).b) * F * mix(0.5, 1.0, min(sh, ao));
  float fr = pow(1.0 - NdV, 2.0);
  vec3 film = mix(vec3(0.8, 0.88, 1.12), vec3(0.9, 0.86, 1.1), 0.5 + 0.5 * sin((1.0 - NdV) * 9.0));
  spec *= mix(vec3(1.0), film, uIri * fr);
  vec3 Hh = normalize(KEY + V);
  float NdH = max(dot(N, Hh), 0.0), a2 = 0.0025;
  float D = a2 / (3.14159 * pow(NdH * NdH * (a2 - 1.0) + 1.0, 2.0));
  spec += vec3(0.9, 0.95, 1.0) * D * F * 0.55 * sh;

  float matte = (1.0 - strandness) * 0.92;
  float ar2 = 0.16;
  float Dr = ar2 / (3.14159 * pow(NdH * NdH * (ar2 - 1.0) + 1.0, 2.0));
  vec3 cRoom = normalize(vec3(-0.34, -0.42, 0.84));
  vec3 rough = vec3(1.0) * Dr * F * 0.06 * sh
             + vec3(0.95, 0.9, 0.84) * pow(max(dot(R, cRoom), 0.0), 10.0) * F * 0.9;
  spec = mix(spec, rough, matte);

  vec3 diff = vec3(0.0007) * (1.8 * max(dot(N, KEY), 0.0) * sh + 0.9 * ao);
  vec3 col = diff + spec;

  vec2 bq = (p - uBtnP.xy) / uBtnP.zw + N.xy * 1.6;
  vec2 dsp = normalize(bq - vec2(uWin.x, -0.3) + 1e-4) * 0.02;
  vec3 win = vec3(faceWindow(bq + dsp).r, faceWindow(bq).g, faceWindow(bq - dsp).b);
  col += win * matte * mix(0.6, 1.0, ao);

  float bevel = 1.0 - smoothstep(0.3, 0.86, N.z);
  vec2 nd = normalize(N.xy + 1e-5);
  float rimL = pow(max(dot(nd, vec2(-0.6, -0.8)), 0.0), 2.0);
  float rimR = pow(max(dot(nd, vec2(0.8, 0.6)), 0.0), 3.0) * 0.55;
  vec2 cq = (p - uBtnP.xy) / uBtnP.zw;
  float glint = pow(0.5 + 0.5 * cos(atan(cq.y, cq.x) - uTime * 0.9), 28.0);
  vec3 rimC = vec3(0.82, 0.9, 1.0) * rimL + vec3(1.0, 0.94, 0.86) * rimR + vec3(1.0) * glint * 1.4;
  col += rimC * bevel * 0.5 * (1.0 - strandness) * mix(0.7, 1.0, sh);

  if (uLabelAmt > 0.0) {
    vec2 lu = (p - uLabelBox.xy) / (2.0 * uLabelBox.zw) + 0.5;
    if (lu.x > 0.0 && lu.y > 0.0 && lu.x < 1.0 && lu.y < 1.0) {
      float m = textureLod(uLabel, lu, uLabelLod).a * (1.0 - smoothstep(0.15, 0.5, strandness)) * uLabelAmt;
      if (m > 0.002) col = mix(col, shadeLabel(lu, sh, ao), m);
    }
  }
  return col;
}

vec3 shadeHand(vec2 p, vec4 g) {
  vec3 N = vec3(g.xy, sqrt(max(1e-4, 1.0 - dot(g.xy, g.xy))));
  vec2 d = p - uHand.xy;
  vec2 r = vec2(uHand2.x * d.x + uHand2.y * d.y, -uHand2.y * d.x + uHand2.x * d.y) / uHand.z;
  vec4 tc = mix(textureLod(uArrowCol, clamp((r + vec2(6.1, 0.9)) / 24.0, 0.0, 1.0), 0.0),
                textureLod(uHandCol, clamp((r + vec2(8.0, 3.0)) / 24.0, 0.0, 1.0), 0.0), uMorph);
  vec3 alb = pow(mix(vec3(0.0), tc.rgb, smoothstep(0.2, 0.8, tc.a)), vec3(2.2)) * 0.86 + 0.012;
  float sh = softShadow(p, g.z + 0.6);
  float ao = occlusion(p, g.z);
  vec3 R = reflect(vec3(0.0, 0.0, -1.0), N);
  float F = 0.04 + 0.96 * pow(1.0 - clamp(N.z, 0.03, 1.0), 5.0);
  vec3 Hh = normalize(KEY + vec3(0.0, 0.0, 1.0));
  float NdH = max(dot(N, Hh), 0.0), a2 = 0.004;
  float D = a2 / (3.14159 * pow(NdH * NdH * (a2 - 1.0) + 1.0, 2.0));
  return alb * (1.2 * max(dot(N, KEY), 0.0) * sh + 0.9 * ao) + env(R) * F * 1.15 * mix(0.6, 1.0, sh) + vec3(0.95) * D * F * 0.5 * sh;
}
vec3 shadeAny(vec2 p, vec4 g) { return g.w > 2.5 ? shadeHand(p, g) : shadeGoo(p, g); }

float sdPill(vec2 q, vec2 b) { return length(vec2(max(abs(q.x) - (b.x - b.y), 0.0), q.y)) - b.y; }
float buttonShadow(vec2 p) {
  vec2 q = p - uBtnP.xy;
  float d0 = max(sdPill(q, uBtnP.zw), 0.0);
  float lift = uBtnH.y, h = uBtnH.x + lift;
  vec2 off = -normalize(KEY.xy) * (h * 0.25 + lift * 0.30);
  float d1 = max(sdPill(q - off, uBtnP.zw - vec2(1.0)), 0.0);
  float grounded = 1.0 - smoothstep(0.0, 12.0, lift);
  float contact = exp(-d0 / (2.2 + lift * 0.4)) * 0.42 * grounded;
  float occl = exp(-d0 / 6.0) * 0.18 * mix(0.45, 1.0, grounded);
  float dropSh = exp(-d1 / (5.0 + h * 0.15 + lift * 0.35)) * (0.20 - 0.05 * (1.0 - grounded));
  float ambient = exp(-d0 / 26.0) * 0.07;
  float lit = (1.0 - contact) * (1.0 - occl) * (1.0 - dropSh) * (1.0 - ambient);
  return clamp(1.0 - lit, 0.0, 0.88);
}

// transparent floor: fully transparent outside the button so it merges seamlessly into any background
float floorShadowAlpha(vec2 p) {
  return 0.0;
}

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 tone(vec3 c) { return pow(aces(c * 0.95), vec3(1.0 / 2.2)); }

void main() {
  KEY = normalize(vec3(-0.45, -0.56, 0.74));
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec4 g = gAt(c);
  vec3 rgb = vec3(0.0);
  float a;
  if (g.w < 0.5) {
    float sa = floorShadowAlpha(p);
    float cov = clamp(0.5 - g.x * uDpr, 0.0, 1.0);
    a = sa;
    if (cov > 0.0) {
      vec4 n0 = gAt(c + ivec2(1, 0)), n1 = gAt(c - ivec2(1, 0)), n2 = gAt(c + ivec2(0, 1)), n3 = gAt(c - ivec2(0, 1));
      vec4 gn = n0.w > 0.5 ? n0 : n1.w > 0.5 ? n1 : n2.w > 0.5 ? n2 : n3.w > 0.5 ? n3 : vec4(0.0);
      vec3 gc = gn.w > 0.5 ? shadeAny(p, gn) : vec3(0.012);
      rgb = tone(gc) * cov;
      a = cov + (1.0 - cov) * sa;
    }
  } else {
    rgb = tone(shadeAny(p, g));
    a = 1.0;
  }
  rgb += a * (hash12(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
  outC = vec4(max(rgb, 0.0), a);
}`;
}
const FRAG_FXAA = `#version 300 es
precision highp float;
uniform sampler2D uC;
uniform vec2 uRes;
out vec4 outC;
float luma(vec4 c) { return dot(c.rgb, vec3(0.299, 0.587, 0.114)) + c.a * 0.5; }
void main() {
  vec2 px = 1.0 / uRes, uv = gl_FragCoord.xy * px;
  vec4 cM = texture(uC, uv);
  vec4 tNW = texture(uC, uv + vec2(-1.0, -1.0) * px), tNE = texture(uC, uv + vec2(1.0, -1.0) * px);
  vec4 tSW = texture(uC, uv + vec2(-1.0, 1.0) * px), tSE = texture(uC, uv + vec2(1.0, 1.0) * px);
  float lNW = luma(tNW), lNE = luma(tNE), lSW = luma(tSW), lSE = luma(tSE), lM = luma(cM);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  if (lMax - lMin < max(0.03, lMax * 0.08)) { outC = cM; return; }
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  float reduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
  dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), -8.0, 8.0) * px;
  vec4 A = 0.5 * (texture(uC, uv - dir / 6.0) + texture(uC, uv + dir / 6.0));
  vec4 B = A * 0.5 + 0.25 * (texture(uC, uv - dir * 0.5) + texture(uC, uv + dir * 0.5));
  float lB = luma(B);
  outC = (lB < lMin || lB > lMax) ? A : B;
}`; // ───────────────────────────── helpers ─────────────────────────────
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const ease = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const rand = (a, b) => a + Math.random() * (b - a);
function spring(o, k, kv, target, w, z, dt) {
  o[kv] += (w * w * (target - o[k]) - 2 * z * w * o[kv]) * dt;
  o[k] += o[kv] * dt;
}
const PIXEL_BUDGET = { low: 1e6, balanced: 22e5, high: 45e5 };
const num = (v, d) =>
  v !== undefined && v !== null && v !== "" && Number.isFinite(Number(v))
    ? Number(v)
    : d;
function mergePhysics(p) {
  const out = { ...DEFAULT_PHYSICS };
  if (p) for (const k of Object.keys(out)) out[k] = num(p[k], out[k]);
  out.maxStrands = Math.round(clamp(out.maxStrands, 0, 7));
  out.thickness = clamp(out.thickness, 0.3, 2.5);
  out.reach = Math.max(out.reach, 10);
  out.awareness = Math.max(out.awareness, 30);
  out.maxLen = Math.max(out.maxLen, 60);
  out.snapStretch = Math.max(out.snapStretch, 1.05);
  out.gravity = Math.max(out.gravity, 0);
  out.creep = Math.max(out.creep, 0);
  out.sheen = clamp(out.sheen, 0, 1);
  return out;
}
function parseFontSize(v, d = 19) {
  if (typeof v === "number") return Number.isFinite(v) ? v : d;
  const m = /^\s*([\d.]+)\s*(px|em|rem)?\s*$/.exec(String(v ?? ""));
  if (!m) return d;
  const n = parseFloat(m[1]);
  return m[2] === "em" || m[2] === "rem" ? n * 16 : n;
} // ───────────────────────────── engine ─────────────────────────────
function createVenom(wrap, canvas, hitEl, initial, hooks) {
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    alpha: true,
    premultipliedAlpha: true,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  });
  if (!gl) return null;
  let opts = initial;
  const P = mergePhysics(initial.physics);
  const reduced =
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FLOATBUF = !!(
    gl.getExtension("EXT_color_buffer_float") ||
    gl.getExtension("EXT_color_buffer_half_float")
  );
  let MAXS = 18,
    MAXC = 24;
  if (gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) < 900) {
    MAXS = 6;
    MAXC = 3;
  }
  let CURZ = 25;
  const strands = [];
  const ripples = [];
  const hand = {
    m: 0,
    mV: 0,
    s: HAND_BIG,
    v: 0,
    ang: 0,
    angV: 0,
    on: false,
    ready: false,
    coat: -60,
    coatV: 0,
    thr: 0.8,
    ox: 0,
    oy: 0,
    oxV: 0,
    oyV: 0,
  };
  const cur = {
    x: -1e4,
    y: -1e4,
    vx: 0,
    vy: 0,
    lx: -1e4,
    ly: -1e4,
    present: false,
    down: false,
    mouse: false,
    t: 0,
  };
  const btn = {
    cx: 0,
    cy: 0,
    hw: 150,
    hh: 30,
    lbw: 72,
    lbh: 18,
    top: 14,
    sink: 5,
    dome: 1.2,
    lift: 0,
    liftV: 0,
    press: 0,
    pressV: 0,
    pressTarget: 0,
    intro: reduced ? 1 : 0,
    introV: 0,
  };
  const pull = { x: 0, y: 0, amt: 0, v: 0 };
  const peak = { x: 0, y: 0, amt: 0, v: 0 };
  let time = reduced ? 3 : 0,
    lastSnap = -1,
    lastSpawn = -1,
    lastMicro = -1,
    nextProbe = 2.6,
    awareNow = 0;
  let labelAmt = 0,
    labelTarget = 0,
    labelInkW = 0,
    labelCss = 19;
  let W = 1,
    H = 1,
    DPR = 1,
    quality = 1;
  let destroyed = false,
    visible = true,
    overGoo = false,
    lastCursor = "",
    rect = null,
    labelFontOk = true;
  let lastProbeT = Math.random();
  const viewW = () => Math.max(1, wrap.clientWidth);
  const viewH = () => Math.max(1, wrap.clientHeight);
  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src.trim());
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(
        "Venom shader compile failed: " + gl.getShaderInfoLog(sh),
      );
    }
    return sh;
  }
  function program(fs, names) {
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(prog) || "link failed");
    const u = {};
    for (const n of names) u[n] = gl.getUniformLocation(prog, n);
    return { prog, u };
  }
  let p1, p2, p3;
  try {
    p1 = program(sceneFrag(MAXS, MAXC, FLOATBUF), [
      "uArrowSDF",
      "uMorph",
      "uCoat",
      "uNC",
      "uCoil",
      "uCBox",
      "uHandSDF",
      "uHand",
      "uHand2",
      "uRes",
      "uDpr",
      "uTime",
      "uBtn",
      "uBtnZ",
      "uBtnZ2",
      "uPull",
      "uPeak",
      "uNS",
      "uPts",
      "uBox",
      "uAnc",
      "uAncD",
      "uNBr",
      "uBr",
      "uNB",
      "uBlob",
      "uBlobZ",
      "uRip",
      "uLabel",
      "uLabelBox",
      "uEmboss",
      "uZTop",
      "uK",
    ]);
    p2 = program(shadeFrag(FLOATBUF), [
      "uG",
      "uLabel",
      "uRes",
      "uDpr",
      "uTime",
      "uLabelBox",
      "uLabelAmt",
      "uLabelLod",
      "uIri",
      "uZMax",
      "uLift",
      "uBtnP",
      "uWin",
      "uBtnH",
      "uHandCol",
      "uArrowCol",
      "uMorph",
      "uHand",
      "uHand2",
    ]);
    p3 = program(FRAG_FXAA, ["uC", "uRes"]);
  } catch (err) {
    console.warn(err);
    try {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    } catch (e) {}
    return null;
  }
  const handColTex = gl.createTexture(),
    handSdfTex = gl.createTexture();
  const arrowColTex = gl.createTexture(),
    arrowSdfTex = gl.createTexture();
  let iconsLoaded = 0;
  function buildIcon(svg, colTex, sdfTex) {
    const img = new Image();
    img.onload = () => {
      if (destroyed) return;
      gl.activeTexture(gl.TEXTURE7);
      const C = 256,
        cv = document.createElement("canvas");
      cv.width = cv.height = C;
      cv.getContext("2d").drawImage(img, 0, 0, C, C);
      gl.bindTexture(gl.TEXTURE_2D, colTex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const N = 96,
        sc = document.createElement("canvas");
      sc.width = sc.height = N;
      const sx = sc.getContext("2d");
      sx.drawImage(img, 0, 0, N, N);
      const a = sx.getImageData(0, 0, N, N).data;
      const inside = new Uint8Array(N * N);
      for (let i = 0; i < N * N; i++) inside[i] = a[i * 4 + 3] > 127 ? 1 : 0;
      const edge = [];
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const v = inside[y * N + x];
          if (
            (x > 0 && inside[y * N + x - 1] !== v) ||
            (x < N - 1 && inside[y * N + x + 1] !== v) ||
            (y > 0 && inside[(y - 1) * N + x] !== v) ||
            (y < N - 1 && inside[(y + 1) * N + x] !== v)
          )
            edge.push(x, y);
        }
      const sdf = new Float32Array(N * N),
        unit = 24 / N;
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          let best = 1e9;
          for (let k = 0; k < edge.length; k += 2) {
            const dx = edge[k] - x,
              dy = edge[k + 1] - y,
              d = dx * dx + dy * dy;
            if (d < best) best = d;
          }
          const d = (Math.sqrt(best) + 0.5) * unit;
          sdf[y * N + x] = inside[y * N + x] ? -d : d;
        }
      gl.bindTexture(gl.TEXTURE_2D, sdfTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, N, N, 0, gl.RED, gl.FLOAT, sdf);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (++iconsLoaded === 2) hand.ready = true;
    };
    img.src = "data:image/svg+xml," + encodeURIComponent(svg);
  }
  buildIcon(HAND_SVG, handColTex, handSdfTex);
  buildIcon(ARROW_SVG, arrowColTex, arrowSdfTex);
  const vao = gl.createVertexArray();
  let gTex = null,
    cTex = null;
  const fbo = gl.createFramebuffer(),
    cFbo = gl.createFramebuffer();
  function makeGBuffer() {
    gl.activeTexture(gl.TEXTURE7);
    if (gTex) gl.deleteTexture(gTex);
    gTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, gTex);
    const levels = Math.floor(Math.log2(Math.max(W, H))) + 1;
    gl.texStorage2D(
      gl.TEXTURE_2D,
      levels,
      FLOATBUF ? gl.RGBA16F : gl.RGBA8,
      W,
      H,
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      gTex,
      0,
    );
    if (cTex) gl.deleteTexture(cTex);
    cTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, cTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, W, H);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, cFbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      cTex,
      0,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = LABEL_W;
  labelCanvas.height = LABEL_H;
  const lctx = labelCanvas.getContext("2d");
  const labelTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, labelTex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array(4),
  );
  function uploadLabel() {
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, labelTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      labelCanvas,
    );
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  let labelToken = 0;
  async function setLabelText(text, fontCss, size, token) {
    const fontStr = fontCss.replace("{px}", LABEL_PX + "px");
    try {
      if (document.fonts?.load) {
        await document.fonts.load(fontStr, text);
      }
    } catch (e) {}
    if (destroyed || token !== labelToken) return;
    lctx.clearRect(0, 0, LABEL_W, LABEL_H);
    lctx.font = fontStr;
    if (!lctx.font || lctx.font.includes("10px")) {
      lctx.font = `normal 700 ${LABEL_PX}px Geist, Inter, system-ui, -apple-system, sans-serif`;
    }
    lctx.fillStyle = "white";
    lctx.textAlign = "center";
    lctx.textBaseline = "alphabetic";
    let m = lctx.measureText(text);
    const maxW = LABEL_W * 0.94;
    if (m.width > maxW) {
      lctx.font = fontCss.replace("{px}", (LABEL_PX * maxW) / m.width + "px");
      m = lctx.measureText(text);
    }
    const ascent = Number.isFinite(m.actualBoundingBoxAscent) ? m.actualBoundingBoxAscent : (LABEL_PX * 0.72);
    const descent = Number.isFinite(m.actualBoundingBoxDescent) ? m.actualBoundingBoxDescent : (LABEL_PX * 0.18);
    lctx.fillText(
      text,
      LABEL_W / 2,
      LABEL_H / 2 + (ascent - descent) / 2,
    );
    const leftBox = Number.isFinite(m.actualBoundingBoxLeft) ? m.actualBoundingBoxLeft : (m.width / 2);
    const rightBox = Number.isFinite(m.actualBoundingBoxRight) ? m.actualBoundingBoxRight : (m.width / 2);
    labelInkW = (leftBox + rightBox) || m.width || (text.length * LABEL_PX * 0.55);
    labelCss = size;
    try {
      labelFontOk =
        document.fonts?.check(fontStr, text) ??
        true;
    } catch (e) {
      labelFontOk = true;
    }
    uploadLabel();
    labelTarget = 1;
    layoutButton();
  }
  let labelKey = "";
  function applyLabel() {
    const key = JSON.stringify([opts.text, opts.fontCss, opts.labelSize]);
    if (key === labelKey) return;
    labelKey = key;
    const token = ++labelToken;
    const { text, fontCss, labelSize } = opts;
    setLabelText(text, fontCss, labelSize, token);
  }
  function geo() {
    const e = btn.intro,
      pr = btn.press;
    return {
      cx: btn.cx,
      cy: btn.cy,
      hw: btn.hh * 0.5 + (btn.hw - btn.hh * 0.5) * e + 2.5 * pr,
      hh: btn.hh * (0.55 + 0.45 * e) + 1 * pr,
      top: Math.max(1, btn.top * e * (1 - 0.3 * pr)),
    };
  }
  function pillEdge(x, y, g, inset = 0) {
    const a = g.hw - g.hh;
    const ax = clamp(x - g.cx, -a, a);
    let dx = x - g.cx - ax,
      dy = y - g.cy;
    let L = Math.hypot(dx, dy);
    if (L < 0.001) {
      dx = 0;
      dy = -1;
      L = 0.001;
    } else {
      dx /= L;
      dy /= L;
    }
    const R = Math.max(1, g.hh - inset);
    return {
      x: g.cx + ax + dx * R,
      y: g.cy + dy * R,
      nx: dx,
      ny: dy,
      d: L - g.hh,
    };
  }
  function anchorFor(px, py, lat, g) {
    const e = pillEdge(px, py, g);
    return pillEdge(
      e.x - e.ny * lat - e.nx * 4,
      e.y + e.nx * lat - e.ny * 4,
      g,
      10,
    );
  }
  function addRipple(x, y, amp) {
    if (reduced) return;
    ripples.push({ x, y, age: 0, amp });
    if (ripples.length > MAXR) ripples.shift();
  }
  function newStrand(kind, g, ax, ay) {
    const s = {
      kind,
      state: "grow",
      pin: "anchor",
      lx: (ax - g.cx) / g.hw,
      ly: (ay - g.cy) / g.hh,
      pos: new Float32Array(NP * 3),
      prev: new Float32Array(NP * 3),
      rad: new Float32Array(NP).fill(2),
      u: 0,
      ud: 0,
      uKick: true,
      rest: 1,
      vol: 0,
      stretch: 1,
      pinch: 0,
      len: 0,
      neckS: rand(0.42, 0.62),
      side: Math.random() < 0.5 ? -1 : 1,
      wig: rand(0.5, 1.2),
      phase: rand(0, 100),
      snapMul: rand(0.85, 1.15),
      lenMul: rand(0.88, 1.12),
      wrap: null,
      lat: 0,
      life: 0,
      ttl: 0,
      probe: null,
      mound: 0,
      dead: false,
      retract: 0,
    };
    const z = Math.max(2, g.top - 4) + btn.lift * LIFT_H;
    const e = pillEdge(ax, ay, g);
    for (let i = 0; i < NP; i++) {
      const o = i * 3;
      s.pos[o] = s.prev[o] = ax + e.nx * i * 0.4;
      s.pos[o + 1] = s.prev[o + 1] = ay + e.ny * i * 0.4;
      s.pos[o + 2] = s.prev[o + 2] = z;
    }
    return s;
  }
  function spawnReach(g) {
    if (strands.length >= MAXS - 1) return;
    const k = strands.filter(
      (s) => s.kind === "reach" && s.pin === "anchor" && s.state !== "recoil",
    ).length;
    const lat = [0, 30, -30, 58, -58, 82, -82][k % 7] + rand(-6, 6);
    const a = anchorFor(cur.x, cur.y, lat, g);
    const s = newStrand("reach", g, a.x, a.y);
    s.lat = lat;
    s.vol = Math.PI * 1.25 * 1.25 * 170;
    const taken = new Set(strands.filter((o) => o.wrap).map((o) => o.wrap.f));
    let f = 0;
    while (taken.has(f) && f < FINGERS.length - 1) f++;
    s.wrap = {
      f,
      prog: 0,
      th0: null,
      dir: 1,
      ph: rand(0, 6.28),
      slide: 0,
      r: 0.7,
    };
    strands.push(s);
  }
  function handToWorld(ix, iy) {
    const dx = (ix - 8) * hand.s,
      dy = (iy - 3) * hand.s,
      c = Math.cos(hand.ang),
      sn = Math.sin(hand.ang);
    return [
      cur.x + hand.ox + c * dx - sn * dy,
      cur.y + hand.oy + sn * dx + c * dy,
    ];
  }
  const handTh = () => 0.8 * hand.s;
  const cp = [0, 0, 0, 0];
  function coilPoint(s, f, hair) {
    const w = s.wrap,
      F = FINGERS[w.f];
    const A = handToWorld(F.a[0], F.a[1]),
      B = handToWorld(F.b[0], F.b[1]);
    let ux = B[0] - A[0],
      uy = B[1] - A[1];
    const L = Math.hypot(ux, uy) || 1;
    ux /= L;
    uy /= L;
    const nx = -uy,
      ny = ux;
    if (w.th0 === null) {
      const side =
        (s.pos[0] - (A[0] + B[0]) / 2) * nx +
        (s.pos[1] - (A[1] + B[1]) / 2) * ny;
      w.th0 = side > 0 ? 0 : Math.PI;
      w.dir = side > 0 ? 1 : -1;
    }
    const r = (hair ? 0.45 : w.r) * P.thickness;
    const phi = f * F.turns * (hair ? 1.25 : 1) * 2 * Math.PI * w.prog;
    const t = clamp(
      F.t0 +
        w.slide +
        ((F.t1 - F.t0) * phi) / (F.turns * 2 * Math.PI * (hair ? 1.1 : 1)),
      0.02,
      0.98,
    );
    const th = w.th0 + w.dir * phi;
    const hw = F.hw * hand.s + r + 0.35,
      zr = handTh() + r + 0.3;
    cp[0] = A[0] + ux * t * L + nx * Math.cos(th) * hw;
    cp[1] = A[1] + uy * t * L + ny * Math.cos(th) * hw;
    cp[2] = CURZ + Math.sin(th) * zr;
    cp[3] = r * (1 - 0.35 * f * f);
    return cp;
  }
  function coilStart(s) {
    const p = coilPoint(s, 0, false);
    return [p[0], p[1], p[2]];
  }
  function spawnMicro(g) {
    if (strands.length >= MAXS - 6) return;
    const lat = rand(-1, 1) * 75;
    const a = anchorFor(cur.x, cur.y, lat, g);
    const s = newStrand("micro", g, a.x, a.y);
    s.lat = lat;
    s.probe = { len: rand(0.5, 1.2), z: rand(1, 5), ph: rand(0, 6.28) };
    s.ttl = rand(0.7, 1.9);
    s.vol = Math.PI * 0.55 * 0.55 * 40;
    strands.push(s);
  }
  function outlineAt(t, g) {
    const a = g.hw - g.hh,
      straight = 2 * a,
      cap = Math.PI * g.hh,
      per = 2 * straight + 2 * cap;
    let s = (((t % 1) + 1) % 1) * per;
    if (s < straight) return pillEdge(g.cx - a + s, g.cy - g.hh - 1, g);
    s -= straight;
    if (s < cap) {
      const th = -Math.PI / 2 + s / g.hh;
      return pillEdge(
        g.cx + a + Math.cos(th) * g.hh * 2,
        g.cy + Math.sin(th) * g.hh * 2,
        g,
      );
    }
    s -= cap;
    if (s < straight) return pillEdge(g.cx + a - s, g.cy + g.hh + 1, g);
    s -= straight;
    const th = Math.PI / 2 + s / g.hh;
    return pillEdge(
      g.cx - a + Math.cos(th) * g.hh * 2,
      g.cy + Math.sin(th) * g.hh * 2,
      g,
    );
  }
  function spawnProbe(g) {
    const dir = Math.random() < 0.5 ? -1 : 1,
      n = Math.random() < 0.5 ? 2 : 3;
    const t = lastProbeT + rand(0.25, 0.75);
    lastProbeT = t;
    const base = outlineAt(t, g);
    for (let i = 0; i < n && strands.length < MAXS - 2; i++) {
      const lat = (i - (n - 1) / 2) * 13 + rand(-3, 3);
      const a = pillEdge(base.x - base.ny * lat, base.y + base.nx * lat, g, 8);
      const s = newStrand("probe", g, a.x, a.y);
      s.probe = {
        nx: a.nx,
        ny: a.ny,
        dist: rand(11, 20),
        z: rand(2, 6),
        dir,
        delay: i * 0.07,
      };
      s.ttl = rand(0.8, 1);
      s.vol = Math.PI * 0.8 * 0.8 * 40;
      strands.push(s);
    }
  }
  const cum = new Float32Array(NP),
    tmpP = new Float32Array(NP * 3),
    tmpV = new Float32Array(NP * 3);
  function truncate(s, Lnew) {
    const pos = s.pos,
      prev = s.prev;
    cum[0] = 0;
    for (let i = 1; i < NP; i++) {
      const a = (i - 1) * 3,
        b = i * 3;
      cum[i] =
        cum[i - 1] +
        Math.hypot(
          pos[b] - pos[a],
          pos[b + 1] - pos[a + 1],
          pos[b + 2] - pos[a + 2],
        );
    }
    if (cum[NP - 1] < 0.001 || Lnew >= cum[NP - 1]) return;
    let k = 0;
    for (let j = 0; j < NP; j++) {
      const target = (Lnew * j) / (NP - 1);
      while (k < NP - 2 && cum[k + 1] < target) k++;
      const t = clamp(
        (target - cum[k]) / Math.max(cum[k + 1] - cum[k], 1e-6),
        0,
        1,
      );
      for (let c = 0; c < 3; c++) {
        tmpP[j * 3 + c] = pos[k * 3 + c] * (1 - t) + pos[(k + 1) * 3 + c] * t;
        tmpV[j * 3 + c] = prev[k * 3 + c] * (1 - t) + prev[(k + 1) * 3 + c] * t;
      }
    }
    pos.set(tmpP);
    prev.set(tmpV);
  }
  function resample(src, a, b) {
    const out = new Float32Array(NP * 3);
    for (let j = 0; j < NP; j++) {
      const f = a + ((b - a) * j) / (NP - 1);
      const i0 = clamp(Math.floor(f), 0, NP - 2),
        t = f - i0;
      for (let c = 0; c < 3; c++)
        out[j * 3 + c] = src[i0 * 3 + c] * (1 - t) + src[(i0 + 1) * 3 + c] * t;
    }
    return out;
  }
  function split(s, g) {
    const k = s.neckS * (NP - 1);
    const base = {
      ...s,
      kind: "piece",
      state: "recoil",
      pin: "anchor",
      pinch: 0,
      mound: s.mound,
      wrap: null,
      pos: resample(s.pos, 0, k),
      prev: resample(s.prev, 0, k),
      rad: new Float32Array(NP),
      vol: s.vol * s.neckS,
    };
    const tip = {
      ...s,
      kind: "piece",
      state: "recoil",
      pin: "cursor",
      pinch: 0,
      mound: 0,
      pos: resample(s.pos, NP - 1, k),
      prev: resample(s.prev, NP - 1, k),
      rad: new Float32Array(NP),
      vol: s.vol * (1 - s.neckS),
    };
    base.len = s.len * s.neckS;
    base.rest = base.len / (NP - 1);
    tip.len = s.len * (1 - s.neckS);
    tip.rest = tip.len / (NP - 1);
    base.retract = tip.retract = 0;
    const idx = strands.indexOf(s);
    strands[idx] = base;
    if (strands.length < MAXS) strands.push(tip);
    addRipple(g.cx + s.lx * g.hw, g.cy + s.ly * g.hh, 0.8);
    lastSnap = time;
  }
  function releaseAll(absorb) {
    for (const s of strands) {
      if (
        s.kind === "reach" &&
        (s.state === "grow" || s.state === "attached")
      ) {
        if (absorb || s.state === "grow") {
          s.state = "recoil";
          s.kind = "piece";
        } else if (!s.pinch) s.pinch = 1e-4;
      }
    }
  }
  function stepStrand(s, dt, g) {
    s.life += dt;
    const w = s.wrap;
    if (w) {
      w.slide = 0.045 * Math.sin(time * 1.4 + w.ph);
      if (s.state === "attached")
        w.prog += (1 - w.prog) * (1 - Math.exp(-dt * 10));
      else if (s.state === "recoil") {
        w.prog -= dt * 5;
        if (w.prog <= 0) {
          s.wrap = null;
          if (s.pin === "cursor") s.dead = true;
        }
      }
    }
    const R =
      s.pin === "anchor"
        ? [
            g.cx + s.lx * g.hw,
            g.cy + s.ly * g.hh,
            Math.max(2, g.top - 4) + btn.lift * LIFT_H,
          ]
        : s.wrap
          ? coilStart(s)
          : [cur.x, cur.y, CURZ];
    let T = null;
    if (s.kind === "reach" && (s.state === "grow" || s.state === "attached")) {
      T = coilStart(s);
      if (s.state === "attached") {
        const an = anchorFor(cur.x, cur.y, s.lat, g),
          k = 1 - Math.exp(-dt * 1.4);
        s.lx += ((an.x - g.cx) / g.hw - s.lx) * k;
        s.ly += ((an.y - g.cy) / g.hh - s.ly) * k;
      }
    } else if (s.kind === "micro" && s.state !== "recoil") {
      const an = anchorFor(cur.x, cur.y, s.lat, g),
        k = 1 - Math.exp(-dt * 2);
      s.lx += ((an.x - g.cx) / g.hw - s.lx) * k;
      s.ly += ((an.y - g.cy) / g.hh - s.ly) * k;
      const e2 = pillEdge(R[0], R[1], g);
      const tx = cur.x - R[0],
        ty = cur.y - R[1];
      const tl = Math.hypot(tx, ty) || 1;
      let dx = e2.nx * 0.25 + (tx / tl) * 0.75,
        dy = e2.ny * 0.25 + (ty / tl) * 0.75;
      const dl = Math.hypot(dx, dy) || 1;
      dx /= dl;
      dy /= dl;
      const len = (10 + 38 * awareNow) * s.probe.len,
        sway = Math.sin(time * 3 + s.probe.ph) * 4;
      T = [
        R[0] + dx * len - dy * sway,
        R[1] + dy * len + dx * sway,
        R[2] + s.probe.z * awareNow,
      ];
      if (s.life > s.ttl || awareNow < 0.08) {
        s.state = "recoil";
        T = null;
      }
    } else if (s.kind === "probe" && s.state !== "recoil") {
      const pr = s.probe,
        f = clamp((s.life - pr.delay) / s.ttl, 0, 1),
        wave = Math.sin(Math.PI * f);
      const glide = pr.dir * (f - 0.3) * 24,
        out = 3 + pr.dist * wave;
      T = [
        R[0] + pr.nx * out - pr.ny * glide,
        R[1] + pr.ny * out + pr.nx * glide,
        R[2] + pr.z * wave,
      ];
      if (s.life > s.ttl + pr.delay) {
        s.state = "recoil";
        T = null;
      }
    }
    let tip = null;
    if (T) {
      const L0 = Math.hypot(T[0] - R[0], T[1] - R[1], T[2] - R[2]);
      if (s.state === "grow") {
        const f = 3.8 * P.whip * (0.75 + 0.25 * P.magnet),
          z = 0.5,
          r = -0.2;
        const k1 = z / (Math.PI * f),
          k2 = 1 / (2 * Math.PI * f) ** 2,
          k3 = (r * z) / (2 * Math.PI * f);
        const xd = s.uKick ? 1 / dt : 0;
        s.uKick = false;
        const k2s = Math.max(k2, (dt * dt) / 2 + (dt * k1) / 2, dt * k1);
        s.u += dt * s.ud;
        s.ud += (dt * (1 + k3 * xd - s.u - k1 * s.ud)) / k2s;
        const u = s.u,
          uc = clamp(u, 0, 1);
        const L2 = Math.hypot(T[0] - R[0], T[1] - R[1]) || 1;
        const nx = -(T[1] - R[1]) / L2,
          ny = (T[0] - R[0]) / L2;
        const lat =
          s.side * s.wig * Math.sin(Math.PI * uc) * Math.min(L2 * 0.3, 38);
        tip = [
          R[0] + (T[0] - R[0]) * u + nx * lat,
          R[1] + (T[1] - R[1]) * u + ny * lat,
          R[2] + (T[2] - R[2]) * uc + 22 * Math.sin(Math.PI * uc),
        ];
        s.rest = (Math.max(4, L0 * Math.max(u, 0.03)) * 1.05) / (NP - 1);
        if (u > 0.85 && Math.abs(s.ud) < 1.6) s.state = "attached";
      } else {
        tip = T;
        let Lr = s.rest * (NP - 1);
        if (L0 < Lr * 1.03) Lr += (L0 * 1.03 - Lr) * (1 - Math.exp(-dt * 3.5));
        else Lr += (L0 - Lr) * (1 - Math.exp(-dt * P.creep));
        s.rest = Lr / (NP - 1);
        s.stretch = L0 / Math.max(Lr, 1);
        if (
          s.kind === "reach" &&
          !s.pinch &&
          (s.stretch > P.snapStretch * s.snapMul || L0 > P.maxLen * s.lenMul)
        )
          s.pinch = 1e-4;
      }
    } else if (s.state === "recoil") {
      s.retract += dt;
      const Ln = Math.max(
        0,
        s.len * Math.exp(-dt * 9) - (s.pin === "cursor" ? 160 : 110) * dt,
      );
      truncate(s, Ln);
      s.rest = Ln / (NP - 1);
    }
    if (s.pinch > 0) {
      s.pinch += dt / 0.1;
      if (s.pinch >= 1) {
        split(s, g);
        return;
      }
    }
    const pos = s.pos,
      prev = s.prev;
    const damp = s.state === "recoil" ? 0.94 : 0.975;
    const lastO = (NP - 1) * 3;
    const ex = pos[lastO] - R[0],
      ey = pos[lastO + 1] - R[1],
      el = Math.hypot(ex, ey) || 1;
    const px = -ey / el,
      py = ex / el;
    const slack = clamp(1.35 - s.stretch, 0.15, 1);
    const amp =
      (reduced || s.state === "recoil" ? 0 : 700) *
      P.slither *
      slack *
      (s.state === "grow" ? 0.4 : 1);
    const gdt = P.gravity * dt * dt;
    const mag =
      (s.kind === "reach" || s.kind === "micro") &&
      s.state !== "recoil" &&
      cur.present
        ? P.magnet * 900 * dt * dt
        : 0;
    for (let i = 1; i < NP; i++) {
      const o = i * 3,
        sp = i / (NP - 1);
      const vx = (pos[o] - prev[o]) * damp,
        vy = (pos[o + 1] - prev[o + 1]) * damp,
        vz = (pos[o + 2] - prev[o + 2]) * damp;
      prev[o] = pos[o];
      prev[o + 1] = pos[o + 1];
      prev[o + 2] = pos[o + 2];
      const env = Math.sin(Math.PI * sp);
      const wave =
        Math.sin(sp * 8.5 - time * 7.5 + s.phase) * env * amp * dt * dt;
      pos[o] += vx + px * wave;
      pos[o + 1] += vy + py * wave;
      pos[o + 2] +=
        vz -
        gdt +
        Math.cos(sp * 6 - time * 5 + s.phase) * env * amp * 0.25 * dt * dt;
      if (mag) {
        const mx = cur.x - pos[o],
          my = cur.y - pos[o + 1],
          ml = Math.hypot(mx, my) || 1;
        pos[o] += (mx / ml) * mag * env;
        pos[o + 1] += (my / ml) * mag * env;
      }
    }
    const rest = Math.max(s.rest, 0.05);
    for (let it = 0; it < ITER; it++) {
      pos[0] = R[0];
      pos[1] = R[1];
      pos[2] = R[2];
      if (tip) {
        pos[lastO] = tip[0];
        pos[lastO + 1] = tip[1];
        pos[lastO + 2] = tip[2];
      }
      for (let i = 0; i < NP - 1; i++) {
        const a = i * 3,
          b = a + 3;
        let dx = pos[b] - pos[a],
          dy = pos[b + 1] - pos[a + 1],
          dz = pos[b + 2] - pos[a + 2];
        const d = Math.hypot(dx, dy, dz) || 1e-6;
        const wa = i === 0 ? 0 : 1,
          wb = i + 1 === NP - 1 && tip ? 0 : 1,
          ws = wa + wb;
        if (!ws) continue;
        const diff = ((d - rest) / d) * 0.95;
        dx *= diff;
        dy *= diff;
        dz *= diff;
        if (wa) {
          const f = wa / ws;
          pos[a] += dx * f;
          pos[a + 1] += dy * f;
          pos[a + 2] += dz * f;
        }
        if (wb) {
          const f = wb / ws;
          pos[b] -= dx * f;
          pos[b + 1] -= dy * f;
          pos[b + 2] -= dz * f;
        }
      }
      for (let i = 0; i < NP - 2; i++) {
        const a = i * 3,
          b = a + 6;
        let dx = pos[b] - pos[a],
          dy = pos[b + 1] - pos[a + 1],
          dz = pos[b + 2] - pos[a + 2];
        const d = Math.hypot(dx, dy, dz) || 1e-6,
          min = rest * 1.55;
        if (d >= min) continue;
        const wa = i === 0 ? 0 : 1,
          wb = i + 2 === NP - 1 && tip ? 0 : 1,
          ws = wa + wb;
        if (!ws) continue;
        const diff = ((d - min) / d) * 0.25;
        dx *= diff;
        dy *= diff;
        dz *= diff;
        if (wa) {
          const f = wa / ws;
          pos[a] += dx * f;
          pos[a + 1] += dy * f;
          pos[a + 2] += dz * f;
        }
        if (wb) {
          const f = wb / ws;
          pos[b] -= dx * f;
          pos[b + 1] -= dy * f;
          pos[b + 2] -= dz * f;
        }
      }
    }
    for (let i = 1; i < NP; i++) {
      const o = i * 3,
        rmin = s.rad[i] * 0.7;
      if (pos[o + 2] < rmin) {
        pos[o + 2] = rmin;
        prev[o] += (pos[o] - prev[o]) * 0.3;
        prev[o + 1] += (pos[o + 1] - prev[o + 1]) * 0.3;
      }
    }
    let L = 0;
    for (let i = 0; i < NP - 1; i++) {
      const a = i * 3,
        b = a + 3;
      L += Math.hypot(
        pos[b] - pos[a],
        pos[b + 1] - pos[a + 1],
        pos[b + 2] - pos[a + 2],
      );
    }
    s.len = L;
    const rMean =
      clamp(
        Math.sqrt(s.vol / (Math.PI * Math.max(L, 2))),
        0.55,
        s.state === "recoil" ? 5 : 7.5,
      ) * P.thickness;
    const held = s.state === "attached";
    const neck = held ? clamp((s.stretch - 1.15) / 1.2, 0, 0.7) : 0;
    const nk = neck * (1 - s.pinch) + s.pinch * 0.96;
    const bead = held ? clamp((s.stretch - 1.5) / 0.8, 0, 1) : 0;
    const beadFreq = L / (9 * Math.max(rMean, 0.6));
    const capGrow = s.state === "recoil" ? Math.min(0.8, s.retract * 3) : 0;
    for (let i = 0; i < NP; i++) {
      const sp = i / (NP - 1);
      let r =
        rMean * (s.pin === "cursor" ? 0.6 : 1 + 0.55 * Math.exp(-sp / 0.08));
      if (
        (s.wrap && s.kind === "reach") ||
        s.kind === "micro" ||
        s.kind === "probe"
      )
        r *= 1 - 0.62 * ease(0.5, 1, sp);
      else r *= 1 + (0.5 + capGrow) * Math.exp(-(1 - sp) / 0.07);
      r *= 1 - nk * Math.exp(-(((sp - s.neckS) / 0.16) ** 2));
      r *= 1 + bead * 0.3 * Math.sin(sp * Math.PI * 2 * beadFreq + s.phase);
      s.rad[i] = Math.max(r, 0.35);
    }
    let moundT = 0,
      elongT = 0;
    if (s.pin === "anchor") {
      if (s.state === "grow") {
        moundT = 7;
        elongT = 0.9;
      } else if (s.state === "attached") {
        moundT = 6 + 6 * clamp(s.stretch - 1, 0, 1.4);
        elongT = 1 + 1.6 * clamp(s.stretch - 0.8, 0, 1.4);
      }
      if (s.kind === "micro") {
        moundT *= 0.35;
        elongT *= 0.6;
      }
      if (s.kind === "probe") {
        moundT *= 0.12;
        elongT *= 0.4;
      }
    }
    s.mound +=
      (moundT * 0.55 * P.pull - s.mound) *
      (1 - Math.exp(-dt * (moundT > s.mound ? 10 : 5)));
    s.elong =
      (s.elong || 0) + (elongT - (s.elong || 0)) * (1 - Math.exp(-dt * 8));
    const dxm = pos[9] - pos[0],
      dym = pos[10] - pos[1],
      dm = Math.hypot(dxm, dym);
    if (dm > 1) {
      s.dirX = dxm / dm;
      s.dirY = dym / dm;
    } else if (s.dirX === undefined) {
      s.dirX = 0;
      s.dirY = -1;
    }
    if (s.state === "recoil" && (s.rest * (NP - 1) < 12 || L < 5)) {
      s.dead = true;
      if (s.pin === "anchor" && s.kind !== "micro") addRipple(R[0], R[1], 0.5);
    }
  }
  function step(dt) {
    if (!reduced) time += dt;
    spring(btn, "intro", "introV", 1, 9, 0.85, dt);
    spring(btn, "press", "pressV", btn.pressTarget, 30, 0.75, dt);
    labelAmt +=
      (labelTarget - labelAmt) * (1 - Math.exp(-dt * (time > 0.6 ? 4 : 0)));
    const g = geo();
    const present = cur.present && btn.intro > 0.6;
    const e = pillEdge(cur.x, cur.y, g);
    const inside = present && e.d < -4;
    const aware = present && !inside ? ease(P.awareness, 18, e.d) : 0;
    awareNow = aware;
    spring(pull, "amt", "v", awareNow, 14, 1, dt);
    const pk = 1 - Math.exp(-dt * 10);
    pull.x += (e.x - e.nx * 6 - pull.x) * pk;
    pull.y += (e.y - e.ny * 6 - pull.y) * pk;
    spring(peak, "amt", "v", inside ? 1 : 0, 12, 1, dt);
    spring(btn, "lift", "liftV", inside ? 1 : 0, 11, 0.95, dt);
    CURZ = g.top + btn.lift * LIFT_H + 11;
    const fk = 1 - Math.exp(-dt * 14);
    peak.x += (cur.x - peak.x) * (peak.amt < 0.02 ? 1 : fk);
    peak.y += (cur.y - peak.y) * (peak.amt < 0.02 ? 1 : fk);
    if (!reduced) {
      let active = 0,
        microN = 0;
      for (let i = 0; i < strands.length; i++) {
        const s = strands[i];
        if (
          s.kind === "reach" &&
          (s.state === "grow" || s.state === "attached")
        )
          active++;
        else if (s.kind === "micro" && s.state !== "recoil") microN++;
      }
      if (!present) releaseAll(false);
      else if (inside) releaseAll(true);
      else {
        const want =
          e.d < P.reach
            ? Math.min(
                P.maxStrands,
                Math.round(
                  Math.min(2, P.maxStrands) +
                    Math.max(0, P.maxStrands - 2) *
                      ease(P.reach, P.reach * 0.4, e.d),
                ),
              )
            : 0;
        if (
          active < want &&
          time - lastSpawn > rand(0.03, 0.06) &&
          time - lastSnap > 0.15
        ) {
          spawnReach(g);
          lastSpawn = time;
        }
        if (
          microN < Math.round(9 * ease(0.1, 0.8, aware)) &&
          time - lastMicro > rand(0.03, 0.07)
        ) {
          spawnMicro(g);
          lastMicro = time;
        }
      }
      if (!inside && aware < 0.02 && time > nextProbe && btn.intro > 0.95) {
        if (strands.every((s) => s.kind === "probe" || s.state === "recoil"))
          spawnProbe(g);
        nextProbe = time + rand(1.8, 2.3);
      }
    }
    for (let i = 0; i < strands.length; i++) stepStrand(strands[i], dt, g);
    for (let i = strands.length - 1; i >= 0; i--)
      if (strands[i].dead) strands.splice(i, 1);
    let wrapped = false,
      reachTouch = false;
    for (let i = 0; i < strands.length; i++) {
      const s = strands[i];
      if (s.wrap) wrapped = true;
      if (
        s.kind === "reach" &&
        (s.state === "attached" || (s.state === "grow" && s.u > 0.5))
      )
        reachTouch = true;
    }
    const engage =
      !reduced &&
      hand.ready &&
      present &&
      (e.d < P.reach + 40 || inside || wrapped);
    spring(hand, "s", "v", HAND_BIG, 16, 0.9, dt);
    spring(
      hand,
      "coat",
      "coatV",
      inside ? 160 : present ? clamp(45 - e.d, -60, 160) : -60,
      9,
      0.9,
      dt,
    );
    const thrT = inside ? 0.57 : 0.8 - 0.2 * clamp(1 - e.d / 60, 0, 1);
    hand.thr += (thrT - hand.thr) * (1 - Math.exp(-dt * 4));
    hand.on = hand.ready && cur.present && cur.mouse && opts.customCursor;
    const touching = inside || reachTouch;
    spring(
      hand,
      "m",
      "mV",
      (engage && touching) || (hand.on && inside) ? 1 : 0,
      32,
      1,
      dt,
    );
    hand.m = clamp(hand.m, 0, 1);
    let tx = 0,
      ty = 0;
    for (const s of strands) {
      if (s.kind !== "reach" || s.state !== "attached" || !s.wrap) continue;
      const a = (NP - 1) * 3,
        b = (NP - 4) * 3;
      const dx = s.pos[b] - s.pos[a],
        dy = s.pos[b + 1] - s.pos[a + 1],
        dl = Math.hypot(dx, dy) || 1;
      const tension = clamp(s.stretch - 0.7, 0, 1.2) * s.wrap.prog;
      tx += (dx / dl) * tension;
      ty += (dy / dl) * tension;
    }
    const tm = Math.hypot(tx, ty),
      grip = hand.on ? Math.min(1, tm / 1.5) * P.grip : 0;
    const ux = tm > 1e-4 ? tx / tm : 0,
      uy = tm > 1e-4 ? ty / tm : 0;
    spring(hand, "ox", "oxV", ux * PULL_MAX * grip, 16, 0.62, dt);
    spring(hand, "oy", "oyV", uy * PULL_MAX * grip, 16, 0.62, dt);
    let dA = Math.atan2(uy, ux) - WRIST_ANG;
    dA = Math.atan2(Math.sin(dA), Math.cos(dA));
    const pullTilt =
      tm > 1e-4 ? clamp(dA * 0.35, -TILT_MAX, TILT_MAX) * grip : 0;
    spring(
      hand,
      "ang",
      "angV",
      clamp(cur.vx * 22e-5, -0.32, 0.32) + pullTilt,
      12,
      0.85,
      dt,
    );
    for (const r of ripples) r.age += dt;
    while (ripples.length && ripples[0].age > 1.6) ripples.shift();
    cur.vx *= Math.exp(-dt * 8);
    cur.vy *= Math.exp(-dt * 8);
  }
  const ptsBuf = new Float32Array(MAXS * NP * 4),
    boxBuf = new Float32Array(MAXS * 4),
    ancBuf = new Float32Array(MAXS * 4);
  const ancDBuf = new Float32Array(MAXS * 4),
    brBuf = new Float32Array(MAXBR * 12);
  const coilBuf = new Float32Array(MAXC * WP * 4),
    cboxBuf = new Float32Array(MAXC * 4);
  const blobBuf = new Float32Array(MAXB * 4),
    blobZBuf = new Float32Array(MAXB),
    ripBuf = new Float32Array(MAXR * 4);
  const K = [2.5, 6, 5];
  function render() {
    const g = geo();
    let zTop =
      g.top +
      btn.dome +
      pull.amt +
      peak.amt * PEAK_H * P.pull +
      btn.lift * LIFT_H +
      4;
    let maxMound = 0;
    const ns = Math.min(strands.length, MAXS);
    for (let i = 0; i < ns; i++) {
      const s = strands[i];
      let x0 = 1e9,
        y0 = 1e9,
        x1 = -1e9,
        y1 = -1e9,
        rMax = 0;
      for (let j = 0; j < NP; j++) {
        const o = (i * NP + j) * 4,
          x = s.pos[j * 3],
          y = s.pos[j * 3 + 1],
          z = s.pos[j * 3 + 2],
          r = s.rad[j];
        ptsBuf[o] = x;
        ptsBuf[o + 1] = y;
        ptsBuf[o + 2] = z;
        ptsBuf[o + 3] = r;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
        rMax = Math.max(rMax, r);
        zTop = Math.max(zTop, z + r + K[1] * 0.3);
      }
      const pad = rMax + K[1] + 3;
      boxBuf.set([x0 - pad, y0 - pad, x1 + pad, y1 + pad], i * 4);
      const ax = s.pin === "anchor" ? g.cx + s.lx * g.hw : 0,
        ay = s.pin === "anchor" ? g.cy + s.ly * g.hh : 0;
      const m = s.pin === "anchor" ? s.mound : 0;
      maxMound = Math.max(maxMound, m);
      ancBuf.set([ax, ay, m, 17], i * 4);
      ancDBuf.set([s.dirX ?? 0, s.dirY ?? -1, s.elong || 0, 0], i * 4);
    }
    zTop += maxMound;
    const held = strands
      .filter((s) => s.kind === "reach" && s.state === "attached")
      .sort((a, b) => a.lat - b.lat);
    let nbr = 0;
    for (let i = 0; i + 1 < held.length && nbr < MAXBR; i++) {
      const A = held[i],
        B = held[i + 1];
      const grow = clamp((Math.min(A.life, B.life) - 0.3) * 4, 0, 1);
      const taut = clamp(2.3 - Math.max(A.stretch, B.stretch), 0.25, 1);
      for (const sp of [0.22, 0.42, 0.62]) {
        if (nbr >= MAXBR) break;
        const j = Math.round(sp * (NP - 1)) * 3;
        const ax = A.pos[j],
          ay = A.pos[j + 1],
          az = A.pos[j + 2],
          bx = B.pos[j],
          by = B.pos[j + 1],
          bz = B.pos[j + 2];
        const dist = Math.hypot(bx - ax, by - ay);
        const r =
          0.22 * P.thickness * clamp(1.6 - dist / 70, 0, 1) * grow * taut;
        if (r < 0.2) continue;
        const rx = (A.pos[0] + B.pos[0]) / 2,
          ry = (A.pos[1] + B.pos[1]) / 2;
        let mx = (ax + bx) / 2,
          my = (ay + by) / 2;
        const dl = Math.hypot(rx - mx, ry - my) || 1,
          sag = dist * 0.22;
        mx += ((rx - mx) / dl) * sag;
        my += ((ry - my) / dl) * sag;
        brBuf.set(
          [
            ax,
            ay,
            az,
            r,
            mx,
            my,
            (az + bz) / 2 - dist * 0.05,
            r * 0.75,
            bx,
            by,
            bz,
            r,
          ],
          nbr * 12,
        );
        nbr++;
      }
    }
    let nc = 0;
    if (hand.on && hand.m > 0.6) {
      for (const hair of [false, true]) {
        for (const s of strands) {
          if (nc >= MAXC) break;
          if (!s.wrap || s.wrap.prog < 0.02) continue;
          let x0 = 1e9,
            y0 = 1e9,
            x1 = -1e9,
            y1 = -1e9;
          for (let j = 0; j < WP; j++) {
            const q = coilPoint(s, j / (WP - 1), hair);
            coilBuf.set(q, (nc * WP + j) * 4);
            x0 = Math.min(x0, q[0]);
            y0 = Math.min(y0, q[1]);
            x1 = Math.max(x1, q[0]);
            y1 = Math.max(y1, q[1]);
          }
          const pad = 4 + K[1];
          cboxBuf.set([x0 - pad, y0 - pad, x1 + pad, y1 + pad], nc * 4);
          nc++;
        }
      }
    }
    if (hand.on) zTop = Math.max(zTop, CURZ + handTh() + 6);
    for (const s of strands) {
      if (s.kind !== "reach" || s.state !== "attached") continue;
      const spread =
        clamp((s.stretch - 0.8) * 18, 0, 9) * clamp((s.life - 0.4) * 3, 0, 1);
      if (spread < 0.5) continue;
      for (const side of [-1, 1, 0.4]) {
        if (nc >= MAXC) break;
        let x0 = 1e9,
          y0 = 1e9,
          x1 = -1e9,
          y1 = -1e9;
        for (let j = 0; j < WP; j++) {
          const f = j / (WP - 1),
            fi = f * (NP - 1),
            i0 = Math.min(NP - 2, Math.floor(fi)),
            t = fi - i0;
          const a = i0 * 3,
            b = a + 3,
            P0 = s.pos;
          const tx = P0[b] - P0[a],
            ty = P0[b + 1] - P0[a + 1],
            tl = Math.hypot(tx, ty) || 1;
          const env = Math.sin(Math.PI * f) ** 1.4;
          const wob =
            0.75 + 0.25 * Math.sin(time * 3.1 + f * 7 + s.phase + side);
          const off = side * spread * env * wob * (side > 0 ? 1 : 0.7);
          const q = [
            P0[a] + (P0[b] - P0[a]) * t - (ty / tl) * off,
            P0[a + 1] + (P0[b + 1] - P0[a + 1]) * t + (tx / tl) * off,
            P0[a + 2] +
              (P0[b + 2] - P0[a + 2]) * t -
              spread * (side === 0.4 ? -0.25 : 0.35) * env,
            (0.24 + 0.1 * (1 - env)) * P.thickness,
          ];
          coilBuf.set(q, (nc * WP + j) * 4);
          x0 = Math.min(x0, q[0]);
          y0 = Math.min(y0, q[1]);
          x1 = Math.max(x1, q[0]);
          y1 = Math.max(y1, q[1]);
        }
        const pad = 4 + K[1];
        cboxBuf.set([x0 - pad, y0 - pad, x1 + pad, y1 + pad], nc * 4);
        nc++;
      }
    }
    const handOn = hand.on && hand.ready ? 1 : 0;
    ripBuf.fill(0);
    ripples.forEach((r, i) => ripBuf.set([r.x, r.y, r.age, r.amp], i * 4));
    const lb = [g.cx, g.cy + LABEL_NUDGE, btn.lbw, btn.lbh];
    const time2 = reduced ? 3 : time;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, W, H);
    gl.useProgram(p1.prog);
    gl.bindVertexArray(vao);
    const u1 = p1.u;
    gl.uniform2f(u1.uRes, W, H);
    gl.uniform1f(u1.uDpr, DPR);
    gl.uniform1f(u1.uTime, time2);
    gl.uniform4f(u1.uBtn, g.cx, g.cy, g.hw, g.hh);
    gl.uniform4f(u1.uBtnZ2, btn.lift * LIFT_H, BEVEL, 0, 0);
    gl.uniform4f(
      u1.uBtnZ,
      g.top,
      btn.sink * Math.min(1, btn.intro),
      btn.dome * Math.min(1, btn.intro),
      0,
    );
    gl.uniform4f(u1.uPull, pull.x, pull.y, pull.amt, 34);
    gl.uniform4f(u1.uPeak, peak.x, peak.y, peak.amt * PEAK_H * P.pull, 24);
    gl.uniform1i(u1.uNS, ns);
    gl.uniform4fv(u1.uPts, ptsBuf);
    gl.uniform4fv(u1.uBox, boxBuf);
    gl.uniform4fv(u1.uAnc, ancBuf);
    gl.uniform4fv(u1.uAncD, ancDBuf);
    gl.uniform1i(u1.uNBr, nbr);
    gl.uniform4fv(u1.uBr, brBuf);
    gl.uniform1i(u1.uNB, 0);
    gl.uniform4fv(u1.uBlob, blobBuf);
    gl.uniform1fv(u1.uBlobZ, blobZBuf);
    gl.uniform4fv(u1.uRip, ripBuf);
    gl.uniform4f(u1.uLabelBox, lb[0], lb[1], lb[2], lb[3]);
    gl.uniform1f(u1.uEmboss, 0);
    gl.uniform1f(u1.uZTop, zTop);
    gl.uniform3f(u1.uK, K[0], K[1], K[2]);
    gl.uniform1i(u1.uLabel, 1);
    gl.uniform1i(u1.uNC, nc);
    gl.uniform4fv(u1.uCoil, coilBuf);
    gl.uniform4fv(u1.uCBox, cboxBuf);
    gl.uniform4f(u1.uHand, cur.x + hand.ox, cur.y + hand.oy, hand.s, handOn);
    gl.uniform4f(
      u1.uHand2,
      Math.cos(hand.ang),
      Math.sin(hand.ang),
      CURZ,
      handTh(),
    );
    gl.uniform3f(u1.uCoat, hand.coat, 22, hand.thr);
    gl.uniform1i(u1.uHandSDF, 2);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, handSdfTex);
    gl.uniform1i(u1.uArrowSDF, 5);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, arrowSdfTex);
    gl.uniform1f(u1.uMorph, hand.m);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, labelTex);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gTex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindFramebuffer(gl.FRAMEBUFFER, cFbo);
    gl.viewport(0, 0, W, H);
    gl.useProgram(p2.prog);
    const u2 = p2.u;
    gl.uniform1i(u2.uG, 0);
    gl.uniform1i(u2.uLabel, 1);
    gl.uniform2f(u2.uRes, W, H);
    gl.uniform1f(u2.uDpr, DPR);
    gl.uniform1f(u2.uTime, time2);
    gl.uniform4f(u2.uLabelBox, lb[0], lb[1], lb[2], lb[3]);
    gl.uniform1f(u2.uLabelAmt, labelAmt);
    gl.uniform1f(
      u2.uLabelLod,
      Math.max(0, Math.log2(LABEL_W / (2 * lb[2] * DPR)) - 0.6),
    );
    gl.uniform1f(u2.uIri, P.sheen);
    gl.uniform1f(u2.uZMax, zTop);
    gl.uniform1f(u2.uLift, btn.lift);
    gl.uniform4f(u2.uBtnP, g.cx, g.cy, g.hw, g.hh);
    const inkHalf = (labelInkW * labelCss) / LABEL_PX / 2;
    gl.uniform2f(u2.uWin, -(inkHalf + 16) / g.hw, 15 / g.hw);
    gl.uniform2f(u2.uBtnH, g.top, btn.lift * LIFT_H);
    gl.uniform4f(u2.uHand, cur.x + hand.ox, cur.y + hand.oy, hand.s, handOn);
    gl.uniform4f(
      u2.uHand2,
      Math.cos(hand.ang),
      Math.sin(hand.ang),
      CURZ,
      handTh(),
    );
    gl.uniform1i(u2.uHandCol, 3);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, handColTex);
    gl.uniform1i(u2.uArrowCol, 6);
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, arrowColTex);
    gl.uniform1f(u2.uMorph, hand.m);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(p3.prog);
    gl.uniform1i(p3.u.uC, 4);
    gl.uniform2f(p3.u.uRes, W, H);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, cTex);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function layoutButton() {
    btn.cx = viewW() / 2;
    btn.cy = viewH() / 2;
    const sc = (labelCss || 16) / LABEL_PX;
    btn.hh = clamp(opts.buttonHeight, 36, 160) / 2;
    btn.hw = Math.max(
      btn.hh * 1.25,
      ((labelInkW || 520) * sc) / 2 + opts.sidePadding,
    );
    btn.lbw = (LABEL_W * sc) / 2;
    btn.lbh = (LABEL_H * sc) / 2;
    Object.assign(hitEl.style, {
      left: `${btn.cx - btn.hw}px`,
      top: `${btn.cy - btn.hh}px`,
      width: `${btn.hw * 2}px`,
      height: `${btn.hh * 2}px`,
    });
  }
  function resize() {
    layoutButton();
    let dpr = Math.min(window.devicePixelRatio || 1, 2) * quality;
    const area = viewW() * viewH(),
      budget = PIXEL_BUDGET[opts.quality] || PIXEL_BUDGET.balanced;
    if (area * dpr * dpr > budget) dpr = Math.sqrt(budget / area);
    dpr = Math.max(dpr, 0.25);
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
    W = clamp(Math.round(viewW() * dpr), 1, maxTex);
    H = clamp(Math.round(viewH() * dpr), 1, maxTex);
    canvas.width = W;
    canvas.height = H;
    DPR = W / viewW();
    makeGBuffer();
  }
  resize();
  const ro = new ResizeObserver(() => resize());
  ro.observe(wrap);
  const io = new IntersectionObserver((en) => {
    visible = en[0]?.isIntersecting ?? true;
  });
  io.observe(wrap);
  let last = performance.now(),
    acc = 0,
    frameEma = 1 / 60,
    slowFor = 0,
    raf = 0;
  function fail(err) {
    console.warn("[VenomButton]", err);
    destroy();
    hooks.onFail();
  }
  function frame(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    rect = null;
    let dt = (now - last) / 1e3;
    last = now;
    if (dt > 0.1) dt = 0.1;
    if (!visible) return;
    try {
      frameEma += (dt - frameEma) * 0.05;
      acc += dt;
      let n = 0;
      while (acc >= SUB && n < 40) {
        step(SUB);
        acc -= SUB;
        n++;
      }
      if (n === 40) acc = 0;
      const c = hand.on ? "none" : overGoo ? "pointer" : "";
      if (c !== lastCursor) {
        lastCursor = c;
        wrap.style.cursor = c;
      }
      render();
      if (
        frameEma > 1 / 40 &&
        dt < 0.09 &&
        document.visibilityState === "visible"
      )
        slowFor += dt;
      else slowFor = 0;
      if (slowFor > 2 && quality > 0.5) {
        quality -= 0.1;
        slowFor = 0;
        resize();
      }
    } catch (err) {
      fail(err);
    }
  }
  raf = requestAnimationFrame(frame);
  function local(e) {
    const r = rect || (rect = wrap.getBoundingClientRect());
    const sx = viewW() / (r.width || 1),
      sy = viewH() / (r.height || 1);
    const x = (e.clientX - r.left) * sx,
      y = (e.clientY - r.top) * sy;
    return { x, y, inside: x >= 0 && y >= 0 && x <= viewW() && y <= viewH() };
  }
  const insidePill = (x, y) => pillEdge(x, y, geo()).d < 0;
  const onMove = (e) => {
    const l = local(e);
    if (!l.inside) {
      cur.present = false;
      overGoo = false;
      return;
    }
    const now = performance.now(),
      dts = Math.max(1, now - cur.t) / 1e3;
    if (cur.present) {
      cur.vx = (l.x - cur.lx) / dts;
      cur.vy = (l.y - cur.ly) / dts;
    }
    cur.t = now;
    cur.x = cur.lx = l.x;
    cur.y = cur.ly = l.y;
    cur.mouse = e.pointerType === "mouse" || e.pointerType === "pen";
    cur.present = cur.mouse || cur.down;
    overGoo = insidePill(cur.x, cur.y);
  };
  const onRaw = (e) => {
    if (cur.present && cur.mouse) {
      const l = local(e);
      if (l.inside) {
        cur.x = l.x;
        cur.y = l.y;
      }
    }
  };
  const onLeave = () => {
    cur.present = false;
    overGoo = false;
  };
  const onBlur = () => {
    cur.present = false;
    cur.down = false;
    overGoo = false;
    if (btn.pressTarget) press(false);
  };
  const onDown = (e) => {
    const l = local(e);
    if (!l.inside) return;
    cur.down = true;
    cur.x = l.x;
    cur.y = l.y;
    cur.present = true;
    if (insidePill(l.x, l.y)) press(true);
  };
  const onUp = (e) => {
    cur.down = false;
    if (e.pointerType === "touch") cur.present = false;
    if (btn.pressTarget) {
      const l = local(e);
      press(false, l.x, l.y);
    }
  };
  function press(on, x, y) {
    btn.pressTarget = on ? 1 : 0;
    if (!on) {
      addRipple(x ?? btn.cx, y ?? btn.cy, 1.6);
      for (const s of strands) if (s.state === "attached") s.rest *= 0.82;
    }
  }
  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!e.repeat) press(true);
    }
  };
  const onKeyUp = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      press(false, btn.cx, btn.cy);
    }
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  if ("onpointerrawupdate" in window)
    window.addEventListener("pointerrawupdate", onRaw, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  window.addEventListener("blur", onBlur);
  window.addEventListener("pointerdown", onDown);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  hitEl.addEventListener("keydown", onKeyDown);
  hitEl.addEventListener("keyup", onKeyUp);
  const fontsApi = document.fonts;
  const onFontsDone = () => {
    if (destroyed || labelFontOk) return;
    try {
      if (
        fontsApi.check(opts.fontCss.replace("{px}", LABEL_PX + "px"), opts.text)
      ) {
        labelKey = "";
        applyLabel();
      }
    } catch (e) {}
  };
  fontsApi?.addEventListener?.("loadingdone", onFontsDone);
  const onCtxLost = (e) => {
    e.preventDefault();
    if (destroyed) return;
    destroy();
    hooks.onLost();
  };
  canvas.addEventListener("webglcontextlost", onCtxLost);
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerrawupdate", onRaw);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    hitEl.removeEventListener("keydown", onKeyDown);
    hitEl.removeEventListener("keyup", onKeyUp);
    canvas.removeEventListener("webglcontextlost", onCtxLost);
    fontsApi?.removeEventListener?.("loadingdone", onFontsDone);
    wrap.style.cursor = "";
    try {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    } catch (e) {}
  }
  applyLabel();
  return {
    update(next) {
      const qualityChanged = next.quality !== opts.quality;
      if (qualityChanged) quality = 1;
      opts = next;
      Object.assign(P, mergePhysics(next.physics));
      applyLabel();
      if (qualityChanged) resize();
      else layoutButton();
    },
    destroy,
  };
} // ───────────────────────────── Framer component ─────────────────────────────
function fontFamilyCss(font) {
  let fam = font?.fontFamily || "Geist, Inter, system-ui, sans-serif";
  if (typeof fam === "string" && fam.includes("var(")) {
    fam = fam.replace(/var\([^,]+,\s*/g, "").replace(/\)+/g, "").replace(/['"]/g, "");
  }
  if (!fam || !fam.trim()) fam = "Geist, Inter, system-ui, sans-serif";
  return `${fam}, -apple-system, "Segoe UI", sans-serif`;
}
function fontToCss(font) {
  const weight = font?.fontWeight ?? 700;
  const style = font?.fontStyle ?? "normal";
  return `${style} ${weight} {px} ${fontFamilyCss(font)}`;
}
const CSS = `
.venom-hit:focus,.venom-fallback:focus{outline:none}
.venom-hit:focus-visible,.venom-fallback:focus-visible{outline:2px solid rgba(10,132,255,.9);outline-offset:6px}
`;
function VenomButton(props) {
  const {
    text,
    font,
    link,
    newTab,
    buttonHeight,
    sidePadding,
    customCursor,
    quality,
    physics,
    style,
    onClick,
  } = props;
  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const hitRef = useRef(null);
  const engineRef = useRef(null);
  const retries = useRef(0);
  const [noGL, setNoGL] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const isStatic = useIsStaticRenderer();
  const labelSize = clamp(parseFontSize(font?.fontSize, 19), 8, 96);
  const fontKey = JSON.stringify(font || {});
  const physicsKey = JSON.stringify(physics || {});
  const label =
    typeof text === "string" && text.length ? text : "let’s collaborate";
  const opts = useMemo(
    () => ({
      text: label,
      fontCss: fontToCss(font),
      labelSize,
      buttonHeight: clamp(num(buttonHeight, 60), 36, 160),
      sidePadding: clamp(num(sidePadding, 30), 4, 120),
      customCursor: customCursor !== false && !isStatic,
      quality: quality || "balanced",
      physics: mergePhysics(physics),
    }),
    [
      label,
      fontKey,
      labelSize,
      buttonHeight,
      sidePadding,
      customCursor,
      isStatic,
      quality,
      physicsKey,
    ],
  );
  const optsRef = useRef(opts);
  optsRef.current = opts;
  useEffect(() => {
    if (isStatic) {
      setNoGL(true);
      return;
    }
    const wrap = wrapRef.current,
      stage = stageRef.current,
      hit = hitRef.current;
    if (!wrap || !stage || !hit) return;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none";
    stage.appendChild(canvas);
    let eng = null;
    try {
      eng = createVenom(wrap, canvas, hit, optsRef.current, {
        onFail: () => {
          engineRef.current = null;
          canvas.style.display = "none";
          setNoGL(true);
        },
        onLost: () => {
          engineRef.current = null;
          canvas.style.display = "none";
          if (retries.current++ < 3) setEpoch((n) => n + 1);
          else setNoGL(true);
        },
      });
    } catch (err) {
      console.warn("[VenomButton]", err);
      eng = null;
    }
    if (!eng) {
      canvas.remove();
      setNoGL(true);
      return;
    }
    setNoGL(false);
    engineRef.current = eng;
    return () => {
      eng.destroy();
      engineRef.current = null;
      canvas.remove();
    };
  }, [epoch, isStatic]);
  useEffect(() => {
    engineRef.current?.update(opts);
  }, [opts]);
  const Tag = link ? "a" : "button";
  const tagProps = link
    ? {
        href: link,
        ...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {}),
      }
    : { type: "button" };
  
  const navigate = useNavigate();
  const handleClick = (e: React.MouseEvent) => {
    if (typeof onClick === 'function') {
      onClick(e);
      return;
    }
    if (link && !newTab && !link.startsWith('http') && !link.startsWith('//')) {
      e.preventDefault();
      navigate({ to: link });
    }
  };

  const family = fontFamilyCss(font);
  const weight = font?.fontWeight ?? 700;

  return (
    <div
      ref={wrapRef}
      className={props.className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'visible',
        ...style,
      }}
    >
      <style>{CSS}</style>
      <div
        ref={stageRef}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
      />
      <Tag
        ref={hitRef}
        className="venom-hit"
        aria-label={label}
        onClick={handleClick}
        {...tagProps}
        style={{
          position: 'absolute',
          margin: 0,
          padding: 0,
          border: 0,
          borderRadius: 999,
          background: 'transparent',
          color: 'transparent',
          fontFamily: family,
          fontWeight: weight,
          fontSize: labelSize,
          lineHeight: 1,
          cursor: 'pointer',
          touchAction: 'none',
          WebkitTapHighlightColor: 'transparent',
          textDecoration: 'none',
          display: noGL ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          whiteSpace: 'nowrap',
          pointerEvents: 'auto',
        }}
      >
        {label}
      </Tag>
      {noGL && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Tag
            className="venom-fallback"
            aria-label={label}
            onClick={handleClick}
            {...tagProps}
            style={{
              pointerEvents: 'auto',
              margin: 0,
              border: 0,
              borderRadius: 999,
              cursor: 'pointer',
              height: opts.buttonHeight,
              padding: `0 ${opts.sidePadding}px`,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
              fontFamily: family,
              fontWeight: weight,
              fontSize: labelSize,
              lineHeight: 1,
              textDecoration: 'none',
              color: '#f2f2f5',
              background: 'radial-gradient(120% 140% at 30% 20%, #3a3a48, #101014 60%)',
              boxShadow: '0 18px 30px -16px rgba(20,20,30,.6), inset 0 1px 0 rgba(255,255,255,.18)',
            }}
          >
            {label}
          </Tag>
        </div>
      )}
    </div>
  );
}

VenomButton.defaultProps = {
  text: 'Dashboard',
  buttonHeight: 46,
  sidePadding: 24,
  customCursor: false,
  quality: 'balanced',
  physics: DEFAULT_PHYSICS,
};

export { VenomButton };
export default VenomButton;
