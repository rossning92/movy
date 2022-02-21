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

function replaceColorMacro(tex: string): string {
  for (const color of ["red", "green", "blue", "yellow", "cyan", "magenta"]) {
    tex = tex.replace(new RegExp(`\\\\${color}`, "g"), `\\textcolor{${color}}`);
  }
  return tex;
}

export async function createTexObject(
  tex: string,
  { color = "white" } = {}
): Promise<THREE.Object3D> {
  tex = replaceColorMacro(tex);

  const svg = await tex2svg(tex, { color });

  // SVGLoader will throw exception if path element has empty d attribute
  const removePathElementsWithEmptyData = (node: Element) => {
    const nodes = node.children;

    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].nodeName === "path") {
        if (nodes[i].getAttribute("d") === "") {
          nodes[i].remove();
        }
      } else {
        removePathElementsWithEmptyData(nodes[i]);
      }
    }
  };
  removePathElementsWithEmptyData(svg);

  // SVGLoader is not able to handle sub svg element which references defs in parent svg element.
  const expandSubSVGElements = (node: Element) => {
    const nodes = node.children;
    for (const node of nodes) {
      if (node.nodeName === "svg" && node.parentNode !== null) {
        const translate = `translate(${node.getAttribute("x") || "0"}, ${
          node.getAttribute("y") || "0"
        })`;

        for (const childNode of node.children) {
          let transform = childNode.getAttribute("transform");
          transform = transform ? `${translate} ${transform}` : translate;
          childNode.setAttribute("transform", transform);
          node.parentNode.appendChild(childNode);
        }

        node.remove();
      }
      expandSubSVGElements(node);
    }
  };
  expandSubSVGElements(svg);

  const texObject = parseSVG(svg.outerHTML);
  texObject.traverse((x) => {
    if (x.name) {
      // Remove prefix of MathJax "MJX-*-""
      x.name = x.name.replace(/MJX-\d+-/g, "");
    }
  });

  return texObject;
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
