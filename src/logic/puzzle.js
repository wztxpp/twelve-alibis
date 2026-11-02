/** Evaluate one public testimony expression in one public-evidence world. */
export function evaluate(expression, world) {
  switch (expression.type) {
    case 'fieldEq':
      return world[expression.left] === world[expression.right];
    case 'ltField':
      return world[expression.left] < world[expression.right];
    case 'offsetEq': {
      const target = world[expression.right] + expression.offset;
      const normalized = expression.mod === undefined
        ? target
        : ((target % expression.mod) + expression.mod) % expression.mod;
      return world[expression.left] === normalized;
    }
    case 'eq':
      return world[expression.field] === expression.value;
    case 'ne':
      return world[expression.field] !== expression.value;
    case 'before':
      return world.order.indexOf(expression.a) < world.order.indexOf(expression.b);
    case 'adjacentBefore':
      return world.order.indexOf(expression.b) === world.order.indexOf(expression.a) + 1;
    case 'and':
      return expression.args.every(part => evaluate(part, world));
    case 'or':
      return expression.args.some(part => evaluate(part, world));
    case 'not':
      return !evaluate(expression.arg, world);
    default:
      throw new Error(`Unknown rule ${expression.type}`);
  }
}

/** Whether every speaker's truth value matches the selected identities. */
export function compatible(liars, level, world) {
  return level.statements.every((statement, index) =>
    evaluate(statement.expr, world) === !liars.has(statement.speaker ?? index));
}

/** Submission acceptance is derived from constraints, not hard-coded answers. */
export function valid(liars, level) {
  return liars.size === level.liarCount
    && level.worlds.some(world => compatible(liars, level, world));
}
