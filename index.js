import * as THREE from "three";
import { OrbitControls } from 'jsm/controls/OrbitControls.js';
import { OBJLoader } from "jsm/loaders/OBJLoader.js";
import { EffectComposer } from 'jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'jsm/shaders/FXAAShader.js';
import getSun from "./src/getSun.js";
import getNebula from "./src/getNebula.js";
import getStarfield from "./src/getStarfield.js";
import getPlanet from "./src/getPlanet.js";
import getAsteroidBelt from "./src/getAsteroidBelt.js";
import getElipticLines, { getRing } from "./src/getElipticLines.js";

// Global variables
const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, w / h, 0.01, 1000);
camera.position.set(0, 20, 0); // Top-down view
camera.lookAt(0, 0, 0);

// Enhanced renderer with better settings
const renderer = new THREE.WebGLRenderer({ 
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setSize(w, h);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Post-processing setup
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Bloom effect
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(w, h),
  0.5,  // strength
  0.4,  // radius
  0.85  // threshold
);
composer.addPass(bloomPass);

// Anti-aliasing
const fxaaPass = new ShaderPass(FXAAShader);
fxaaPass.material.uniforms['resolution'].value.x = 1 / (w * renderer.getPixelRatio());
fxaaPass.material.uniforms['resolution'].value.y = 1 / (h * renderer.getPixelRatio());
composer.addPass(fxaaPass);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.03;
controls.maxDistance = 40;
controls.minDistance = 0.2;
controls.enableRotate = true; // Allow rotation
controls.enablePan = true;
controls.enableZoom = true;

// State management
const state = {
  cameraMode: 'auto', // 'auto', 'manual', 'follow'
  bloomEnabled: true,
  atmosphereEnabled: true,
  particlesEnabled: true,
  audioEnabled: false,
  speedMultiplier: 1.0,
  selectedPlanet: null,
  planets: {},
  raycaster: new THREE.Raycaster(),
  mouse: new THREE.Vector2()
};

// Audio context
let audioContext, audioSource;
function initAudio() {
  if (state.audioEnabled) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    // Create ambient space sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(60, audioContext.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.01, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 2);
    
    oscillator.start();
    audioSource = { oscillator, gainNode };
  }
}

// UI Controls
function setupUI() {
  // Camera mode buttons
  document.getElementById('auto-camera').addEventListener('click', () => {
    setCameraMode('auto');
    updateButtonStates();
  });
  
  document.getElementById('manual-camera').addEventListener('click', () => {
    setCameraMode('manual');
    updateButtonStates();
  });
  
  document.getElementById('planet-follow').addEventListener('click', () => {
    setCameraMode('follow');
    updateButtonStates();
  });
  
  // Effect toggles
  document.getElementById('toggle-bloom').addEventListener('click', () => {
    state.bloomEnabled = !state.bloomEnabled;
    bloomPass.enabled = state.bloomEnabled;
    document.getElementById('toggle-bloom').textContent = `Bloom: ${state.bloomEnabled ? 'ON' : 'OFF'}`;
  });
  
  document.getElementById('toggle-atmosphere').addEventListener('click', () => {
    state.atmosphereEnabled = !state.atmosphereEnabled;
    document.getElementById('toggle-atmosphere').textContent = `Atmosphere: ${state.atmosphereEnabled ? 'ON' : 'OFF'}`;
    // Actually show/hide atmospheres robustly
    Object.values(state.planets).forEach(planetGroup => {
      if (planetGroup && planetGroup.traverse) {
        planetGroup.traverse(obj => {
          if (obj.material && obj.material.transparent && obj.material.side === THREE.BackSide) {
            obj.visible = state.atmosphereEnabled;
          }
        });
      }
    });
  });
  
  document.getElementById('toggle-particles').addEventListener('click', () => {
    state.particlesEnabled = !state.particlesEnabled;
    document.getElementById('toggle-particles').textContent = `Particles: ${state.particlesEnabled ? 'ON' : 'OFF'}`;
    if (globalParticleSystem) globalParticleSystem.visible = state.particlesEnabled;
    if (globalStarfield) globalStarfield.visible = state.particlesEnabled;
  });
  
  document.getElementById('toggle-audio').addEventListener('click', () => {
    state.audioEnabled = !state.audioEnabled;
    document.getElementById('toggle-audio').textContent = `Audio: ${state.audioEnabled ? 'ON' : 'OFF'}`;
    if (state.audioEnabled) {
      initAudio();
    } else {
      // Stop and clean up audio
      if (audioSource && audioSource.oscillator) {
        audioSource.oscillator.stop();
        audioSource.oscillator.disconnect();
      }
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
      audioSource = null;
    }
  });
  
  // Speed control
  const speedControl = document.getElementById('speed-control');
  const speedValue = document.getElementById('speed-value');
  speedControl.addEventListener('input', (e) => {
    state.speedMultiplier = parseFloat(e.target.value);
    speedValue.textContent = `${state.speedMultiplier.toFixed(1)}x`;
  });
  
  // Mouse events for planet selection
  renderer.domElement.addEventListener('click', onMouseClick);
  renderer.domElement.addEventListener('mousemove', onMouseMove);
}

