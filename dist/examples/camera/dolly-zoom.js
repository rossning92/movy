import * as mo from 'movy';

mo.setDefaultEase('power2.inOut');
mo.setDefaultDuration(1.5);
mo.usePerspectiveCamera();
mo.cameraMoveTo({ position: [0, 1, 3], lookAt: [0, 0, 0], duration: 0 });
mo.addGrid({ color: '#404040', rx: 0, gridSize: 100, scale: 0.5, y: -1 });

for (let i = -4; i <= 4; i += 1) {
  mo.addSphere({ position: [0, 0, i * 4], scale: 2 });
}

mo.camera.dollyZoom({ fov: 10 }).dollyZoom({ fov: 90 }).dollyZoom({ fov: 10 });
