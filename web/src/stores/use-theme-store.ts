import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeName = "light" | "dark";

type ThemeStore = {
    theme: ThemeName;
    setTheme: (theme?: string) => void;
};

export const THEME_STORAGE_KEY = "infinite-canvas:theme_store:v2";

/** 校验任意来源的主题值，非法时回退亮色。 */
export function normalizeThemeName(value: unknown): ThemeName {
    return value === "dark" ? "dark" : "light";
}

export const useThemeStore = create<ThemeStore>()(
    persist(
        (set) => ({
            theme: "light",
            setTheme: (theme?: string) => set({ theme: normalizeThemeName(theme) }),
        }),
        {
            name: THEME_STORAGE_KEY,
            // v2 丢弃 v1 时期被强制写入的 dark 值：产品默认亮色，用户此后主动切换才会持久化。
            merge: (persisted, current) => ({ ...current, theme: normalizeThemeName((persisted as { theme?: unknown } | undefined)?.theme) }),
        },
    ),
);
