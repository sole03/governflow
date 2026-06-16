export { SECURITY_TEMPLATES, SECURITY_TEMPLATE_META } from "./security.js";
export { ARCHITECTURE_TEMPLATES, ARCHITECTURE_TEMPLATE_META } from "./architecture.js";
export { TYPE_TEMPLATES, TYPE_TEMPLATE_META } from "./type.js";
export { STYLE_TEMPLATES, STYLE_TEMPLATE_META } from "./style.js";
import { SECURITY_TEMPLATES } from "./security.js";
import { SECURITY_TEMPLATE_META } from "./security.js";
import { ARCHITECTURE_TEMPLATES } from "./architecture.js";
import { ARCHITECTURE_TEMPLATE_META } from "./architecture.js";
import { TYPE_TEMPLATES } from "./type.js";
import { TYPE_TEMPLATE_META } from "./type.js";
import { STYLE_TEMPLATES } from "./style.js";
import { STYLE_TEMPLATE_META } from "./style.js";

export const ALL_TEMPLATES: string[] = [
  ...SECURITY_TEMPLATES,
  ...ARCHITECTURE_TEMPLATES,
  ...TYPE_TEMPLATES,
  ...STYLE_TEMPLATES,
];

export const TEMPLATE_SUMMARY = {
  total: ALL_TEMPLATES.length,
  categories: {
    security: { count: SECURITY_TEMPLATES.length, description: SECURITY_TEMPLATE_META.description },
    architecture: { count: ARCHITECTURE_TEMPLATES.length, description: ARCHITECTURE_TEMPLATE_META.description },
    type: { count: TYPE_TEMPLATES.length, description: TYPE_TEMPLATE_META.description },
    style: { count: STYLE_TEMPLATES.length, description: STYLE_TEMPLATE_META.description },
  },
};
