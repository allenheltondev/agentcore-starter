// Consumes the @readysetcloud/ui tailwind preset (shared design tokens) and
// scans both the app source and the shipped JS of the RSC packages so their
// token utility classes are generated. Mirrors content-tracking's setup.
module.exports = {
  presets: [require('@readysetcloud/ui/tailwind-preset')],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './node_modules/@readysetcloud/ui/dist/**/*.js',
    './node_modules/@readysetcloud/ui-chat/dist/**/*.js',
  ],
};
