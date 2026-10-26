// realizes: docs/ui-design-language.md > §6.3 Gallery page

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Gallery } from "./Gallery.js";

const root = document.querySelector("#root");
if (root === null) throw new Error("Gallery root is missing.");

createRoot(root).render(<StrictMode><Gallery /></StrictMode>);
