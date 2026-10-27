import { useEffect, useState } from "react";
import { layoutFor, type PageLayout } from "../../model/layout.js";

export function useLayout(touch: boolean): PageLayout {
    const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
    useEffect(() => {
        const resize = (): void => setViewport({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener("resize", resize);
        window.addEventListener("orientationchange", resize);
        return () => { window.removeEventListener("resize", resize); window.removeEventListener("orientationchange", resize); };
    }, []);
    return layoutFor({ ...viewport, touch });
}
