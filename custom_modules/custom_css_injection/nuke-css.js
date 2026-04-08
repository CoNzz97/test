(function injectNukeStyles() {
  const styleId = "nuke-style";

  if (document.getElementById(styleId)) {
    return;
  }

  const cssNuke = `
    :root {
      --nuke-missile-image-url: url("https://mikobotecdn.win/emotes/imissilefauna.png");
      --nuke-flight-duration: 3800ms;
      --nuke-impact-delay: 3500ms;
      --nuke-disintegration-duration: 1350ms;
      --nuke-missile-rotation-offset: 225deg;
    }

    #nuke-overlay {
      position: fixed;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: 2147483001;
    }

    #nuke-overlay:empty {
      display: none;
    }

    .nuke-shot {
      position: absolute;
      inset: 0;
      --nuke-origin-x: calc(100vw + 72px);
      --nuke-origin-y: calc(100vh + 46px);
      --nuke-apex-x: 52vw;
      --nuke-apex-y: 44px;
      --nuke-target-x: 120px;
      --nuke-target-y: 120px;
      --nuke-origin-rotate: -145deg;
      --nuke-apex-rotate: -225deg;
      --nuke-target-rotate: -225deg;
      --nuke-missile-rotation-offset: 225deg;
    }

    .nuke-missile,
    .nuke-smoke,
    .nuke-impact {
      position: fixed;
      left: 0;
      top: 0;
      pointer-events: none;
      will-change: transform, opacity, filter;
    }

    .nuke-missile {
      z-index: 3;
      width: 74px;
      height: 74px;
      background:
        var(--nuke-missile-image-url)
        center / contain no-repeat;
      filter:
        drop-shadow(0 0 7px rgba(255, 213, 100, 0.86))
        drop-shadow(0 0 18px rgba(255, 117, 22, 0.48));
      transform:
        translate(var(--nuke-origin-x), var(--nuke-origin-y))
        translate(-50%, -50%)
        rotate(calc(var(--nuke-origin-rotate) + var(--nuke-missile-rotation-offset)))
        scale(0.8);
      animation:
        nuke-missile-arc var(--nuke-flight-duration, 3800ms)
        linear forwards;
    }

    .nuke-smoke {
      z-index: 2;
      width: 142px;
      height: 58px;
      border-radius: 999px;
      opacity: 0;
      background:
        radial-gradient(ellipse at 18% 50%, rgba(255, 232, 164, 0.58) 0 18%, rgba(255, 126, 28, 0.24) 36%, rgba(255, 126, 28, 0) 70%),
        radial-gradient(ellipse at 64% 48%, rgba(83, 83, 83, 0.48) 0 26%, rgba(50, 50, 50, 0.24) 46%, rgba(40, 40, 40, 0) 76%);
      filter: blur(8px) saturate(1.2);
      transform:
        translate(var(--nuke-origin-x), var(--nuke-origin-y))
        translate(-50%, -50%)
        rotate(var(--nuke-origin-rotate))
        scale(0.62);
      animation:
        nuke-smoke-arc var(--nuke-flight-duration, 3800ms)
        linear forwards;
    }

    .nuke-impact {
      z-index: 4;
      width: 168px;
      height: 168px;
      border-radius: 50%;
      opacity: 0;
      background:
        radial-gradient(circle, rgba(255, 255, 255, 1) 0 8%, rgba(255, 232, 126, 0.96) 15%, rgba(255, 126, 24, 0.76) 34%, rgba(212, 32, 0, 0.38) 56%, rgba(212, 32, 0, 0) 74%);
      box-shadow:
        0 0 28px rgba(255, 230, 116, 0.86),
        0 0 68px rgba(255, 84, 0, 0.62);
      filter: blur(0.4px) saturate(1.24);
      transform:
        translate(var(--nuke-target-x), var(--nuke-target-y))
        translate(-50%, -50%)
        scale(0.18);
      animation:
        nuke-impact-pop 760ms ease-out
        var(--nuke-impact-delay, 3500ms) forwards;
    }

    .nuke-impact::before,
    .nuke-impact::after {
      content: "";
      position: absolute;
      inset: -24px;
      border-radius: 50%;
      pointer-events: none;
    }

    .nuke-impact::before {
      border: 4px solid rgba(255, 222, 114, 0.78);
      opacity: 0;
      transform: scale(0.18);
      animation:
        nuke-impact-ring 720ms ease-out
        var(--nuke-impact-delay, 3500ms) forwards;
    }

    .nuke-impact::after {
      background:
        conic-gradient(from 0deg, rgba(255, 255, 255, 0.78), rgba(255, 127, 28, 0.2), rgba(255, 255, 255, 0.7), rgba(255, 127, 28, 0.12), rgba(255, 255, 255, 0.78));
      opacity: 0;
      filter: blur(6px);
      animation:
        nuke-impact-sparks 720ms ease-out
        var(--nuke-impact-delay, 3500ms) forwards;
    }

    #messagebuffer > div.nuke-targeting,
    #messagebuffer > div.nuke-disintegrating {
      position: sticky;
      top: 0;
      isolation: isolate;
      z-index: 4;
    }

    #messagebuffer > div.nuke-targeting {
      filter:
        brightness(1.18)
        saturate(1.25)
        drop-shadow(0 0 5px rgba(255, 202, 75, 0.5));
    }

    #messagebuffer > div.nuke-targeting::after {
      content: "";
      position: absolute;
      inset: -4px -8px;
      border: 1px dashed rgba(255, 225, 114, 0.96);
      border-radius: 5px;
      box-shadow:
        0 0 14px rgba(255, 166, 42, 0.64),
        inset 0 0 12px rgba(255, 236, 172, 0.28);
      animation: nuke-target-lock 0.44s ease-out forwards;
      pointer-events: none;
    }

    #messagebuffer > div.nuke-disintegrating {
      pointer-events: none;
      overflow: hidden;
      transform-origin: 50% 50%;
      will-change: transform, filter, opacity;
      animation:
        nuke-message-disintegrate
        var(--nuke-disintegration-duration, 1350ms)
        ease-in forwards;
    }

    #messagebuffer > div.nuke-disintegrating::before,
    #messagebuffer > div.nuke-disintegrating::after {
      content: "";
      position: absolute;
      inset: -4px;
      pointer-events: none;
      mix-blend-mode: screen;
    }

    #messagebuffer > div.nuke-disintegrating::before {
      background:
        linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 239, 160, 0.92) 42%, rgba(255, 110, 0, 0.98) 55%, rgba(255, 255, 255, 0) 100%);
      filter: blur(8px);
      transform: translateX(-120%) skewX(-14deg);
      animation:
        nuke-message-sweep
        var(--nuke-disintegration-duration, 1350ms)
        ease-out forwards;
    }

    #messagebuffer > div.nuke-disintegrating::after {
      background:
        radial-gradient(circle at 16% 48%, rgba(255, 244, 190, 0.4) 0 5%, rgba(255, 244, 190, 0) 16%),
        radial-gradient(circle at 46% 42%, rgba(255, 180, 72, 0.42) 0 6%, rgba(255, 180, 72, 0) 18%),
        radial-gradient(circle at 76% 58%, rgba(255, 94, 0, 0.42) 0 7%, rgba(255, 94, 0, 0) 20%);
      opacity: 0;
      filter: blur(0.6px) saturate(1.4);
      animation:
        nuke-message-fragments
        var(--nuke-disintegration-duration, 1350ms)
        ease-out forwards;
    }

    @keyframes nuke-missile-arc {
      0% {
        opacity: 0;
        transform:
        translate(var(--nuke-origin-x), var(--nuke-origin-y))
        translate(-50%, -50%)
        rotate(calc(var(--nuke-origin-rotate) + var(--nuke-missile-rotation-offset)))
        scale(0.66);
      }
      8% {
        opacity: 1;
        transform:
          translate(calc(var(--nuke-origin-x) - 70px), calc(var(--nuke-origin-y) - 48px))
          translate(-50%, -50%)
          rotate(calc(var(--nuke-origin-rotate) + var(--nuke-missile-rotation-offset)))
          scale(0.82);
      }
      62% {
        opacity: 1;
        transform:
          translate(var(--nuke-apex-x), var(--nuke-apex-y))
          translate(-50%, -50%)
          rotate(calc(var(--nuke-origin-rotate) + var(--nuke-missile-rotation-offset)))
          scale(1.02);
      }
      70% {
        opacity: 1;
        transform:
          translate(var(--nuke-apex-x), var(--nuke-apex-y))
          translate(-50%, -50%)
          rotate(calc(var(--nuke-apex-rotate) + var(--nuke-missile-rotation-offset)))
          scale(1.02);
      }
      82% {
        opacity: 1;
        transform:
          translate(var(--nuke-target-x), calc(var(--nuke-target-y) - 24px))
          translate(-50%, -50%)
          rotate(calc(var(--nuke-target-rotate) + var(--nuke-missile-rotation-offset)))
          scale(1.08);
      }
      100% {
        opacity: 0;
        transform:
          translate(var(--nuke-target-x), var(--nuke-target-y))
          translate(-50%, -50%)
          rotate(calc(var(--nuke-target-rotate) + var(--nuke-missile-rotation-offset)))
          scale(0.72);
      }
    }

    @keyframes nuke-smoke-arc {
      0% {
        opacity: 0;
        transform:
          translate(var(--nuke-origin-x), var(--nuke-origin-y))
          translate(-50%, -50%)
          rotate(var(--nuke-origin-rotate))
          scale(0.4);
      }
      18% {
        opacity: 0.86;
      }
      54% {
        opacity: 0.62;
        transform:
          translate(var(--nuke-apex-x), var(--nuke-apex-y))
          translate(-50%, -50%)
          rotate(var(--nuke-apex-rotate))
          scale(0.92);
      }
      100% {
        opacity: 0;
        transform:
          translate(var(--nuke-target-x), var(--nuke-target-y))
          translate(-50%, -50%)
          rotate(var(--nuke-target-rotate))
          scale(0.32);
      }
    }

    @keyframes nuke-impact-pop {
      0% { opacity: 0; transform: translate(var(--nuke-target-x), var(--nuke-target-y)) translate(-50%, -50%) scale(0.18); }
      22% { opacity: 1; transform: translate(var(--nuke-target-x), var(--nuke-target-y)) translate(-50%, -50%) scale(1.18); }
      64% { opacity: 0.88; transform: translate(var(--nuke-target-x), var(--nuke-target-y)) translate(-50%, -50%) scale(1.04); }
      100% { opacity: 0; transform: translate(var(--nuke-target-x), var(--nuke-target-y)) translate(-50%, -50%) scale(1.46); }
    }

    @keyframes nuke-impact-ring {
      0% { opacity: 0; transform: scale(0.18); }
      34% { opacity: 0.88; }
      100% { opacity: 0; transform: scale(1.42); }
    }

    @keyframes nuke-impact-sparks {
      0% { opacity: 0; transform: rotate(0deg) scale(0.45); }
      34% { opacity: 0.8; }
      100% { opacity: 0; transform: rotate(74deg) scale(1.34); }
    }

    @keyframes nuke-target-lock {
      0% { opacity: 0; transform: scale(1.04); }
      60% { opacity: 1; transform: scale(1); }
      100% { opacity: 0.9; transform: scale(1); }
    }

    @keyframes nuke-message-disintegrate {
      0% {
        opacity: 1;
        filter: brightness(1.6) saturate(1.5) drop-shadow(0 0 6px rgba(255, 170, 36, 0.56));
        transform: translate(0, 0) rotate(0deg) scale(1);
      }
      28% {
        opacity: 1;
        filter: brightness(2.25) saturate(2.1) blur(0.5px) drop-shadow(0 0 11px rgba(255, 88, 0, 0.74));
        transform: translate(-4px, -2px) rotate(-0.6deg) scale(1.02);
      }
      62% {
        opacity: 0.82;
        filter: brightness(2.6) saturate(1.7) blur(2px) drop-shadow(0 0 18px rgba(255, 90, 0, 0.7));
        transform: translate(8px, -8px) rotate(1.8deg) skewX(8deg) scale(0.96);
      }
      100% {
        opacity: 0;
        filter: brightness(3.1) saturate(1.1) blur(8px) drop-shadow(0 0 24px rgba(255, 110, 0, 0.42));
        transform: translate(34px, -22px) rotate(5deg) skewX(18deg) scale(0.82, 0.92);
      }
    }

    @keyframes nuke-message-sweep {
      0% { opacity: 0; transform: translateX(-120%) skewX(-14deg); }
      18% { opacity: 1; }
      84% { opacity: 0.8; transform: translateX(92%) skewX(-14deg); }
      100% { opacity: 0; transform: translateX(128%) skewX(-14deg); }
    }

    @keyframes nuke-message-fragments {
      0% { opacity: 0; transform: translate(0, 0) scale(1); }
      30% { opacity: 0.64; transform: translate(4px, -6px) scale(1.04); }
      70% { opacity: 0.58; transform: translate(18px, -18px) scale(1.1); }
      100% { opacity: 0; transform: translate(34px, -30px) scale(1.18); }
    }
  `;

  const styleElement = document.createElement("style");
  styleElement.id = styleId;
  styleElement.textContent = cssNuke;
  document.head.appendChild(styleElement);
})();
