import { create } from 'zustand';

type UiStore = {
  isBootstrapping: boolean;
  setBootstrapping: (value: boolean) => void;
};

export const useUiStore = create<UiStore>((set) => ({
  isBootstrapping: false,
  setBootstrapping: (value) => set({ isBootstrapping: value }),
}));
