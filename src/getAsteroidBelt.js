import * as THREE from 'three';

function getInstanced({ distance, mesh, size, index = 0 }) {
    const numObjs = 50 + Math.floor(Math.random() * 50);
    const instaMesh = new THREE.InstancedMesh(mesh.geometry, mesh.material, numObjs);
    const matrix = new THREE.Matrix4();
    
    const asteroidMaterial = new THREE.MeshStandardMaterial({
        color: 0x666666,
        roughness: 0.9,
        metalness: 0.1,
        emissive: 0x111111,
        emissiveIntensity: 0.1
    });
    
    const enhancedInstaMesh = new THREE.InstancedMesh(mesh.geometry, asteroidMaterial, numObjs);
    
    for (let i = 0; i < numObjs; i += 1) {
        const radius = distance + Math.random() * 0.2 - 0.1;
        const angle = Math.random() * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = (Math.random() - 0.5) * 0.1;
        const position = new THREE.Vector3(x, y, z);
        const quaternion = new THREE.Quaternion();
        quaternion.random();
        const currentSize = size + Math.random() * 0.1 - 0.05;
        const scale = new THREE.Vector3().setScalar(currentSize);
        matrix.compose(position, quaternion, scale);
        enhancedInstaMesh.setMatrixAt(i, matrix);
    }
    
    enhancedInstaMesh.userData = {
        update(t) {
            const rate = -0.0003 * (1 + index * 0.2);
            enhancedInstaMesh.rotation.z = t * rate;
            
            enhancedInstaMesh.rotation.x = Math.sin(t * 0.1) * 0.05;
            enhancedInstaMesh.rotation.y = Math.cos(t * 0.15) * 0.05;
            
            asteroidMaterial.emissiveIntensity = 0.1 + Math.sin(t * 0.5) * 0.05;
        }
    };
    
    return enhancedInstaMesh;
}

function getAsteroidBelt(objs) {
    const group = new THREE.Group();
    
    const beltDistances = [2.5, 2.6, 2.7];
    
    objs.forEach((obj, objIndex) => {
        beltDistances.forEach((distance, beltIndex) => {
            const asteroids = getInstanced({ 
                distance: distance, 
                mesh: obj, 
                size: 0.025 + beltIndex * 0.005,
                index: objIndex + beltIndex
            });
            group.add(asteroids);
        });
    });
    
    const particleCount = 200;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
        const radius = 2.4 + Math.random() * 0.6;
        const angle = Math.random() * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = (Math.random() - 0.5) * 0.2;
        
        particlePositions[i * 3] = x;
        particlePositions[i * 3 + 1] = y;
        particlePositions[i * 3 + 2] = z;
        
        particleSizes[i] = Math.random() * 0.02 + 0.005;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    
    const particleMaterial = new THREE.PointsMaterial({
        color: 0x888888,
        size: 0.01,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    
    particles.userData.update = (t) => {
        particles.rotation.z = t * -0.0002;
        particles.rotation.x = Math.sin(t * 0.05) * 0.02;
    };
    
    group.add(particles);
    
    return group;
}

export default getAsteroidBelt;