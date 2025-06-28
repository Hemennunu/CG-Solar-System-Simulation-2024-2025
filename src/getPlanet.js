import * as THREE from 'three';
import { getFresnelMat } from './getFresnelMat.js';

const texLoader = new THREE.TextureLoader();
const geo = new THREE.IcosahedronGeometry(1, 6);

function createAtmosphere(size, color) {
    const atmosphereGeo = new THREE.IcosahedronGeometry(size * 1.1, 4);
    const atmosphereMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending
    });
    const atmosphere = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    return atmosphere;
}

function createRing(innerRadius, outerRadius, color, opacity = 0.7) {
    const ringGeo = new THREE.RingGeometry(innerRadius, outerRadius, 64);
    const ringMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: opacity,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    return ring;
}

function setPlanetNameRecursive(object, planetName) {
    if (!object) return;
    object.userData.planetName = planetName;
    if (object.children && object.children.length > 0) {
        object.children.forEach(child => setPlanetNameRecursive(child, planetName));
    }
}

function getPlanet({ children = [], distance = 0, img = '', normalMap = '', specularMap = '', size = 1, atmosphere = false, atmosphereColor = 0x88aaff, rings = null, planetName = null, ringTexture = null, cloudMap = '' }) {
    const orbitGroup = new THREE.Group();
    orbitGroup.rotation.x = Math.random() * Math.PI * 2;

    // Load color, normal, and specular maps if provided
    const colorMap = texLoader.load(`./textures/${img}`);
    const normal = normalMap ? texLoader.load(`./textures/${normalMap}`) : null;
    const specular = specularMap ? texLoader.load(`./textures/${specularMap}`) : null;
    const clouds = cloudMap ? texLoader.load(`./textures/${cloudMap}`) : null;

    // Realistic planet material
    const planetMat = new THREE.MeshStandardMaterial({
        map: colorMap,
        normalMap: normal,
        metalnessMap: specular,
        roughness: 0.7,
        metalness: 0.2,
        envMapIntensity: 0.7
    });

    const planet = new THREE.Mesh(geo, planetMat);
    planet.scale.setScalar(size);
    planet.castShadow = true;
    planet.receiveShadow = true;

    const startAngle = Math.random() * Math.PI * 2;
    planet.position.x = Math.cos(startAngle) * distance;
    planet.position.z = Math.sin(startAngle) * distance;

    // Cloud layer (if provided)
    let cloudMesh = null;
    if (clouds) {
        const cloudGeo = new THREE.IcosahedronGeometry(size * 1.01, 6);
        const cloudMat = new THREE.MeshStandardMaterial({
            map: clouds,
            transparent: true,
            opacity: 0.5,
            depthWrite: false
        });
        cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
        planet.add(cloudMesh);
    }

    // Enhanced rim effect
    const planetRimMat = getFresnelMat({ rimHex: 0xffffff, facingHex: 0x000000 });
    const planetRimMesh = new THREE.Mesh(geo, planetRimMat);
    planetRimMesh.scale.setScalar(1.02);
    planet.add(planetRimMesh);

    // Add atmosphere if specified
    if (atmosphere) {
        const atmosphereMesh = createAtmosphere(size, atmosphereColor);
        planet.add(atmosphereMesh);
        // Animate atmosphere
        atmosphereMesh.userData.update = (t) => {
            atmosphereMesh.rotation.y = t * 0.1;
            atmosphereMesh.material.opacity = 0.2 + Math.sin(t * 2) * 0.1;
        };
    }

    // Add rings if specified
    if (rings) {
        rings.forEach(ringData => {
            let ring;
            if (ringData.texture) {
                // Use a transparent PNG texture for realistic rings
                const ringTex = texLoader.load(`./textures/${ringData.texture}`);
                const ringGeo = new THREE.RingGeometry(ringData.innerRadius, ringData.outerRadius, 128);
                const ringMat = new THREE.MeshBasicMaterial({
                    map: ringTex,
                    transparent: true,
                    opacity: ringData.opacity ?? 1.0,
                    side: THREE.DoubleSide
                });
                ring = new THREE.Mesh(ringGeo, ringMat);
            } else {
                ring = createRing(ringData.innerRadius, ringData.outerRadius, ringData.color, ringData.opacity);
            }
            ring.rotation.x = Math.PI / 2;
            ring.position.x = Math.cos(startAngle) * distance;
            ring.position.z = Math.sin(startAngle) * distance;
            orbitGroup.add(ring);
        });
    }

    children.forEach((child) => {
        child.position.x = Math.cos(startAngle) * distance;
        child.position.z = Math.sin(startAngle) * distance;
        orbitGroup.add(child);
    });

    // Set planetName recursively on all descendants of the planet mesh
    if (planetName) {
        setPlanetNameRecursive(planet, planetName);
        // Also set it on the orbit group itself
        orbitGroup.userData.planetName = planetName;
    }

    const rate = Math.random() * 1 - 1.0;
    orbitGroup.userData.update = (t) => {
        orbitGroup.rotation.y = t * rate;
        children.forEach((child) => {
            child.userData.update?.(t);
        });
        // Planet rotation
        planet.rotation.y += 0.01;
        // Cloud layer animation
        if (cloudMesh) {
            cloudMesh.rotation.y += 0.008;
        }
        // Atmospheric animation
        if (atmosphere) {
            planet.children.forEach(child => {
                if (child.userData.update) {
                    child.userData.update(t);
                }
            });
        }
    };
    
    orbitGroup.add(planet);
    return orbitGroup;
}

export default getPlanet;