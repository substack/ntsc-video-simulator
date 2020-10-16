# ntsc-video

real-time ntsc television simulator

This module takes care of setting up a pipeline for [glsl-ntsc-video][] modulation and demodulation
with a pipeline of framebuffers (including interlacing) using [regl][].

[glsl-ntsc-video]: https://github.com/substack/glsl-ntsc-video
[regl]: http://regl.party/

# example

``` js
var regl = require('regl')()
var tv = require('../index.js')({ regl })
var draw = regl({
  frag: `
    precision highp float;
    varying vec2 vpos;
    uniform float time;
    void main () {
      vec2 uv = vpos*vec2(1,-1)*0.5+0.5;
      vec3 rgb = mix(
        vec3(0,uv),
        vec3(uv.y,0,uv.x),
        sin(time)*0.5+0.5
      );
      gl_FragColor = vec4(rgb,1);
    }
  `,
  vert: `
    precision highp float;
    attribute vec2 position;
    varying vec2 vpos;
    void main () {
      vpos = position;
      gl_Position = vec4(position,0,1);
    }
  `,
  attributes: { position: [-4,-4,-4,+4,+4,+0] },
  elements: [0,1,2],
  uniforms: { time: regl.context('time') }
})

regl.frame(() => {
  tv.modulate(() => draw())
  tv.demodulate()
})
```

# api

``` 
var TV = require('ntsc-video')
```

# `var tv = TV(opts)

create a new `tv` instance from:

* `opts.regl` (required) - regl instance
* `opts.width` - width of the framebuffer to use for {,de}modulation (height is 525)
* `opts.shadowMask` - proportion of shadow mask to show (1.0: all, 0.0: none) default: 0.1

## `tv.modulate(fn)`

Convert the draw calls in `fn` into a modulated ntsc video signal.

The draw calls are written into an internal framebuffer.

## `tv.demodulate()`

Draw the ntsc video signal stored into an internal framebuffer to the screen as rgb.

## `tv.filter(fn)`

Map over the values from the modulated signal with draw calls in `fn()`.
You will have access to a `sampler2D` uniform named `signal` to sample from and the results are
written out into another internal .

Check out the `example/static.js` file.

# todo

hsync, vsync, colorburst sync

# install

```
npm install ntsc-video
```

# license

bsd
