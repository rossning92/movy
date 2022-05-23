export function createVideoElement(file: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.src = file;
    video.crossOrigin = 'anonymous';
    video.style.display = 'none';
    document.body.prepend(video);
    video.addEventListener('canplay', () => {
      video.play();
      resolve(video);
    });
  });
}
