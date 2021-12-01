declare var MathJax: any;

import * as THREE from "three";
import { toThreeColor } from "./color";
import { parseSVG } from "./svg";

export async function tex2svg(
  tex: string,
  { color = "white" } = {}
): Promise<SVGElement> {
  return new Promise((resolve, _) => {
    const input = `\\color{${color}}{${tex}}`;
    MathJax.texReset();
    MathJax.tex2svgPromise(input)
      .then(function (node: any) {
        const svg = node.getElementsByTagName("svg")[0];
        MathJax.startup.document.clear();
        MathJax.startup.document.updateDocument();
        resolve(svg);
      })
      .catch(function (_: any) {})
      .then(function () {});
  });
}

export async function createTexObject(
  tex: string,
  { color = "white" } = {}
): Promise<THREE.Object3D> {
  const svg = await tex2svg(tex, { color });

  const removeEmptyPath = (node: ChildNode) => {
    const nodes = node.childNodes;

    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].nodeName === "path") {
        if (nodes[i].getAttribute("d") === "") {
          nodes[i].remove();
        }
      } else {
        removeEmptyPath(nodes[i]);
      }
    }
  };

  removeEmptyPath(svg);

  return parseSVG(svg.outerHTML, { color });
}

export async function createTexSprite(
  tex: string,
  { color = "white" } = {}
): Promise<THREE.Object3D> {
  const canvas = await tex2canvas(tex, {
    color: "#" + toThreeColor(color as string).getHexString(),
  });
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.x = texture.image.width / 120;
  mesh.scale.y = texture.image.height / 120;

  const parent = new THREE.Group();
  parent.add(mesh);
  return parent;
}

export async function tex2canvas(
  tex: string,
  { color = "white" } = {}
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, _) => {
    const input = `\\color{${color}}{${tex}}`;
    MathJax.texReset();
    MathJax.tex2svgPromise(input)
      .then(function (node: any) {
        var svg = node.getElementsByTagName("svg")[0];

        // Convert to canvas object.
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        var image = new Image();
        image.src =
          "data:image/svg+xml;base64," +
          window.btoa(unescape(encodeURIComponent(svg.outerHTML)));
        image.onload = function () {
          var canvas = document.createElement("canvas");

          canvas.width = image.width * 10;
          canvas.height = image.height * 10;
          var context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas);
        };

        MathJax.startup.document.clear();
        MathJax.startup.document.updateDocument();
      })
      .catch(function (_: any) {})
      .then(function () {});
  });
}
