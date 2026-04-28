// Pure SPA — disable SSR and prerendering for the whole app. The static
// adapter outputs `index.html` as a fallback that the backend Worker
// serves via the ASSETS binding for any non-/api path.
export const ssr = false;
export const prerender = false;
export const trailingSlash = 'never';
