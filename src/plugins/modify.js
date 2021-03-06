"use strict";

const
  Path = require('path'),
  Utils = require('../utils');

// logic ::
// State =>
// { originallyFrom: ?LocalSrc, filename :: String, content :: () => String} =>
// ?{ ?newFilename :: String, ?newContent :: String }

const assertResult = Utils.assertObject([], ['newFilename', 'newContent']);

const main = logic => state => {
  const modifyFn = logic(state);

  const attempt = (op, input) => {
    const desc = input.originallyFrom ? input.originallyFrom.path : input.filename;
    const result = state.scopeErrors(desc + ":", () => modifyFn(input));
    if (result) {
      assertResult(result);

      const contentChanged = result.newContent !== undefined && result.newContent !== input.content();
      const newContent = contentChanged ? result.newContent : input.content();

      const oldFilename = op.to.path;
      const newFilename = result.newFilename !== undefined ? Utils.fixRelativePath(result.newFilename) : oldFilename;
      const newTo = op.to.withNewPath(newFilename);
      const filenameChanged = newFilename !== oldFilename;

      state.removeOp(op);

      if (op.type === 'copy' && !contentChanged)
        state.ops.push(Object.assign({}, op, { to: newTo }));
      else
        state.addOpWrite(newTo, newContent, input.originallyFrom);

      if (filenameChanged)
        renameLocal(state, oldFilename, newFilename);
    }
  };

  const renameLocal = (state, before, after) => {
    const beforeUrl = '/' + before;
    const afterUrl = '/' + after;

    const replaceAtKey = key => o => {
      if (o[key] === beforeUrl) {
        const r = Object.assign({}, o);
        r[key] = afterUrl;
        return r;
      } else
        return o;
    }

    // Update state.urls
    state.urls = Utils.mapObjectValues(state.urls, urls => urls.map(replaceAtKey('url')));

    // Repalce state.manifest
    state.manifest.mapValues(replaceAtKey('local'));
  };

  for (const op of state.ops) {
    if (op.type === 'copy') {
      if (!op.transitive) {
        const originallyFrom = op.from;
        const filename = op.to.path;
        const content = () => op.from.content().toString();
        attempt(op, { originallyFrom, filename, content });
      }
    } else if (op.type === 'write') {
      const originallyFrom = op.originallyFrom;
      const filename = op.to.path;
      const content = () => op.content;
      attempt(op, { originallyFrom, filename, content });
    }
  }
};

const stateless = f => main(_ => f);

const widenFilenameTest = t => {
  const test = (t instanceof RegExp) ? f => t.test(f) : t;
  return i => test(i.filename) || (i.originallyFrom && test(i.originallyFrom.path));
}

const modifyContent = (testFilename, modify, { failUnlessChange } = {}) => {
  const test = widenFilenameTest(testFilename);
  return main(s => {

    const done = a => ({ newContent: a });

    const apply = failUnlessChange
      ? (i, before, after) => {if (before === after) s.addError(`Failed to change ${i.filename}`); else return done(after)}
      : (i, before, after) => done(after);

    const run = i => {
      const content = i.content();
      return apply(i, content, modify(content));
    }

    return i => test(i) && run(i);
  });
}

const rename = (testFilename, modifyFilename) => {
  const test = widenFilenameTest(testFilename);
  return stateless(i => test(i) && { newFilename: modifyFilename(i.filename) });
}

module.exports = {
  content: modifyContent,
  rename,
  stateful: main,
  stateless,
};
