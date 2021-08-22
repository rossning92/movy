declare var MathJax: any;

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
