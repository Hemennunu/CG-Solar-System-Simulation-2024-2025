import * as THREE from "three";

export default function getNebula({
  hue = 0.6,
  numSprites = 10,
  opacity = 0.2,
  radius = 40,
  size = 80,
  z = -50.5,
} = {}) {
  const nebulaGroup = new THREE.Group();
  
  // Create multiple layers for depth
  const layers = 3;
  
  for (let layer = 0; layer < layers; layer++) {
    const layerRadius = radius + layer * 5;
    const layerOpacity = opacity * (1 - layer * 0.3);
    const layerSize = size * (1 + layer * 0.2);
    
    for (let i = 0; i < numSprites; i++) {
      const sprite = new THREE.Sprite();
      
      // Create gradient texture for nebula
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      
      // Create radial gradient
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, `hsla(${hue * 360}, 80%, 70%, ${layerOpacity})`);
      gradient.addColorStop(0.5, `hsla(${hue * 360}, 60%, 50%, ${layerOpacity * 0.5})`);
      gradient.addColorStop(1, `hsla(${hue * 360}, 40%, 30%, 0)`);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        blending: THREE.AdditiveBlending
      });
      
      sprite.material = material;
      sprite.scale.setScalar(layerSize);
      
      // Random position within the nebula
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * layerRadius;
      sprite.position.set(
        Math.cos(angle) * distance,
        Math.sin(angle) * distance,
        z + layer * 2
      );
      
      // Add animation data
      sprite.userData = {
        originalPosition: sprite.position.clone(),
        speed: Math.random() * 0.5 + 0.5,
        phase: Math.random() * Math.PI * 2,
        rotationSpeed: Math.random() * 0.02 - 0.01
      };
      
      nebulaGroup.add(sprite);
    }
  }
  
  // Animation function
  nebulaGroup.userData.update = (t) => {
    nebulaGroup.children.forEach((sprite) => {
      const data = sprite.userData;
      
      // Gentle floating motion
      sprite.position.x = data.originalPosition.x + Math.sin(t * data.speed + data.phase) * 2;
      sprite.position.y = data.originalPosition.y + Math.cos(t * data.speed * 0.7 + data.phase) * 2;
      
      // Rotation
      sprite.rotation += data.rotationSpeed;
      
      // Pulsing opacity
      const pulse = 0.5 + Math.sin(t * 0.5 + data.phase) * 0.3;
      sprite.material.opacity = sprite.material.opacity * 0.9 + pulse * 0.1;
      
      // Color shift
      const hueShift = Math.sin(t * 0.1 + data.phase) * 0.1;
      const currentHue = (hue + hueShift) % 1;
      sprite.material.color.setHSL(currentHue, 0.8, 0.6);
    });
  };
  
  return nebulaGroup;
}