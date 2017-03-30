const
  Assert = require('chai').assert,
  Path = require('path'),
  Plan = require('../src/plan'),
  State = require('../src/state'),
  TestData = require('./data'),
  TestUtil = require('./util');

const { vizJs, vizJsExplicit, image1SvgSha256, image2SvgSha256, image2SvgSha384, jqueryUrl, src, target } = TestData;

const svgs = { type: 'local', files: '*{1,2}.svg', manifest: f => f.replace(/\.svg$/, 'Svg') };

function addSvgExpectations(expect) {
  for (const i of [1, 2]) {
    const f = `image${i}.svg`;
    expect.addOp({ type: 'copy', from: [src, f], to: [target, f] });
    expect.addManifestEntryLocal(`image${i}Svg`, '/' + f)
  }
}

// TODO warn about multiple files with same target name

describe('Plan', () => {
  describe('run', () => {

    const testPlan = TestUtil.testPlan(TestUtil.stateResultsMinusGraph);

    describe('local', () => {

      it('simple', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { vizJs },
        };
        testPlan(cfg, expect => {
          expect.addOp({
            type: 'copy',
            from: [src, 'vendor/viz.js'],
            to: [target, 'viz.js']
          });
          expect.addManifestEntryLocal('vizJs', '/viz.js')
        })
      });

      it('with src', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { vizJs: { type: 'local', src: 'vendor', files: 'v?z.js', manifest: true } },
        };
        testPlan(cfg, expect => {
          expect.addOp({
            type: 'copy',
            from: [src + '/vendor', 'viz.js'],
            to: [target, 'viz.js']
          });
          expect.addManifestEntryLocal('vizJs', '/viz.js')
        })
      });

      it('no manifest', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { vizJs: { type: 'local', files: 'vendor/v?z.js' } },
        };
        testPlan(cfg, expect => {
          expect.addOp({
            type: 'copy',
            from: [src, 'vendor/viz.js'],
            to: [target, 'viz.js']
          });
        });
      });

      it('manifest string', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { vizJs: { type: 'local', files: 'vendor/v?z.js', manifest: 'omgJs' } },
        };
        testPlan(cfg, expect => {
          expect.addOp({
            type: 'copy',
            from: [src, 'vendor/viz.js'],
            to: [target, 'viz.js']
          });
          expect.addManifestEntryLocal('omgJs', '/viz.js')
        });
      });

      it('manifest: true in array = error', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { vizJs: [vizJs] },
        };
        testPlan(cfg, expect => {
          expect.addError('vizJs has {manifest: true} but requires an explicit name or function.')
        });
      });

      it('hashed filename', () => {
        const cfg = {
          src,
          output: { dir: target, name: '[hash].[ext]' },
          assets: { vizJs },
        };
        testPlan(cfg, expect => {
          expect.addOp({
            type: 'copy',
            from: [src, 'vendor/viz.js'],
            to: [target, 'e4e91995e194dd59cafba1c0dad576c6.js']
          });
          expect.addManifestEntryLocal('vizJs', '/e4e91995e194dd59cafba1c0dad576c6.js')
        });
      });

      it('manifest fn', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { svgs },
        };
        testPlan(cfg, expect => {
          addSvgExpectations(expect);
        });
      });

      it('manifest fn and outputPath', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: {
            svgs: Object.assign({ outputPath: 'img' }, svgs)
          },
        };
        testPlan(cfg, expect => {
          for (const i of [1, 2]) {
            const f = `image${i}.svg`;
            expect.addOp({ type: 'copy', from: [src, f], to: [target, 'img/' + f] });
            expect.addManifestEntryLocal(`image${i}Svg`, '/img/' + f)
          }
        });
      });

      it('manifest fn and outputName', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: {
            svgs: Object.assign({ outputName: '[hash].[ext]' }, svgs)
          },
        };
        testPlan(cfg, expect => {
          const hashes = ['03f43b8f2e62bd8d9c3ccb8f9d8f8b26', '88ddfd89852406e3916e28a79407d564'];
          for (const i of [1, 2]) {
            const fi = `image${i}.svg`;
            const fo = `${hashes[i-1]}.svg`;
            expect.addOp({ type: 'copy', from: [src, fi], to: [target, fo] });
            expect.addManifestEntryLocal(`image${i}Svg`, '/' + fo)
          }
        });
      });
    });

    function testManifestRequiredInArray(valueA, valueB, subname, okA, okB) {
      Object.freeze(valueA);
      Object.freeze(valueB);

      it('manifest name from asset name', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { extA: valueA, extB: valueB },
        };
        testPlan(cfg, expect => {
          okA(expect, "extA");
          okB(expect, "extB");
        });
      });

      it('explicit manifest names', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: {
            exts: [
              Object.assign({ manifest: 'extA' }, valueA),
              Object.assign({ manifest: 'extB' }, valueB),
            ],
          },
        };
        testPlan(cfg, expect => {
          okA(expect, "extA");
          okB(expect, "extB");
        });
      });

      it('manifest names required', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { exts: [valueA, valueB] },
        };
        testPlan(cfg, expect => {
          expect.addError(`exts:${subname(valueA)} requires an explicit manifest name because it's in an array.`);
          expect.addError(`exts:${subname(valueB)} requires an explicit manifest name because it's in an array.`);
        });
      });

      it('error if manifest setting not a string', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: {
            extA: Object.assign({ manifest: false }, valueA),
            extB: Object.assign({ manifest: f => f }, valueB),
          },
        };
        testPlan(cfg, expect => {
          expect.addError("extA has an invalid manifest: false");
          expect.addError("extB has an invalid manifest: undefined");
        });
      });
    };

    describe('external', () => {
      const a = { type: 'external', path: 'a.js' };
      const b = { type: 'external', path: '/b.js' };
      const okA = (expect, name) => expect.addManifestEntryLocal(name, '/a.js');
      const okB = (expect, name) => expect.addManifestEntryLocal(name, '/b.js');
      testManifestRequiredInArray(a, b, i => i.path, okA, okB);
    });

    describe('optional', () => {
      it('ignored when not referenced', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: {},
          optional: { vizJs },
        };
        testPlan(cfg, expect => {});
      });
    });

    describe('dependencies', () => {

      [
        ['optional', 'vizJs'],
        ['same optional twice', ['vizJs', 'vizJs']],
      ].map(([testName, assetValue]) => {
        it('main → ' + testName, () => {
          const cfg = {
            src,
            output: { dir: target },
            assets: { omg: assetValue },
            optional: { vizJs },
          };
          testPlan(cfg, expect => {
            expect.addOp({ type: 'copy', from: [src, 'vendor/viz.js'], to: [target, 'viz.js'] });
            expect.addManifestEntryLocal('vizJs', '/viz.js');
          });
        });
      });

      it('cycle: self-reference', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { omg: 'omg' },
        };
        testPlan(cfg, expect => {
          expect.addError('Circular dependency on asset: omg');
        });
      });

      it('cycle: a↔b', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { a: 'b', b: 'a' },
        };
        testPlan(cfg, expect => {
          expect.addError('Circular dependency on asset: a');
        });
      });
    });

    describe('cdn', () => {
      const url = jqueryUrl;

      const test = (def, expectFn) => {
        const cfg = { src, output: { dir: target }, assets: { x: Object.assign({ type: 'cdn' }, def) } };
        testPlan(cfg, expectFn);
      };

      const testOk = (def, out) => test(def, expect => expect.addManifestEntryCdn('x', out));
      const testErr = (def, err) => test(def, expect => expect.addError(err));

      it('integrity specified', () => {
        const integrity = TestData.jqueryCdn.integrity;
        testOk({ url, integrity }, { url, integrity });
      });

      it('integrity from file', () => {
        testOk( //
          { url, integrity: { files: 'image2.svg' } }, //
          { url, integrity: image2SvgSha256 });
      });

      it('integrity from multiple files', () => {
        testOk( //
          { url, integrity: { files: 'image{1,2}.svg' } }, //
          { url, integrity: `${image1SvgSha256} ${image2SvgSha256}` });
      });

      it('integrity with different algorithm', () => {
        testOk( //
          { url, integrity: { files: 'image2.svg', algo: 'sha384' } }, //
          { url, integrity: image2SvgSha384 });
      });

      it('integrity with multiple algorithms', () => {
        testOk( //
          { url, integrity: { files: 'image2.svg', algo: ['sha384', 'sha256'] } }, //
          { url, integrity: `${image2SvgSha384} ${image2SvgSha256}` });
      });

      it('error when no integrity', () => {
        testErr({ url }, 'x missing key: integrity');
      });

      it('error when no url', () => {
        testErr({ integrity: image2SvgSha256 }, 'x missing key: url');
      });

      it('error when no files match', () => {
        testErr( //
          { url, integrity: { files: 'whatever.js' } }, //
          'x integrity file(s) not found: whatever.js');
      });

      const url2 = 'https://unpkg.com/react@15.3.1/dist/react.min.js';
      const a = { type: 'cdn', url: url, integrity: image1SvgSha256 };
      const b = { type: 'cdn', url: url2, integrity: image2SvgSha256 };
      const okA = (expect, name) => expect.addManifestEntryCdn(name, { url: url, integrity: image1SvgSha256 });
      const okB = (expect, name) => expect.addManifestEntryCdn(name, { url: url2, integrity: image2SvgSha256 });
      testManifestRequiredInArray(a, b, i => i.url, okA, okB);
    });

    describe('multi-feature', () => {
      it('example #1', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: {
            a: 'b',
            m: [svgs, 'n', 'j'],
          },
          optional: {
            x: { type: 'external', path: 'x' }, // not referenced
            b: ['c'],
            c: ['d', 'e', 'm'],
            d: [vizJsExplicit, 'e'],
            e: 'f',
            f: { type: 'external', path: 'f' },
            n: [{ type: 'external', path: 'n', manifest: 'n' }],
            j: { type: 'cdn', url: jqueryUrl, integrity: image1SvgSha256 },
          },
        };
        testPlan(cfg, expect => {
          addSvgExpectations(expect);
          expect.addOp({ type: 'copy', from: [src, 'vendor/viz.js'], to: [target, 'viz.js'] });
          expect.addManifestEntryLocal('vizJs', '/viz.js');
          expect.addManifestEntryLocal('f', '/f');
          expect.addManifestEntryLocal('n', '/n');
          expect.addManifestEntryCdn('j', { url: jqueryUrl, integrity: image1SvgSha256 });
        });
        // console.log(Plan.run(cfg));
      });
    });

  });
});
