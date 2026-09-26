// Minify the CSS as usual, but leave calc() alone: the old calc optimiser in Parcel 1's
// cssnano can't read the cqw units the Game Boy is sized in, and fails the build.
module.exports = {
  preset: ['default', { calc: false }],
};
