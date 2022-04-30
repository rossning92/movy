import { javascript } from '@codemirror/lang-javascript';
import CodeMirror from '@uiw/react-codemirror';
import 'purecss/build/pure.css';
import 'purecss/build/grids-responsive.css';
import React, { useEffect, useRef, useCallback, useState } from 'react';
import ReactDOM from 'react-dom';
import './style/editor.css';
import './style/scrollbar.css';

const examples = [
  'examples/2d-geometry.js',
  'examples/3d-geometry.js',
  'examples/axes-2d.js',
  'examples/demo.js',
  'examples/eases.js',
  'examples/fonts.js',
  'examples/formula-transform-2.js',
  'examples/formula-transform.js',
  'examples/hello-movy.js',
  'examples/line-chart.js',
  'examples/matrix.js',
  'examples/movy-logo.js',
  'examples/prime-numbers.js',
  'examples/progress-bar.js',
  'examples/rasterization.js',
  'examples/scaling.js',
  'examples/symmetric-crypto.js',
  'examples/text-3d.js',
  'examples/text-outline.js',
  'examples/camera/dolly-zoom.js',
];

function loadFile(file) {
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

function getParameterByName(name) {
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`);
  const results = regex.exec(window.location.href);
  if (!results || !results[2]) return undefined;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function PureDropdown(dropdownParent) {
  const PREFIX = 'pure-';
  const ACTIVE_CLASS_NAME = `${PREFIX}menu-active`;
  const ARIA_ROLE = 'role';
  const ARIA_HIDDEN = 'aria-hidden';
  const MENU_OPEN = 0;
  const MENU_CLOSED = 1;
  const MENU_ACTIVE_SELECTOR = '.pure-menu-active';
  const MENU_LINK_SELECTOR = '.pure-menu-link';
  const MENU_SELECTOR = '.pure-menu-children';
  const DISMISS_EVENT =
    window.hasOwnProperty && Object.prototype.hasOwnProperty.call(window, 'ontouchstart')
      ? 'touchstart'
      : 'mousedown';
  const ARROW_KEYS_ENABLED = true;
  const ddm = this; // drop down menu

  this.state = MENU_CLOSED;

  this.show = () => {
    if (this.state !== MENU_OPEN) {
      this.dropdownParent.classList.add(ACTIVE_CLASS_NAME);
      this.menu.setAttribute(ARIA_HIDDEN, false);
      this.state = MENU_OPEN;
    }
  };

  this.hide = () => {
    if (this.state !== MENU_CLOSED) {
      this.dropdownParent.classList.remove(ACTIVE_CLASS_NAME);
      this.menu.setAttribute(ARIA_HIDDEN, true);
      this.link.focus();
      this.state = MENU_CLOSED;
    }
  };

  this.toggle = () => {
    this[this.state === MENU_CLOSED ? 'show' : 'hide']();
  };

  this.halt = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  this.dropdownParent = dropdownParent;
  this.link = this.dropdownParent.querySelector(MENU_LINK_SELECTOR);
  this.menu = this.dropdownParent.querySelector(MENU_SELECTOR);
  this.firstMenuLink = this.menu.querySelector(MENU_LINK_SELECTOR);

  // Set ARIA attributes
  this.link.setAttribute('aria-haspopup', 'true');
  this.menu.setAttribute(ARIA_ROLE, 'menu');
  this.menu.setAttribute('aria-labelledby', this.link.getAttribute('id'));
  this.menu.setAttribute('aria-hidden', 'true');
  [].forEach.call(this.menu.querySelectorAll('li'), (el) => {
    el.setAttribute(ARIA_ROLE, 'presentation');
  });
  [].forEach.call(this.menu.querySelectorAll('a'), (el) => {
    el.setAttribute(ARIA_ROLE, 'menuitem');
  });

  // Toggle on click
  this.link.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    ddm.toggle();
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    let previousSibling;
    let nextSibling;
    let previousLink;
    let nextLink;

    // if the menu isn't active, ignore
    if (ddm.state !== MENU_OPEN) {
      return;
    }

    // if the menu is the parent of an open, active submenu, ignore
    if (ddm.menu.querySelector(MENU_ACTIVE_SELECTOR)) {
      return;
    }

    const currentLink = ddm.menu.querySelector(':focus');

    // Dismiss an open menu on ESC
    if (e.keyCode === 27) {
      /* Esc */
      ddm.halt(e);
      ddm.hide();
    } else if (ARROW_KEYS_ENABLED && e.keyCode === 40) {
      // Go to the next link on down arrow
      /* Down arrow */
      ddm.halt(e);
      // get the nextSibling (an LI) of the current link's LI
      nextSibling = currentLink ? currentLink.parentNode.nextSibling : null;
      // if the nextSibling is a text node (not an element), go to the next one
      while (nextSibling && nextSibling.nodeType !== 1) {
        nextSibling = nextSibling.nextSibling;
      }
      nextLink = nextSibling ? nextSibling.querySelector('.pure-menu-link') : null;
      // if there is no currently focused link, focus the first one
      if (!currentLink) {
        ddm.menu.querySelector('.pure-menu-link').focus();
      } else if (nextLink) {
        nextLink.focus();
      }
    } else if (ARROW_KEYS_ENABLED && e.keyCode === 38) {
      // Go to the previous link on up arrow
      /* Up arrow */
      ddm.halt(e);
      // get the currently focused link
      previousSibling = currentLink ? currentLink.parentNode.previousSibling : null;
      while (previousSibling && previousSibling.nodeType !== 1) {
        previousSibling = previousSibling.previousSibling;
      }
      previousLink = previousSibling ? previousSibling.querySelector('.pure-menu-link') : null;
      // if there is no currently focused link, focus the last link
      if (!currentLink) {
        ddm.menu.querySelector('.pure-menu-item:last-child .pure-menu-link').focus();
      } else if (previousLink) {
        // else if there is a previous item, go to the previous item
        previousLink.focus();
      }
    }
  });

  // Dismiss an open menu on outside event
  document.addEventListener(DISMISS_EVENT, (e) => {
    const { target } = e;
    if (target !== ddm.link && !ddm.menu.contains(target)) {
      ddm.hide();
      ddm.link.blur();
    }
  });
}

function getFileNameWithoutExtension(path) {
  return path.split('/').pop().split('.').shift();
}

function Slider({ iframe, disabled }) {
  const [position, setPosition] = useState(0);
  const [timeline, setTimeline] = useState(null);

  const handleMessage = useCallback((event) => {
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
      style={{ height: '24px', position: 'relative', overflow: 'hidden' }}
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
        timeline.animations.map((anim, i) => (
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
  const [iframe, setIframe] = useState(null);
  const [aspect, setAspect] = useState(16 / 9);

  const handleMessage = useCallback((event) => {
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
  function exportVideo() {
    setIsExporting(true);
    if (iframe) {
      iframe.contentWindow.postMessage(
        { type: 'exportVideo', name: getFileNameWithoutExtension(filePath) || 'untitled' },
        '*'
      );
    }
  }

  function runCode(code) {
    if (!uiDisabled) {
      setIsLoading(true);

      if (iframe) {
        containerRef.current.removeChild(iframe);
      }

      const iframeNew = document.createElement('iframe');
      iframeNew.style.border = 'none';
      iframeNew.style.position = 'absolute';
      iframeNew.style.top = '0';
      iframeNew.style.left = '0';
      iframeNew.style.width = '100%';
      iframeNew.style.height = '100%';
      containerRef.current.appendChild(iframeNew);
      const doc = iframeNew.contentWindow.document;
      doc.open();
      doc.write('<html><body>');
      doc.write(`<script type="importmap">
      {
        "imports": {
          "movy": "/movy.js"
        }
      }
      </script>`);
      doc.write('<script src="mathjax/tex-svg.js"></script>');
      doc.write('<script type="module">');
      doc.write(code.replaceAll('</script>', '<\\/script>'));
      doc.write('</script></body></html>');
      doc.close();

      setIframe(iframeNew);
    }
  }

  const onKeyDown = useCallback((e) => {
    if (e.ctrlKey) {
      if (e.key === 'Enter') {
        e.preventDefault();
        runCode(liveCode);
      } else if (e.key === 'm') {
        e.preventDefault();
        exportVideo();
      }
    }
  });
  useEffect(() => {
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onKeyDown]);

  function loadAnimation(file) {
    setIsLoading(true);

    return loadFile(file).then((code) => {
      setFilePath(file);
      setSourceCode(code);
      return runCode(code);
    });
  }

  useEffect(() => {
    const dropdownParents = document.querySelectorAll('.pure-menu-has-children');
    for (let i = 0; i < dropdownParents.length; i += 1) {
      // eslint-disable-next-line no-unused-vars
      const ddm = new PureDropdown(dropdownParents[i]);
    }

    const file = getParameterByName('file');
    if (file) {
      loadAnimation(file);
    } else {
      loadAnimation('examples/hello-movy.js');
    }
  }, []);

  return (
    <div style={{ height: '100%' }}>
      <div
        className="pure-menu pure-menu-horizontal"
        style={{
          position: 'fixed',
          zIndex: '10',
          background: 'black',
          borderBottom: '1px solid #808080',
        }}
      >
        <ul className="pure-menu-list">
          <li className="pure-menu-item pure-menu-has-children pure-menu-allow-hover">
            <a href="#noop" className="pure-menu-link">
              Examples
            </a>
            <ul className="pure-menu-children">
              {examples.map((file) => (
                <li className="pure-menu-item" key={file}>
                  <a
                    href="#noop"
                    className="pure-menu-link"
                    onClick={(e) => {
                      e.preventDefault();
                      window.history.pushState(null, '', `?file=${file}`);
                      if (!uiDisabled) {
                        loadAnimation(`${file}`);
                      }
                    }}
                  >
                    {file}
                  </a>
                </li>
              ))}
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
        <ul className="pure-menu-list" style={{ float: 'right' }}>
          <li className="pure-menu-item">
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
                textShadow: '0 1px 1px rgba(0, 0, 0, 0.2)',
              }}
            >
              {isExporting ? 'Exporting' : 'EXPORT (ctrl-m)'}
            </button>
          </li>
        </ul>
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
                borderBottom: '1px solid #808080',
                width: '100%',
                paddingTop: `${(1 / aspect) * 100}%`,
              }}
            />
            <Slider iframe={iframe} disabled={uiDisabled} />
            {false && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 1,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  background: '#000',
                  border: '4px solid #808080',
                }}
              >
                <div style={{ fontSize: '2em' }}>LOADING</div>
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
            onChange={(value) => {
              setLiveCode(value);
            }}
          />

          <button
            type="button"
            className={`pure-button${uiDisabled ? ' pure-button-disabled' : ''}`}
            href="#"
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
