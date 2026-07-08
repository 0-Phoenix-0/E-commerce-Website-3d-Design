'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import ThreeDToolbar from './ThreeDToolbar';
import ThreeDPlaceholder from './ThreeDPlaceholder';
import ThreeDLoading from './ThreeDLoading';

interface Props {
  modelUrl: string | null;
  previewImage?: string | null;
}

export default function ThreeDViewer({ modelUrl, previewImage }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Viewer State variables
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Controls State variables
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [bgColor, setBgColor] = useState('#f3f4f6');
  const [lightIntensity, setLightIntensity] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Group | THREE.Object3D | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);

  // If no modelUrl, render the placeholder
  if (!modelUrl) {
    return <ThreeDPlaceholder message="This product does not have a 3D model available yet." />;
  }

  // Handle Resize
  useEffect(() => {
    if (!rendererRef.current || !cameraRef.current || !containerRef.current) return;

    const handleResize = () => {
      if (!rendererRef.current || !cameraRef.current || !containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [loading]);

  // Handle Fullscreen Event Changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Initialize ThreeJS Scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 600;
    const height = containerRef.current.clientHeight || 450;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bgColor);
    sceneRef.current = scene;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(5, 5, 5);
    cameraRef.current = camera;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      preserveDrawingBuffer: true, // required for screenshot functionality
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // 4. Controls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 1.8; // Prevent going underground
    controls.minDistance = 1;
    controls.maxDistance = 50;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 2.0;
    controlsRef.current = controls;

    // 5. Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, lightIntensity * 0.4);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const dirLight = new THREE.DirectionalLight(0xffffff, lightIntensity * 0.8);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.0001;
    scene.add(dirLight);
    dirLightRef.current = dirLight;

    // Add secondary fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 3, -5);
    scene.add(fillLight);

    // 6. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // 7. Load GLB Model
    setLoading(true);
    setLoadError(null);
    setLoadProgress(0);

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        // Success
        const model = gltf.scene;
        modelRef.current = model;

        // Enable shadows on model children
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.wireframe = wireframe;
            }
          }
        });

        // Compute Bounding Box to center and scale
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Center model origin
        model.position.x += model.position.x - center.x;
        model.position.y += model.position.y - center.y;
        model.position.z += model.position.z - center.z;

        scene.add(model);

        // Position camera to fit the bounding sphere perfectly
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraDistance *= 1.4; // zoom out buffer

        camera.position.set(cameraDistance * 0.8, cameraDistance * 0.6, cameraDistance);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();

        setLoading(false);
      },
      (xhr) => {
        // Progress
        if (xhr.total > 0) {
          setLoadProgress((xhr.loaded / xhr.total) * 100);
        } else {
          // Fake progress if content-length is missing
          setLoadProgress((prev) => Math.min(prev + 5, 95));
        }
      },
      (error) => {
        // Error
        console.error('An error happened loading 3D model:', error);
        setLoadError('Failed to load 3D GLB model file.');
        setLoading(false);
      }
    );

    // Clean up
    return () => {
      cancelAnimationFrame(animationFrameId);
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      scene.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl]);

  // Effect: Wireframe Toggle
  useEffect(() => {
    if (modelRef.current) {
      modelRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => (m.wireframe = wireframe));
          } else {
            child.material.wireframe = wireframe;
          }
        }
      });
    }
  }, [wireframe]);

  // Effect: Auto Rotate Toggle
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Effect: Background Color Change
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(bgColor);
    }
  }, [bgColor]);

  // Effect: Light Intensity Change
  useEffect(() => {
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = lightIntensity * 0.4;
    }
    if (dirLightRef.current) {
      dirLightRef.current.intensity = lightIntensity * 0.8;
    }
  }, [lightIntensity]);

  // Handler: Reset Camera
  const handleResetCamera = () => {
    if (!cameraRef.current || !controlsRef.current || !modelRef.current) return;

    const box = new THREE.Box3().setFromObject(modelRef.current);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cameraRef.current.fov * (Math.PI / 180);
    let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.4;

    cameraRef.current.position.set(cameraDistance * 0.8, cameraDistance * 0.6, cameraDistance);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  // Handler: Take Screenshot
  const handleScreenshot = () => {
    if (!rendererRef.current) return;
    try {
      const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `3d_product_screenshot_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Failed to take 3D model screenshot:', e);
    }
  };

  // Handler: Toggle Fullscreen
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative rounded-3xl overflow-hidden border border-gray-150 bg-gray-50 flex flex-col justify-center items-center select-none ${
        isFullscreen ? 'w-screen h-screen' : 'w-full aspect-[4/3] min-h-[350px]'
      }`}
    >
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-gray-50 z-30 flex items-center justify-center">
          <ThreeDLoading progress={loadProgress} />
        </div>
      )}

      {/* Error Overlay */}
      {loadError && (
        <div className="absolute inset-0 bg-red-50/95 z-30 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-12 h-12 rounded-xl bg-white border border-red-100 flex items-center justify-center text-red-500 mb-3 shadow-sm">
            <svg className="w-6 h-6 stroke-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h4 className="text-sm font-semibold text-red-800 mb-1">Failed to Render 3D Model</h4>
          <p className="text-xs text-red-650/80 max-w-xs mb-4">{loadError}</p>
        </div>
      )}

      {/* Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block outline-none touch-none" />

      {/* Toolbar Controls Overlay */}
      {!loading && !loadError && (
        <ThreeDToolbar
          wireframe={wireframe}
          onToggleWireframe={() => setWireframe(!wireframe)}
          autoRotate={autoRotate}
          onToggleAutoRotate={() => setAutoRotate(!autoRotate)}
          bgColor={bgColor}
          onChangeBgColor={setBgColor}
          lightIntensity={lightIntensity}
          onChangeLightIntensity={setLightIntensity}
          onResetCamera={handleResetCamera}
          onScreenshot={handleScreenshot}
          onToggleFullscreen={handleToggleFullscreen}
          isFullscreen={isFullscreen}
        />
      )}
    </div>
  );
}
