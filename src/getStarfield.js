import * as THREE from "three";

export default function getStarfield({ numStars = 500, size = 0.2 } = {}) {
  function randomSpherePoint() {
    const radius = Math.random() * 25 + 25;
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    let x = radius * Math.sin(phi) * Math.cos(theta);
    let y = radius * Math.sin(phi) * Math.sin(theta);
    let z = radius * Math.cos(phi);

    return {
      pos: new THREE.Vector3(x, y, z),
      hue: Math.random() * 0.3 + 0.5, // More varied colors
      minDist: radius,
      twinkleSpeed: Math.random() * 2 + 0.5,
      twinklePhase: Math.random() * Math.PI * 2,
      size: Math.random() * 0.5 + 0.5
    };
  }
  
  const verts = [];
  const colors = [];
  const sizes = [];
  const positions = [];
  let col;
  
  for (let i = 0; i < numStars; i += 1) {
    let p = randomSpherePoint();
    const { pos, hue, twinkleSpeed, twinklePhase, size: starSize } = p;
    positions.push(p);
    
    // Create different star types
    const starType = Math.random();
    let starColor;
    
    if (starType < 0.1) {
      // Blue stars (hot)
      starColor = new THREE.Color().setHSL(0.6, 0.8, Math.random() * 0.5 + 0.5);
    } else if (starType < 0.3) {
      // White stars
      starColor = new THREE.Color().setHSL(0, 0, Math.random() * 0.5 + 0.5);
    } else if (starType < 0.6) {
      // Yellow stars (like our sun)
      starColor = new THREE.Color().setHSL(0.12, 0.8, Math.random() * 0.5 + 0.5);
    } else {
      // Red/orange stars (cooler)
      starColor = new THREE.Color().setHSL(0.05, 0.8, Math.random() * 0.5 + 0.5);
    }
    
    verts.push(pos.x, pos.y, pos.z);
    colors.push(starColor.r, starColor.g, starColor.b);
    sizes.push(starSize);
  }
  
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));
  
  const mat = new THREE.PointsMaterial({
    size: size,
    vertexColors: true,
    map: new THREE.TextureLoader().load("./src/circle.png"),
    transparent: true,
    blending: THREE.AdditiveBlending
  });
  
  const points = new THREE.Points(geo, mat);
  
  // Add twinkling animation
  points.userData.update = (t) => {
    const colors = geo.attributes.color.array;
    const sizes = geo.attributes.size.array;
    
    for (let i = 0; i < numStars; i++) {
      const i3 = i * 3;
      const star = positions[i];
      
      // Twinkling effect
      const twinkle = Math.sin(t * star.twinkleSpeed + star.twinklePhase) * 0.3 + 0.7;
      
      // Update color intensity
      colors[i3] *= twinkle;
      colors[i3 + 1] *= twinkle;
      colors[i3 + 2] *= twinkle;
      
      // Update size
      sizes[i] = star.size * (0.5 + twinkle * 0.5);
    }
    
    geo.attributes.color.needsUpdate = true;
    geo.attributes.size.needsUpdate = true;
  };
  
  return points;
}
