import { PressableScale } from './ui.js';

/** Fullscreen presentation only; never changes playback or sends sync events. */
export function fullscreenPlayer(container: HTMLElement, video: EventTarget & { readonly paused: boolean }, button: HTMLButtonElement) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let manuallyHidden = false;
  const originalTabIndex = container.getAttribute('tabindex');
  container.tabIndex = -1;
  const hideButton = PressableScale('Hide controls', () => {
    if (!isFullscreen()) return;
    manuallyHidden = true;
    clearTimeout(timer);
    container.classList.add('controls-hidden');
    if (document.activeElement instanceof HTMLElement && container.contains(document.activeElement)) document.activeElement.blur();
    container.focus({ preventScroll: true });
  }, 'fullscreen-hide-controls');
  hideButton.title = 'Hide all controls. Click the video or press a key to show them again.';
  container.append(hideButton);
  const idleDelay = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--player-controls-idle')) || 0;
  const isFullscreen = () => document.fullscreenElement === container;
  function reveal() {
    if (manuallyHidden) return;
    clearTimeout(timer); container.classList.remove('controls-idle');
    if (isFullscreen() && !video.paused) timer = setTimeout(() => {
      if (!container.querySelector(':focus-visible') && !container.querySelector('select:focus') && !container.querySelector('details[open]')) container.classList.add('controls-idle');
    }, idleDelay);
  }
  function restore() { manuallyHidden = false; container.classList.remove('controls-hidden'); reveal(); }
  function update() { button.textContent = isFullscreen() ? '⛶ Exit fullscreen' : '⛶ Fullscreen'; button.setAttribute('aria-pressed', String(isFullscreen())); restore(); }
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isFullscreen()) void document.exitFullscreen().catch(() => undefined);
    if (manuallyHidden && event.key !== 'Escape') event.preventDefault();
    restore();
  }
  const onPause = () => { if (!manuallyHidden) { clearTimeout(timer); container.classList.remove('controls-idle'); } };
  for (const event of ['pointermove', 'focusin', 'focusout']) container.addEventListener(event, reveal);
  container.addEventListener('pointerdown', restore);
  container.addEventListener('keydown', keydown);
  document.addEventListener('fullscreenchange', update); video.addEventListener('playing', reveal); video.addEventListener('pause', onPause);
  update();
  return { cleanup() {
    clearTimeout(timer);
    for (const event of ['pointermove', 'focusin', 'focusout']) container.removeEventListener(event, reveal);
    container.removeEventListener('pointerdown', restore);
    hideButton.remove();
    if (originalTabIndex === null) container.removeAttribute('tabindex');
    else container.setAttribute('tabindex', originalTabIndex);
    container.removeEventListener('keydown', keydown);
    document.removeEventListener('fullscreenchange', update); video.removeEventListener('playing', reveal); video.removeEventListener('pause', onPause);
    if (isFullscreen()) void document.exitFullscreen().catch(() => undefined);
  } };
}
