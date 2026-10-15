export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.className = className; if (text !== undefined) node.textContent = text; return node;
}
export function PressableScale(label: string, action: () => void | Promise<void>, className = '') {
  const button = el('button', `pressable ${className}`, label); button.type = 'button';
  button.addEventListener('click', () => { void action(); }); return button;
}
export function Header(title: string, subtitle: string) {
  const header = el('header', 'page-header'); header.append(el('p', 'eyebrow', subtitle), el('h1', '', title)); return header;
}
export function Screen(title: string, subtitle: string) {
  const screen = el('main', 'screen'); screen.id = 'main'; screen.append(Header(title, subtitle)); return screen;
}
export function card(title: string, body: string) { const node = el('section', 'card'); node.append(el('h2', '', title), el('p', 'muted', body)); return node; }
export function notice() { const node = el('p', 'notice'); node.setAttribute('role', 'status'); node.hidden = true; return node; }
export function show(node: HTMLElement, text: string) { node.textContent = text; node.hidden = !text; }
export function field(label: string, type = 'text') {
  const wrapper = el('label', 'field', label); const input = el('input'); input.type = type; wrapper.append(input); return { wrapper, input };
}
export function useTheme(name = localStorage.getItem('us-web-theme') || 'Auto') { document.documentElement.dataset.theme = name; localStorage.setItem('us-web-theme', name); }
export function useMotion() { return !matchMedia('(prefers-reduced-motion: reduce)').matches; }
export function time(seconds: number) { const n = Math.max(0, Math.floor(seconds)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; }
