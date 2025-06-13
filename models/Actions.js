const Action = Object.freeze({
  APPLY: 'apply',
  DESTROY: 'destroy',
  PLAN: 'plan',
});

function getActionName(action) {
  if (action === Action.APPLY) return 'Apply';
  if (action === Action.DESTROY) return 'Destroy';
  if (action === Action.PLAN) return 'Plan';
  throw new Error(`Unknown action: ${action}`);
}

module.exports = { Action, getActionName };
