import * as mo from 'movy';

mo.usePerspectiveCamera();
mo.cameraMoveTo({ position: [2, 3, 4], lookAt: [0, 0, 0], duration: 0 });
mo.addSphere();
mo.addGrid({ color: 'gray', rx: 0 });

mo.camera.dollyZoom({ fov: 10 }).dollyZoom({ fov: 130 });
