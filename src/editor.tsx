import { javascript } from '@codemirror/lang-javascript';
import CodeMirror from '@uiw/react-codemirror';
import 'purecss/build/pure.css';
// grids-responsive.css must come after pure.css
import { Timeline } from 'movy';
import 'purecss/build/grids-responsive.css';
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as ReactDOM from 'react-dom';
import './style/editor.css';
import './style/scrollbar.css';

interface ExampleMenuItem {
  children?: ExampleMenuItem[];
  name: string;
  path: string;
}
declare const examples: ExampleMenuItem[];

declare global {
  interface Window {
    exportVideo: (options?: { name?: string; format?: string }) => void;
  }
}

function loadFile(file: string) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', file, true);
    request.send(null);
    request.onreadystatechange = () => {
      if (request.readyState === 4 && request.status === 200) {
        const type = request.getResponseHeader('Content-Type');
        if (type.indexOf('text') !== 1) {
          resolve(request.responseText);
        }
      }
    };
  });
}

function getParameterByName(name: string) {
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`);
  const results = regex.exec(window.location.href);
  if (!results || !results[2]) return undefined;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function getFileNameWithoutExtension(path: string) {
  return path.split('/').pop().split('.').shift();
}

function Slider({ iframe, disabled }: { iframe: HTMLIFrameElement; disabled: boolean }) {
  const [position, setPosition] = useState(0);
  const [timeline, setTimeline] = useState<Timeline>(null);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (typeof event.data !== 'object' || !event.data.type) {
      return;
    }

    if (event.data.type === 'scriptLoaded') {
      setTimeline(event.data.timeline);
    } else if (event.data.type === 'positionChanged') {
      setPosition(event.data.position);
    }
  }, []);
  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleMessage]);

  return (
    <div
      style={{
        height: '24px',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#303030',
      }}
      onClick={(e) => {
        if (!disabled && timeline) {
          e.preventDefault();
          const x = e.nativeEvent.offsetX;
          const width = e.currentTarget.offsetWidth;
          const p = (x / width) * timeline.duration;

          if (iframe) {
            iframe.contentWindow.postMessage({ type: 'seek', position: p }, '*');
          }
        }
      }}
      aria-hidden="true"
    >
      <div
        style={{
          background: disabled ? 'gray' : 'blue',
          height: '100%',
          width: timeline ? `${(position / timeline.duration) * 100}%` : '0%',
        }}
      />

      {timeline &&
        timeline.animations.map((anim, i: number) => (
          <div
            key={i}
            className="unselectable clickthrough"
            style={{
              position: 'absolute',
              zIndex: 1,
              left: `${(anim.t / timeline.duration) * 100}%`,
              bottom: 0,
              transform: 'translate(-50%, 0%)',
              color: 'gray',
              fontSize: '0.75em',
            }}
          >
            |
          </div>
        ))}

      {timeline &&
        timeline.markers.map((marker, i) => (
          <div
            key={i}
            className="unselectable clickthrough"
            style={{
              position: 'absolute',
              zIndex: 1,
              left: `${(marker.time / timeline.duration) * 100}%`,
              bottom: 0,
              color: '#ffffff',
              fontSize: '0.75em',
            }}
          >
            {marker.name}
          </div>
        ))}

      {timeline &&
        [...Array(Math.floor(timeline.duration + 1)).keys()].map((i) => (
          <div
            key={i}
            className="unselectable clickthrough"
            style={{
              position: 'absolute',
              zIndex: 2,
              top: 0,
              left: `${(i / timeline.duration) * 100}%`,
              textAlign: 'center',
              transform: 'translate(-50%, 0%)',
              fontSize: '0.75em',
            }}
          >
            {i}
          </div>
        ))}
    </div>
  );
}

function App() {
  const containerRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sourceCode, setSourceCode] = useState('');
  const [liveCode, setLiveCode] = useState('');
  const [filePath, setFilePath] = useState(null);
  const [iframe, setIframe] = useState<HTMLIFrameElement>(null);
  const [aspect, setAspect] = useState(16 / 9);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (typeof event.data !== 'object' || !event.data.type) {
      return;
    }

    if (event.data.type === 'videoExported') {
      setIsExporting(false);
    } else if (event.data.type === 'scriptLoaded') {
      setIsLoading(false);
      setAspect(event.data.aspect);
    }
  }, []);
  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleMessage]);

  const uiDisabled = isLoading || isExporting;

  const exportVideo = useCallback(
    (options?: { name?: string; format?: string }) => {
      if (iframe) {
        iframe.contentWindow.postMessage(
          {
            type: 'exportVideo',
            name: options?.name || getFileNameWithoutExtension(filePath) || 'untitled',
            format: options?.format,
          },
          '*'
        );
      }
      setIsExporting(true);
    },
    [iframe, filePath]
  );

  useEffect(() => {
    window.exportVideo = exportVideo;
    return () => {
      window.exportVideo = undefined;
    };
  }, [exportVideo]);

  function runCode(code: string) {
    if (!containerRef.current) {
      return;
    }

    setIsLoading(true);

    const container = containerRef.current;
    while (container.firstChild) {
      container.firstChild.remove();
    }

    const iframeNew = document.createElement('iframe');
    iframeNew.style.border = 'none';
    iframeNew.style.position = 'absolute';
    iframeNew.style.top = '0';
    iframeNew.style.left = '0';
    iframeNew.style.width = '100%';
    iframeNew.style.height = '100%';
    iframeNew.src = document.URL;
    container.appendChild(iframeNew);

    const doc = iframeNew.contentWindow.document;
    doc.open();
    doc.write('<html><body>');
    doc.write(`<script type="importmap">
      {
        "imports": {
          "movy": "./movy.js"
        }
      }
      </script>`);
    doc.write('<script src="mathjax/tex-svg.js"></script>');
    doc.write('<script type="module">');
    doc.write(code.replace(/<\/script>/g, '<\\/script>'));
    doc.write('</script></body></html>');
    doc.close();

    setIframe(iframeNew);
  }

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === 'Enter') {
          e.preventDefault();
          runCode(liveCode);
        } else if (e.key === 'm') {
          e.preventDefault();
          exportVideo();
        }
      }
    },
    [liveCode, exportVideo]
  );
  useEffect(() => {
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onKeyDown]);

  function loadAnimation(file: string) {
    setIsLoading(true);

    return loadFile(file).then((code: string) => {
      setFilePath(file);
      setSourceCode(code);
      return runCode(code);
    });
  }

  function reloadAnimation() {
    const file = getParameterByName('file');
    if (file) {
      loadAnimation(file);
    } else {
      loadAnimation('examples/hello-movy.js');
    }
  }

  const handlePopState = useCallback(() => {
    reloadAnimation();
  }, []);
  useEffect(() => {
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [handlePopState]);

  useEffect(() => {
    reloadAnimation();
  }, []);

  function generateMenuItem(item: ExampleMenuItem) {
    return item.children.length == 0 ? (
      <li className="pure-menu-item" key={item.name}>
        <a
          href="#"
          className="pure-menu-link"
          onClick={(e) => {
            e.preventDefault();
            if (!uiDisabled) {
              window.history.pushState(null, '', `?file=${item.path}`);
              reloadAnimation();
            }
          }}
        >
          {item.name}
        </a>
      </li>
    ) : (
      <li className="pure-menu-item pure-menu-has-children pure-menu-allow-hover" key={item.name}>
        <a href="#" className="pure-menu-link">
          {item.name}
        </a>
        <ul className="pure-menu-children">
          {item.children.map((item) => generateMenuItem(item))}
        </ul>
      </li>
    );
  }

  return (
    <div>
      <div
        style={{
          position: 'fixed',
          zIndex: 10,
          background: 'black',
          borderBottom: '1px solid #808080',
          left: 0,
          right: 0,
        }}
      >
        <div className="pure-menu" style={{ float: 'left' }}>
          <ul className="pure-menu-list">
            <li className="pure-menu-item pure-menu-has-children pure-menu-allow-hover">
              <a href="#" className="pure-menu-link">
                Examples
              </a>
              <ul className="pure-menu-children">
                {examples.map((item) => generateMenuItem(item))}
              </ul>
            </li>

            {/* <li class="pure-menu-item pure-menu-has-children pure-menu-allow-hover">
            <a href="#" class="pure-menu-link">
              webm
            </a>
            <ul class="pure-menu-children">
              <li class="pure-menu-item">
                <a href="#" class="pure-menu-link">
                  webm
                </a>
              </li>
              <li class="pure-menu-item">
                <a href="#" class="pure-menu-link">
                  webm(hq)
                </a>
              </li>
            </ul>
          </li>
          <li class="pure-menu-item pure-menu-has-children pure-menu-allow-hover">
            <a href="#" class="pure-menu-link">
              30fps
            </a>
            <ul class="pure-menu-children">
              <li class="pure-menu-item">
                <a href="#" class="pure-menu-link">
                  25fps
                </a>
              </li>
              <li class="pure-menu-item">
                <a href="#" class="pure-menu-link">
                  30fps
                </a>
              </li>
              <li class="pure-menu-item">
                <a href="#" class="pure-menu-link">
                  60fps
                </a>
              </li>
            </ul>
          </li> */}
          </ul>
        </div>
        <button
          type="button"
          className={`pure-button${uiDisabled ? ' pure-button-disabled' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            exportVideo();
          }}
          style={{
            background: 'rgb(202, 60, 60)',
            color: 'white',
            float: 'right',
            textShadow: '0 1px 1px rgba(0, 0, 0, 0.2)',
          }}
        >
          {isExporting ? 'Exporting' : 'EXPORT (ctrl-m)'}
        </button>
      </div>

      <div
        className="pure-g"
        style={{
          position: 'absolute',
          top: 36,
          bottom: 0,
          width: '100%',
        }}
      >
        <div className="pure-u-1 pure-u-lg-1-2">
          <div
            style={{
              position: 'relative',
            }}
          >
            <div
              ref={containerRef}
              style={{
                position: 'relative',
                width: '100%',
                paddingTop: `${(1 / aspect) * 100}%`,
              }}
            />
            <Slider iframe={iframe} disabled={uiDisabled} />
            {isLoading && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 5,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  background: '#000',
                }}
              >
                (loading...)
              </div>
            )}
          </div>
        </div>
        <div
          className="pure-u-1 pure-u-lg-1-2"
          style={{
            position: 'relative',
            maxHeight: '100%',
            overflow: 'hidden',
            overflowY: 'scroll',
            scrollbarWidth: 'thin',
          }}
        >
          <CodeMirror
            value={sourceCode}
            theme="dark"
            maxHeight="100%"
            extensions={[javascript()]}
            onChange={(value: string) => {
              setLiveCode(value);
            }}
          />

          <button
            type="button"
            className="pure-button"
            onClick={(e) => {
              e.preventDefault();
              runCode(liveCode);
            }}
            style={{
              position: 'absolute',
              background: 'rgba(0, 255, 0, 0.3)',
              color: 'white',
              textShadow: '0 1px 1px rgba(0, 0, 0, 0.2)',
              right: '4px',
              top: '4px',
            }}
          >
            RUN (ctrl-enter)
          </button>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line import/prefer-default-export
(function renderEditor() {
  const root = document.createElement('div');
  root.style.height = '100%';
  document.body.appendChild(root);
  ReactDOM.render(<App />, root);
})();