function updateButtonStates() {
  document.getElementById('auto-camera').classList.toggle('active', state.cameraMode === 'auto');
  document.getElementById('manual-camera').classList.toggle('active', state.cameraMode === 'manual');
  document.getElementById('planet-follow').classList.toggle('active', state.cameraMode === 'follow');
}

function setCameraMode(mode) {
  state.cameraMode = mode;
  if (mode === 'auto') {
    camera.position.set(0, 20, 0);
    camera.lookAt(0, 0, 0);
  }
}

// Planet information
const planetData = {
  sun: { name: 'Sun', type: 'Star', diameter: '1,392,700 km', distance: '0 AU' },
  mercury: { name: 'Mercury', type: 'Terrestrial', diameter: '4,879 km', distance: '0.39 AU' },
  venus: { name: 'Venus', type: 'Terrestrial', diameter: '12,104 km', distance: '0.72 AU' },
  earth: { name: 'Earth', type: 'Terrestrial', diameter: '12,756 km', distance: '1 AU' },
  moon: { name: 'Moon', type: 'Natural Satellite', diameter: '3,474 km', distance: '0.00257 AU' },
  mars: { name: 'Mars', type: 'Terrestrial', diameter: '6,792 km', distance: '1.52 AU' },
  jupiter: { name: 'Jupiter', type: 'Gas Giant', diameter: '142,984 km', distance: '5.20 AU' },
  saturn: { name: 'Saturn', type: 'Gas Giant', diameter: '120,536 km', distance: '9.58 AU' },
  uranus: { name: 'Uranus', type: 'Ice Giant', diameter: '51,118 km', distance: '19.18 AU' },
  neptune: { name: 'Neptune', type: 'Ice Giant', diameter: '49,528 km', distance: '30.07 AU' }
};

function showPlanetInfo(planetName) {
  const infoPanel = document.getElementById('info-panel');
  const planetDetails = document.getElementById('planet-details');
  
  if (planetName && planetData[planetName]) {
    const data = planetData[planetName];
    planetDetails.innerHTML = `
      <div class="planet-info">
        <div class="planet-name">${data.name}</div>
        <div><strong>Diameter:</strong> ${data.diameter}</div>
        <div><strong>Distance from Sun:</strong> ${data.distance}</div>
      </div>
    `;
    infoPanel.style.display = 'block';
  } else {
    infoPanel.style.display = 'none';
  }
}

