const
  Path = require('path'),
  Manifest = require('../manifest');
  State = require('../state');

const term = n =>
  /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(n) ? n : "`" + n + "`";

const stringLiteral = s =>
  /["\n\r\t\\]/.test(s) ? `"""${s}"""` : `"${s}"`;

const extractCss = ({
  fileFilter = f => /\.css$/.test(f),
  newManifestName = n => `${n}Urls`,
}) => state => {

  for (const [manifestKey, manifestValue] of Object.entries(state.manifest.entries)) {
    const filename = manifestValue.local;
    if (filename && fileFilter(filename)) {
      const op = state.getOpThatCreatesLocalFile(filename);
      if (op) {
        const name = newManifestName(manifestKey);
        const css = State.opContent(op);
        const urls =
          (css.match(/url *\( *.+? *\)/g) || [])
            .filter(s => !/url\(data:/.test(s))
            .map(s => s.match(/url *\( *['"]?(.+?)['"]? *\)$/)[1]);
        state.manifest.addList(name, urls);
      }
    }
  }

};

const scala = ({ object, filename, outputPath, nameMod = n => n }) => state => {

  const fqcn = object.match(/^(.+)\.([^.]+)$/);
  if (!fqcn) {
    state.addError(`Invalid object FQCN: ${objectName}`);
  } else {

    const manifest = state.manifest;
    const [, pkg, obj] = fqcn;
    let cdnUsed = false;

    const defs = [];
    for (const k of Object.keys(manifest.entries).sort()) {
      const v = manifest.entries[k];
      // console.log(`${k} = ${require('../utils').inspect(v)}`)

      const name = nameMod(k);
      const url = Manifest.url(v, false);
      if (v.cdn) {
        cdnUsed = true;
        const {url, integrity} = v.cdn;
        const i = integrity ? `Some(${stringLiteral(integrity)})` : 'None';
        defs.push(`def ${term(name)} = CDN(\n  href = ${stringLiteral(url)},\n  integrity = ${i})`);
      } else if (url) {
        defs.push(`def ${term(name)} = ${stringLiteral(url)}`)
      } else if (v.list) {
        const vs = v.list.map(i => `\n  ${stringLiteral(i)} ::`).join('');
        defs.push(`def ${term(name)}: List[String] =${vs}\n  Nil`);
      }

      // final case class Resource(url: String, integrity: Option[String])
    }

    const content = [
      `package ${pkg}`,
      "",
      "/** Generated by webtamp. */",
      `object ${obj} {`,
      "",
      cdnUsed && "  final case class CDN(href: String, integrity: Option[String])",
      cdnUsed && "",
      defs.map(l => l.replace(/^/gm, "  ")).join("\n\n"),
      "}"
    ].filter(s => s !== false).join("\n");

    // console.log("-------------------------------------------------------------------------")
    // console.log(content);
    // console.log("-------------------------------------------------------------------------")

    let outfile = filename || `${obj}.scala`;
    if (outputPath)
      outfile = Path.join(outputPath, outfile);

    state.addOpWrite(outfile, content);
  }
};

module.exports = {
  extractCss,
  generate: {scala}
};
