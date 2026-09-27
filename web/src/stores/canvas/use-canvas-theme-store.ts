import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemeName } from "@/stores/use-theme-store";
import { normalizeThemeName, useThemeStore } from "@/stores/use-theme-store";
import { useLayoutEffect } from "react";

type CanvasThemeStore = { theme: ThemeName; active: boolean; setTheme: (theme?: string) => void };

/**
 * 画布主题只决定画布内部的节点与工具配色；应用外壳（顶栏、侧栏、浮层）统一跟随
 * useThemeStore 的全局明暗偏好，避免"外面亮、画布页黑"的割裂。
 */
export const useCanvasThemeStore = create<CanvasThemeStore>()(
    persist(
        (set) => ({
            theme: "light",
            active: false,
            setTheme: (theme?: string) => set({ theme: normalizeThemeName(theme) }),
        }),
        {
            name: "infinite-canvas:canvas-theme:v3",
            // v3 丢弃 v2 时期强制写入的 dark 值；此后持久化的合法明暗值正常恢复。
            merge: (persisted, current) => ({ ...current, theme: normalizeThemeName((persisted as { theme?: unknown } | undefined)?.theme) }),
        },
    ),
);

/** 保留挂载/卸载钩子以兼容既有调用方；shell 主题已统一由全局 store 驱动。 */
export function useCanvasThemeScope() {
    useLayoutEffect(() => {
        useCanvasThemeStore.setState({ active: true });
        return () => { useCanvasThemeStore.setState({ active: false }); };
    }, []);
}

export function useActiveTheme(): ThemeName {
    return useThemeStore((state) => state.theme);
}
