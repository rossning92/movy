import * as mo from 'movy';

mo.usePerspectiveCamera();
mo.cameraMoveTo({ position: [3, 3, 3], lookAt: [0, 0, 0], duration: 0 });
mo.addGrid({ color: 'gray', rx: 0 });

for (let i = -3; i <= 3; i += 1) {
  mo.addSphere({ position: [i, 0, i] });
}

mo.camera.dollyZoom({ fov: 10 }).dollyZoom({ fov: 90 }).dollyZoom({ fov: 10 });
