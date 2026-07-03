export type StoreListener<T> = (state: T, previous: T) => void;
export type StoreUpdater<T> = Partial<T> | ((state: T) => Partial<T>);

export interface Store<T> {
  get: () => T;
  set: (updater: StoreUpdater<T>) => void;
  replace: (next: T) => void;
  subscribe: (listener: StoreListener<T>) => () => void;
}

export function createStore<T>(initialState: T): Store<T> {
  let state = initialState;
  const listeners = new Set<StoreListener<T>>();

  return {
    get: () => state,
    set: (updater) => {
      const previous = state;
      const patch = typeof updater === "function" ? updater(state) : updater;
      state = { ...state, ...patch };
      listeners.forEach((listener) => listener(state, previous));
    },
    replace: (next) => {
      const previous = state;
      state = next;
      listeners.forEach((listener) => listener(state, previous));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      listener(state, state);
      return () => listeners.delete(listener);
    },
  };
}
