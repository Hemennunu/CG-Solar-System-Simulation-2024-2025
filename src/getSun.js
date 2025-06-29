import * as THREE from 'three';
import { getFresnelMat } from "./getFresnelMat.js";
import { ImprovedNoise } from 'jsm/math/ImprovedNoise.js';
// sun

function getCorona() {
    const radius = 0.9;
    const material = new THREE.MeshBasicMaterial({
        color: 0xffff99,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.8
    });
    const geo = new THREE.IcosahedronGeometry(radius, 6);
    const mesh = new THREE.Mesh(geo, material);
    const noise = new ImprovedNoise();

    let v3 = new THREE.Vector3();
    let p = new THREE.Vector3();
    let pos = geo.attributes.position;
    pos.usage = THREE.DynamicDrawUsage;
    const len = pos.count;

    function update(t) {
        for (let i = 0; i < len; i += 1) {
            p.fromBufferAttribute(pos, i).normalize();
            v3.copy(p).multiplyScalar(3.0);
            let ns = noise.noise(v3.x + Math.cos(t), v3.y + Math.sin(t), v3.z + t);
            v3.copy(p)
                .setLength(radius)
                .addScaledVector(p, ns * 0.6);
            pos.setXYZ(i, v3.x, v3.y, v3.z);
        }
        pos.needsUpdate = true;
    }
    mesh.userData.update = update;
    return mesh;
}

function getSolarFlares() {
    const flareCount = 8;
    const flares = new THREE.Group();
    
    for (let i = 0; i < flareCount; i++) {
        const flareGeometry = new THREE.ConeGeometry(0.1, 0.8, 8);
        const flareMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        
        const flare = new THREE.Mesh(flareGeometry, flareMaterial);
        flare.position.setFromSphericalCoords(1.2, Math.PI / 2, (i / flareCount) * Math.PI * 2);
        flare.lookAt(0, 0, 0);
        flare.rotation.z = Math.PI / 2;
        
        flares.add(flare);
    }
    
    flares.userData.update = (t) => {
        flares.children.forEach((flare, index) => {
            flare.material.opacity = 0.3 + Math.sin(t * 2 + index) * 0.4;
            flare.scale.setScalar(0.8 + Math.sin(t * 3 + index) * 0.3);
        });
    };
    
    return flares;
}

function getSun() {
    // Main sun body with enhanced material
    const sunMat = new THREE.MeshStandardMaterial({
        emissive: 0xff4400,
        emissiveIntensity: 2,
        color: 0xff6600,
        roughness: 0.1,
        metalness: 0.9
    });
    const geo = new THREE.IcosahedronGeometry(1, 6);
    const sun = new THREE.Mesh(geo, sunMat);

    // Enhanced rim effect
    const sunRimMat = getFresnelMat({ rimHex: 0xffff99, facingHex: 0x000000 });
    const rimMesh = new THREE.Mesh(geo, sunRimMat);
    rimMesh.scale.setScalar(1.02);
    sun.add(rimMesh);

    // Corona effect
    const coronaMesh = getCorona();
    sun.add(coronaMesh);

    // Enhanced lighting
    const sunLight = new THREE.PointLight(0xffff99, 15, 50);
    sun.add(sunLight);
    
    // Additional ambient light from sun
    const sunAmbient = new THREE.PointLight(0xff4400, 5, 30);
    sun.add(sunAmbient);

    // Sun surface animation
    sun.userData.update = (t) => {
        sun.rotation.y = t * 0.5;
        sun.rotation.x = Math.sin(t * 0.3) * 0.1;
        coronaMesh.userData.update(t);
        
        // Pulsing effect
        const pulse = 1 + Math.sin(t * 2) * 0.05;
        sun.scale.setScalar(pulse);
        
        // Dynamic light intensity
        sunLight.intensity = 15 + Math.sin(t * 1.5) * 5;
        sunAmbient.intensity = 5 + Math.sin(t * 2) * 2;
    };
    
    return sun;
}

export default getSun;