import { createContext, useContext } from "react";

// Shared by the existing dialogs; changing layout never replaces their models.
export const PhoneLayoutContext = createContext(false);
export const usePhoneLayout = (): boolean => useContext(PhoneLayoutContext);
