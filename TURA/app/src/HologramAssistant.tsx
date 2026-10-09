import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useAIState, type AIState } from "./ai-state";
import cloudMeta from "./assets/face-cloud.json";
import cloudUrl from "./assets/face-cloud.bin?url";

export type AssistantState = AIState;

interface HologramAssistantProps {
  /** What to show. Left out, the hologram follows setAIState(). */
  state?: AssistantState;
  /**
   * False lets the face come apart and go back into the field of particles;
   * true (the default) gathers it again.
   */
  formed?: boolean;
  /**
   * How loud TURA's voice is right now, from 0 to 1, read on every frame
   * while answering: the level of a Web Audio analyser, for instance.
   * Without it, or while it returns null, the mouth moves to a made-up
   * rhythm of syllables instead.
   */
  audioLevel?: () => number | null;
}

/** What the render loop reads on every frame. */
type Live = { state: AssistantState; formed: boolean; audioLevel?: () => number | null };

/**
 * What each state asks of the particles. Every value is a target that the
 * scene eases towards, so states blend into each other instead of cutting.
 */
const stateConfig: Record<
  AssistantState,
  {
    /** The share of the face's particles that hold their place; the rest wander off and come back. */
    stability: number;
    /** How much less the outer parts of the head hold than its centre. */
    edgeLoss: number;
    /** How far the head sways from facing the user, in radians, and how fast. */
    sway: number;
    swaySpeed: number;
    /** Tilt of the head: negative looks up. */
    pitch: number;
    eyeGlow: number;
    /** How wide the pupils are (1 is at rest), and how far the eyes wander from the user. */
    pupil: number;
    gaze: number;
    listen: number;
    think: number;
    answer: number;
  }
> = {
  idle: { stability: 0.97, edgeLoss: 0.24, sway: 0.07, swaySpeed: 0.25, pitch: 0, eyeGlow: 0.45, pupil: 1, gaze: 1, listen: 0, think: 0, answer: 0 },
  listening: { stability: 1, edgeLoss: 0.1, sway: 0.03, swaySpeed: 0.5, pitch: 0.02, eyeGlow: 1, pupil: 1.28, gaze: 0, listen: 1, think: 0, answer: 0 },
  thinking: { stability: 0.86, edgeLoss: 0.7, sway: 0.1, swaySpeed: 0.4, pitch: -0.07, eyeGlow: 0.75, pupil: 0.85, gaze: 1.3, listen: 0, think: 1, answer: 0 },
  answering: { stability: 1, edgeLoss: 0.05, sway: 0.04, swaySpeed: 0.7, pitch: 0, eyeGlow: 0.8, pupil: 1.1, gaze: 0.35, listen: 0, think: 0, answer: 1 },
};

/** The box the particles float in while they are not part of the face. */
const FIELD = { width: 5.4, height: 4.6, depth: 3.8, y: -0.15 };
/** The space the hologram takes on screen; .voice__hologram holds the same while this file loads. */
const HOLOGRAM_SIZE = { width: "min(100vw, 560px)", height: "min(118vw, 600px, 60dvh)" };
/** Where the camera stands, and the middle of what it frames. */
const CAMERA = { distance: 6.6, y: -0.14, fov: 30 };
/**
 * Following the cursor at rest, on devices that have one: how far the head
 * turns and tilts towards it (radians), how long after the cursor last moved
 * the face keeps looking at it, and how far away, in widths of the hologram,
 * the cursor has to be for the face to be turned all the way.
 */
