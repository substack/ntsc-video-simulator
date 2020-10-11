var regl = require('regl')({
  extensions: [
    'oes_texture_float',
    'oes_texture_float_linear',
    'webgl_color_buffer_float'
  ]
})
var tv = require('../index.js')({ regl })

var resl = require('resl')({
  manifest: {
    fbi: {
      type: 'image',
      src: location.search.slice(1),
      //src: 'fbi.png'
      //src: 'tux-bowl.jpg'
    }
  },
  onDone: (assets) => {
    var draw = regl({
      frag: `
        precision highp float;
        varying vec2 vpos;
        uniform float time;
        uniform sampler2D texture;
        void main () {
          vec2 uv = vpos*vec2(1,-1)*0.5+0.5;
          vec3 rgb = texture2D(texture,uv).xyz;
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
      uniforms: {
        time: regl.context('time'),
        texture: regl.texture(assets.fbi)
      }
    })
    //regl.frame(frame)
    frame()
    frame()
    window.addEventListener('resize', frame)
    function frame() {
      regl.poll()
      tv.modulate(() => {
        draw()
      })
      tv.demodulate()
    }
  }
})
