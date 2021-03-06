"use strict";

const
  Action = require('./action'),
  Plan = require('./plan');

function run(cfg, { dryRun = false } = {}) {
  const state = Plan.run(cfg);
  Action.run(state.results(), { dryRun });
  return state;
};

module.exports = {
  plugins: require('./plugins'),
  run,
};