// Mouse interaction
function onMouseClick(event) {
  state.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  state.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  state.raycaster.setFromCamera(state.mouse, camera);
  const intersects = state.raycaster.intersectObjects(scene.children, true);
  
  // Only consider intersections with objects that have userData.planetName
  const planetIntersect = intersects.find(intersect => {
    let current = intersect.object;
    while (current) {
      if (current.userData.planetName) return true;
      current = current.parent;
    }
    return false;
  });

  if (planetIntersect) {
    // Find the planet name by traversing up the object tree
    let planetName = null;
    let current = planetIntersect.object;
    while (current && !planetName) {
      if (current.userData.planetName) {
        planetName = current.userData.planetName;
      }
      current = current.parent;
    }
    if (planetName) {
      state.selectedPlanet = planetName;
      showPlanetInfo(planetName);
      if (state.cameraMode === 'follow') {
        // Animate camera to follow the selected planet
        const planet = state.planets[planetName];
        if (planet) {
          const targetPosition = planet.getWorldPosition(new THREE.Vector3());
          targetPosition.multiplyScalar(1.5); // Distance from planet
          animateCameraTo(targetPosition);
        }
      }
    }
  }
}

function onMouseMove(event) {
  state.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  state.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  state.raycaster.setFromCamera(state.mouse, camera);
  const intersects = state.raycaster.intersectObjects(scene.children, true);

  // Only consider intersections with objects that have userData.planetName
  const planetIntersect = intersects.find(intersect => {
    let current = intersect.object;
    while (current) {
      if (current.userData.planetName) return true;
      current = current.parent;
    }
    return false;
  });

  if (planetIntersect) {
    // Find the planet name by traversing up the object tree
    let planetName = null;
    let current = planetIntersect.object;
    while (current && !planetName) {
      if (current.userData.planetName) {
        planetName = current.userData.planetName;
      }
      current = current.parent;
    }
    if (planetName) {
      showPlanetInfo(planetName);
      return;
    }
  }
  // If not hovering any planet, hide the info panel
  const infoPanel = document.getElementById('info-panel');
  if (infoPanel) infoPanel.style.display = 'none';
}

// Camera animation
function animateCameraTo(targetPosition) {
  const startPosition = camera.position.clone();
  const duration = 2000; // 2 seconds
  const startTime = Date.now();
  
  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
    
    camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }
  
  animate();
}

// Enhanced particle system
function createParticleSystem() {
  const particleCount = 1000;
  const particles = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  
  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    
    // Random positions in a sphere
    const radius = Math.random() * 50 + 10;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    
    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = radius * Math.cos(phi);
    
    // Random colors
    const color = new THREE.Color();
    color.setHSL(Math.random() * 0.1 + 0.6, 0.8, Math.random() * 0.5 + 0.5);
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
    
    sizes[i] = Math.random() * 2 + 0.5;
  }
  
  particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  particles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  
  const particleMaterial = new THREE.PointsMaterial({
    size: 0.1,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });
  
  const particleSystem = new THREE.Points(particles, particleMaterial);
  
  particleSystem.userData.update = (t) => {
    const positions = particles.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3 + 1] += Math.sin(t + i) * 0.001;
    }
    particles.attributes.position.needsUpdate = true;
  };
  
  return particleSystem;
}

function setPlanetNameRecursive(object, planetName) {
  if (!object) return;
  object.userData.planetName = planetName;
  if (object.children && object.children.length > 0) {
    object.children.forEach(child => setPlanetNameRecursive(child, planetName));
  }
}

// Store references to particle systems and starfield for toggling
let globalParticleSystem = null;
let globalStarfield = null;

