import * as THREE from 'three';

export enum AppMode {
  TREE = 'TREE',
  SCATTER = 'SCATTER',
  FOCUS = 'FOCUS',
}

export interface ParticleData {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  type: 'DECORATION' | 'DUST' | 'PHOTO';
  initialPos: THREE.Vector3;
}

export type ImageSize = '1K' | '2K' | '4K';

export interface GeneratedImage {
  url: string;
  prompt: string;
}

export interface HandLandmarkerResult {
  landmarks: number[][][];
  worldLandmarks: number[][][];
  handedness: any[];
}
