"use strict";

const { assertObject, OutputFile } = require('./utils');

class State {
  constructor(src, target) {
    this.src = src;
    this.target = target;
    this.ops = [];
    this.errors = [];
    this.warns = [];
    this.manifest = {};
    this.urls = {};
    this.deps = {};
    this.pending = {};
  }

  addOp(o) {
    this.ops.push(o)
  }
  addOpCopy(from, to, transitive) {
    this.addOp({
      type: 'copy',
      from,
      to: (to instanceof OutputFile) ? to : new OutputFile(this.target, to),
      transitive,
    })
  }
  addOpWrite(to, content, originallyFrom) {
    this.addOp({
      type: 'write',
      originallyFrom,
      to: (to instanceof OutputFile) ? to : new OutputFile(this.target, to),
      content,
    })
  }

  addError(o) {
    this.errors.push(o)
  }
  addWarn(o) {
    this.warns.push(o)
  }

  addUrl(assetName, url) {
    assertObject(['url'], ['integrity', 'crossorigin', 'transitive'])(url);
    if (!this.urls[assetName])
      this.addError(`Asset not registered: ${assetName}`);
    this.urls[assetName].push(url);
  }

  scopeErrors(mod, block) {
    if (mod === '' || !mod) return block();
    const e = this.errors.length;
    const r = block();
    let i = this.errors.length;
    let f = mod;
    if (typeof mod === 'string')
      f = e => `${mod} ${e}`;
    while (--i >= e)
      this.errors[i] = f(this.errors[i]);
    return r;
  }

  removeOp(op) {
    this.ops = this.ops.filter(o => o !== op);
  }

  checkThenRunIfNoErrors(check, run) {
    const errCount = this.errors.length;
    const a = check();
    if (this.errors.length === errCount)
      run(a);
  }

  addManifestEntry(k, v) {
    if (this.manifest[k] && this.manifest[k] !== v) {
      const o = {}
      o[k] = this.manifest[k];
      this.addWarn("Overwritting manifest entry: " + JSON.stringify(o))
    }
    this.manifest[k] = v;
  }

  addManifestEntryLocal(name, local) {
    this.addManifestEntry(name, { local })
  }

  addManifestEntryCdn(name, cdn) {
    this.addManifestEntry(name, { cdn })
  }

  registerNow(name) {
    if (this.pending[name])
      this.addError(`Duplicate asset: ${name}`);
    else if (!this.deps[name]) {
      this.deps[name] = [];
      this.urls[name] = [];
    }
  }

  registerForLater(name, register) {
    if (this.deps[name])
      this.addError(`Duplicate asset: ${name}`);
    else {
      if (!this.pending[name])
        this.pending[name] = [];
      this.pending[name].push(register);
    }
  }

  addDependency(from, to) {
    const a = this.deps[from];
    if (!a)
      this.deps[from] = [to];
    else if (Object.isFrozen(a))
      this.addError(`Can't add dependency ${to} to terminal asset ${from}.`);
    else if (!a.includes(to))
      a.push(to);
  }

  /** Resolve required, pending deps */
  resolvePending() {
    const loop = () => {
      // This seems stupid, lazy way of doing it but it's been too long a day so meh
      const changed = [false];
      for (const [name, deps] of Object.entries(this.deps))
        for (const dep of deps) {
          if (this.deps[dep]) {
            // Already registered - do nothing
          } else if (this.pending[dep]) {
            const fns = this.pending[dep];
            this.pending[dep] = undefined;
            fns.forEach(fn => fn());
            changed[0] = true;
          } else {
            this.addError(`${name} referenced an unspecified asset: ${dep}`);
          }
        }
      return changed[0];
    }
    while (loop());
  }

  graphDependencies() {
    this.graph = undefined;
    if (this.ok()) {
      const graph = {};
      const add = n => {
        if (graph[n] === undefined) {

          graph[n] = null;
          const deps = this.deps[n] || [];
          deps.forEach(add);
          graph[n] = {};
          deps.forEach(d => graph[n][d] = graph[d]);
          Object.freeze(graph[n]);

        } else if (graph[n] === null) {
          this.addError(`Circular dependency on asset: ${n}`)
        }
      };
      Object.keys(this.deps).forEach(add);
      Object.freeze(graph);
      this.graph = graph;
    }
  }

  ok() {
    return this.errors.length == 0
  }

  results() {
    return {
      ops: this.ops,
      errors: this.errors.sort(),
      warns: this.warns.sort(),
      manifest: this.manifest,
      graph: this.graph,
    };
  }
}

State.manifestUrl = (entry, allowCdn) => {
  let r = entry.local || entry.url;
  if (!r && allowCdn && entry.cdn) r = entry.cdn.url;
  return r;
}

State.manifestEntryToUrlEntry = m => {
  let u = {};
  if (m.cdn) {
    Object.assign(u, m.cdn);
    u.crossorigin = 'anonymous'; // aaaaaaaaaah the temp hacks
  } else {
    u.url = State.manifestUrl(m, false);
  }
  return u;
}

module.exports = State;
