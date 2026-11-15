type Binding = {
  [K in keyof HTMLElementEventMap]: readonly [
    target: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ];
}[keyof HTMLElementEventMap];

/** A single list owns both registration and teardown, including capture. */
export function bindListeners(bindings: readonly Binding[]): () => void {
  for (const [target, type, listener, options] of bindings) {
    target.addEventListener(type, listener as EventListener, options);
  }
  return () => {
    for (const [target, type, listener, options] of bindings) {
      target.removeEventListener(type, listener as EventListener, typeof options === 'boolean' ? options : options?.capture);
    }
  };
}
