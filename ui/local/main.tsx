// realizes: docs/ui-spec.md > §7 local page entry

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LocalPage } from "./LocalPage.js";

document.documentElement.dataset.density = "desktop";
const root = document.querySelector("#root");
if (root === null) throw new Error("The local UI root is missing.");
createRoot(root).render(<StrictMode><LocalPage /></StrictMode>);

