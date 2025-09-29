
import React from "react";
import { DbBrandConfig, DefaultDbBrandConfig } from "./brandConfigBase";

export const BrandContext = React.createContext<DbBrandConfig>(DefaultDbBrandConfig);
export const useBrand = () => React.useContext(BrandContext);
