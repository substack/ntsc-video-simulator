var regl = require('regl')()
var tv = require('../')({ regl })
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