const FOLLOW = { yaw: 0.26, pitch: 0.14, seconds: 6, reach: 1.4 };
/** Seconds the face takes to gather out of the field, and to come apart again. */
const FORM_SECONDS = 6.5;
const DISSOLVE_SECONDS = 3;

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uForm;
  uniform float uStability;
  uniform float uEdgeLoss;
  uniform float uListen;
  uniform float uThink;
  uniform float uAnswer;
  uniform float uAudio;
  uniform float uEyeGlow;
  uniform float uScale;
  uniform float uFocus;
  uniform mat3 uTurn;
  uniform vec3 uEyeLeft;
  uniform vec3 uEyeRight;
  uniform vec3 uMouth;
  uniform vec2 uLids;
  uniform vec2 uEyeRadii; // iris, pupil
  uniform vec2 uGaze;     // how far the eyes look away from straight ahead
  uniform float uPupil;   // how wide the pupils are; 1 is at rest
  uniform float uBlink;   // 0 open, 1 shut

  // position is where the particle floats in the field.
  attribute vec3 aFace;   // its place on the face, for the particles that have one
  attribute vec3 aNormal; // which way the face is turned there
  attribute vec4 aSeed;   // two random numbers, whether it belongs to the face, how much it follows the jaw
  attribute vec4 aInfo;   // when it arrives while the face forms, how far out it is, extra brightness, kind

  varying vec3 vColor;
  varying float vAlpha;
  varying float vBlur;

  void main() {
    float belongs = aSeed.z;
    float kind = aInfo.w; // 0 surface, 1 warm accent, 2 iris, 3 drawn line, 4 catchlight
    bool iris = kind > 1.5 && kind < 2.5;
    bool catchlight = kind > 3.5;

    // Adrift: a slow current through the field plus a faint tremor, so no
    // particle is ever still. While TURA listens the field leans in.
    float t = uTime * 0.1;
    vec3 field = position + 0.22 * vec3(
      sin(position.y * 1.3 + t * 1.7 + aSeed.x * 6.28),
      cos(position.z * 1.1 + t * 1.3 + aSeed.y * 12.5),
      sin(position.x * 1.2 - t * 1.1 + aSeed.x * 3.1)
    );
    field += 0.008 * sin(uTime * 3.0 + aSeed.x * 50.0);
    field -= normalize(field + vec3(0.0, 0.1, 0.001)) * uListen * 0.3
      * (0.5 + 0.5 * sin(uTime * 1.4 + aSeed.y * 20.0));
    // While TURA speaks the field is pushed out with every syllable.
    float speaking = uAudio * uAnswer;
    field += normalize(field + vec3(0.0, 0.1, 0.001)) * 0.16 * speaking;

    // Thinking: the particles that leave the face circle the head in
    // streams instead of going back to the field.
    float angle = uTime * (0.5 + aSeed.y) * 1.2 + aSeed.x * 6.283;
    float radius = 1.2 + aSeed.y * 0.9;
    vec3 stream = vec3(
      cos(angle) * radius,
      (aSeed.x - 0.5) * 2.6 + 0.2 + 0.15 * sin(angle * 0.5),
      sin(angle) * radius
    );
    vec3 away = mix(field, stream, uThink * belongs);

    // The face gathers in an order baked into each point (a vague cast of
    // the head, the eyes, then nose, mouth and jaw), and once there each
    // point takes turns leaving and coming back, the outer ones most.
    float arrived = smoothstep(0.0, 1.0, clamp((uForm * 1.3 - aInfo.x) / 0.3, 0.0, 1.0));
    float wander = 0.5 + 0.5 * sin(uTime * (0.15 + aSeed.y * 0.25) + aSeed.x * 37.0);
    float hold = kind > 1.5 ? 2.0 : uStability - aInfo.y * uEdgeLoss;
    float gathered = arrived * (1.0 - smoothstep(hold - 0.06, hold + 0.06, wander)) * belongs;

    vec3 face = aFace;
    float lidded = 1.0;
    vec3 eyeCenter = aFace.x < 0.0 ? uEyeLeft : uEyeRight;
    if (iris || catchlight) {
      vec2 offset = aFace.xy - eyeCenter.xy;
      if (iris) {
        // The pupil widens and narrows, and the fibres between it and the
        // outer ring stretch with it; while TURA thinks the iris also turns.
        float reach = clamp((length(offset) - uEyeRadii.y) / (uEyeRadii.x - uEyeRadii.y), 0.0, 1.0);
        float pupil = min(uEyeRadii.y * uPupil, uEyeRadii.x * 0.8);
        offset = normalize(offset) * mix(pupil, uEyeRadii.x, reach);
        float turn = uTime * (0.04 + 1.3 * uThink) * (aFace.x < 0.0 ? 1.0 : -1.0);
        offset = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * offset;
        offset += uGaze;
      } else {
        // The reflection barely follows the gaze: it belongs to the light, not the eye.
        offset += 0.35 * uGaze;
      }
      // Whatever is behind the lids, or under them as they blink, is not drawn.
      float opening = uLids.y * (1.0 - uBlink) * sqrt(max(0.0, 1.0 - pow(offset.x / uLids.x, 2.0)));
      lidded = step(abs(offset.y), opening * (offset.y > 0.0 ? 0.94 : 0.76));
      face.xy = eyeCenter.xy + offset;
    } else if (kind > 2.5 && aFace.y > eyeCenter.y && distance(aFace.xy, eyeCenter.xy) < uLids.x * 1.25) {
      // Blinking: the upper lid and its crease come down onto the lower lid.
      face.y = mix(face.y, eyeCenter.y - 0.26 * (aFace.y - eyeCenter.y), uBlink);
    }

    // On the face: it breathes, shimmers, ripples while it listens and
    // pulses out from the mouth while it speaks.
    face *= 1.0 + 0.008 * sin(uTime * 1.2);
    face += aNormal * 0.005 * sin(uTime * 2.3 + aSeed.x * 80.0);
    face += aNormal * 0.014 * uListen * sin(length(aFace.xy) * 9.0 - uTime * 6.0);
    // Speaking: the jaw drops with the voice, and rings of light and
    // movement travel out from the mouth across the whole face.
    float fromMouth = distance(aFace, uMouth);
    float voice = sin(fromMouth * 8.0 - uTime * 10.0) * exp(-fromMouth * 0.75) * speaking;
    face += aNormal * 0.04 * voice;
    face.y -= aSeed.w * 0.1 * speaking;
    face = uTurn * face;

    vec3 placed = mix(away, face, gathered);
    vec4 view = modelViewMatrix * vec4(placed, 1.0);
    gl_Position = projectionMatrix * view;

    // Depth of field: the face is in focus; what floats in front of it or
    // behind it is larger, softer and fainter.
    float blur = clamp(abs(-view.z - uFocus) / 1.7, 0.0, 1.0) * (1.0 - 0.9 * gathered);
    // The face is drawn in fine points; the field is mostly a mist of
    // specks, with a few larger motes.
    float size = belongs > 0.5
      ? mix(0.5, 0.95, aSeed.y)
      : (aSeed.y < 0.92 ? mix(0.28, 0.55, aSeed.x) : mix(0.9, 1.6, aSeed.x));
    // The iris is fine detail in a very small space: smaller points, or it
    // would all merge into a white blot.
    if (iris) size = mix(0.34, 0.52, aSeed.y);
    if (catchlight) size = 0.7;
    size *= 1.0 + 1.7 * blur;
    gl_PointSize = uScale * size / -view.z;

    // Light: the particles are lit like a surface would be, from above and
    // to one side, and what faces away goes dark. That shading, with more
    // points where the face bends, is what draws its features.
    vec3 normal = normalize(uTurn * aNormal);
    float diffuse = max(dot(normal, normalize(vec3(0.5, 0.42, 0.76))), 0.0);
    float shade = (0.14 + 0.86 * pow(diffuse, 1.2)) * (0.15 + 0.85 * smoothstep(-0.45, 0.25, normal.z));
    shade += 0.55 * aInfo.z;
    // Drawn lines keep their own brightness whatever the light: the irises
    // strong, the lids and lips just enough to firm up what the shading shows.
    if (kind > 1.5) shade = kind > 2.5 ? 0.25 + 0.6 * aInfo.z : 0.18 + 0.62 * aInfo.z;
    if (catchlight) shade = 1.5;

    // The eyes shed a little light on what is around them.
    float fromEye = min(distance(aFace, uEyeLeft), distance(aFace, uEyeRight));
    float eyeLight = exp(-fromEye * fromEye / 0.03) * uEyeGlow;
    shade += 0.55 * eyeLight;
    if (iris) shade *= 0.8 + 0.45 * uEyeGlow + 0.2 * uThink * sin(uTime * 7.0 + aSeed.x * 6.28);
    // The whole face brightens with the voice, the mouth most of all.
    shade *= 1.0 + speaking * (0.35 + 0.9 * exp(-fromMouth * fromMouth / 0.06));

    float adrift = belongs > 0.5 ? 0.3 : mix(0.12, 0.42, aSeed.x);
    vAlpha = mix(adrift, 0.9 * shade, gathered) / (1.0 + 7.0 * blur * blur) + 0.9 * max(voice, 0.0) * gathered;
    vAlpha *= lidded;
    // The field thins out towards the edges of the canvas instead of being cut by them.
    vec2 screen = abs(gl_Position.xy / gl_Position.w);
    vAlpha *= smoothstep(1.0, 0.72, screen.x) * smoothstep(1.0, 0.72, screen.y);
    vBlur = blur;

    // Electric blue through cyan to a bluish white where the light is strongest.
    vec3 cold = mix(vec3(0.1, 0.4, 1.0), vec3(0.22, 0.82, 1.0), aSeed.y);
    cold = mix(cold, vec3(0.86, 0.95, 1.0), clamp(0.6 * shade * shade * gathered, 0.0, 1.0));
    cold = mix(cold, vec3(0.5, 0.95, 1.0), clamp(eyeLight * gathered, 0.0, 1.0));
    cold = mix(cold, vec3(0.9, 0.98, 1.0), clamp(1.4 * max(voice, 0.0) * gathered, 0.0, 1.0));
    vColor = cold;
    if (kind > 0.5 && kind < 1.5) vColor = vec3(1.0, 0.4, 0.16);
    // Deep blue by the pupil, cyan across the fibres, near white at the outer ring.
    if (iris) vColor = mix(vec3(0.12, 0.5, 1.0), vec3(0.7, 0.97, 1.0), aInfo.z * aInfo.z);
    if (catchlight) vColor = vec3(1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vBlur;

  void main() {
    // A round dot instead of the square a point is by default: a crisp core
    // in focus, an even soft disc out of it.
    float fromCenter = length(gl_PointCoord - 0.5);
    float disc = smoothstep(0.5, mix(0.1, 0.42, vBlur), fromCenter);
    gl_FragColor = vec4(vColor, disc * vAlpha);
  }
`;

interface Cloud {
  count: number;
  /** x, y, z per point. */
  positions: Float32Array;
  normals: Float32Array;
  /** How much each point follows the jaw: 1 down with it, slightly negative for the upper lip. */
  jaw: Float32Array;
  /** Per point: when it arrives as the face forms, how far out it is, extra brightness, kind. */
  info: Float32Array;
}

/** Unpacks the cloud that scripts/bake-face.mjs writes: 14 bytes per point. */
function readCloud(buffer: ArrayBuffer): Cloud {
  const { count, stride, range } = cloudMeta;
  const data = new DataView(buffer);
  const cloud: Cloud = {
    count,
    positions: new Float32Array(count * 3),
    normals: new Float32Array(count * 3),
    jaw: new Float32Array(count),
    info: new Float32Array(count * 4),
  };
  for (let index = 0; index < count; index++) {
    const at = index * stride;
    for (let axis = 0; axis < 3; axis++) {
      cloud.positions[index * 3 + axis] = (((data.getInt16(at + axis * 2, true) + 32768) / 65535) * 2 - 1) * range;
      cloud.normals[index * 3 + axis] = data.getInt8(at + 6 + axis) / 127;
    }
    cloud.jaw[index] = data.getInt8(at + 9) / 127;
    cloud.info.set(
      [data.getUint8(at + 10) / 255, data.getUint8(at + 11) / 255, data.getUint8(at + 12) / 255, data.getUint8(at + 13)],
      index * 4,
    );
  }
  return cloud;
}

/** One geometry for everything: the points of the face first, then the ones that only ever float. */
function buildGeometry(cloud: Cloud, faceCount: number, fieldCount: number): THREE.BufferGeometry {
  const total = faceCount + fieldCount;
  const home = new Float32Array(total * 3);
  const face = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);
  const seed = new Float32Array(total * 4);
  const info = new Float32Array(total * 4);

  for (let index = 0; index < total; index++) {
    const belongs = index < faceCount;
    home.set(
      [
        (Math.random() - 0.5) * FIELD.width,
        (Math.random() - 0.5) * FIELD.height + FIELD.y,
        (Math.random() - 0.5) * FIELD.depth,
      ],
      index * 3,
    );
    if (belongs) {
      // The baked cloud is shuffled, so its first points are an even sample of all of it.
      face.set(cloud.positions.subarray(index * 3, index * 3 + 3), index * 3);
      normal.set(cloud.normals.subarray(index * 3, index * 3 + 3), index * 3);
      info.set(cloud.info.subarray(index * 4, index * 4 + 4), index * 4);
    } else if (Math.random() < 0.035) {
      info[index * 4 + 3] = 1; // a warm accent among the cold
    }
    seed.set([Math.random(), Math.random(), belongs ? 1 : 0, belongs ? cloud.jaw[index] : 0], index * 4);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(home, 3));
  geometry.setAttribute("aFace", new THREE.BufferAttribute(face, 3));
  geometry.setAttribute("aNormal", new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
  geometry.setAttribute("aInfo", new THREE.BufferAttribute(info, 4));
  return geometry;
}

/** Eases `current` towards `target`; `rate` is how much of the gap closes per second, roughly. */
const ease = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

function Particles({ cloud, live }: { cloud: Cloud; live: React.RefObject<Live> }) {
  const geometry = useMemo(() => {
    // Fewer particles on a phone-sized screen, which also has the weaker GPU.
    const small = window.innerWidth < 500;
    return buildGeometry(cloud, Math.min(cloud.count, small ? 14000 : 26000), small ? 8000 : 17000);
  }, [cloud]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uForm: { value: 0 },
      uStability: { value: stateConfig.idle.stability },
      uEdgeLoss: { value: stateConfig.idle.edgeLoss },
      uListen: { value: 0 },
      uThink: { value: 0 },
      uAnswer: { value: 0 },
      uAudio: { value: 0 },
      uEyeGlow: { value: 0 },
      uScale: { value: 1 },
      // The face is what is in focus: the distance from the camera to its surface.
      uFocus: { value: CAMERA.distance - 0.7 },
      uTurn: { value: new THREE.Matrix3() },
      uEyeLeft: { value: new THREE.Vector3(...cloudMeta.eyes[0]) },
      uEyeRight: { value: new THREE.Vector3(...cloudMeta.eyes[1]) },
      uMouth: { value: new THREE.Vector3(...cloudMeta.mouth) },
      uLids: { value: new THREE.Vector2(...cloudMeta.lids) },
      uEyeRadii: { value: new THREE.Vector2(cloudMeta.irisRadius, cloudMeta.pupilRadius) },
      uGaze: { value: new THREE.Vector2() },
      uPupil: { value: 1 },
      uBlink: { value: 0 },
    }),
    [],
  );

  // Built by hand rather than as a <shaderMaterial> element: the render loop
  // writes to these very uniform objects, and declaring them as a prop hands
  // the material a copy that the loop would never reach.
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms],
  );
  useEffect(() => () => material.dispose(), [material]);

  // People who ask for less motion get the same scene, much calmer.
  const pace = useMemo(
    () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.25 : 1),
    [],
  );
  const pose = useRef({ time: 0, yaw: 0, pitch: 0, turn: new THREE.Matrix4(), rotation: new THREE.Euler() });
  // Where the mouse is, measured from the face: -1 to 1 across and up, and
  // when it last moved. Touch is left out: a finger is not somewhere to look,
  // and it leaves no position behind when it lifts.
  const canvas = useThree((three) => three.gl.domElement);
  const cursor = useRef({ x: 0, y: 0, at: -Infinity });
  useEffect(() => {
    const track = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        return;
      }
      const box = canvas.getBoundingClientRect();
      const clamp = (value: number) => Math.max(-1, Math.min(1, value / FOLLOW.reach));
      cursor.current = {
        x: clamp((event.clientX - (box.left + box.width / 2)) / (box.width / 2)),
        // The eyes sit above the middle of the canvas.
        y: clamp(-(event.clientY - (box.top + box.height * 0.4)) / (box.width / 2)),
        at: performance.now() / 1000,
      };
    };
    window.addEventListener("pointermove", track);
    return () => window.removeEventListener("pointermove", track);
  }, [canvas]);

  // The eyes: where they are looking and when they next move, and the same for blinking.
  const eyes = useRef({ gazeX: 0, gazeY: 0, nextGlance: 0, blinkAt: performance.now() / 1000 + 4, blinkUntil: 0 });

  useFrame(({ size, gl }, delta) => {
    const dt = Math.min(delta, 0.05);
    const { state, formed, audioLevel } = live.current;
    const target = stateConfig[state];
    const u = uniforms;
    const p = pose.current;
    p.time += dt * pace;

    u.uTime.value = p.time;
    u.uScale.value = size.height * gl.getPixelRatio() * 0.03;
    // At a steady pace rather than eased: the face gathering, stage by
    // stage, is the point of the scene.
    u.uForm.value = formed
      ? Math.min(1, u.uForm.value + dt / FORM_SECONDS)
      : Math.max(0, u.uForm.value - dt / DISSOLVE_SECONDS);
    u.uStability.value = ease(u.uStability.value, target.stability, 1.5, dt);
    u.uEdgeLoss.value = ease(u.uEdgeLoss.value, target.edgeLoss, 1.5, dt);
    u.uListen.value = ease(u.uListen.value, target.listen, 3, dt);
    u.uThink.value = ease(u.uThink.value, target.think, 1.6, dt);
    u.uAnswer.value = ease(u.uAnswer.value, target.answer, 3, dt);
    u.uEyeGlow.value = ease(u.uEyeGlow.value, target.eyeGlow, 3, dt);

    const heard = audioLevel?.() ?? null;
    const syllables = 0.3 + 0.7 * Math.abs(Math.sin(p.time * 9) * Math.sin(p.time * 3.3 + 1));
    u.uAudio.value = ease(u.uAudio.value, heard ?? syllables, 14, dt);

    // Eyes: every few seconds they glance somewhere else, quickly, the way
    // eyes move; while thinking they look up. They blink every few seconds too.
    const e = eyes.current;
    const now = performance.now() / 1000;
    // At rest, with a mouse that moved lately, TURA watches the cursor.
    const following = state === "idle" && now - cursor.current.at < FOLLOW.seconds;
    if (following) {
      e.gazeX = cursor.current.x * cloudMeta.irisRadius * 0.5;
      e.gazeY = cursor.current.y * cloudMeta.irisRadius * 0.3;
      e.nextGlance = p.time + 1;
    } else if (p.time > e.nextGlance) {
      const reach = cloudMeta.irisRadius * 0.42 * target.gaze;
      e.gazeX = (Math.random() * 2 - 1) * reach;
      e.gazeY = (Math.random() * 2 - 1) * reach * 0.4 + (state === "thinking" ? reach * 0.45 : 0);
      e.nextGlance = p.time + 1.2 + Math.random() * 2.6;
    }
    u.uGaze.value.set(ease(u.uGaze.value.x, e.gazeX, 12, dt), ease(u.uGaze.value.y, e.gazeY, 12, dt));
    u.uPupil.value = ease(u.uPupil.value, target.pupil + 0.06 * Math.sin(p.time * 0.9), 4, dt);
    // Timed by the clock, not by the scene: a blink has to stay brief even
    // when the device is drawing slowly.
    if (now > e.blinkAt) {
      e.blinkUntil = now + 0.15;
      e.blinkAt = now + 2.5 + Math.random() * 4;
    }
    u.uBlink.value = now < e.blinkUntil ? 1 : ease(u.uBlink.value, 0, 30, dt);

    // The head turns after the eyes, and more slowly, as a head does.
    const sway = target.sway * Math.sin(p.time * target.swaySpeed);
    const yaw = following ? cursor.current.x * FOLLOW.yaw + 0.3 * sway : sway;
    const pitch = following ? -cursor.current.y * FOLLOW.pitch : target.pitch;
    p.yaw = ease(p.yaw, yaw, following ? 3 : 1.4, dt);
    p.pitch = ease(p.pitch, pitch + 0.02 * Math.sin(p.time * 0.6), following ? 3 : 1.4, dt);
    p.rotation.set(p.pitch, p.yaw, 0);
    u.uTurn.value.setFromMatrix4(p.turn.makeRotationFromEuler(p.rotation));
  });

  return (
    // The shader moves every point, so the bounds three.js would cull by are meaningless.
    <points geometry={geometry} material={material} frustumCulled={false} />
  );
}

/**
 * TURA as a field of particles that gathers into a face. There is one cloud:
 * the same particles float in the field, converge to draw the head, keep
 * moving once they are there and drift back out, so the face is never a
 * separate object placed on top of a background.
 *
 * The face itself comes from a real head mesh, baked ahead of time into a
 * cloud of points (scripts/bake-face.mjs); the mesh is never loaded here.
 */
export function HologramAssistant({ state, formed = true, audioLevel }: HologramAssistantProps) {
  const shared = useAIState();
  // Read by the render loop on every frame, so a change of props never
  // rebuilds the scene.
  const live = useRef<Live>({ state: state ?? shared, formed, audioLevel });
  live.current = { state: state ?? shared, formed, audioLevel };

  const [cloud, setCloud] = useState<Cloud | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(cloudUrl)
      .then((response) => response.arrayBuffer())
      .then((buffer) => {
        if (!cancelled) {
          setCloud(readCloud(buffer));
        }
      })
      // Without the cloud there is no hologram; the screen works without it.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      role="img"
      aria-label="TURA"
      // Credit required by the licence of the head scan the face is made from.
      title={cloudMeta.attribution}
      style={HOLOGRAM_SIZE}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
        camera={{ fov: CAMERA.fov, near: 0.1, far: 30, position: [0, CAMERA.y, CAMERA.distance] }}
        onCreated={({ camera }) => camera.lookAt(0, CAMERA.y, 0)}
      >
        {cloud && <Particles cloud={cloud} live={live} />}
      </Canvas>
    </div>
  );
}