function initScene(data) {
  const { objs } = data;
  const solarSystem = new THREE.Group();
  solarSystem.userData.update = (t) => {
    solarSystem.children.forEach((child) => {
      child.userData.update?.(t);
    });
  };
  scene.add(solarSystem);

  // Helper to add a planet and its orbit ring
  function addPlanetWithRing(planetObj, distance, planetName) {
    // Add orbit ring at the same radius as the planet
    const ring = getRing({ distance, width: 1.2 });
    solarSystem.add(ring);
    // Set planetName recursively on all children
    setPlanetNameRecursive(planetObj, planetName);
    solarSystem.add(planetObj);
  }

  // Enhanced sun with more dramatic effects
  const sun = getSun();
  setPlanetNameRecursive(sun, 'sun');
  solarSystem.add(sun);
  state.planets.sun = sun;

  // Planets with enhanced materials and effects
  const mercury = getPlanet({ 
    size: 0.1, 
    distance: 1.25, 
    img: 'mercury_color.jpg',
    normalMap: 'mercury_normal.jpg',
    planetName: 'mercury',
    atmosphere: false
  });
  addPlanetWithRing(mercury, 1.25, 'mercury');
  state.planets.mercury = mercury;

  const venus = getPlanet({ 
    size: 0.2, 
    distance: 1.65, 
    img: 'venus_color.jpg',
    normalMap: 'venus_normal.jpg',
    planetName: 'venus',
    atmosphere: true,
    atmosphereColor: 0xffaa44
  });
  addPlanetWithRing(venus, 1.65, 'venus');
  state.planets.venus = venus;

  const moon = getPlanet({ size: 0.075, distance: 0.4, img: 'moon_color.jpg', normalMap: 'moon_normal.jpg', planetName: 'moon' });
  const earth = getPlanet({ 
    children: [moon], 
    size: 0.225, 
    distance: 2.0, 
    img: 'earth_color.jpg',
    normalMap: 'earth_normal.jpg',
    specularMap: 'earth_specular.jpg',
    planetName: 'earth',
    atmosphere: true,
    atmosphereColor: 0x88aaff,
    cloudMap: 'earth_clouds.png'
  });
  addPlanetWithRing(earth, 2.0, 'earth');
  state.planets.earth = earth;
  state.planets.moon = moon;

  const mars = getPlanet({ 
    size: 0.15, 
    distance: 2.25, 
    img: 'mars_color.jpg',
    normalMap: 'mars_normal.jpg',
    planetName: 'mars',
    atmosphere: true,
    atmosphereColor: 0xff6644
  });
  addPlanetWithRing(mars, 2.25, 'mars');
  state.planets.mars = mars;

  const asteroidBelt = getAsteroidBelt(objs);
  solarSystem.add(asteroidBelt);

  const jupiter = getPlanet({ 
    size: 0.4, 
    distance: 2.75, 
    img: 'jupiter_color.jpg',
    planetName: 'jupiter',
    atmosphere: true,
    atmosphereColor: 0xffaa66,
    cloudMap: 'jupiter_clouds.png'
  });
  addPlanetWithRing(jupiter, 2.75, 'jupiter');
  state.planets.jupiter = jupiter;

  // Enhanced Saturn with realistic ring texture
  const saturn = getPlanet({ 
    size: 0.35, 
    distance: 3.25, 
    img: 'saturn_color.jpg',
    planetName: 'saturn',
    atmosphere: true,
    atmosphereColor: 0xffdd88,
    rings: [
      { innerRadius: 0.45, outerRadius: 0.85, texture: 'saturn_ring.png', opacity: 1.0 }
    ],
    cloudMap: 'saturn_clouds.png'
  });
  addPlanetWithRing(saturn, 3.25, 'saturn');
  state.planets.saturn = saturn;

  // Uranus with realistic ring texture
  const uranus = getPlanet({ 
    size: 0.3, 
    distance: 3.75, 
    img: 'uranus_color.jpg',
    planetName: 'uranus',
    atmosphere: true,
    atmosphereColor: 0x88aaff,
    rings: [
      { innerRadius: 0.35, outerRadius: 0.45, texture: 'uranus_ring.png', opacity: 0.7 }
    ]
  });
  addPlanetWithRing(uranus, 3.75, 'uranus');
  state.planets.uranus = uranus;

  const neptune = getPlanet({ 
    size: 0.3, 
    distance: 4.25, 
    img: 'neptune_color.jpg',
    planetName: 'neptune',
    atmosphere: true,
    atmosphereColor: 0x4488ff
  });
  addPlanetWithRing(neptune, 4.25, 'neptune');
  state.planets.neptune = neptune;

  // Enhanced starfield
  const starfield = getStarfield({ numStars: 1000, size: 0.35 });
  scene.add(starfield);
  globalStarfield = starfield;

  // Enhanced lighting
  const dirLight = new THREE.DirectionalLight(0x0099ff, 2);
  dirLight.position.set(0, 1, 0);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  scene.add(dirLight);

  // Ambient light for better overall illumination
  const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
  scene.add(ambientLight);

  // Enhanced nebulas
  const nebula = getNebula({
    hue: 0.6,
    numSprites: 15,
    opacity: 0.3,
    radius: 40,
    size: 80,
    z: -50.5,
  });
  scene.add(nebula);

  const anotherNebula = getNebula({
    hue: 0.0,
    numSprites: 15,
    opacity: 0.3,
    radius: 40,
    size: 80,
    z: 50.5,
  });
  scene.add(anotherNebula);

  // Particle system
  const particleSystem = createParticleSystem();
  scene.add(particleSystem);
  globalParticleSystem = particleSystem;

  // Animation loop
  const cameraDistance = 5;
  function animate(t = 0) {
    const time = t * 0.0002 * state.speedMultiplier;
    requestAnimationFrame(animate);
    
    solarSystem.userData.update(time);
    if (globalParticleSystem) globalParticleSystem.userData.update?.(time);
    
    // Camera controls
    if (state.cameraMode === 'auto') {
      camera.lookAt(0, 0, 0);
    } else if (state.cameraMode === 'manual') {
      controls.update();
    } else if (state.cameraMode === 'follow' && state.selectedPlanet && state.planets[state.selectedPlanet]) {
      // Third-person chase camera: follow behind and above the planet
      const planet = state.planets[state.selectedPlanet];
      const target = planet.getWorldPosition(new THREE.Vector3());
      // Offset: behind and above the planet (relative to orbit center)
      const offsetDir = target.clone().normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(up, offsetDir).normalize();
      const chaseOffset = offsetDir.clone().multiplyScalar(1.5 + (planet.scale ? planet.scale.x : 0))
        .add(up.clone().multiplyScalar(0.7)) // above
        .add(right.clone().multiplyScalar(0.3)); // slight side offset for 3D effect
      const desiredCamPos = target.clone().add(chaseOffset);
      camera.position.lerp(desiredCamPos, 0.1);
      camera.lookAt(target);
    }
    
    // Render with post-processing
    composer.render();
  }

  animate();
  
  // Hide loading screen
  document.getElementById('loading').style.display = 'none';
  
  // Setup UI
  setupUI();
}

// Load asteroid models
const sceneData = {
  objs: [],
};
const manager = new THREE.LoadingManager();
manager.onLoad = () => initScene(sceneData);
const loader = new OBJLoader(manager);
const objs = ['Rock1', 'Rock2', 'Rock3'];
objs.forEach((name) => {
  let path = `./rocks/${name}.obj`;
  loader.load(path, (obj) => {
    obj.traverse((child) => {
      if (child.isMesh) {
        sceneData.objs.push(child);
      }
    });
  });
});

// Handle window resize
function handleWindowResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  
  renderer.setSize(w, h);
  composer.setSize(w, h);
  
  // Update FXAA
  fxaaPass.material.uniforms['resolution'].value.x = 1 / (w * renderer.getPixelRatio());
  fxaaPass.material.uniforms['resolution'].value.y = 1 / (h * renderer.getPixelRatio());
}
window.addEventListener('resize', handleWindowResize, false);