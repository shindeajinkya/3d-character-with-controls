import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import gsap from "gsap";

const arrowKeysToWASDMap: Record<string, string> = {
  ArrowUp: "w",
  ArrowDown: "s",
  ArrowRight: "d",
  ArrowLeft: "a",
};

const arrowKeys = Object.keys(arrowKeysToWASDMap);

// Loaders
const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

// Canvas
const canvas = document.querySelector<HTMLElement>("canvas.webgl");
const infoButton1 = document.querySelector<HTMLElement>("#info-button-1");
const controlButtons = document.querySelectorAll(".control-button");
if (!canvas) throw new Error("canvas not found");

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

window.addEventListener("resize", () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Scene
const scene = new THREE.Scene();

const movingSpeed = 0.012;
let foxModel: THREE.Group | null = null;
let mixer: THREE.AnimationMixer | null = null;
let idleAnimation: THREE.AnimationAction | null = null;
let walkAnimation: THREE.AnimationAction | null = null;
let movingOnZ: number | null = null;
let movingOnX: number | null = null;

// Loading Models

gltfLoader.load("/Fox/glTF/Fox.gltf", (gltf) => {
  mixer = new THREE.AnimationMixer(gltf.scene);
  idleAnimation = mixer.clipAction(gltf.animations[0]);
  walkAnimation = mixer.clipAction(gltf.animations[1]);

  idleAnimation.play();

  gltf.scene.scale.set(0.025, 0.025, 0.025);
  scene.add(gltf.scene);
  foxModel = gltf.scene;
  foxModel.traverse((child: any) => {
    if (child.isMesh && child.material.isMeshStandardMaterial) {
      child.castShadow = true;
      // child.receiveShadow = true;
    }
  });
  foxModel.position.y -= 1;
  controls.target = foxModel.position.add(new THREE.Vector3(0, 1, 0));
});

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  1000
);

camera.position.set(0, 2, -5);

// Floor textures
const dirtNormalTexture = textureLoader.load("/textures/dirt/normal.jpg");
const dirtColorTexture = textureLoader.load("/textures/dirt/color.jpg");

// Environment Map
const environmentMap = textureLoader.load("/rainforest_trail_1k.jpg");

environmentMap.mapping = THREE.EquirectangularReflectionMapping;
environmentMap.colorSpace = THREE.SRGBColorSpace;

scene.background = environmentMap;
scene.environment = environmentMap;

// texture settings
dirtColorTexture.colorSpace = THREE.SRGBColorSpace;
dirtColorTexture.repeat.set(1.5, 1.5);
dirtColorTexture.wrapS = THREE.RepeatWrapping;
dirtColorTexture.wrapT = THREE.RepeatWrapping;

dirtNormalTexture.repeat.set(1.5, 1.5);
dirtNormalTexture.wrapS = THREE.RepeatWrapping;
dirtNormalTexture.wrapT = THREE.RepeatWrapping;

// Floor
const floorGeometry = new THREE.PlaneGeometry(20, 20);
const floorMaterial = new THREE.MeshStandardMaterial({
  normalMap: dirtNormalTexture,
  map: dirtColorTexture,
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI * 0.5;
floor.receiveShadow = true;

scene.add(floor);

// test cube
const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff });
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube.position.set(3, 0.5, 3);
cube.castShadow = true;
scene.add(cube);

// Lights
const light = new THREE.AmbientLight(0xffffff, 2);
scene.add(light);

const directionalLight = new THREE.DirectionalLight(0xffff0f, 4);
directionalLight.castShadow = true;
directionalLight.position.set(3, 4, 5);
directionalLight.shadow.mapSize.set(1024, 1024);
directionalLight.shadow.camera.far = 15;
directionalLight.shadow.camera.left = -7;
directionalLight.shadow.camera.top = 7;
directionalLight.shadow.camera.right = 7;
directionalLight.shadow.camera.bottom = -7;
scene.add(directionalLight);

// Shadow camera helper
// const cameraHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
// scene.add(cameraHelper);

// const lightHelper = new THREE.DirectionalLightHelper(directionalLight);
// scene.add(lightHelper);

// Orbit Controls
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.75, 0);
controls.enableDamping = true;
controls.enabled = false;

// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas: canvas ?? undefined,
  antialias: true,
});
// renderer.autoClearColor = false;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Handling WASD key controls
document.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  const key = arrowKeys.includes(event.key)
    ? arrowKeysToWASDMap[event.key]
    : event.key.toLowerCase();
  startWalking(key);
});

document.addEventListener("keyup", (event) => {
  if (event.repeat) return;
  const key = arrowKeys.includes(event.key)
    ? arrowKeysToWASDMap[event.key]
    : event.key.toLowerCase();
  stopWalking(key);
});

// Handling button controls for mobile
controlButtons.forEach((button) => {
  button.addEventListener("touchstart", (event) => {
    const id = (event.target as HTMLElement).id;
    startWalking(id);
  });

  button.addEventListener("touchend", (event) => {
    const id = (event.target as HTMLElement).id;
    stopWalking(id);
  });
});

// Handling animations
const clock = new THREE.Clock();
let previousTime = 0;
function animate() {
  requestAnimationFrame(animate);

  const elapsedTime = clock.getElapsedTime();
  const deltaTime = elapsedTime - previousTime;
  previousTime = elapsedTime;

  // Update button position based on cube
  const screenPosition = cube.position.clone();
  screenPosition.project(camera);

  const translateX = screenPosition.x * sizes.width * 0.5;
  const translateY = -screenPosition.y * sizes.height * 0.5;
  // infoButton1 &&
  //   (infoButton1.style.transform = `translateX(${translateX}px) translateY(${translateY}px)`);

  // updating model position
  if (foxModel) {
    const difference = foxModel.position.clone().sub(cube.position);
    if (Math.abs(difference.x) < 3 && Math.abs(difference.z) < 3) {
      infoButton1?.classList.add("visible");
      infoButton1 &&
        (infoButton1.style.transform = `translateX(${translateX}px) translateY(${translateY}px)`);
    } else {
      infoButton1 && (infoButton1.style.transform = `scale(0, 0)`);
      infoButton1?.classList.remove("visible");
    }

    if (movingOnZ) {
      foxModel.position.z += movingOnZ;
      camera.position.z += movingOnZ;
    }
    if (movingOnX) {
      foxModel.position.x += movingOnX;
      camera.position.x += movingOnX;
    }
    camera.lookAt(foxModel as any);
    controls.target = foxModel.position;
  }

  // making the camera follow the model in a TPS view

  // Update mixer
  mixer?.update(deltaTime);

  // update controls
  controls.update();

  // Update renderer
  renderer.render(scene, camera);
}
animate();

function startWalking(key: string) {
  const isMovingForward = key === "w";
  const isMovingRight = key === "d";
  const isMovingLeft = key === "a";
  const isMovingBackward = key === "s";

  if (
    (!isMovingBackward &&
      !isMovingForward &&
      !isMovingLeft &&
      !isMovingRight) ||
    !foxModel
  )
    return;
  movingOnZ = isMovingForward
    ? movingSpeed
    : isMovingBackward
    ? -movingSpeed
    : null;
  movingOnX = isMovingRight ? -movingSpeed : isMovingLeft ? movingSpeed : null;

  if (!isMovingForward) {
    const yRotation = isMovingLeft
      ? Math.PI * 0.5
      : isMovingRight
      ? -Math.PI * 0.5
      : Math.PI;

    gsap.to(foxModel.rotation, {
      duration: 0.5,
      y: yRotation,
    });
  }

  idleAnimation?.stop();
  walkAnimation?.reset();
  walkAnimation?.play();
  idleAnimation && walkAnimation?.crossFadeFrom(idleAnimation, 0.5, true);
}

function stopWalking(key: string) {
  const wasMovingForward = key === "w";
  const wasMovingRight = key === "d";
  const wasMovingLeft = key === "a";
  const wasMovingBackward = key === "s";

  if (
    (!wasMovingBackward &&
      !wasMovingForward &&
      !wasMovingLeft &&
      !wasMovingRight) ||
    !foxModel
  )
    return;

  movingOnX = null;
  movingOnZ = null;

  if (!wasMovingForward) {
    gsap.to(foxModel.rotation, {
      duration: 0.5,
      y: 0,
    });
  }

  walkAnimation?.stop();
  idleAnimation?.reset();
  idleAnimation?.play();
  walkAnimation && idleAnimation?.crossFadeFrom(walkAnimation, 0.5, true);
}
