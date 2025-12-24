import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { AppMode, ParticleData } from '../types';

interface ExperienceProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  newPhoto: string | null; // URL of new photo to add
  onPhotoAdded: () => void; // Callback to clear new photo queue
}

export const Experience: React.FC<ExperienceProps> = ({ mode, setMode, newPhoto, onPhotoAdded }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Refs for Three.js objects to access them in closures/loops without re-renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const particlesRef = useRef<ParticleData[]>([]);
  const mainGroupRef = useRef<THREE.Group | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);

  // State
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize Three.js
  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 50);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 2.2;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    // Post-processing
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.strength = 0.45;
    bloomPass.radius = 0.4;
    bloomPass.threshold = 0.7;

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composerRef.current = composer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffaa00, 2, 50);
    scene.add(pointLight);

    const spotLight = new THREE.SpotLight(0xd4af37, 1200);
    spotLight.position.set(30, 40, 40);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.5;
    scene.add(spotLight);

    const backLight = new THREE.SpotLight(0x4444ff, 600);
    backLight.position.set(-30, 20, -30);
    scene.add(backLight);

    // Main Group for Rotation
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);
    mainGroupRef.current = mainGroup;

    // Helper: Create Candy Cane Texture
    const createCandyTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#ff0000';
        for (let i = -64; i < 64; i += 16) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + 16, 64);
          ctx.lineTo(i + 8, 64);
          ctx.lineTo(i - 8, 0);
          ctx.fill();
        }
      }
      return new THREE.CanvasTexture(canvas);
    };

    // Geometries & Materials
    const boxGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const sphereGeo = new THREE.SphereGeometry(0.3, 16, 16);
    
    // Candy Cane Shape
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.5, 0),
      new THREE.Vector3(0, 0.5, 0),
      new THREE.Vector3(0.3, 0.8, 0)
    ]);
    const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.1, 8, false);

    const matGold = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.8 });
    const matGreen = new THREE.MeshStandardMaterial({ color: 0x004400, roughness: 0.7 });
    const matRed = new THREE.MeshPhysicalMaterial({ color: 0xaa0000, roughness: 0.2, clearcoat: 1.0 });
    const matCandy = new THREE.MeshStandardMaterial({ map: createCandyTexture() });

    // Initial Photo
    const photoCanvas = document.createElement('canvas');
    photoCanvas.width = 512;
    photoCanvas.height = 512;
    const pCtx = photoCanvas.getContext('2d');
    if (pCtx) {
        pCtx.fillStyle = '#fceea7';
        pCtx.fillRect(0,0,512,512);
        pCtx.fillStyle = '#d4af37';
        pCtx.font = 'bold 60px Times New Roman';
        pCtx.textAlign = 'center';
        pCtx.fillText("JOYEUX", 256, 220);
        pCtx.fillText("NOEL", 256, 300);
    }
    const initialPhotoTex = new THREE.CanvasTexture(photoCanvas);
    initialPhotoTex.colorSpace = THREE.SRGBColorSpace;

    const addParticle = (type: 'DECORATION' | 'DUST' | 'PHOTO', texture?: THREE.Texture) => {
       let mesh: THREE.Mesh;
       
       if (type === 'PHOTO' && texture) {
           const frameGeo = new THREE.BoxGeometry(3, 3, 0.2);
           const mats = [
               matGold, matGold, matGold, matGold,
               new THREE.MeshBasicMaterial({ map: texture }), // Front
               matGold // Back
           ];
           mesh = new THREE.Mesh(frameGeo, mats);
       } else if (type === 'DUST') {
           mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), matGold);
       } else {
           const rand = Math.random();
           if (rand < 0.3) mesh = new THREE.Mesh(boxGeo, Math.random() > 0.5 ? matGold : matGreen);
           else if (rand < 0.6) mesh = new THREE.Mesh(sphereGeo, matRed);
           else mesh = new THREE.Mesh(tubeGeo, matCandy);
       }

       mainGroup.add(mesh);
       
       // Initial random position
       mesh.position.set(
           (Math.random() - 0.5) * 50,
           (Math.random() - 0.5) * 50,
           (Math.random() - 0.5) * 50
       );

       particlesRef.current.push({
           mesh,
           velocity: new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).multiplyScalar(0.05),
           type,
           initialPos: mesh.position.clone()
       });
    };

    // Create Particles
    // 1500 Decorations
    for(let i=0; i<1500; i++) addParticle('DECORATION');
    // 2500 Dust
    for(let i=0; i<2500; i++) addParticle('DUST');
    // 1 Photo
    addParticle('PHOTO', initialPhotoTex);

    // Resize Handler
    const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Initialization complete
    setIsLoaded(true);

    return () => {
        window.removeEventListener('resize', handleResize);
        containerRef.current?.removeChild(renderer.domElement);
    };
  }, []);


  // 2. Handle New Photos
  useEffect(() => {
    if (newPhoto && mainGroupRef.current) {
        new THREE.TextureLoader().load(newPhoto, (t) => {
            t.colorSpace = THREE.SRGBColorSpace;
            
            // Replicate addParticle logic locally
            const frameGeo = new THREE.BoxGeometry(3, 3, 0.2);
            const matGold = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.8 });
             const mats = [
               matGold, matGold, matGold, matGold,
               new THREE.MeshBasicMaterial({ map: t }), // Front
               matGold // Back
           ];
           const mesh = new THREE.Mesh(frameGeo, mats);
           mainGroupRef.current?.add(mesh);
           
           particlesRef.current.push({
               mesh,
               velocity: new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).multiplyScalar(0.05),
               type: 'PHOTO',
               initialPos: mesh.position.clone()
           });
           
           onPhotoAdded();
        });
    }
  }, [newPhoto, onPhotoAdded]);


  // 3. MediaPipe Setup
  useEffect(() => {
    const initMediaPipe = async () => {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
        });

        // Start Webcam
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && videoRef.current) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                videoRef.current.srcObject = stream;
                videoRef.current.addEventListener("loadeddata", () => {
                    videoRef.current?.play();
                });
            } catch (err) {
                console.error("Webcam access denied", err);
            }
        }
    };
    initMediaPipe();
  }, []);

  // 4. Animation Loop
  // We use a ref to track the current mode to avoid re-creating the loop on state change
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
      let lastTime = 0;
      let focusTarget: THREE.Object3D | null = null;

      const animate = (time: number) => {
          const delta = (time - lastTime) / 1000;
          lastTime = time;
          const currentMode = modeRef.current;

          // CV Detection
          if (landmarkerRef.current && videoRef.current && videoRef.current.currentTime > 0) {
              const result = landmarkerRef.current.detectForVideo(videoRef.current, time);
              
              if (result.landmarks && result.landmarks.length > 0) {
                  const lm = result.landmarks[0];
                  // Control Rotation
                  const palm = lm[9];
                  if (mainGroupRef.current) {
                      // Map 0..1 to -PI..PI range approximately
                      const targetRotY = (palm.x - 0.5) * 2; 
                      const targetRotX = (palm.y - 0.5) * 2;
                      mainGroupRef.current.rotation.y = THREE.MathUtils.lerp(mainGroupRef.current.rotation.y, targetRotY, 0.1);
                      mainGroupRef.current.rotation.x = THREE.MathUtils.lerp(mainGroupRef.current.rotation.x, targetRotX, 0.1);
                  }

                  // Gestures
                  const thumb = new THREE.Vector3(lm[4].x, lm[4].y, lm[4].z);
                  const index = new THREE.Vector3(lm[8].x, lm[8].y, lm[8].z);
                  const wrist = new THREE.Vector3(lm[0].x, lm[0].y, lm[0].z);
                  const tips = [12, 16, 20].map(i => new THREE.Vector3(lm[i].x, lm[i].y, lm[i].z));
                  
                  // Pinch
                  if (thumb.distanceTo(index) < 0.05) {
                      if (currentMode !== AppMode.FOCUS) setMode(AppMode.FOCUS);
                  }
                  
                  // Average distance from tips to wrist
                  const avgDist = tips.reduce((acc, t) => acc + t.distanceTo(wrist), 0) / tips.length;

                  // Fist
                  if (avgDist < 0.25) {
                      if (currentMode !== AppMode.TREE) setMode(AppMode.TREE);
                  } 
                  // Open Hand
                  else if (avgDist > 0.4) {
                      if (currentMode !== AppMode.SCATTER) setMode(AppMode.SCATTER);
                  }
              }
          }

          // Particle Logic
          const particleCount = particlesRef.current.length;
          
          // Select random target for focus mode if none
          if (currentMode === AppMode.FOCUS && !focusTarget) {
               const photos = particlesRef.current.filter(p => p.type === 'PHOTO');
               if (photos.length > 0) {
                   focusTarget = photos[Math.floor(Math.random() * photos.length)].mesh;
               }
          }
          if (currentMode !== AppMode.FOCUS) focusTarget = null;

          for (let i = 0; i < particleCount; i++) {
              const p = particlesRef.current[i];
              let targetPos = new THREE.Vector3();

              if (currentMode === AppMode.TREE) {
                  // Cone Spiral
                  const t = i / particleCount;
                  const angle = t * 50 * Math.PI;
                  const height = (t - 0.5) * 40; // -20 to 20
                  const maxRadius = 15;
                  const radius = maxRadius * (1 - t);
                  
                  targetPos.set(
                      Math.cos(angle) * radius,
                      height,
                      Math.sin(angle) * radius
                  );
              } else if (currentMode === AppMode.SCATTER) {
                  // Keep current flow or random orbit
                  // For Scatter, we use physics-like drift + boundary constraint
                  p.mesh.rotation.x += p.velocity.x;
                  p.mesh.rotation.y += p.velocity.y;
                  
                  // Use initialPos as an anchor but drift
                  targetPos.copy(p.initialPos).addScaledVector(p.velocity, Math.sin(time * 0.001) * 20);
                  
                  // Clamp to sphere shell 8-20
                  if (targetPos.length() < 8) targetPos.setLength(8);
                  if (targetPos.length() > 20) targetPos.setLength(20);
              } else if (currentMode === AppMode.FOCUS) {
                  if (p.mesh === focusTarget) {
                      targetPos.set(0, 0, 35); // Front of camera
                      p.mesh.scale.lerp(new THREE.Vector3(4.5, 4.5, 4.5), 0.05);
                      p.mesh.lookAt(cameraRef.current!.position);
                  } else {
                      // Background noise
                      targetPos.copy(p.initialPos).multiplyScalar(1.5);
                      p.mesh.scale.lerp(new THREE.Vector3(1,1,1), 0.05);
                  }
              }

              // Apply Position
              if (currentMode !== AppMode.SCATTER) {
                   p.mesh.position.lerp(targetPos, 0.05);
                   p.mesh.rotation.y += 0.01;
              } else {
                  // In scatter, we just lerp loosely to the computed drifting target
                  p.mesh.position.lerp(targetPos, 0.02);
              }
              
              // Reset scale if not focused
              if (currentMode !== AppMode.FOCUS || p.mesh !== focusTarget) {
                   p.mesh.scale.lerp(new THREE.Vector3(1,1,1), 0.1);
              }
          }

          if (composerRef.current) composerRef.current.render();
          requestRef.current = requestAnimationFrame(animate);
      };

      requestRef.current = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(requestRef.current);
  }, [setMode]); // We don't depend on mode state directly, we use modeRef

  return (
    <>
        <div ref={containerRef} className="absolute inset-0 z-0" />
        {/* Hidden CV Video */}
        <div className="absolute bottom-0 right-0 opacity-0 pointer-events-none">
            <video ref={videoRef} autoPlay playsInline muted width="320" height="240"></video>
        </div>
        
        {/* Loading Screen */}
        {!isLoaded && (
            <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center transition-opacity duration-1000">
                <div className="w-10 h-10 border-4 border-transparent border-t-[#d4af37] rounded-full animate-spin mb-4"></div>
                <div className="text-[#d4af37] font-cinzel tracking-widest text-sm">LOADING HOLIDAY MAGIC</div>
            </div>
        )}
    </>
  );
};
