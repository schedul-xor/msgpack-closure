msgpack-closure
===============

Porting MessagePack javascript library ( https://github.com/msgpack/msgpack-javascript )

[![Build Status](https://travis-ci.org/schedul-xor/msgpack-closure.svg?branch=master)](https://travis-ci.org/schedul-xor/msgpack-closure)

How to build and run
-----------------
Install required node modules and build deps.js.
```
npm install -g npm && npm install
python node_modules/nclosure/third_party/closure-library/closure/bin/build/depswriter.py \
  "--root_with_prefix=src/ ../../../../../../src" \
  "--root_with_prefix=examples/ ../../../../../../examples" \
  "--root_with_prefix=node_modules/nclosure/lib/third_party/node ../../../../lib/third_party/node" 
> deps.js
```

Run example server (deps.js required)

It will start listening port 3000, launch your web browser and set URI to http://localhost:3000/
```
node tasks/serve.js
```

Run unit test.
```
find test | grep '.test.js$' | xargs mocha -R tap
```

Build compressed version.
```
node tasks/build.js buildcfg/config.json mh.min.js
```

TODOs
-----
* Linter
* Generate JSDoc

Thanks
----------
* [Uupaa](https://github.com/uupaa) (developer of the original version)
* [OpenLayers developers](https://github.com/openlayers) (borrowed lots and lots of node scripts they'd developed to make Closure developing easier)
* [Sadayuki Furuhashi](http://msgpack.org/) (designer of MessagePack)
