const
  Assert = require('chai').assert,
  OutputName = require('../src/outputName'),
  Path = require('path'),
  Plan = require('../src/plan'),
  Results = require('../src/results');

const
  vizJs = { type: 'local', files: 'vendor/v?z.js', manifest: true },
  svgs = { type: 'local', files: '*.svg', manifest: f => f.replace(/\.svg$/, 'Svg') },
  src = Path.resolve(__dirname, 'data'),
  target = '/tmp/tool-thingy';

describe('Plan', () => {
  describe('run', () => {

    function assertResults(cfg, addExpectations) {
      const expect = new Results;
      addExpectations(expect);
      Assert.deepEqual(Plan.run(cfg), expect.toObject());
    };

    describe('local', () => {

      it('simple', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { vizJs },
        };
        assertResults(cfg, expect => {
          expect.addOp({
            type: 'copy',
            from: [src, 'vendor/viz.js'],
            to: [target, 'viz.js']
          });
          expect.addManifestEntry('vizJs', '/viz.js')
        })
      });

      it('no manifest', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { vizJs: { type: 'local', files: 'vendor/v?z.js' } },
        };
        assertResults(cfg, expect => {
          expect.addOp({
            type: 'copy',
            from: [src, 'vendor/viz.js'],
            to: [target, 'viz.js']
          });
        });
      });

      it('hashed filename', () => {
        const cfg = {
          src,
          output: { dir: target, name: '[hash].[ext]' },
          assets: { vizJs },
        };
        assertResults(cfg, expect => {
          expect.addOp({
            type: 'copy',
            from: [src, 'vendor/viz.js'],
            to: [target, 'e4e91995e194dd59cafba1c0dad576c6.js']
          });
          expect.addManifestEntry('vizJs', '/e4e91995e194dd59cafba1c0dad576c6.js')
        });
      });

      it('manifest fn', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { svgs },
        };
        assertResults(cfg, expect => {
          for (const i of [1, 2]) {
            const f = `image${i}.svg`;
            expect.addOp({ type: 'copy', from: [src, f], to: [target, f] });
            expect.addManifestEntry(`image${i}Svg`, '/' + f)
          }
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
        assertResults(cfg, expect => {
          for (const i of [1, 2]) {
            const f = `image${i}.svg`;
            expect.addOp({ type: 'copy', from: [src, f], to: [target, 'img/' + f] });
            expect.addManifestEntry(`image${i}Svg`, '/img/' + f)
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
        assertResults(cfg, expect => {
          const hashes = ['03f43b8f2e62bd8d9c3ccb8f9d8f8b26', '88ddfd89852406e3916e28a79407d564'];
          for (const i of [1, 2]) {
            const fi = `image${i}.svg`;
            const fo = `${hashes[i-1]}.svg`;
            expect.addOp({ type: 'copy', from: [src, fi], to: [target, fo] });
            expect.addManifestEntry(`image${i}Svg`, '/' + fo)
          }
        });
      });
    });

    describe('external', () => {
      it('simple', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: {
            extA: { type: 'external', path: 'a.js' },
            extB: { type: 'external', path: '/b.js' },
          },
        };
        assertResults(cfg, expect => {
          expect.addManifestEntry("extA", '/a.js');
          expect.addManifestEntry("extB", '/b.js');
        });
      });

      it('errors if manifest setting provided', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: { extA: { type: 'external', path: 'a.js', manifest: false } },
        };
        assertResults(cfg, expect => {
          expect.addError("extA is of type 'external' but contains a manifest key: false")
        });
      });

    });

    describe('optional', () => {
      it('ignored when not referenced', () => {
        const cfg = {
          src,
          output: { dir: target },
          assets: {},
          optional: { vizJs },
        };
        assertResults(cfg, expect => {});
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
          assertResults(cfg, expect => {
            expect.addOp({ type: 'copy', from: [src, 'vendor/viz.js'], to: [target, 'viz.js'] });
            expect.addManifestEntry('vizJs', '/viz.js');
          });
        });
      });

    });

  });
});