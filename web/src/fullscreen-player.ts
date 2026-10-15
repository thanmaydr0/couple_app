/** Fullscreen presentation only; never changes playback or sends sync events. */
export function fullscreenPlayer(container: HTMLElement, video: EventTarget & { readonly paused: boolean }, button: HTMLButtonElement) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const idleDelay = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--player-controls-idle')) || 0;
  const isFullscreen = () => document.fullscreenElement === container;
  function reveal() {
    clearTimeout(timer); container.classList.remove('controls-idle');
    if (isFullscreen() && !video.paused) timer = setTimeout(() => {
      if (!container.querySelector(':focus-visible') && !container.querySelector('select:focus') && !container.querySelector('details[open]')) container.classList.add('controls-idle');
    }, idleDelay);
  }
  function update() { button.textContent = isFullscreen() ? '⛶ Exit fullscreen' : '⛶ Fullscreen'; button.setAttribute('aria-pressed', String(isFullscreen())); reveal(); }
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isFullscreen()) void document.exitFullscreen().catch(() => undefined);
    reveal();
  }
  const onPause = () => { clearTimeout(timer); container.classList.remove('controls-idle'); };
  for (const event of ['pointermove', 'pointerdown', 'focusin', 'focusout']) container.addEventListener(event, reveal);
  container.addEventListener('keydown', keydown);
  document.addEventListener('fullscreenchange', update); video.addEventListener('playing', reveal); video.addEventListener('pause', onPause);
  update();
  return { cleanup() {
    clearTimeout(timer);
    for (const event of ['pointermove', 'pointerdown', 'focusin', 'focusout']) container.removeEventListener(event, reveal);
    container.removeEventListener('keydown', keydown);
    document.removeEventListener('fullscreenchange', update); video.removeEventListener('playing', reveal); video.removeEventListener('pause', onPause);
    if (isFullscreen()) void document.exitFullscreen().catch(() => undefined);
  } };
}
